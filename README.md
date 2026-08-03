# Field Explorer for Bitrix24

[![Build Status](https://github.com/Codinghustel/Field-Explorer-/actions/workflows/ci.yml/badge.svg)](https://github.com/Codinghustel/Field-Explorer-/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4fc08d.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![Bitrix24 UI](https://img.shields.io/badge/Bitrix24-UI%202.9-2fc6f6.svg)](https://bitrix24.github.io/b24ui/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](Dockerfile)

A professional, read-only **CRM Schema & Field Explorer** application for **Bitrix24**. Designed for Bitrix24 developers, integrators, and CRM administrators to discover, inspect, copy, and export field definitions, technical API codes (`UF_CRM_*`), data types, and attribute settings across all Bitrix24 CRM entities, Smart Processes, Catalogs, and Inventory Management modules.

---

## 🚀 Live Production Instance

- **App URL:** [`https://field-explorer.premierchoiceint.online/`](https://field-explorer.premierchoiceint.online/)
- **Bitrix24 Portal:** `https://pcicrm.bitrix24.com/`
- **PaaS / Dokploy:** `https://paas.usmankhan.xyz/`

---

## ✨ Key Capabilities

- **Complete Schema Exploration:** Instantly retrieve the entire field dictionary (both System and Custom fields) without needing to look up a specific record ID.
- **Universal CRM Coverage:** Supports Deals, Contacts, Companies, Leads, and all custom Smart Processes (SPA) via the universal Bitrix24 `crm.item.fields` REST API.
- **CRM Activities & Catalog:** Inspect CRM Activity fields, Product Catalog items (Simple Products, Parent Products, Variation SKUs/Offers), Warehouses/Stores, and Inventory Documents.
- **Native Bitrix24 Look & Feel:** Built with `@bitrix24/b24ui-nuxt` and official Bitrix24 icons, blending seamlessly into the Bitrix24 portal UI.
- **Developer-Friendly Tools:**
  - One-click copying of technical REST field codes (e.g. `UF_CRM_1723456789`).
  - Search fields by label, code, data type, or source.
  - Filter by Custom vs. System fields or specific data types.
  - Detail modal showing raw REST names, immutability, required flags, and field configuration JSON.
- **Spreadsheet-Safe CSV Export:** One-click UTF-8 CSV export with Excel BOM support, cell quoting, and formula-injection defenses (`=`, `+`, `-`, `@` triggers neutralized).
- **Embedded & Standalone Views:** Runs inside CRM record detail tabs, Activity timeline menus, or directly from the Bitrix24 Application Launcher.
- **Zero Data Egress:** 100% client-side execution using the Bitrix24 JS SDK. No CRM record data or access tokens are sent to external databases or third-party servers.

---

## 📊 Supported Bitrix24 Modules & Entities

| Group | Entity | Source / API Method | Placement Tab Supported |
| ----- | ------ | ------------------- | ----------------------- |
| **CRM** | Deal | `crm.item.fields` (`entityTypeId: 2`) | `CRM_DEAL_DETAIL_TAB` |
| **CRM** | Contact | `crm.item.fields` (`entityTypeId: 3`) | `CRM_CONTACT_DETAIL_TAB` |
| **CRM** | Company | `crm.item.fields` (`entityTypeId: 4`) | `CRM_COMPANY_DETAIL_TAB` |
| **CRM** | Lead | `crm.item.fields` (`entityTypeId: 1`) | `CRM_LEAD_DETAIL_TAB` |
| **CRM** | Smart Processes (SPA) | `crm.item.fields` (`entityTypeId: N`) | `CRM_DYNAMIC_N_DETAIL_TAB` |
| **CRM** | Activity | `crm.activity.fields` | `CRM_ACTIVITY_LIST_MENU` / Timelines |
| **Catalog** | Simple Product | `catalog.product.getFieldsByFilter` | App Launcher |
| **Catalog** | Product with Variations | `catalog.product.sku.getFieldsByFilter` | App Launcher |
| **Catalog** | Variation / Offer | `catalog.product.offer.getFieldsByFilter` | App Launcher |
| **Inventory** | Warehouse / Store | `catalog.store.getFields` | App Launcher |
| **Inventory** | Inventory Document | `catalog.document.getFields` | App Launcher |

---

## 🛠️ Stack & Architecture

- **Frontend:** [Vue 3](https://vuejs.org/) (Composition API), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI Framework:** [`@bitrix24/b24ui-nuxt`](https://bitrix24.github.io/b24ui/), [`@bitrix24/b24icons-vue`](https://bitrix24.github.io/b24icons/), [Tailwind CSS v4](https://tailwindcss.com/)
- **SDK:** Official Bitrix24 Browser JavaScript SDK (`api.bitrix24.com/api/v1/`)
- **Server / Web:** Nginx 1.28 on Alpine Linux with Content Security Policy (CSP) & health checks
- **Testing:** [Vitest](https://vitest.dev/), Vue Test Utils
- **Containerization:** Multi-stage Docker build

---

## 📚 Documentation Map

Detailed setup, deployment, and architecture guides are available in the [`docs/`](docs/) directory:

| Guide | Description |
| ----- | ----------- |
| 📖 [**Bitrix24 Installation Guide**](docs/bitrix-installation.md) | How to configure Local Applications and placements in Bitrix24 |
| 🚀 [**Dokploy Deployment Guide**](docs/dokploy-deployment.md) | Host deployment, Traefik domain routing, and Cloudflare SSL modes |
| 📐 [**Architecture Overview**](docs/architecture.md) | Client-side execution model, security boundaries, and data flow |
| 🔧 [**Troubleshooting Guide**](docs/troubleshooting.md) | Solutions for CSP errors, iframe sizing, scope permissions, and SSL loops |

---

## ⚡ Quick Start & Installation in Bitrix24

To connect Field Explorer to your Bitrix24 portal:

1. Log into your Bitrix24 portal as an **Administrator**.
2. Navigate to **Applications > Developer resources > Other > Local application**.
3. Select **Client-side / JavaScript SDK**.
4. Set the URLs to:
   - **Application URL:** `https://field-explorer.premierchoiceint.online/`
   - **Initial installation URL:** `https://field-explorer.premierchoiceint.online/`
5. Select the required permissions (scopes):
   - `crm` (CRM & Activities)
   - `catalog` (Product Catalog & Inventory)
   - `placement` (App Embedding)
6. Click **Save**.
7. Open Field Explorer from your Bitrix24 left navigation menu and click **Set up CRM tabs** to register placement detail tabs.

For step-by-step instructions, see the [Bitrix24 Installation Guide](docs/bitrix-installation.md).

---

## 💻 Local Development

### Installation

```bash
# Clone repository
git clone https://github.com/Codinghustel/Field-Explorer-.git
cd Field-Explorer-

# Install dependencies
npm install

# Start development server
npm run dev
```

### Previewing the UI Outside Bitrix24

Because the Bitrix24 SDK requires an active iframe context, standard standalone browser tabs render the app launcher/standalone guide. You can preview mock schema data locally by navigating to:

```text
http://localhost:5173/?preview=1
```

### Quality & Build Verification

```bash
# Run unit tests
npm test

# Type-check and build for production
npm run build

# Audit dependencies
npm audit --omit=dev
```

---

## 🐳 Docker Production Build

Run locally with Docker:

```bash
# Build multi-stage Docker image
docker build -t bitrix24-field-explorer .

# Run container on port 8080
docker run --rm -p 8080:80 bitrix24-field-explorer

# Test health check endpoint
curl http://localhost:8080/health
```

---

## 🔒 Security & Privacy

- **No Data Persistence:** Field Explorer does not store or log any CRM record data, customer information, or API credentials.
- **In-Browser CSV Generation:** CSV files are constructed in browser memory using UTF-8 encoding with BOM for Microsoft Excel compatibility.
- **Formula Injection Shield:** All exported values undergo sanitization to prevent malicious spreadsheet formula execution (`'=`, `'+`, `'-`, `'@`).
- **Framing Controls:** Nginx `Content-Security-Policy` limits framing to authorized Bitrix24 portal origins.

---

## 📄 License & Contribution

This project is licensed under the [MIT License](LICENSE).
Contributions, bug reports, and feature requests are welcome! Please read the [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting Pull Requests.
