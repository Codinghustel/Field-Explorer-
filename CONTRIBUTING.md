# Contributing to Field Explorer for Bitrix24

Thank you for considering contributing to Field Explorer! We welcome bug fixes, documentation improvements, UI enhancements, and new feature requests.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher
- `npm` v10 or higher
- [Docker](https://www.docker.com/) (optional, for container builds)

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/Codinghustel/Field-Explorer-.git
   cd Field-Explorer-
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

4. **Preview standalone mode:**
   Open `http://localhost:5173/?preview=1` in your browser to test the UI with mock schema data without needing an active Bitrix24 portal connection.

## Development Workflow

Before submitting a Pull Request, ensure all quality checks pass:

```bash
# Run unit tests
npm test

# Build for production and verify TypeScript types
npm run build

# Check for production dependency vulnerabilities
npm audit --omit=dev
```

## Project Structure

```text
Field-Explorer-/
├── .github/              # GitHub Actions workflows and issue templates
├── docs/                 # Documentation (Architecture, Installation, Deployment, Troubleshooting)
├── src/
│   ├── assets/           # Global styles and Bitrix24 UI theme overrides
│   ├── lib/              # Core utility logic (CSV export, field normalization)
│   ├── services/         # Bitrix24 JS SDK wrappers and REST API adapters
│   ├── App.vue           # Main application shell
│   ├── main.ts           # Vue application entrypoint
│   └── types.ts          # TypeScript domain interfaces
├── Dockerfile            # Multi-stage production container build
├── nginx.conf            # Hardened Nginx configuration with CSP
└── vite.config.ts        # Vite + Bitrix24 UI plugin configuration
```

## Pull Request Guidelines

1. **Branch Naming:** Use clear branch names like `feature/smart-process-filters` or `fix/csv-encoding`.
2. **Commit Messages:** Keep commit messages concise and descriptive in active voice (e.g. `Fix header layout on mobile viewports`).
3. **Tests:** Include unit tests for any new normalization, parsing, or export logic in `src/lib/*.test.ts` or `src/services/*.test.ts`.
4. **No Secrets:** Never commit Bitrix24 credentials, tokens, or environment keys.
