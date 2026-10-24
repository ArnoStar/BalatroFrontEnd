# syntax=docker/dockerfile:1
# The front end in a container: nginx serves the built app and passes /api/ to
# the API (API_UPSTREAM, http://api:8000 by default, as in docker compose).
#
# The game's own files (textures, sounds, shaders, data, font) are not in this
# repository: the build reads them from a copy of the game, given as the build
# context "game".
#
#   docker build --network host --build-context game=../balatro_src -t balatro-frontend .
#   docker run -p 8080:80 -e API_UPSTREAM=http://<api host>:8000 balatro-frontend
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
RUN npm run build

FROM nginx:1.28-alpine
ENV API_UPSTREAM=http://api:8000
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
