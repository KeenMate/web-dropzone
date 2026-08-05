.PHONY: help setup dev build build-core build-renderer package publish publish-rc publish-dry clean clean-dist test test-e2e test-e2e-ui test-e2e-headed test-e2e-install lint preview check-version update-deps install-dev

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

setup: ## Install dependencies (root + workspaces)
	@echo "Installing dependencies..."
	npm install
	@echo "Setup complete"

dev: ## Start development server with hot reload
	@echo "Starting development server..."
	npm run dev

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

# Default target
.DEFAULT_GOAL := help
