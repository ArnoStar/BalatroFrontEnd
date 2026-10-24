# syntax=docker/dockerfile:1
# The game in a container: nginx serves the built app at /play/ and passes
# /api/ to the API (API_UPSTREAM, http://api:8000 by default, as in docker
# compose). In the full stack the portal (BalatroPortal) is in front of it.
#
# The game's own files (textures, sounds, shaders, data, font) are not in this
# repository: the build reads them from a copy of the game, given as the build
# context "game".
#
#   docker build --network host --build-context game=../balatro_src -t balatro-frontend .
#   docker run -p 8080:80 -e API_UPSTREAM=http://<api host>:8000 balatro-frontend
#   (outside a compose network, a host name also needs API_RESOLVER, a DNS server)
#
# (--network host: the build downloads through this machine's connection, which
# also works behind a VPN whose MTU is smaller than Docker's bridge.)

FROM node:22-trixie-slim AS build
# LuaJIT extracts the game's data, LÖVE renders its font (scripts/copy-assets.mjs)
# without a screen (SDL's offscreen driver on Mesa's software OpenGL). The slim
# image drops man pages, but love's install script needs its own.
RUN echo 'path-include /usr/share/man/man6/love*' > /etc/dpkg/dpkg.cfg.d/zz-love \
 && mkdir -p /usr/share/man/man6 \
 && apt-get update \
 && apt-get install -y --no-install-recommends luajit love libgl1 libgles2 libegl1 libegl-mesa0 libgl1-mesa-dri \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN --mount=from=game,target=/game BALATRO_SRC=/game npm run assets
# an API on another origin (the default is /api on the page's own)
ARG VITE_API_URL=""
# the identity service and the portal elsewhere (the default: /identity and / on the page's origin)
ARG VITE_IDENTITY_URL=""
ARG VITE_PORTAL_URL=""
RUN npm run build

FROM nginx:1.28-alpine
# API_UPSTREAM: where /api/ goes, an API's base URL, with or without a path.
# API_RESOLVER: the DNS that finds its host (Docker's, on a compose network)
ENV API_UPSTREAM=http://api:8000 \
    API_RESOLVER=127.0.0.11
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/api-upstream.envsh /docker-entrypoint.d/16-api-upstream.envsh
COPY --from=build /app/dist /usr/share/nginx/html/play
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/play/"]
