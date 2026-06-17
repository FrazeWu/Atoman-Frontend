# Favicon Design

## Goal

Show the Atoman icon in the browser tab reliably in development and production.

## Current State

The Vite frontend already has a static image at `public/favio.png` and `index.html` links to it with:

```html
<link rel="icon" type="image/png" href="/favio.png" />
```

The filename is nonstandard, which can be easy to miss and gives browsers no conventional `/favicon.*` fallback.

## Approach

Use the existing image content from `public/favio.png`, expose it through the conventional `public/favicon.png` filename, and update `index.html` to reference `/favicon.png`.

## Scope

- Add or create `public/favicon.png` from the existing image.
- Update the HTML favicon link to `/favicon.png`.
- Keep the current page title and application code unchanged.

## Testing

Run the frontend build to confirm Vite can package the app and the static asset path is valid.
