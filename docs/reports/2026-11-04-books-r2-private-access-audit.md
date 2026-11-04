# R2 private book prefixes — security acceptance (2026-11-04)

## Finding

- `assets.atoman.org` is an enabled public custom domain for the shared `atoman` R2 bucket.
- Book revision files use `book/revisions/...`; private imports and private publication evidence use `books/private/...`.
- The original Cloudflare custom WAF rule blocked `/book/` but not `/books/private/`.
- Nonexistent synthetic paths before remediation returned 403 on `/book/...` and 404 on `/books/private/...`. This confirms a missing access-control rule, **not** disclosure of an existing file.

## Remediation

Updated the existing Cloudflare zone custom WAF block rule (not the R2 object data) to use:

```text
(http.host eq "assets.atoman.org" and (starts_with(lower(url_decode(http.request.uri.path)), "/book/") or starts_with(lower(url_decode(http.request.uri.path)), "/books/private/")))
```

The expression protects both variants regardless of case and once-URL-decoded prefixes. It does not affect S3 API presigned uploads or the backend's authenticated revision-content endpoint.

Synthetic GET probes returned **403** for both book prefixes, including percent-encoded and uppercase path variants. A nonexistent `/music/...` control returned **404**, not an unrelated block. Backend API and frontend health both returned **200**.

Use `npm run qa:books:r2-prefix` to repeat these six **read-only** real-domain checks after future Cloudflare deployments.

## Operational safeguards

- Keep `BOOK_PRIVATE_BUCKET` on a dedicated nonpublic R2 bucket when possible; only use the shared `atoman` bucket if the book prefixes are explicitly protected.
- Public book publishing additionally requires `BOOK_CLAMSCAN_PATH` and a working ClamAV engine. The host ClamAV 1.4.3 scanner passed the repository's benign/EICAR test. This does **not** prove that the live worker is configured to invoke it.
- The current R2 bucket has a `third-party-ui` wildcard CORS rule that includes `PUT`. This was **not modified**, because the exact clients relying on it have not been identified. CORS does not itself bypass S3 signed-request authentication; review cross-origin upload support separately before narrowing it.
- Do not consider production PDF/EPUB uploads, malware scan processing, and dual-device login synchronization end-to-end verified until a disposable staging stack successfully runs the authenticated browser test and a separate approved R2 canary validates the production credentials.
