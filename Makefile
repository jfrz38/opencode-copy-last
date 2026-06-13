.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install install-frozen
install: ## install project dependencies
	pnpm install

install-frozen: ## install dependencies from lockfile
	pnpm install --frozen-lockfile

.PHONY: clean build
clean: ## clean build artifacts
	pnpm clean

build: ## compile the project
	pnpm run build

.PHONY: lint typecheck test test-watch check ci
lint: ## run eslint
	pnpm run lint

typecheck: ## run TypeScript type checking
	pnpm run typecheck

test: ## run unit tests
	pnpm run test

test-watch: ## run tests in watch mode
	pnpm run test:watch

check: ## run architecture and package quality checks
	pnpm exec clean-arch check ./src && pnpm run check

ci: install-frozen check ## install from lockfile and run all checks

.PHONY: package pack-dry-run publish-npm
package: ## create npm package tarball
	pnpm run package

pack-dry-run: ## preview npm package contents without publishing
	pnpm run pack:dry-run

publish-npm: ## publish package to npm
	pnpm run publish:npm
