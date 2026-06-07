CODE_PATH=$(CURDIR)/copy-last

.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install install-frozen
install: ## install project dependencies
	cd $(CODE_PATH) && pnpm install

install-frozen: ## install dependencies from lockfile
	cd $(CODE_PATH) && pnpm install --frozen-lockfile

.PHONY: clean build
clean: ## clean build artifacts
	cd $(CODE_PATH) && pnpm clean

build: ## compile the project
	cd $(CODE_PATH) && pnpm run build

.PHONY: lint typecheck test test-watch check ci
lint: ## run eslint
	cd $(CODE_PATH) && pnpm run lint

typecheck: ## run TypeScript type checking
	cd $(CODE_PATH) && pnpm run typecheck

test: ## run unit tests
	cd $(CODE_PATH) && pnpm run test

test-watch: ## run tests in watch mode
	cd $(CODE_PATH) && pnpm run test:watch

check: ## run all quality checks
	cd $(CODE_PATH) && pnpm run check

ci: install-frozen check ## install from lockfile and run all checks

.PHONY: package pack-dry-run publish-npm
package: ## create npm package tarball
	cd $(CODE_PATH) && pnpm run package

pack-dry-run: ## preview npm package contents without publishing
	cd $(CODE_PATH) && pnpm run pack:dry-run

publish-npm: ## publish package to npm
	cd $(CODE_PATH) && pnpm run publish:npm
