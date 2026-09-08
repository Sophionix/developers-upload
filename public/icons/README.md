# App Icons

Replace the placeholder references in `manifest.webmanifest` with real PNG icon files:

- `icon-192.png` — 192×192 px, PNG, app icon (used for home screen and splash)
- `icon-512.png` — 512×512 px, PNG, app icon (used for install prompt and splash screen)

Both icons should use the `any maskable` purpose, meaning the artwork should sit within
the safe zone (center 80% of the canvas) so Android adaptive icon masking does not crop
key content.

These files must be placed in this directory (`public/icons/`) before deploying to production.
