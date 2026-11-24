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
