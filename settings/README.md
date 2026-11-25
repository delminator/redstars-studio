# settings/ — price and permissions

`pricing.json` — optional. **Absent ⇒ the app is not sold** (shown « Pas encore
en vente », subscriptions refused).
- `tiers`: the price paid is the one of the **last tier reached** by the number
  of subscribing organizations (€ / month / organization, 0–500).
  First tier at `"subs": 0`, `subs` increasing, and a later tier is **never
  more expensive** (cooperative promise). All prices at 0 = free app.
- `milestones`: crowdfunding goals (`threshold` in € collected, increasing),
  shown on the funding page.

`permissions.json` — required.
- `access`: every platform data your code uses outside its own tables —
  `scope` from the platform's list (members, organization, users, wallet,
  billing, notifications, email, events, register, print, federation,
  traceability, bridge), `level` read|write, `why` 3–200 characters. The
  platform writes the label; you only say why.
- `roles`: what `admin`, `collaborator`, `member` can do in the app.

Declare every scope you use: shown today, enforced by the platform next.
Unknown fields are refused. Full guide: `docs/STORE.md`. This README is
ignored by the platform.
