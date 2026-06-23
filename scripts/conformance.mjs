#!/usr/bin/env node
// conformance.mjs — does an app still conform to the RedStars template?
//
// Detects DRIFT: an app that has fallen behind the template's structure
// or the core contract. It only DETECTS + REPORTS — the dev resolves
// what's flagged. No merging, no auto-update.
//
//   node conformance.mjs [APP_DIR]      (APP_DIR defaults to cwd)
//
// The script's own repo (the template) is the reference. Exit code 1 if
// any ✗ (broken against the current contract); ⚠ (behind but working)
// does not fail.

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(process.argv[2] || '.')
const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const results = []
const ok   = (label, detail = '') => results.push({ lvl: 'ok',   label, detail })
const warn = (label, detail = '') => results.push({ lvl: 'warn', label, detail })
const fail = (label, detail = '') => results.push({ lvl: 'fail', label, detail })

const exists = (...p) => fs.existsSync(path.join(APP, ...p))
const read   = (...p) => fs.readFileSync(path.join(APP, ...p), 'utf8')

// --- 1. Structure ----------------------------------------------------------
if (!exists('ui', 'src', 'plugin.ts')) {
  fail('structure', 'ui/src/plugin.ts is missing — not a plugin repo?')
} else if (!exists('ui', 'src', 'collaborator')) {
  fail('structure', 'ui/src/collaborator/ is missing — the required base view')
} else {
  const opt = ['admin', 'user', 'modales', 'tabs'].filter(d => exists('ui', 'src', d))
  ok('structure', `collaborator/ + ${opt.join(' ') || '(no optional dirs)'}`)
}

// --- 2. plugin.ts shape ----------------------------------------------------
if (exists('ui', 'src', 'plugin.ts')) {
  const src = read('ui', 'src', 'plugin.ts')
  const has = (re) => re.test(src)
  const missing = []
  if (!has(/\bid\s*:/))             missing.push('id')
  if (!has(/\bviews\s*:/))          missing.push('views')
  if (!has(/\bcollaborator\s*:/))   missing.push('views.collaborator')
  if (missing.length) fail('plugin.ts', `required field(s) absent: ${missing.join(', ')}`)
  else if (!has(/\bminCoreVersion\s*:/)) warn('plugin.ts', 'minCoreVersion not declared')
  else ok('plugin.ts', 'AppPlugin shape OK')
}

// --- 2b. Catalogue capability — adopt the core `catalog` primitive ---------
// The product/service catalogue is now a CORE platform capability (the
// `{ kind: 'catalog' }` slot primitive → core's /api/v1/store). An app must
// NOT ship its own catalogue table/UI. Drift here is the "please update"
// signal surfaced in each app's CI by the conformance workflow.
{
  const uiDir = path.join(APP, 'ui', 'src')
  let ui = ''
  const walk = (d) => { for (const e of (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) ui += fs.readFileSync(p, 'utf8') + '\n'
  } }
  walk(uiDir)
  const cmdDir = path.join(APP, 'cmd')
  const goSrc = (fs.existsSync(cmdDir) ? fs.readdirSync(cmdDir) : [])
    .map(d => path.join(cmdDir, d, 'main.go'))
    .filter(fs.existsSync)
    .map(f => fs.readFileSync(f, 'utf8')).join('\n')
  const usesPrimitive = /kind:\s*['"]catalog['"]/.test(ui)
  // Match the specific bespoke PRODUCT-catalogue signals only. The bare word
  // "Catalogue" is too broad — it false-flags apps whose "catalogue" is a
  // different entity (e.g. ludo's GAME catalogue, which must NOT migrate; see
  // CATALOG_PLATFORM.md §8).
  const bespoke = /CatalogueBoard\b/.test(ui)
    || /_produit\b|_product\b/.test(goSrc)
    || /\/products\b/.test(goSrc)
  if (usesPrimitive) ok('catalogue', "uses the core `catalog` primitive")
  else if (bespoke) warn('catalogue', "ships its OWN catalogue — migrate to the core `{ kind: 'catalog' }` primitive (redstars-core/docs/CATALOG_PLATFORM.md)")
  // no catalogue at all → nothing to flag.
}

// --- 2c. Cash register capability — adopt the core `cash-register` primitive
// The cash register (caisse) is now a CORE platform capability (the
// `{ kind: 'cash-register' }` slot primitive → core's /api/v1/register). An app
// must NOT ship its own register table/UI nor bridge the host's
// CashRegisterFullscreen via a shell-compat shim.
{
  const uiDir = path.join(APP, 'ui', 'src')
  let ui = ''
  const walk = (d) => { for (const e of (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) ui += fs.readFileSync(p, 'utf8') + '\n'
  } }
  walk(uiDir)
  const usesPrimitive = /kind:\s*['"]cash-register['"]/.test(ui)
  const bespoke = /LudoCashRegister|CashRegisterTab|CashRegisterModal|CashRegisterFullscreen/.test(ui)
    || /shell-compat\/components\/cash-register/.test(ui)
  if (usesPrimitive) ok('cash-register', "uses the core `cash-register` primitive")
  else if (bespoke) warn('cash-register', "ships its OWN cash register — migrate to the core `{ kind: 'cash-register' }` primitive (redstars-core/docs/REGISTER_PLATFORM.md)")
  // no cash register at all → nothing to flag.
}

// --- 2d. Billing capability — adopt the core `quotes`/`invoices` primitives --
// Quotes (devis) and invoices (factures), incl. the Swiss QR-bill, are CORE
// platform capabilities (the `{ kind: 'quotes' }` / `{ kind: 'invoices' }` slot
// primitives → core's /api/v1/store). An app must NOT ship its own quote/invoice
// tables, totals, or PDF/QR-bill rendering.
{
  const uiDir = path.join(APP, 'ui', 'src')
  let ui = ''
  const walk = (d) => { for (const e of (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) ui += fs.readFileSync(p, 'utf8') + '\n'
  } }
  walk(uiDir)
  const cmdDir = path.join(APP, 'cmd')
  const goSrc = (fs.existsSync(cmdDir) ? fs.readdirSync(cmdDir) : [])
    .map(d => path.join(cmdDir, d, 'main.go')).filter(fs.existsSync)
    .map(f => fs.readFileSync(f, 'utf8')).join('\n')
  const usesPrimitive = /kind:\s*['"](quotes|invoices)['"]/.test(ui)
  // Bespoke billing signals: own quote/invoice tables or a QR-bill/PDF renderer.
  const bespoke = /_devis\b|_facture\b|_invoice\b|\/quotes\b|\/invoices\b/.test(goSrc)
    || /go-qrcode|swissQR|qr-?bill|QRBill/i.test(goSrc)
    || /gofpdf|go-pdf\/fpdf/.test(goSrc)
  if (usesPrimitive) ok('billing', "uses the core `quotes`/`invoices` primitives")
  else if (bespoke) warn('billing', "ships its OWN quotes/invoices — migrate to the core `{ kind: 'quotes' }` / `{ kind: 'invoices' }` primitives (redstars-core/docs/CATALOG_PLATFORM.md)")
  // no billing at all → nothing to flag.
}

// --- 2e. Contract pin — the app must declare @delminator/core-ui ---------------
// The contract is a versioned package (workspace:* in-tree, ^x.y.z for indie
// devs). An app that doesn't declare it can't enforce build-time type safety
// nor track the contract version it targets. See docs/PLATFORM_PIPELINE.md §4.
if (exists('ui', 'package.json')) {
  const pkg = read('ui', 'package.json')
  const m = pkg.match(/"@delminator\/core-ui"\s*:\s*"([^"]+)"/)
  if (m) ok('contract pin', `@delminator/core-ui ${m[1]}`)
  else warn('contract pin', 'ui/package.json does not declare @delminator/core-ui — pin it (workspace:* in-tree, ^x.y.z for indie devs)')
}

// --- 2f. Host externalization — /host must be a Vite external ---------------
// Host UI components (@delminator/core-ui/host) are provided at RUNTIME by the
// host via window.__shell__. If the app imports them but DOESN'T externalize
// /host in vite.config, they get bundled → bloat + a second React copy.
{
  const uiDir = path.join(APP, 'ui', 'src')
  let ui = ''
  const walk = (d) => { for (const e of (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) ui += fs.readFileSync(p, 'utf8') + '\n'
  } }
  walk(uiDir)
  const importsHost = /from\s+['"]@delminator\/core-ui\/host['"]/.test(ui)
  const viteFile = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']
    .map(f => path.join(APP, 'ui', f)).find(fs.existsSync)
  const vite = viteFile ? fs.readFileSync(viteFile, 'utf8') : ''
  const externalized = /@delminator\/core-ui\/host/.test(vite)
  if (importsHost && !externalized) {
    warn('host externals', "imports @delminator/core-ui/host but vite.config doesn't externalize it — add it to rollupOptions.external (else it's bundled + duplicates React)")
  } else if (importsHost) {
    ok('host externals', '@delminator/core-ui/host externalized')
  }
  // doesn't import host components → nothing to flag.
}

// --- 2g. Design tokens — theme via c-* tokens, never raw Tailwind colours ---
// Surfaces/text/borders must use the palette-driven `c-*` tokens (c-bg, c-card,
// c-text, c-accent, c-success…) so a palette swap re-themes the whole fleet and
// every app matches the host primitives (member-list, dashboard, caisse). Raw
// Tailwind hues (`bg-gray-800`, `text-purple-600`, …) and `dark:` colour variants
// are DRIFT: they ignore the palette, don't resolve reliably in the plugin subtree,
// and make an app's surfaces diverge from the shared ones (e.g. a white catalogue
// next to a themed member list). Elevation is host-centralised too: `shadow-*`
// compiles to a 1px c-border ring, `drop-shadow-*` is neutralised — don't hand-roll
// shadows. SoT: redstars-core/docs/DESIGN_SYSTEM.md.
{
  const uiDir = path.join(APP, 'ui', 'src')
  const HUES = 'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
  const rawColor = new RegExp(`(?:bg|text|border|ring|from|to|via|divide|fill|stroke|placeholder)-(?:${HUES})-\\d{2,3}`, 'g')
  const darkVariant = new RegExp(`dark:(?:hover:|focus:|active:|group-hover:)*(?:bg|text|border|ring|from|to|via|divide)-(?:white|black|${HUES})`, 'g')
  const offenders = []
  let raw = 0, dark = 0
  const walk = (d) => { for (const e of (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : [])) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8')
      const r = (t.match(rawColor) || []).length
      const k = (t.match(darkVariant) || []).length
      if (r + k > 0) { offenders.push([path.relative(uiDir, p), r + k]); raw += r; dark += k }
    }
  } }
  walk(uiDir)
  if (offenders.length === 0) {
    ok('design tokens', 'all surfaces use c-* palette tokens')
  } else {
    const total = raw + dark
    const top = offenders.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${f}(${n})`).join(', ')
    warn('design tokens', `${total} raw Tailwind colour/dark: class(es) in ${offenders.length} file(s) — migrate to c-* tokens (DESIGN_SYSTEM.md). Top: ${top}`)
  }
}

// --- 3. Core SDK source -----------------------------------------------------
// The canonical Core SDK lives in the core repo at apps/backend/pkg/coresdk;
// apps import it via `replace github.com/delminator/redstars/backend => ../backend`
// so there's a SINGLE source of truth — no per-repo copy that can drift.
// Conformance: check the app imports it. If it still ships its own sdk/, flag it.
const mainGoCandidates = fs.existsSync(path.join(APP, 'cmd'))
  ? fs.readdirSync(path.join(APP, 'cmd')).map(d => path.join(APP, 'cmd', d, 'main.go'))
  : []
const mainGo = mainGoCandidates.find(fs.existsSync)
if (!mainGo) {
  warn('core SDK', 'cmd/<app>/main.go not found — cannot determine SDK usage')
} else {
  const src = fs.readFileSync(mainGo, 'utf8')
  const usesShared = /github\.com\/delminator\/redstars\/backend\/pkg\/coresdk/.test(src)
  const hasLegacySdk = fs.existsSync(path.join(APP, 'sdk', 'core_client.go'))
  if (usesShared && !hasLegacySdk) ok('core SDK', 'uses shared coresdk from core repo (zero drift)')
  else if (usesShared && hasLegacySdk) warn('core SDK', 'imports shared coresdk but legacy sdk/ folder still present — delete it')
  else if (hasLegacySdk) warn('core SDK', 'using legacy per-repo sdk/core_client.go — migrate to shared backend/pkg/coresdk to inherit new methods automatically')
  else warn('core SDK', 'main.go does not import coresdk — app may not use the Go SDK')
}

// --- 4. CI + signing -------------------------------------------------------
for (const wf of ['build-plugin.yml', 'deploy-dev.yml']) {
  if (!exists('.github', 'workflows', wf)) warn('ci', `.github/workflows/${wf} missing`)
}
if (!exists('scripts', 'plugin-sign.mjs')) warn('signing', 'scripts/plugin-sign.mjs missing')
if (!results.some(r => r.label === 'ci' || r.label === 'signing')) ok('ci', 'workflows + signer present')

// --- 5. Contract compile check (strongest signal) -------------------------
if (exists('ui', 'node_modules')) {
  try {
    execSync('node_modules/.bin/tsc --noEmit -p tsconfig.json', {
      cwd: path.join(APP, 'ui'), stdio: 'pipe',
    })
    ok('contract', 'ui/ typechecks against the current @delminator/core-ui')
  } catch (e) {
    const full = (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
    const out = full.trim().split('\n').slice(0, 3).join(' / ')
    // `@delminator/core-ui` is a private workspace package — it isn't installable
    // from a standalone app repo (no registry entry), so CI without the
    // workspace can't resolve it. That's an ENVIRONMENT limit, not app drift:
    // degrade to ⚠ (contract unchecked here) rather than ✗ (broken). The check
    // still runs fully where the contract resolves (local workspace / symlink).
    if (/Cannot find module '@delminator\/core-ui/.test(full)) {
      warn('contract', '@delminator/core-ui not resolvable here — contract typecheck skipped (verify in the workspace)')
    } else {
      fail('contract', `ui/ no longer compiles against @delminator/core-ui — ${out}`)
    }
  }
} else {
  warn('contract', 'ui/node_modules absent — run `pnpm install` to verify the compile')
}

// --- Report ----------------------------------------------------------------
const icon = { ok: '\x1b[32m✓\x1b[0m', warn: '\x1b[33m⚠\x1b[0m', fail: '\x1b[31m✗\x1b[0m' }
console.log(`\nRedStars conformance — ${APP}\n`)
for (const r of results) {
  console.log(`  ${icon[r.lvl]} ${r.label.padEnd(12)} ${r.detail}`)
}
const fails = results.filter(r => r.lvl === 'fail').length
const warns = results.filter(r => r.lvl === 'warn').length
console.log(
  `\n${fails ? '\x1b[31mDRIFT — broken' : warns ? '\x1b[33mDRIFT — behind' : '\x1b[32mCONFORMANT'}\x1b[0m`
  + ` (${fails} broken, ${warns} behind)\n`,
)
process.exit(fails ? 1 : 0)
