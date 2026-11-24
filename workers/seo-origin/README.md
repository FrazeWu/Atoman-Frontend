# AToMAN SEO origin Worker

This Worker is invoked by a Pages service binding only (SEO_ORIGIN).
It has neither a workers.dev route nor public preview URLs.

It restricts its upstream to JSON-producing public GET APIs and a pinned
Workers VPC service. Requests never forward user authentication, cookies, or
arbitrary headers. The VPC service currently uses the existing pve-cluster
Tunnel as an egress to the production VPS HTTPS origin, with full TLS
verification, and a single pinned host and port. This is a transitional
network path: moving the VPC service to a VPS-local Tunnel removes the
dependency on the home cluster, without requiring any Pages code changes.

When changing index.js, deploy this Worker before deploying Pages, because
the Pages binding relies on its API allowlist. wrangler.toml documents the
binding for repeatable deployment. Verify workers.dev/preview subdomains stay
disabled and run the Worker unit tests before release.

## Resilience and performance (2026-11-24)
The private, non-public R2 bucket atoman-seo-private-cache is bound to
SEO_CACHE. Anonymous GET JSON responses from the Worker allowlist are cached
for 20 minutes. On a network or 5xx failure, the Worker serves a previously
verified object only while it is less than 72 hours old. Upstream 403/404/410
are authoritative and never use stale cache. The bucket has no public custom
domain or r2.dev access, and no user authentication is forwarded.

The scheduled Worker refreshes common directory and sitemap API responses every
two hours (32 anonymous URLs), limiting concurrency to four. Single detail URLs are
cached on first access. As a result, a temporary failure of the existing
pve-cluster Tunnel does not immediately break cached SEO content. Uncached
detail URLs and publication of new content still depend on live origin access:
this is a bounded failover cache, not a full standalone replacement for the
Tunnel.

For preview deployments, Pages uses atoman-seo-origin-canary. Production uses
atoman-seo-origin. Promote the tested Worker source and R2 binding to the
production Worker before publishing the Pages production project. Both scripts
must have workers.dev and public preview URLs disabled.
