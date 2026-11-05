# Atoman Mail Stage 8 — safe expanded message UI

The integrated `/mail` page can now request a **single** expanded message from `GET /api/v1/mail/message`, with the same authenticated site session and folder scope used for the list. It displays escaped bounded plain text and sender/recipient/cc, plus attachment names and sizes. It does not inject remote HTML, download attachments or expose raw JMAP credentials.

Only after the selected detail is visible does the page call `POST /api/v1/mail/messages/read`; listing or searching emails does not mark them read. Rapid folder changes cancel obsolete results and skip read updates. Error screens do not claim that a message was displayed. Mobile and desktop route/auth behavior is unchanged.

Verified with Vitest and actual headless Chrome against synthetic local API fixtures. In real Stalwart fixture the matching backend `Email/get` and `Email/set` flow was exercised end to end. Do not enable the read flag in production before the storage and recovery release gates pass. HTML-only rendering and safe attachments are upcoming features; the UI explicitly communicates those limitations.
