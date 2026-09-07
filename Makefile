.PHONY: help setup dev kill-port build build-core build-renderer package publish publish-rc publish-dry clean clean-dist test test-e2e test-e2e-ui test-e2e-headed test-e2e-install lint preview check-version update-deps install-dev image-build image-run image-stop image-clean

# Per-developer overrides (container runner, image name, port). Optional: the
# leading `-` means it's fine if the file is absent. Defaults below apply when a
# value isn't set, so `image-*` works out of the box. Copy or edit .makefile.env
# to switch the runner (e.g. DOCKER_RUNNER = docker).
-include .makefile.env
DOCKER_RUNNER  ?= podman
IMAGE_NAME     ?= registry.km8.es/web-dropzone-examples:prod
CONTAINER_NAME ?= web-dropzone-examples
IMAGE_PORT     ?= 12310

help: ## Show this help message
	@echo "Available targets:"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

setup: ## Install dependencies (root + workspaces)
	@echo "Installing dependencies..."
	npm install
	@echo "Setup complete"

dev: ## Start development server with hot reload
	@echo "Starting development server..."
	npm run dev

# Free the vite dev-server ports. Vite starts at 12200 and hops to the next free
# port when one is busy, so a stale run can hold any of 12200-12205. Kills whatever
# is LISTENING on those ports, covering both IPv4 and IPv6 (vite binds [::1] too).
# Recipes default to Git Bash (sh), so this is written in sh and calls the Windows
# netstat/taskkill directly rather than switching this target's SHELL to cmd.exe
# (a target-specific SHELL leaks and breaks the grep/awk-based help target).
kill-port: ## Free the vite dev-server ports (12200-12205)
	@echo "Freeing ports 12200-12205..."
ifeq ($(OS),Windows_NT)
	-@netstat -ano | grep -E ':1220[0-5][^0-9]' | grep LISTENING | awk '{print $$5}' | sort -u | while read pid; do MSYS_NO_PATHCONV=1 taskkill /F /PID $$pid; done
else
	-@for p in 12200 12201 12202 12203 12204 12205; do lsof -ti tcp:$$p | xargs -r kill -9; done
endif
	@echo "Ports 12200-12205 are free"

build: ## Build all packages (workspaces)
	@echo "Building all packages..."
	npm run build
	@echo "Build complete - see packages/*/dist/"

build-core: ## Build only @keenmate/web-dropzone-core
	@echo "Building @keenmate/web-dropzone-core..."
	npm run build:core
	@echo "Build complete - see packages/web-dropzone-core/dist/"

build-renderer: ## Build only @keenmate/web-dropzone
	@echo "Building @keenmate/web-dropzone..."
	npm run build:renderer
	@echo "Build complete - see packages/web-dropzone/dist/"

package: build ## Pack both packages (creates .tgz tarballs in each package dir)
	@echo "Packing @keenmate/web-dropzone-core..."
	npm pack -w @keenmate/web-dropzone-core
	@echo "Packing @keenmate/web-dropzone..."
	npm pack -w @keenmate/web-dropzone
	@echo "Packages created - see packages/*/keenmate-*.tgz"

publish-dry: build ## Dry-run publish for both packages
	@echo "Dry-run publish: @keenmate/web-dropzone-core"
	npm publish --dry-run -w @keenmate/web-dropzone-core
	@echo ""
	@echo "Dry-run publish: @keenmate/web-dropzone"
	npm publish --dry-run -w @keenmate/web-dropzone
	@echo ""
	@echo "Dry-runs complete - review both tarballs above"

publish: build ## Publish BOTH packages to npm as 'latest' (core first, then renderer) - use for release/patch/minor/major
	@echo "WARNING: This will publish BOTH packages to npm registry as the 'latest' dist-tag"
	@echo "  1. @keenmate/web-dropzone-core"
	@echo "  2. @keenmate/web-dropzone"
	@echo "Use 'make publish-rc' instead if you're shipping a pre-release version."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@powershell -Command "Read-Host | Out-Null"
	@echo "Publishing @keenmate/web-dropzone-core..."
	npm publish -w @keenmate/web-dropzone-core
	@echo "Publishing @keenmate/web-dropzone..."
	npm publish -w @keenmate/web-dropzone
	@echo "Both packages published successfully"

publish-rc: build ## Publish BOTH packages under the 'rc' dist-tag (core first, then renderer) - does NOT touch 'latest'
	@echo "WARNING: This will publish BOTH packages to npm registry under the 'rc' dist-tag"
	@echo "  1. @keenmate/web-dropzone-core"
	@echo "  2. @keenmate/web-dropzone"
	@echo "The 'latest' tag will be untouched - consumers must opt in with @rc or @<version>."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@powershell -Command "Read-Host | Out-Null"
	@echo "Publishing @keenmate/web-dropzone-core under 'rc' tag..."
	npm publish --tag rc -w @keenmate/web-dropzone-core
	@echo "Publishing @keenmate/web-dropzone under 'rc' tag..."
	npm publish --tag rc -w @keenmate/web-dropzone
	@echo "Both packages published successfully under 'rc' tag"

clean: ## Clean build artifacts in all packages
	@echo "Cleaning build artifacts..."
	npm run clean
	@echo "Clean complete"

clean-dist: ## Clean only dist folders in both packages
	@echo "Cleaning dist folders..."
	npm run clean -w @keenmate/web-dropzone-core
	npm run clean -w @keenmate/web-dropzone
	@echo "Dist cleaned"

preview: build ## Preview production build
	@echo "Starting preview server..."
	npm run preview

lint: ## Run linter (if configured)
	@echo "Linting is not configured yet"
	@echo "Consider adding ESLint in the future"

test: test-e2e ## Run all tests (currently just e2e)

test-e2e: ## Run Playwright e2e tests (headless)
	npm run test:e2e

test-e2e-ui: ## Run Playwright e2e tests in UI mode
	npm run test:e2e:ui

test-e2e-headed: ## Run Playwright e2e tests headed (watch the browser)
	npm run test:e2e:headed

test-e2e-install: ## Install chromium browser binary (one-time)
	npm run test:e2e:install

check-version: ## Show current package versions
	@echo "@keenmate/web-dropzone-core:"
	@node -p "require('./packages/web-dropzone-core/package.json').version"
	@echo "@keenmate/web-dropzone:"
	@node -p "require('./packages/web-dropzone/package.json').version"

update-deps: ## Update dependencies (root + workspaces)
	@echo "Updating dependencies..."
	npm update
	@echo "Dependencies updated"

install-dev: package ## Pack both and print install snippets for local testing
	@echo "You can install these locally with:"
	@echo "  npm install <path>/packages/web-dropzone-core/keenmate-web-dropzone-core-<v>.tgz"
	@echo "  npm install <path>/packages/web-dropzone/keenmate-web-dropzone-<v>.tgz"

# ── Container image (examples site) ──────────────────────────────────────────
# Two-stage build (Dockerfile): Vite compiles the examples to static files,
# nginx serves them. Runner is configurable via .makefile.env (DOCKER_RUNNER);
# defaults to podman.

image-build: ## Build the examples container image (build + serve stages)
	@echo "Building $(IMAGE_NAME) with $(DOCKER_RUNNER)..."
	$(DOCKER_RUNNER) build -t $(IMAGE_NAME) .
	@echo "Image built: $(IMAGE_NAME)"

image-run: ## Run the examples image (serves on IMAGE_PORT, default 12310)
	@echo "Starting $(CONTAINER_NAME) on http://localhost:$(IMAGE_PORT) ..."
	-@$(DOCKER_RUNNER) rm -f $(CONTAINER_NAME) >/dev/null 2>&1
	$(DOCKER_RUNNER) run -d --name $(CONTAINER_NAME) -p $(IMAGE_PORT):80 $(IMAGE_NAME)
	@echo "Serving examples at http://localhost:$(IMAGE_PORT)"

image-stop: ## Stop and remove the examples container
	@echo "Stopping $(CONTAINER_NAME)..."
	-@$(DOCKER_RUNNER) rm -f $(CONTAINER_NAME) >/dev/null 2>&1
	@echo "Stopped"

image-clean: image-stop ## Remove the examples container and image
	@echo "Removing image $(IMAGE_NAME)..."
	-@$(DOCKER_RUNNER) rmi $(IMAGE_NAME) >/dev/null 2>&1
	@echo "Image removed"

# Default target
.DEFAULT_GOAL := help
