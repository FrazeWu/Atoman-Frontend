# Atoman Mobile

This directory is the first mobile web application boundary inside the frontend workspace.

## Development

```bash
bun run dev:mobile
```

The mobile app uses port `5174` by default and proxies `/api` and `/uploads` to the backend target configured by `VITE_DEV_PROXY_TARGET`.

## Current pilot

The pilot owns Feed, Blog, Music, Inbox, author profiles, and the core Blog Studio routes. The app reuses the existing API client, Pinia stores, auth flow, route guards, and content views. Account settings and unsupported Studio modules still fall back to the desktop application.

Set `VITE_DESKTOP_APP_URL` in production for account settings and other desktop fallback links. The default production fallback is `https://www.atoman.org`.
