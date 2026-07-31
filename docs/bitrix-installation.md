# Bitrix24 Local App Installation

This project targets a Bitrix24 cloud **local REST application** hosted at a public HTTPS URL.

Production values:

- Portal: `https://pcicrm.bitrix24.com`
- Application URL: `https://field-explorer.premierchoiceint.online/`

## Prerequisites

- Bitrix24 administrator access
- A public HTTPS deployment of this application
- The `crm`, `placement`, and `catalog` scopes

## Configure the app

1. Open **Applications > Developer resources > Other > Local application** in Bitrix24.
2. Choose a client-side application that uses the Bitrix24 JavaScript SDK.
3. Set the application URL and initial installation URL to `https://field-explorer.premierchoiceint.online/`.
4. Grant the `crm`, `placement`, and `catalog` scopes.
5. Save and open the application as an administrator.
6. Select **Register CRM tabs**.

Field Explorer asks Bitrix24 for the placements available to the portal, registers the four core CRM detail tabs, and registers available smart-process detail tabs. A fresh installation calls `BX24.installFinish()` only after all placement registrations succeed.

## Registered placements

- `CRM_DEAL_DETAIL_TAB`
- `CRM_CONTACT_DETAIL_TAB`
- `CRM_COMPANY_DETAIL_TAB`
- `CRM_LEAD_DETAIL_TAB`
- `CRM_DYNAMIC_{entityTypeId}_DETAIL_TAB` for each available smart process
- `CRM_ACTIVITY_LIST_MENU` when available
- Available `CRM_*_ACTIVITY_TIMELINE_MENU` placements

Smart-process placement codes are validated against `placement.list` before registration.

Products, warehouses, and inventory documents do not currently have documented Bitrix24 detail-tab placements. Open those explorers from the application launcher and select the record type and numeric ID.

## Inventory prerequisites

Inventory exploration requires Inventory Management on the portal's plan and enabled under **CRM > Inventory > Inventory management**. The installing administrator also needs permission to view the product catalog, warehouses, and inventory documents.

## Updating tabs

Run **Register CRM tabs** again after creating a new smart process. Existing bindings are updated and newly available dynamic placements are added.

## Troubleshooting

### The SDK does not initialize

Open the application from Bitrix24 rather than directly from its public URL. Confirm that the SDK script from `https://api.bitrix24.com/api/v1/` is not blocked by proxy or content-security policies.

### Access denied

Confirm the current user can read the requested CRM record and that the app has the `crm` scope. Smart-process enumeration additionally requires CRM administrator access.

For products or inventory, confirm the app has the `catalog` scope and the current user can view the product catalog and inventory records.

### The tab does not appear

Open the app as an administrator, run **Register CRM tabs**, and verify the app installation completed. Confirm the public handler is HTTPS and can be framed by the portal.

### A custom Bitrix domain cannot frame the app

Add that exact HTTPS origin to the `frame-ancestors` directive in `nginx.conf`, rebuild, and redeploy the image.
