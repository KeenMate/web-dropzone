# Build Instructions

This document explains how to build and develop the multiselect web component.

## Quick Start

### Option 1: Using Makefile (Linux/Mac/WSL/Git Bash)

```bash
# Install dependencies
make setup

# Start development server (watches for changes)
make dev

# Build for production
make build

# Create npm package
make package

# Publish (dry-run)
make publish-dry

# Publish to npm
make publish

# See all available commands
make help
```

### Option 2: Using Batch Script (Windows CMD/PowerShell)

```cmd
REM Install dependencies
make.bat setup

REM Start development server
make.bat dev

REM Build for production
make.bat build

REM Create npm package
make.bat package

REM Publish (dry-run)
make.bat publish-dry

REM Publish to npm
make.bat publish

REM See all available commands
make.bat help
```

### Option 3: Using npm scripts directly

```bash
# Install dependencies
npm install

# Start development server (watches for changes)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Create npm package
npm run package

# Publish (dry-run)
npm run publish:dry

# Publish to npm
npm publish

# Clean build artifacts
npm run clean
```

## Development Workflow

### 1. Initial Setup

```bash
make setup
# or
npm install
```

This installs all dependencies including TypeScript, Vite, Sass, and Floating UI.

### 2. Development

```bash
make dev
# or
npm run dev
```

This starts the Vite development server with:
- Hot Module Replacement (HMR)
- Fast refresh on file changes
- Available at http://localhost:5173

Open `index.html` in your browser to test your changes in real-time.

### 3. Building

```bash
make build
# or
npm run build
```

This:
1. Compiles TypeScript to JavaScript
2. Bundles the code with Vite
3. Processes SCSS to CSS
4. Creates two output formats:
   - `dist/multiselect.js` (ES module)
   - `dist/multiselect.umd.js` (UMD format)
5. Generates `dist/style.css`

### 4. Testing Locally

Create a package and test it in another project:

```bash
# Create package tarball
make package

# In another project, install it
npm install /path/to/keenmate-web-multiselect-1.0.0-rc01.tgz
```

### 5. Publishing

Before publishing, update the version in `package.json`:

```json
{
  "version": "1.0.0"  // Change this
}
```

Then:

```bash
# Dry-run to see what would be published
make publish-dry

# Actually publish (requires npm login)
make publish
```

## Project Structure

```
web-multiselect/
├── src/
│   ├── index.ts              # Entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── multiselect.ts        # Core multiselect class
│   ├── web-component.ts      # Web component wrapper
│   ├── vite-env.d.ts         # Vite type declarations
│   └── scss/
│       └── _multiselect.scss # Styles
├── dist/                      # Build output (gitignored)
│   ├── multiselect.js        # ES module
│   ├── multiselect.umd.js    # UMD format
│   └── style.css             # Compiled CSS
├── index.html                # Demo page
├── package.json              # Package configuration
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── Makefile                  # Build automation (Unix)
├── make.bat                  # Build automation (Windows)
├── .gitignore
├── README.md                 # User documentation
└── BUILD.md                  # This file
```

## Build Output

After running `make build`, the `dist/` folder contains:

```
dist/
├── multiselect.js           # ES module (modern bundlers)
├── multiselect.umd.js       # UMD format (legacy/CDN)
└── style.css                # Compiled SCSS styles
```

## Code Organization

### Core Class (multiselect.ts)
The `WebMultiSelect` class contains all the logic:
- Option management
- Search/filtering
- Keyboard navigation
- Dropdown positioning
- Event handling

This can be used directly without the web component wrapper.

### Web Component (web-component.ts)
The `MultiSelectElement` class wraps the core class in a custom element:
- Shadow DOM encapsulation
- Attribute observation
- Property setters
- Event dispatching

### Types (types.ts)
TypeScript interfaces for:
- `MultiSelectOption` - Option structure
- `MultiSelectOptions` - Configuration options
- `MultiSelectEventDetail` - Event payload
- Display modes and enums

### Styles (scss/_multiselect.scss)
SCSS styles with:
- BEM naming convention
- CSS custom properties for theming (future)
- Responsive design
- Animations

## Development Tips

### Hot Reload
The dev server automatically reloads when you save changes. Modify files in `src/` and see instant updates in the browser.

### Debugging
Enable debug logging in `multiselect.ts`:
```typescript
const LOG_ENABLED = true; // Set to false to disable logs
```

### Testing Changes
1. Make changes to source files
2. Save and check the browser (dev server auto-reloads)
3. Build and test the production bundle
4. Create a package and test in another project

## Troubleshooting

### Make command not found (Windows)

Use `make.bat` instead:
```cmd
make.bat dev
```

Or use npm scripts:
```bash
npm run dev
```

### TypeScript errors

Make sure you've run `make setup` or `npm install` first.

### Port already in use

If port 5173 is in use, Vite will automatically try the next available port. Check the console output for the actual URL.

### Build fails

1. Clean the dist folder: `make clean-dist`
2. Delete node_modules: `make clean`
3. Reinstall: `make setup`
4. Try building again: `make build`

### Styles not updating

If SCSS changes don't appear:
1. Stop the dev server (Ctrl+C)
2. Clean dist: `make clean-dist`
3. Restart: `make dev`

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: make setup
      - run: make build
      - run: make package
```

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Breaking changes
- **MINOR** version: New features (backward compatible)
- **PATCH** version: Bug fixes

Update version before publishing:
```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

Then:
```bash
make publish
```

## Code Style

- Use TypeScript for type safety
- Follow existing patterns and conventions
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Use meaningful variable names
- Add comments for complex logic

## Dependencies

### Production
- `@floating-ui/dom` - Dropdown positioning

### Development
- `typescript` - TypeScript compiler
- `vite` - Build tool and dev server
- `sass` - SCSS compiler
- `rimraf` - Cross-platform file deletion

## Performance Considerations

- The component uses Shadow DOM for style encapsulation
- Floating UI provides efficient positioning calculations
- Keyboard navigation is debounced
- Search filtering is optimized for large datasets
- Virtual scrolling could be added for very large option lists (future enhancement)
