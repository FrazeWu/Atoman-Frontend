# Atoman Mail Stage 6: integrated Webmail frontend

Date: 2026-11-04. The feature belongs to the **existing Atoman application**, not a standalone website, project, or credential system. It is developed in `Atoman-Frontend`, with backend APIs from `Atoman-Backend` main `6df0015`.

## UI implemented

- Authenticated `/mail` route for desktop and the separate mobile runtime. The site-wide topbar has an email icon separate from private chat `/messages`; the mobile module directory has an `电子邮件` entry.
- Desktop responsive three-column layout: folder navigation, email list and **read-only metadata preview**. Mobile shows one pane at a time with explicit back controls. Existing design tokens supply colors, spacing, borders and motion; no extra app shell, login form or independent site is introduced.
- Fetches only the signed-in Atoman user's account reservation with `GET /api/v1/mail/me`; `active && available:true` is required before fetching folders or messages. Nonactive states (not invited, reserved, provisioning, failed and suspended) show clear, honest messages instead of placeholder email data.
- An invited user can redeem a one-time invitation token using `POST /api/v1/mail/activate`, with the token only in the JSON body. This **reserves** an address; it does not bypass the mail service's disabled provisioning gates or enable mail sending.
- When active and operational, reads real folder metadata from `GET /api/v1/mail/folders` and the first 50 message summaries from `GET /api/v1/mail/messages?mailbox_id=<encoded>&limit=50`. Scope is enforced on the backend. Local search explicitly filters the currently loaded summaries, not all mail.
- A selected summary displays subject, JMAP-provided `preview`, received time and attachment presence. There is no HTML email body rendering, attachment download, recipient details or composer yet; disabled `写邮件` control makes that limitation clear. No fabricated emails or fake unread counts are rendered. The search input uses an explicit accessibility label rather than relying on a visually unsupported screen-reader CSS class.
- Handles API errors, unavailable mail service and expired login state without leaking response details. Request-generation checks prevent slower old-folder replies from overwriting the selected folder's messages; first folder navigation does not block on a slow initial message request.
- Direct `/mail` navigation is explicitly recognized by `src/router/siteContext.ts` and Cloudflare Pages' `functions/_lib/pageSeo.ts` (private / noindex), preventing the production SPA fallback from returning a false 404 on refresh.

## Runtime and security boundaries

- The frontend never sees Stalwart admin credentials, API Keys, Cloudflare R2 keys or raw MIME. It calls only Atoman's existing authenticated API client and cookie session handling.
- The `/mail` route is authenticated in both desktop and mobile route tables. The backend's invitation/read and real-mail activation toggles remain closed until R2 object-level permission and TrueNAS full recovery tests pass.
- The current backend does not expose full MIME bodies, sending, attachments, search beyond first 50 summaries, Sieve filters or the five-second undo-send queue. The UI deliberately does not imply those are available.
- Temporary browser test data contains only `example.test` / `preview@atoman.org` synthetic mailbox information, and is mocked by Playwright. It does not connect to a real mail server or production R2.

## Verification

From a task worktree with workspace dependencies linked:

```sh
NODE_ENV=test ./node_modules/.bin/vitest run \
 tests/unit/views/mail/MailWorkspaceView.spec.ts \
 tests/unit/api/mail.spec.ts \
 tests/unit/router/routes.spec.ts \
 tests/unit/router/siteContext.spec.ts \
 tests/unit/functions/pageSeo.spec.ts \
 tests/unit/mobile/mobile-app.contract.spec.ts --maxWorkers=2

bash scripts/start-mail-preview-check.sh
bun run check:user-copy
bun run type-check
bun run build
```

The local-only preview script checks `GET / = 200`, performs actual headless Chrome desktop and mobile geometry tests, confirms mobile pane navigation and lack of horizontal overflow, reloads `/mail` at a mobile viewport into the **true independent mobile Atoman runtime**, checks its folder list and route restoration, then validates that a `reserved` account cannot access the message workspace; finally it opens `/modules` and follows the real mobile `电子邮件` link back to `/mail`. It removes the temporary Vite listener and browser after testing. Screenshots are temporary (`/tmp/atoman-webmail-{desktop,mobile}-preview-20261104.png`), not production assets.

## Integration blocker

At start of this stage, local `Atoman-Frontend/main` was **diverged** from GitHub `origin/main` (`3323` commits unique locally, `12` unique remotely; after refreshing origin it had `14` unique remote commits and continued changing as other work landed). The main worktree was clean, but under `/root/Atoman/AGENTS.md` **do not merge or push** the feature until branch history has been reconciled safely. Preserve the committed feature worktree; do not force-push, reset, stash another user's changes or deploy the frontend. The backend repo is separate and already synchronized.

## Next product stages

1. Resolve frontend branch divergence without losing existing functionality or concurrent contributors' work.
2. Complete authenticated Cloudflare R2 mail bucket access checks and paired PostgreSQL + R2/TrueNAS restoration.
3. Implement secure full-message body rendering, attachment download/preview, drafts, composing, and the five-second server-side undo-send path.
4. Add permitted Sieve rule editor, junk feedback, synchronization and notification flows. Only enable real mail after safety, deliverability, backup and operational signoff.
