# visibility/ — the shop card

`app.json` — what the shop shows on the app's card. Required.

- `name` 1–40 characters · `icon` one emoji · `color` `#rrggbb`
- `description` 1–300 characters, one sentence: the text of the card
- `visibility` `public` (listed in the shop and on the site's `/apps/`) or `private`

Unknown fields are refused. No HTML. Your app's identity is its Service name,
never a field here. Full guide: `docs/STORE.md`. This README is ignored by the
platform.
