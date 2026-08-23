# Atoman Mobile

This directory is the first mobile web application boundary inside the frontend workspace.

## Development

```bash
bun run dev:mobile
```

The mobile app uses port `5174` by default and proxies `/api` and `/uploads` to the backend target configured by `VITE_DEV_PROXY_TARGET`.

## Current pilot

The pilot owns Feed and Blog routes. The app reuses the existing API client, Pinia stores, auth flow, route guards, and content views. Other modules remain in the desktop application until their mobile routes are migrated.

Set `VITE_DESKTOP_APP_URL` in production so account, notification, message, and Studio links fall back to the desktop application. The default production fallback is `https://www.atoman.org`.
