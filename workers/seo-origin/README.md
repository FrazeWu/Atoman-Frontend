# AToMAN SEO origin Worker

This Worker is invoked by a Pages service binding only (SEO_ORIGIN).
It has neither a workers.dev route nor public preview URLs.

It restricts its upstream to JSON-producing public GET APIs and a pinned
Workers VPC service. Requests never forward user authentication, cookies, or
arbitrary headers. The VPC service uses the dedicated VPS-local atoman-seo-vps-private
Tunnel, with full TLS verification and a single pinned HTTPS host and port.
This removes the home-network hop from the live SEO origin path.

Production and canary PRIVATE_ORIGIN service ID:
01a20b71-edd8-7d22-9564-af908b6b9ad7.
The existing pve-cluster VPC service remains available for manual rollback:
01a20b34-a449-7b81-bf50-c2b14b8b21ac.
To roll back, change only PRIVATE_ORIGIN in the Worker binding and restore
the service ID in wrangler.toml. Retest public listing, detail, and sitemap
responses with caching bypassed in canary first. Do not expose the Worker or
modify the public API's security rules. The VPS connector runs as the enabled
atoman-seo-vps-tunnel.service; its protected token must remain on the VPS.
The retained home Tunnel is a rollback option, not automatic failover.

When changing index.js, deploy this Worker before deploying Pages, because
the Pages binding relies on its API allowlist. wrangler.toml documents the
binding for repeatable deployment. Verify workers.dev/preview subdomains stay
disabled and run the Worker unit tests before release.

## Resilience and performance (2026-11-24)
The private, non-public R2 bucket atoman-seo-private-cache is bound to
SEO_CACHE. Anonymous GET JSON responses from the Worker allowlist are cached
for 20 minutes. On a network or 5xx failure, the Worker serves a previously
verified object only while it is less than 72 hours old. Upstream 403/404/410
are authoritative, invalidate any cache entry, and never use stale cache. The bucket has no public custom
domain or r2.dev access, and no user authentication is forwarded.

The scheduled Worker refreshes common directory and sitemap API responses every
15 minutes (12 selected anonymous URLs), limiting concurrency to four. Single detail URLs are
cached on first access. As a result, a temporary failure of the existing
VPS-local Tunnel does not immediately break cached SEO content. Uncached
detail URLs and publication of new content still depend on live origin access:
this is a bounded failover cache, not a full standalone replacement for the
Tunnel.

For preview deployments, Pages uses atoman-seo-origin-canary. Production uses
atoman-seo-origin. Promote the tested Worker source and R2 binding to the
production Worker before publishing the Pages production project. Both scripts
must have workers.dev and public preview URLs disabled.

Workers Free cron jobs have a 50-subrequest limit and 10 ms CPU budget. The
12-entry warm list is deliberately bounded; other public SEO pages cache on
demand. Check Cron Trigger runtime logs after deployment.
