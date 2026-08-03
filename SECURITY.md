# Security Policy

## Overview

Field Explorer for Bitrix24 is designed as a client-side, zero-telemetry schema inspector. It runs inside the Bitrix24 authorized iframe context and executes REST calls entirely in the user's browser via the official Bitrix24 JS SDK.

### Security Architecture & Principles

1. **Zero External Storage / Zero Data Egress**
   - The application does not maintain an external database or store CRM field values, tokens, or tenant metadata.
   - All REST API calls flow directly between the user's browser and the Bitrix24 API endpoints (`*.bitrix24.com`, `*.bitrix24.eu`, etc.).

2. **Framing & Content Security Policy (CSP)**
   - Nginx enforces strict CSP headers (`frame-ancestors`) limiting iframe embedding to authorized Bitrix24 portal domains.
   - Restrictive headers are enforced: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.

3. **Spreadsheet Formula Injection Defense**
   - CSV export automatically quotes all cells and sanitizes formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with a leading single quote (`'`) to prevent CSV/Excel Formula Injection attacks when exported files are opened in Microsoft Excel or Google Sheets.

4. **XSS & DOM Sanitization**
   - Field names, labels, codes, and values are safely interpolated via Vue's template binding syntax (HTML-escaped by default). No unescaped `v-html` or direct `innerHTML` injection is used.

5. **Token Management**
   - No `client_secret`, access tokens, or refresh tokens are transmitted or logged. Authentication relies exclusively on the Bitrix24 JavaScript SDK runtime session provided inside the Bitrix24 iframe.

---

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| `1.x`   | :white_check_mark: |
| `< 1.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Field Explorer for Bitrix24, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities.
2. Email security reports directly to the maintainers or use private vulnerability reporting on GitHub.
3. Include detailed steps to reproduce the vulnerability, along with any relevant payload or request logs.

### Response Timeline

- **Acknowledgement:** Within 48 hours.
- **Triage & Assessment:** Within 5 business days.
- **Fix Release:** Vulnerabilities will be patched in `main` as a priority.
