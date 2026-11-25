# Your app in the shop — icon, price, permissions, pages

**No code, no request to the platform team.** Everything the RedStars shop and
the public site show about your app lives in this repository, in three folders
at its root. Edit them, push, and as soon as your pod runs the app appears in
the shop with your price and your pages.

```
visibility/app.json          the shop card: name, icon, colour, one-line description, public|private
settings/pricing.json        price tiers + crowdfunding goals        (optional: absent ⇒ not sold)
settings/permissions.json    platform data the app uses, and why; what each role can do
pages/project.md             the project page                        (optional)
pages/funding.md             the funding page                        (optional)
store.go                     embeds the three folders into the binary — nothing to change
store_test.go                runs the platform's own validation in `go test`
```

Each folder also holds a `README.md` with a short reminder of its rules
(the platform ignores those files).

## How it reaches the shop

```
your repo ──go:embed──▶ your binary ──appstore.MustLoad──▶ GET /api/v1/<app>/ui/store
                                       (invalid ⇒ the pod does not start)
                                                                   │ every 30 s
                                                                   ▼
                    core: validates again ─▶ shop card, price, crowdfunding table
                                          ─▶ GET /api/v1/platform/apps/<app>/store (public)
                                          ─▶ subscription dialog + site page /apps/<app>/
```

- Your app's identity is its Kubernetes Service name (`studio`), **never** a
  field of these files: you cannot claim to be another app.
- If you publish an invalid declaration, core ignores it and keeps showing the
  last valid one.
- Changes appear in the shop within a minute after the new pod is running.

## The files

### `visibility/app.json` — required

```json
{
  "name": "Ludo",
  "icon": "🎲",
  "color": "#8b5cf6",
  "description": "Gestion de ludothèque : jeux, adhérents, prêts.",
  "visibility": "public"
}
```

| field | rule |
|---|---|
| `name` | 1–40 characters |
| `icon` | one emoji |
| `color` | `#rrggbb`, shown behind the icon |
| `description` | 1–300 characters: the text of the shop card |
| `visibility` | `public` (listed in the shop and on `/apps/`) or `private` |

### `settings/pricing.json` — optional

```json
{
  "tiers": [
    { "subs": 0,    "price": 20, "label": "Lancement" },
    { "subs": 100,  "price": 15, "label": "Viabilité" },
    { "subs": 1000, "price": 10, "label": "Communauté" }
  ],
  "milestones": [
    { "threshold": 20000, "title": "Maintenance assurée",
      "description": "Une personne rémunérée pour corriger et faire évoluer l'app." }
  ]
}
```

**What an organization pays** = the price of the **last tier reached** by the
number of organizations subscribed to the app, in € per month per
organization. Above, 0–99 subscribers pay 20 €, 100–999 pay 15 €, 1000 and
more pay 10 €. Every subscriber pays the current price: when the app grows,
everybody's price drops.

| rule | why |
|---|---|
| 1–20 tiers; the first starts at `"subs": 0` | there is always a price |
| `subs` strictly increasing | |
| `price` from 0 to 500 | `0` everywhere = a free app |
| a later tier is **never more expensive** | the cooperative promise: more members, lower price |
| `label` 1–40 characters | |
| milestones: up to 20, `threshold` (€ collected) positive and increasing; `title` 1–80, `description` up to 300 characters | shown on the funding page; marked reached when the app's pool gets there |

**No `pricing.json` ⇒ the app is not sold.** The shop shows it as « Pas encore
en vente » and refuses subscriptions — it is never given away by accident.

### `settings/permissions.json` — required

```json
{
  "access": [
    { "scope": "members", "level": "read",  "why": "Afficher le nom des emprunteurs." },
    { "scope": "notifications", "level": "write", "why": "Prévenir d'un retour en retard." }
  ],
  "roles": {
    "admin": "Configure l'app et gère tout.",
    "collaborator": "Enregistre les prêts et les retours.",
    "member": "Consulte le catalogue."
  }
}
```

`access` lists the **platform data your app uses outside its own tables**.
`scope` must be one of:

| scope | shown to the organization as |
|---|---|
| `members` | Membres de l'organisation |
| `organization` | Informations et relations de l'organisation |
| `users` | Profils des utilisateurs |
| `wallet` | Portefeuille de l'organisation |
| `billing` | Catalogue, devis, factures et abonnements |
| `notifications` | Notifications aux membres |
| `email` | Envoi d'e-mails |
| `events` | Événements et annonces de l'organisation |
| `register` | Caisse |
| `print` | Impression de documents (PDF) |
| `federation` | Liens entre clubs et fédération (licences, annonces) |
| `traceability` | Traçabilité entre organisations |
| `bridge` | Événements partagés avec les autres apps de l'organisation |

- `level`: `read` or `write`; a scope may appear once per level.
- `why`: 3–200 characters, in the organization's words: what the data is used
  for. **The label is written by the platform, not by you** — you only explain why.
- `roles`: `admin`, `collaborator`, `member` (any subset), 1–300 characters
  each: what that role can do in your app.
- Your own data (the tables in `cmd/<app>/schema.json`) does not go here: it is
  yours by construction, and no other app can touch it.

Declare **every** scope your code uses. Today the list is shown to the
organization before it subscribes; the platform's internal APIs will enforce
it next — an undeclared scope will then be refused.

### `pages/project.md` and `pages/funding.md` — optional

Markdown, up to 64 KiB each, shown in the subscription dialog and on the
public page `/apps/<app>/` (tabs « Présentation » and « Financement »; the
funding tab adds your tiers and goals below your text).

Supported: `#`, `##`, `###` titles, paragraphs, `-` / `*` / `1.` lists,
`**bold**`, `*italic*`, `` `code` ``, `[links](https://…)` (https and mailto
only, opened in a new tab). **No HTML** — refused by validation, and never
interpreted by the site anyway. No images.

Without `project.md`, the description of `app.json` is shown.

## Check before you push

```bash
go test ./...            # store_test.go runs the platform's validation
go run ./cmd/studio &     # then:
curl -s localhost:$PORT/api/v1/studio/ui/store | jq .
```

Errors name the file and the field to fix, for example:

```
settings/pricing.json: tier 3: the price can only go down as subscribers grow
settings/permissions.json: unknown scope "contacts" (known: billing, bridge, …)
pages/funding.md: HTML is not allowed, write Markdown
```

Unknown fields are refused too (a typo such as `"descripton"` is an error, not
a silently ignored field).

## Why so strict?

Apps are open source: anyone can publish one, and organizations subscribe and
pay for them. So the platform trusts nothing an app declares — every file is
validated twice (in your binary and again in core), sizes are bounded, prices
can only go down, the wording of permissions is the platform's own, and pages
are plain text. The platform reference (in French) is redstars-core
`docs/APP_STORE.md`; the validation code is `pkg/appstore` in redstars-core.
