# Arlo — Chrome side panel extension
#
# A thin wrapper over the npm scripts, plus the dependency tracking npm does not
# do: targets rebuild only when their inputs actually change. Run `make` for the
# list of targets.
#
# Written for GNU Make 3.81 (macOS default) and up.

SHELL := /bin/bash
NPM ?= npm
NODE_MAJOR_REQUIRED := 24

VERSION := $(shell node -p "require('./package.json').version" 2>/dev/null || echo unknown)
ZIP := release/arlo-extension-$(VERSION).zip

# Anything that ends up in the build, so `make build` is a no-op when nothing changed.
SOURCES := $(shell find src public -type f 2>/dev/null) \
           vite.config.ts scripts/build.mjs package.json

.DEFAULT_GOAL := help

# ---------------------------------------------------------------- setup

.PHONY: help
help: ## Show this help
	@echo "Arlo $(VERSION) — make targets"
	@echo
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo

.PHONY: check-node
check-node: ## Fail early if the active Node is older than the pinned major
	@major=$$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0); \
	if [ "$$major" -lt "$(NODE_MAJOR_REQUIRED)" ]; then \
	  echo "Node $(NODE_MAJOR_REQUIRED) or newer is required (found $$(node -v 2>/dev/null || echo 'no node'))."; \
	  echo "Run 'nvm use' or 'fnm use' — the version is pinned in .nvmrc."; \
	  exit 1; \
	fi

# Reinstalls only when the lockfile or manifest moves. The touch keeps the
# directory newer than its prerequisites so this does not re-run every time.
node_modules: package-lock.json package.json
	@$(MAKE) --no-print-directory check-node
	$(NPM) ci
	@touch node_modules

.PHONY: install
install: node_modules ## Install dependencies

# ---------------------------------------------------------------- build

dist: node_modules $(SOURCES)
	$(NPM) run build
	@touch dist

.PHONY: build
build: dist ## Build the extension into dist/
	@echo "Load the unpacked extension from ./dist (chrome://extensions → Load unpacked)"

.PHONY: dev
dev: node_modules ## Rebuild on change
	$(NPM) run dev

$(ZIP): dist
	node scripts/package.mjs

.PHONY: package
package: $(ZIP) ## Zip dist/ into release/ for the Web Store

.PHONY: icons
icons: ## Regenerate the placeholder icons in public/icons/
	node scripts/gen-icons.mjs

# ---------------------------------------------------------------- checks

.PHONY: test
test: node_modules ## Run the tests once
	$(NPM) test

.PHONY: watch
watch: node_modules ## Run the tests in watch mode
	$(NPM) run test:watch

.PHONY: coverage
coverage: node_modules ## Run the tests with coverage thresholds
	$(NPM) run test:coverage

.PHONY: lint
lint: node_modules ## Lint
	$(NPM) run lint

.PHONY: fix
fix: node_modules ## Lint with --fix, then format
	$(NPM) run lint:fix
	$(NPM) run format

.PHONY: format
format: node_modules ## Format with Prettier
	$(NPM) run format

.PHONY: typecheck
typecheck: node_modules ## Typecheck without emitting
	$(NPM) run typecheck

.PHONY: verify
verify: node_modules ## Everything CI runs, in the same order
	$(NPM) run verify

# ---------------------------------------------------------------- release

.PHONY: release
release: verify package ## Verify, then package a release zip
	@echo
	@echo "Built $(ZIP)"
	@echo "To publish it, tag the version you just built:"
	@echo "    git tag v$(VERSION) && git push origin v$(VERSION)"
	@echo "The release workflow checks the tag against package.json before it runs."

# ---------------------------------------------------------------- cleaning

.PHONY: clean
clean: ## Remove build output, packages and coverage
	rm -rf dist release coverage

.PHONY: distclean
distclean: clean ## Also remove node_modules
	rm -rf node_modules
