# Troubleshooting Guide

Common issues encountered when deploying, installing, or using Field Explorer in Bitrix24.

---

## 1. Iframe Display Issues & Framing Errors

### Symptom: Blank screen, narrow column, or "Refused to display in a frame"

- **Cause 1: Content Security Policy (`frame-ancestors`) Mismatch**
  - **Fix:** Check `nginx.conf`. The `Content-Security-Policy` header includes `frame-ancestors https://pcicrm.bitrix24.com;`. If your Bitrix24 portal uses a custom domain or a different TLD (e.g. `*.bitrix24.eu`, `*.bitrix24.de`, `*.bitrix24.in`), update `nginx.conf` and redeploy.

- **Cause 2: Iframe Width Locked at 100px**
  - **Fix:** Ensure `window.BX24.resizeWindow(document.body.clientWidth, height)` passes pixel numbers, not string percentages (`'100%'`). Bitrix24 JS SDK parses `'100%'` as `100px`. This is already handled in the codebase.

- **Cause 3: Cloudflare Flexible SSL Redirect Loop**
  - **Fix:** When using Cloudflare with SSL set to **Flexible**, configure the Dokploy domain with HTTPS **Off** (Port 80). Traefik forwards HTTP to the container, while Cloudflare terminates public HTTPS. See [`docs/dokploy-deployment.md`](dokploy-deployment.md).

---

## 2. Bitrix24 SDK & API Errors

### Symptom: "The Bitrix24 SDK did not load. Open the app inside Bitrix24 and try again."

- **Cause:** You opened the application URL directly in a browser tab rather than through the Bitrix24 portal iframe.
- **Fix:** Open Field Explorer through the Bitrix24 left navigation menu or placement tab. To preview the UI outside Bitrix24 for testing, append `?preview=1` to the URL (e.g. `https://field-explorer.premierchoiceint.online/?preview=1`).

### Symptom: `403 ACCESS_DENIED` or "Bitrix24 denied access"

- **Cause 1: Missing Application Scopes**
  - **Fix:** In Bitrix24 (**Applications > Developer resources > Local application**), ensure all three required scopes are selected:
    - `crm` (CRM & Activities)
    - `catalog` (Product Catalog & Inventory)
    - `placement` (App Embedding)
  - Save the app settings in Bitrix24, then click **Set up CRM tabs** inside Field Explorer to refresh placement bindings.

- **Cause 2: Non-Administrator User**
  - **Fix:** Enumerating Smart Processes (`crm.type.list`) requires CRM Administrator privileges. Standard users can still explore core CRM entities (Deals, Contacts, Companies, Leads).

- **Cause 3: Commercial Plan Requirement**
  - **Fix:** Bitrix24 REST API and Local Apps are available on commercial Bitrix24 plans (Basic, Standard, Professional, Enterprise) or trial periods.

---

## 3. Inventory & Product Catalog Issues

### Symptom: "Inventory Management is not enabled in this Bitrix24 portal"

- **Cause:** You selected **Inventory Document**, but Inventory Management is disabled in Bitrix24 settings.
- **Fix:** Enable Inventory Management in Bitrix24 under **CRM > Inventory > Inventory management**, or ensure your plan includes Inventory Management.

### Symptom: No fields returned for Product Catalog / Stores

- **Cause:** Missing `catalog` scope or the current user lacks permission to view the product catalog / information blocks.
- **Fix:** Re-save the local app in Bitrix24 with the `catalog` scope checked, and verify user permissions under **CRM > Settings > Access Permissions**.

---

## 4. Verification Commands

To diagnose health and response headers on your deployment server:

```bash
# Test application shell response
curl -i https://field-explorer.premierchoiceint.online/

# Test health check endpoint
curl https://field-explorer.premierchoiceint.online/health

# Test Bitrix24 POST handshake handling
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "PLACEMENT=CRM_DEAL_DETAIL_TAB" \
  https://field-explorer.premierchoiceint.online/
```

Expected output for POST handshake: `HTTP/1.1 200 OK` with `Content-Type: text/html; charset=utf-8` and CSP headers permitting your portal.
