# RedStars app template

A neutral, ready-to-use scaffold for a RedStars app. Copy this repo,
rename, uncomment what you need, and you have a working plugin.

Every `AppPlugin` setting and every Core API call is present and
commented — see `ui/src/plugin.ts` and `ui/src/CORE_API.md`.

---

## What an app is

Two halves, one repo:

- **`ui/`** — the plugin bundle (React/TS). Runs *inside* the host
  (`redstars-frontend`) — the host owns the chrome (header, sidebar,
  modals, palette), your bundle fills declared slots. Built to a single
  signed `dist/plugin.js`.
- **`cmd/studio/`** — the Go pod. Serves the UI bundle and your
  `/api/v1/studio/*` API. All data access goes through the Core SDK
  (`coresdk.Client`, imported from the core repo at
  `apps/backend/pkg/coresdk` — single source of truth, shared by every
  app; no per-repo copy that can drift). The pod never touches a
  database directly.

```
.
├── ui/                      the plugin bundle
│   ├── src/plugin.ts        ★ AppPlugin — every setting, commented
│   ├── src/CORE_API.md      ★ every CoreApi / AppApi / CoreSDK call
│   ├── src/collaborator/    the required base view
│   ├── src/admin/           the admin delta view
│   ├── src/user/            the optional member-facing view
│   ├── src/modales/         bespoke modals (host frames them)
│   ├── src/tabs/            tabs for the built-in MemberDetail modal
│   └── src/db/              the two DB-facing internal APIs:
│       ├── user-data.ts       consent-gated user data the app requests
│       └── tables.sql         the app's org-DB tables ({app}_*)
├── cmd/studio/main.go        the Go pod (uses coresdk.Client from core)
├── scripts/plugin-sign.mjs  Ed25519 bundle signer
├── infra/                   K8s manifest + NetworkPolicy
├── Dockerfile
└── .github/workflows/       build-plugin + deploy-dev
```

## Quick start

1. **Rename.** Replace every `studio` with your app id (lowercase, must
   match `/api/v1/<id>` + the k8s service). Pick a free `PORT`.
2. **Authenticate to the contract registry.** `@delminator/core-ui` (the
   typed contract) is published on **GitHub Packages** (private). It's a
   types-only package — at runtime the host provides the implementations.
   The repo's `.npmrc` already points the `@redstars` scope at
   npm.pkg.github.com; you just need a token:
   ```bash
   # PAT (classic) with the `read:packages` scope
   export GITHUB_TOKEN=ghp_xxxxxxxx
   ```
   (In GitHub Actions, `GITHUB_TOKEN` is provided automatically.)
3. **Edit `ui/src/plugin.ts`** — keep the views/slots/modals you need,
   delete the rest. Only `views.collaborator` is required.
4. **Build the bundle.**
   ```bash
   cd ui && pnpm install && pnpm build      # → ui/dist/plugin.js
   ```
   `@delminator/core-ui` is pinned in `ui/package.json` (`^0.3.0`) and stays
   `external` in `vite.config` — your bundle ships only your plugin code.
5. **Wire up signing with the SHARED ORG KEY — do NOT run `keygen`.**
   Every app and the frontend host trust ONE org signing key. A per-app
   keypair produces a bundle the frontend rejects (`signature
   verification failed`). So:
   - leave `cmd/studio/main.go` `pluginPubkey` set to the org pubkey it
     already ships with (same value in every other app + the frontend
     `loader.ts` `PLUGIN_PUBKEY`);
   - set this repo's CI secret `PLUGIN_SIGNING_KEY` to the org **private**
     key (PKCS8 PEM). See `redstars/docs/SECRETS.md` → "Plugin signing
     key" for where it lives.

   `keygen` is only for an intentional fleet-wide key rotation (rotate
   the pubkey in all apps + the frontend at once), never per app.
6. **Deploy** — push to `main`; the workflows build, sign, and roll out.
   Host `infra/studio.yaml` + `infra/studio-network-policy.yaml` in the
   core repo (`infra/k8s/services/` and `…/network-policies/`).

## The contract, in one screen

- **Views** — the host renders ONE per session by org role:
  collaborator · admin (= collaborator + delta) · user.
- **Slots** — a menu id → either a bespoke `lazy()` component or a host
  **primitive** (`{ kind: 'member-list', … }`). Prefer the primitive.
- **Core-provided capabilities** — don't reimplement what the host gives you:
  - `{ kind: 'member-list' }` — the org's members.
  - `{ kind: 'catalog' }` — the **shared product/service catalogue** (one per
    org, reused across all apps). List + cards + search + staff CRUD, zero app
    code. Read in code via `core.listProducts()`. See
    `redstars-core/docs/CATALOG_PLATFORM.md`. **Never ship your own catalogue
    table/UI** — `conformance.mjs` flags that as drift.
  - **Billing profile, country-driven** — `core.getStoreConfig()` returns the
    org's currency + VAT rates from its country (a Swiss org → **CHF + 8.1/2.6/
    3.8**, default → EUR + 20/10/5.5). The catalogue already uses it; quote/
    invoice UIs should too. Don't hardcode currency or VAT rates.
  - **Billing issuer** — `core.getBillingIssuer()` / `updateBillingIssuer()`
    (org-admin): the org's identity on quotes/invoices (IDE `CHE-…`, VAT no.
    `CHE-… TVA/MWST`, address, IBAN/QR-IBAN).
  - `{ kind: 'quotes' }` — the **quotes (devis) workspace** (one per org). Status
    queue + editor whose lines come from the catalogue, with live HT/VAT/TTC
    (currency + VAT from the billing profile), zero app code. In code:
    `core.listQuotes()` / `getQuote()` / `createQuote()` / `setQuoteStatus()`.
  - `{ kind: 'cash-register' }` — the **shared cash register (caisse)** (one per
    org). Entries + stats (income/expense/cash/check/net) + add/edit/delete +
    multi-register tabs, **staff only**, zero app code. In code:
    `core.listRegisterEntries()` / `getRegisterStats()` / `createRegisterEntry()`.
    See `redstars-core/docs/REGISTER_PLATFORM.md`. **Never ship your own register.**
  - `{ kind: 'org-members' }` — the **org↔org relations workspace**: invite
    another org as client/supplier/partner/member, accept/decline, list. In code:
    `core.listOrgRelations()` / `inviteOrgRelation()` / `respondOrgRelation()`.
    See `redstars-core/docs/ORG_RELATIONS.md`.
- **Modals** — `AppPlugin.modals` (bespoke) + `memberDetailTabs` (tabs
  of the built-in MemberDetail modal). The host frames every modal.
- **`core`** — platform data (members, org, wallet, subscriptions,
  consent-gated profiles, realtime). **`api`** — your own backend.
- **Theme** — colour every surface with the palette-driven `c-*` tokens
  (`bg-c-card`, `text-c-text`, `bg-c-accent`, `c-success/warning/error/info`);
  **never** raw Tailwind hues (`bg-gray-800`) or `dark:` variants — they ignore
  the palette and diverge from the host primitives. Elevation is host-centralised
  (`shadow-*` → 1px ring, `drop-shadow-*` neutralised); don't hand-roll shadows.
  SoT: `redstars-core/docs/DESIGN_SYSTEM.md`. `conformance.mjs` flags raw colours.
- **Security** — the bundle is Ed25519-signed; the pod proves its
  identity to core with a ServiceAccount token.

## Staying conformant — drift detection

An app created from this template can fall behind as the template +
the core contract evolve. `scripts/conformance.mjs` DETECTS that drift
(it never merges or auto-updates — you resolve what it flags):

```bash
node scripts/conformance.mjs /path/to/your-app
```

It checks the structure, `plugin.ts` shape, adoption of the core
capability primitives (catalogue / cash register / billing), **design
tokens** (raw Tailwind colours & `dark:` variants instead of `c-*` →
`docs/DESIGN_SYSTEM.md`), Core SDK method parity, CI + signer presence,
and — the strongest signal — whether `ui/` still typechecks against the
current `@delminator/core-ui`. Output is per-check `✓` conformant / `⚠`
behind but working / `✗` broken.

Wire it into an app's CI with the reusable workflow:

```yaml
# .github/workflows/conformance.yml in your app repo
name: Conformance
on: [push, pull_request, workflow_dispatch]
jobs:
  check:
    uses: delminator/redstars-app-template/.github/workflows/conformance.yml@main
```

## Reference

In the core repo (`redstars-core`):

- `docs/APP_PLUGIN_GUIDE.md` — the full guide (§§ 0-14).
- `docs/DESIGN_SYSTEM.md` — theming (`c-*` tokens), elevation, shared surfaces.
- `docs/RENDER_ENGINE_OPTIMIZATION.md` — graphics/asset engine (images, avatars, palette).
- `docs/MICRO_FRONTEND_PLUGINS.md` — the contract (source of truth).
- `docs/CORE_PLATFORM_API.md` — internal API + security model.
- `docs/NETWORK_ISOLATION.md` — pod isolation + identity.

`@delminator/core-ui` is the typed contract package — depended on at
build time, erased at compile (the host provides the runtime).
