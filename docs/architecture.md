# Architecture

Field Explorer is a static, browser-only application. It intentionally has no backend or database for the single-portal deployment model.

## Runtime flow

1. The Bitrix24 browser SDK initializes the authorized iframe context.
2. `src/services/bitrix.ts` validates placement and record identifiers.
3. A source adapter retrieves the complete schema and record values.
4. CRM uses `crm.item.*`; activities use `crm.activity.*`; products, warehouses, and inventory use `catalog.*`.
5. `src/lib/fields.ts` combines both responses into normalized field rows.
6. `src/App.vue` filters, sorts, and renders those rows using Bitrix24 UI.
7. `src/lib/csv.ts` generates filtered exports entirely in the browser.

Bitrix24 may launch placement handlers with an HTTP POST. Nginx serves the SPA shell for that POST while the browser SDK receives the authorized placement context from the parent frame. Other non-read methods are denied.

## Security boundaries

- CRM values are rendered through Vue text interpolation rather than `innerHTML`.
- Record IDs and dynamic entity type IDs must be positive integers.
- No access or refresh token is persisted by the application.
- No CRM values are logged to the browser console.
- CSV cells are quoted and formula-like values are prefixed before download.
- Bitrix24 remains responsible for record-level authorization.

Catalog product parents and variations are kept as separate explorer sources. They can use different information blocks, fields, quantities, and inventory balances, so flattening them would hide important schema differences.

## Distribution boundary

This architecture is appropriate for one trusted Bitrix24 portal. Marketplace or multi-tenant distribution would require a backend for OAuth installation callbacks, encrypted refresh-token storage, tenant isolation, uninstall events, and token refresh coordination.
