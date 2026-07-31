# Field Explorer for Bitrix24

A read-only CRM schema workbench for Bitrix24. Field Explorer runs inside CRM detail tabs or from the application launcher and shows the complete field schema alongside the current record values.

## Features

- Deals, contacts, companies, leads, and smart processes through the universal CRM API
- CRM activities, including access from supported activity-list and timeline menus
- Simple products, variation parents, and product variations through the catalog API
- Warehouses and inventory documents with document-line inspection
- Complete schema including empty fields
- Custom/system, populated/empty, type, and full-text filters
- Required, multiple, read-only, immutable, and field-settings metadata
- Field detail view with raw values and original REST names
- One-click field-code copy
- UTF-8 CSV export of the current filtered and sorted view
- Safe value rendering and spreadsheet-formula injection protection
- Native Bitrix24 appearance through [`@bitrix24/b24ui-nuxt`](https://bitrix24.github.io/b24ui/)
- Responsive iframe and direct application views
- One-time CRM detail-tab registration

## Stack

- Vue 3 and TypeScript
- Vite
- Bitrix24 UI and Bitrix24 icons
- Classic Bitrix24 browser SDK
- Nginx and Docker
- Vitest

## Local development

The browser SDK must initialize inside an authorized Bitrix24 application iframe. A normal browser tab can build and render the shell but cannot request CRM data.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run build
npm audit --omit=dev
```

## Production deployment

Build and run the container:

```bash
docker build -t bitrix24-field-explorer .
docker run --rm -p 8080:80 bitrix24-field-explorer
```

The production deployment for this repository is:

- Bitrix24 portal: `https://pcicrm.bitrix24.com`
- Application: `https://field-explorer.premierchoiceint.online`
- Dokploy panel: `https://paas.usmankhan.xyz`

Place the container behind an HTTPS reverse proxy. The application handler must be publicly accessible to the browser and embeddable by the Bitrix24 portal.

The included Nginx policy permits standard Bitrix24 cloud domains. Update `frame-ancestors` in `nginx.conf` when using a custom or on-premise Bitrix24 domain.

See [`docs/dokploy-deployment.md`](docs/dokploy-deployment.md) for deployment and [`docs/bitrix-installation.md`](docs/bitrix-installation.md) for portal setup.

## CSV behavior

The primary export includes exactly the rows in the current filtered and sorted view. CSV files include a UTF-8 BOM for Excel, quote all values, preserve multiline raw values, and neutralize values beginning with spreadsheet formula characters.

No CRM record data is stored or sent to another service. Export is generated locally in the browser.

## Required scopes

- `crm`
- `placement`
- `catalog`

Smart-process discovery through `crm.type.list` requires a CRM administrator. Core CRM exploration remains available if a regular user cannot enumerate smart-process types.

Catalog and inventory exploration requires the `catalog` scope. Inventory documents also require Inventory Management to be enabled in the portal.
