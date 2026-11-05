# AToMAN Webmail — complete frontend contract and acceptance

This supersedes the read-only frontend scope described in stage 6–8. The shared desktop/mobile `/mail` route uses the existing site login, authenticated API client and CSRF transport. Deployment remains part of the coordinated backend + frontend release; this branch does not modify production or send real external mail.

## User experience

- Desktop has folders, message/conversation list and reader columns. Mobile shows one pane, with explicit folder/list/reader navigation. Conversation mode is the default; single-message mode is a saved browser preference.
- Search and pagination run on the server. A conversation loads every returned page, including messages in other folders. Each summary's real `mailboxIds` is used to scope detail/read requests. Listing, background refresh and collapsed messages never mark read. A message is marked read only after its expanded detail is displayed in the visible reader.
- Selection supports up to 100 messages per operation: archive, read/unread, move and trash, plus reader star, junk, restore and block-sender actions. A server receipt enables undo; stale receipts fail visibly. Trash and junk display the native server's 30-day retention policy. Only empty custom folders may be removed.
- The composer supports To/Cc/Bcc (including Cc/Bcc-only), reply, reply-all, forwarding with copied attachments, plain/formatted text, upload/removal and explicit Send. Failed forwarded attachments are named inside the composer. Sending supports 1–50 recipients and up to 20 attachments (10 MiB each, 25 MiB combined).
- Drafts save after 900 ms idle, serialize revision updates, and flush on close or route navigation. A failed save keeps the editor open; a revision conflict retains the local contents and offers a new draft without overwriting another version. Reload/close warns when content remains unsaved. No message body is written to browser storage.
- Send first persists the draft, then queues an immutable server snapshot with a stable request ID. The server's `send_after` controls the five-second undo display. An uncertain network response locks editing while the same request is confirmed; the opaque request ID survives reload. Confirmed cancellation restores the current server draft. The server alone removes an accepted draft revision. Changed revisions and cancelled sends remain drafts.
- Queue recovery runs on page load and visibility restoration. Queued items poll at one second; active submission polls at five seconds. Mailbox refresh is every 30 seconds while visible and idle. `sent` means submitted to the mail server, never proof of recipient delivery. `uncertain` exposes receipt reconciliation, never an automatic second send.
- Settings manage ordered filters, blocked senders, vacation replies and individually revocable IMAP/SMTP app passwords. A new password is shown once; revoking it also hides that displayed secret. Connection details use IMAP 993 and SMTP 465/587.

## HTTP contract

All paths below are relative to `/api/v1/mail` and use the existing `{data: …}` success envelope. No browser calls Stalwart administration APIs directly.

| Method/path | Request and response used by frontend |
| --- | --- |
| GET `/me`, POST `/activate`, POST `/admin/reserve-self`, POST `/provision` | `MailAccountInfo {status, available, address}`. Both active status and availability are required. Invite/reservation may auto-provision; reserved accounts expose an explicit completion retry. |
| GET `/folders`; POST `/folders`; DELETE `/folders/:id` | Folder list; create `{name}` returns `{id}`; delete returns `{deleted:true}` and rejects system, nonempty or parent folders. |
| GET `/search` | `mailbox_id`, `q`, `position`, `limit`, or `thread_id`. Returns `{items,total,position,has_more}`. `isStarred` becomes UI `isFlagged`; `mailboxIds` map becomes an array of true keys. |
| GET `/message`; POST `/messages/read` | Both use `mailbox_id` and `message_id`. Detail includes `plainText`, `html`, `from/to/cc`, `replyTo`, `messageId`, `attachments[].partId`. Empty optional lists normalize to arrays. |
| GET `/attachment`; GET `/raw` | `message_id`, and attachment `part_id`. Authenticated blob downloads; raw message saves as `.eml` and is available for truncated bodies. |
| POST `/messages/actions`; POST `/messages/actions/undo` | `{ids,action,mailbox_id}` with `star/unstar` names on wire; `{updated,failed,undo_token}` receipt; undo `{token}`. |
| GET `/drafts`; GET/PUT/DELETE `/drafts/:id` | PUT `{revision,compose}`; response `{id,revision,subject,updated_at,compose?}`. Draft list may omit compose. Version conflicts return 409. Compose carries attachment metadata with owned upload IDs. |
| POST `/attachments`; DELETE `/attachments/:id` | Multipart `file`; upload returns `{id,name,type,size,created_at}`. Removed draft references are saved; the server owns orphan retention. |
| POST `/outbox` | `{request_id,draft_id,draft_revision,to,cc,bcc,subject,text,html?,in_reply_to?,references?,attachment_ids}`. Returns `{id,status,send_after,created_at,draft_id}`. Request deduplication must remain valid after an accepted draft is deleted. |
| GET `/outbox`; GET `/outbox/:id`; POST `/outbox/:id/cancel`; POST `/outbox/:id/reconcile` | Server-persisted status: `queued`, `dispatching`, `cancelled`, `sent`, `uncertain`, `blocked`. Reconcile reads evidence and does not resend. |
| GET/PUT `/settings` | `{conversation_mode,blocked_senders,auto_reply:{enabled,subject,text},rules:[{id,name,enabled,field,contains,action,mailbox_id?}]}`. The adapter maps `auto_reply`/`contains` to UI vacation/value and preserves the other preferences. |
| GET/POST `/app-passwords`; DELETE `/app-passwords/:id` | Create `{name}` returns normal metadata plus one-time `password`; list excludes password. |

## Rendering safety

Plain text is escaped by Vue. Formatted mail is sanitized with DOMPurify, stripped of styles/resource attributes, and rendered in a unique-origin sandboxed iframe with CSP denying network loads, scripts and forms. Images become text labels. Authenticated attachments use scoped site API requests and browser blob URLs. No invitation token, mail credentials, password or message content is placed in query strings or browser persistence.

The HTML helper test uses jsdom explicitly because the installed happy-dom implementation is incompatible with DOMPurify's traversal. The same hostile form/script/image fixture is also checked in real Chrome, including an assertion that tracking requests do not occur.

## Reproducible validation

```sh
bun run type-check
NODE_ENV=test ./node_modules/.bin/vitest run --maxWorkers=2 tests/unit/api/mail.spec.ts tests/unit/api/mailClient.spec.ts tests/unit/views/mail tests/unit/views/setting/SettingMailInvitationDialog.spec.ts
bun run build
bun run build:mobile
bash scripts/start-mail-preview-check.sh
```

The focused suite contains 29 tests covering adapters, draft CAS, in-flight edits, send deduplication/locking, Bcc-only delivery requests, safe HTML, conversation pagination, visible-only read changes, stale responses, queue restoration and bulk undo.

The Chrome fixture never sends a real message. It asserts desktop column bounds; grouped reading; HTML sanitization/no tracking; draft/upload/queue/cancel; settings and app-password revocation; attachment forwarding; batch undo; actual mobile app context with one pane/no horizontal overflow; and fail-closed reserved-account state. It writes synthetic screenshots to `/tmp/atoman-mail-complete-{desktop,compose,settings,mobile-list,mobile-reader}.png` on the test server. Screenshot transfer is unavailable on the connection's current plan; these images are retained there, and acceptance relies on browser interaction/layout assertions rather than a claimed manual image review.

Production acceptance must still verify the deployed frontend against the released backend and real authenticated mailbox. Backend SMTP/JMAP, delivery authentication, runtime migrations and hosting publication belong to the coordinated release, not the fixture assertions.
