.DEFAULT_GOAL := help

.PHONY: help install dev build test typecheck start clean

help:
	@echo "SignConnect"
	@echo "  make install     Install npm dependencies"
	@echo "  make dev         Run the client and API in development"
	@echo "  make build       Build the client and the API"
	@echo "  make test        Run the automated checks"
	@echo "  make typecheck   Typecheck the client and the API"
	@echo "  make start       Build, then serve the site and /api on one port"
	@echo "  make clean       Remove build output and the local database"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck

start: build
	npm run start -w server

clean:
	rm -rf client/dist server/dist server/data
