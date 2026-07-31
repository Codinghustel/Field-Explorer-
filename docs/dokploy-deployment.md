# Dokploy Deployment

This application is deployed as a Dokploy **Application** from its GitHub repository.

## Production values

- Dokploy: `https://paas.usmankhan.xyz`
- Repository: `https://github.com/Codinghustel/Field-Explorer-.git`
- Branch: `main`
- Domain: `field-explorer.premierchoiceint.online`
- Health endpoint: `/health`

## Application settings

Create a project and production environment, then create an Application with these settings:

| Setting | Value |
| --- | --- |
| Source | GitHub |
| Repository | `Codinghustel/Field-Explorer-` |
| Branch | `main` |
| Build type | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Docker context | `.` |
| Docker build stage | Leave empty |
| Container port | `80` |
| Environment variables | None |

Deploy the application once before assigning the production domain.

## Domain settings

Create the domain under the Application:

| Setting | Value |
| --- | --- |
| Host | `field-explorer.premierchoiceint.online` |
| Path | `/` |
| Internal path | Leave empty |
| Strip path | Off |
| Container port | `80` |
| HTTPS | Off |
| Certificate | None |

The hostname currently resolves through Cloudflare and the zone uses Flexible SSL. Public browser traffic is HTTPS, while Cloudflare connects to the Dokploy route over HTTP. Enabling HTTPS redirect in Dokploy under this Cloudflare mode causes a redirect loop.

For end-to-end encryption in a future maintenance window:

1. Temporarily switch the Cloudflare record to **DNS only**.
2. Enable HTTPS and Let's Encrypt for the Dokploy domain.
3. Change Cloudflare SSL mode to **Full (strict)**.
4. Restore the Cloudflare proxy.

## Deployment validation

After Dokploy reports a successful deployment, verify:

```bash
curl -I https://field-explorer.premierchoiceint.online/
curl https://field-explorer.premierchoiceint.online/health
```

Expected results:

- The application URL returns `200`.
- `/health` returns `ok`.
- The response includes a CSP `frame-ancestors` rule for `https://pcicrm.bitrix24.com`.
- Opening the app directly may show an SDK-context error; CRM access only works inside the authorized Bitrix24 iframe.

## Automatic deployments

Enable Dokploy auto-deploy for `main` only after the first successful manual deployment. Keep GitHub branch protection and CI enabled so a failed build cannot replace production.
