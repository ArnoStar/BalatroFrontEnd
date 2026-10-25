# BalatroFrontEnd (the game) and the whole site: `make` lists the commands.
#
# The game alone:   make install && make assets && make run   (http://localhost:5173/play/)
# The whole site, on this machine (each part from its repository, hot reload):
#                   make dev                                   (http://localhost:5174)
# The whole site in Docker, configured by .env (see .env.example):
#                   make up                                    (http://localhost:8087)
.DEFAULT_GOAL := help
.PHONY: help install assets run check build dev up down logs ps restart config admin

COMPOSE := docker compose

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

# ---------------------------------------------------------------- the game
install: ## dependencies (npm install)
	npm install

assets: ## the game's textures, sounds, shaders, font and data, from ../balatro_src (npm run assets)
	npm run assets

run: ## the game's dev server, http://localhost:5173/play/ (npm run dev)
	npm run dev

check: ## typecheck and Steiger (npm run check)
	npm run check

build: ## the production build in dist/ (npm run build)
	npm run build

# ---------------------------------------------------------------- the whole site
admin: ## make an account an admin (it asks for the email; EMAIL=... to give it)
	@./scripts/make-admin.sh $(EMAIL)

dev: ## everything locally with hot reload; MAIL=1: emails to Mailpit; AUTH=0: no sign-in
	./scripts/dev-all.sh

up: ## everything in Docker (built from the repositories next to this one), with .env
	$(COMPOSE) up -d --build --wait
	@echo "open http://localhost:$$($(COMPOSE) port portal 80 | cut -d: -f2)"

down: ## stop the Docker services (the data stays in the volumes)
	$(COMPOSE) --profile mail stop

logs: ## follow the Docker services' logs (s=identity for one)
	$(COMPOSE) logs -f --tail 50 $(s)

ps: ## the Docker services and their health
	$(COMPOSE) --profile mail ps

restart: ## rebuild and restart one Docker service: make restart s=identity
	$(COMPOSE) up -d --build --wait $(s)

config: ## the compose file with .env applied (to check the settings)
	$(COMPOSE) config
