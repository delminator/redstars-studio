# Core API reference — everything a plugin can call

Every API surface available to a RedStars app, in one place. Copy the
snippet you need into a slot/modal (TS) or your Go pod (Go).

Full prose: `docs/APP_PLUGIN_GUIDE.md` in the core repo.

---

## 1. `core: CoreApi` — browser, platform data

Passed to every slot/modal component. Talks to core directly; nothing
here is owned by your app.

```ts
// --- Identity / org ------------------------------------------------------
core.listMembers()        // → CoreMember[]  members of the active org
core.getActiveOrg()       // → CoreOrg       { oid, name, role }
core.getCurrentUser()     // → CoreUser      { id, username, global_id, avatar }

// --- Wallet (READ ONLY — money never moves from the browser) -------------
core.getWalletBalance()   // → { balance, currency }

// --- Subscriptions / licences (§ 4.3) ------------------------------------
core.listSubscriptionProducts()                       // → SubscriptionProduct[]
core.getSubscriptionStatus()                          // → { active, subscriptions }
core.purchaseSubscription(productId, idempotencyKey)  // → { subscription }

// --- Consent-gated member data (§ 4.4) -----------------------------------
// You DECLARE the fields you need in db/user-data.ts (→ AppPlugin
// .userDataRequest); the host runs the consent request popup on app
// open. You only READ — never raw, only what the member granted:
core.getMemberProfile(memberId)   // → { fields, granted[], withheld[] }
core.getMyConsents()              // → { fields: ConsentSetting[] }  (granted + decided)
core.updateMyConsents({ phone: true, email: false })
// Org-admin: the per-field PII request LEVELS your app asks for in this org
// (off|optional|mandatory). Backs the host's settings sliders + consent popup.
core.getAppDataRequests()         // → { requests: { <field>: 'off'|'optional'|'mandatory' } }
core.updateAppDataRequests({ phone: 'optional' })  // org-admin → { ok }

// --- Shared catalogue — core-owned, one per org, reused by every app ----
core.listProducts()             // → Product[]  (opt. { kind: 'fourniture'|'prestation' })
core.getProduct(id)             // → Product
core.createProduct(input)       // staff → { id }     (Product without id)
core.updateProduct(id, input)   // staff → { ok }
core.deleteProduct(id)          // staff → { ok }

// --- Billing profile + issuer (country-driven; for quotes/invoices) -----
core.getStoreConfig()           // → { country, currency, currency_symbol, vat_rates[], default_vat_rate }
                                //   CH org → CHF + 8.1/2.6/3.8 ; default → EUR + 20/10/5.5
core.getBillingIssuer()         // → { company_name, ide, vat_number, address, …, iban, qr_iban }
core.updateBillingIssuer(issuer) // org-admin → { ok }

// --- Quotes (devis) — core-owned, per org ; UI = { kind: 'quotes' } -----
core.listQuotes({ status? })    // → Quote[]
core.getQuote(id)               // → Quote & { lines: QuoteLine[] }
core.createQuote(input)         // staff → { id, number }   (totals computed server-side)
core.updateQuote(id, input)     // staff → { ok }   (draft only)
core.setQuoteStatus(id, status) // staff → { ok }   draft|sent|accepted|refused|expired
core.deleteQuote(id)            // staff → { ok }
core.downloadQuotePdf(id, lang) // any reader → triggers PDF download; lang = fr|de|it|en
                                // Swiss-aware devis: issuer (IDE/n° TVA), VAT breakdown,
                                // acompte, ferme/estimatif mention, "bon pour accord".

// --- Invoices (factures) — core-owned, per org ; UI = { kind: 'invoices' } ----
core.listInvoices({ status? })       // → Invoice[]   draft|sent|paid|overdue|cancelled
core.getInvoice(id)                  // → Invoice & { lines: QuoteLine[] }
core.createInvoice(input)            // staff → { id, number }
core.convertQuoteToInvoice(quoteId)  // staff → { id, number, quote_id } (marks quote accepted)
core.setInvoiceStatus(id, status)    // staff → { ok }
core.deleteInvoice(id)               // staff → { ok }
core.downloadInvoicePdf(id, lang)    // any reader → PDF with the Swiss QR-bill
                                     // (QR-IBAN → QRR reference; QR + Swiss cross)

// --- Cash register (caisse) — core-owned, per org ; UI = { kind:'cash-register' }
// Staff only. Multi-register tabs + entries + stats (income/expense/cash/check/net).
core.listRegisters()            // → RegisterDef[]
core.createRegister(name)       // staff → { id }
core.updateRegister(id, name)   // staff → { ok }
core.deleteRegister(id)         // staff → { ok }   (+ its entries)
core.listRegisterEntries({ registerId?, since?, until?, type?, method?, limit?, offset? })
                                // → RegisterEntry[]  (+ total)
core.getRegisterStats({ registerId?, since?, until? })   // → RegisterStats
core.createRegisterEntry(input) // staff → { id }   (RegisterEntryInput)
core.updateRegisterEntry(id, input) // staff → { ok }
core.deleteRegisterEntry(id)    // staff → { ok }

// --- Organization↔organization relations — core-owned ; UI = { kind:'org-members' }
core.listOrgRelations({ status?, type? })  // → OrgRelation[]  (this org's view)
core.listOrgRelationInvites()   // → OrgRelation[]  (incoming pending invites)
core.inviteOrgRelation(targetOid, type)    // admin → { ok }   type: member|client|supplier|partner
core.respondOrgRelation(id, accept)        // admin → { ok }
core.removeOrgRelation(id)      // admin → { ok }

// --- Realtime — DataBridge live events (§ 4.5) ---------------------------
// Synchronous, returns an unsubscribe — return it from a useEffect.
const off = core.subscribe('inventory', (ev) => { /* re-pull */ })
```

> **Catalogue UI** — to SHOW the catalogue, don't call these by hand: declare
> the host primitive `catalogue: { kind: 'catalog', layout: 'both', … }` in a
> view's `slots` (list + cards + search + staff CRUD, zero code). Use the
> `core.*Product*` methods only to consume catalogue items in code (e.g. quote
> lines). The catalogue is core-owned and shared across the org's apps — never
> create your own products table. See `redstars-core/docs/CATALOG_PLATFORM.md`.

> **Cash register UI** — to SHOW the caisse, declare `{ kind: 'cash-register' }`
> in a (staff) view's `slots`: the host renders entries + stats + add/edit/delete
> + multi-register tabs, zero code. The `core.*Register*` methods are only for
> consuming register data in code. Core-owned, shared across the org's apps —
> never create your own register table. See `redstars-core/docs/REGISTER_PLATFORM.md`.

> **Org relations UI** — to SHOW the org↔org relations workspace (invite an org
> as client/supplier/partner/member, accept/decline, list), declare
> `{ kind: 'org-members' }` in a view's `slots`. Use the `core.*OrgRelation*`
> methods only to consume relations in code. See `redstars-core/docs/ORG_RELATIONS.md`.

> **Member directory tabs** — the `{ kind: 'member-list' }` slot is a TABBED view.
> Pick the tabs in the slot config (no extra sidebar items): `relations: true`
> adds a **Réseau** tab (org-members), `offlineMembers: true` adds a right-aligned
> orange **Membres hors ligne** tab — core-managed members without a user account
> (`core.listOfflineMembers / createOfflineMember / updateOfflineMember /
> deleteOfflineMember`), usable as a quote/invoice client (`client_offline_id`).

Every method except `subscribe` returns `Promise<ApiResponse<T>>`:
`{ ok: true, data } | { ok: false, error: { status, message } }`.

---

## 2. `api: AppApi` — browser, YOUR backend

Pre-bound to `/api/v1/studio`. Use it for everything app-specific. The
host attaches the session cookie + `X-Organization-OID`.

```ts
api.get<T>('/path', { query: { k: v } })
api.post<T>('/path', body)
api.put<T>('/path', body)
api.patch<T>('/path', body)
api.delete<T>('/path')
// path is AFTER the prefix: '/items' → GET /api/v1/studio/items
```

---

## 3. `core *sdk.CoreClient` — Go pod, server-side

Your Go pod's typed client for core's `/internal/*` APIs. Created in
`main.go` via `sdk.NewCoreClient(coreURL, "studio", internalKey)`. Every
call takes a `RequestContext` (forwards the user's JWT + org).

```go
// --- Org database (your {app}_* tables) ----------------------------------
core.ListRows(ctx, "studio_items", params)        // SELECT
core.GetRow(ctx, "studio_items", id)
core.InsertRow(ctx, "studio_items", data)
core.UpdateRow(ctx, "studio_items", id, data)
core.DeleteRow(ctx, "studio_items", id)
core.RawQuery(ctx, "SELECT ...", params)         // SELECT-only

// --- Shared app-common DB ------------------------------------------------
core.ListCommon(ctx, "table", params)

// --- Users / members ------------------------------------------------------
core.GetCurrentUser(ctx)
core.GetCurrentMember(ctx)
core.ListMembers(ctx)
core.GetMemberProfile(ctx, userID)               // consent-gated

// --- App settings ---------------------------------------------------------
core.GetSettings(ctx)
core.UpdateSettings(ctx, data)

// --- Wallet — money moves SERVER-SIDE ONLY -------------------------------
core.GetWalletBalance(ctx)
core.WalletTransaction(ctx, amount, desc, refType, refID)

// --- Subscriptions / licences --------------------------------------------
core.ListSubscriptionProducts(ctx, includeInactive)
core.GetSubscriptionStatus(ctx)
core.PurchaseSubscription(ctx, productID, idempotencyKey)
core.CreateSubscriptionProduct(ctx, fields)      // admin
core.UpdateSubscriptionProduct(ctx, id, fields)  // admin

// --- DataBridge live events ----------------------------------------------
core.PublishBridgeEvent(ctx, "inventory", "updated", data)

// --- Email ---------------------------------------------------------------
core.SendEmail(ctx, to, subject, htmlBody)

// --- App install / migrate -----------------------------------------------
core.Install(ctx, sql)
core.Migrate(ctx, sql, version)
```

---

## 4. What plugins CANNOT do

- Move money from the browser — wallet writes are server-side only.
- Access another app's `{app}_*` tables — core scopes by verified pod identity.
- Read a member's PII without consent — `getMemberProfile` returns only granted fields.
- Open their own WebSocket — realtime rides the host's single socket via `core.subscribe`.
- Hardcode colours — use the `c-*` palette tokens.
