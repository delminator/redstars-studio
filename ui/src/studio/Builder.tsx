// redstars-studio — the in-app application builder.
//
// Flow: a short ASSISTANT for IDENTITY (create the app), then a BUILDER
// WORKSPACE where you add "bricks" (host primitives). A brick that stores data
// (list/collection/tasks/announcements) defines its fields right there — no
// separate "entities" step. Identity stays editable (✎ button). Export the spec
// → the codegen (redstars/tools/builder) turns it into a real deployable app.
import { useState, useMemo, useEffect } from 'react'
import type { ViewSlotProps } from '@delminator/core-ui'
import registryData from '../primitive-registry.json'

type L = { fr: string; en: string }
type Field = { name: string; type: string; required?: boolean; options?: string[] }
type Entity = { name: string; kind?: string; fields?: Field[] }
type Item = { id: string; label: L; icon?: string; align?: 'bottom'; slot: Record<string, unknown> }
type Spec = {
  id: string; name: L; icon: string; description: string; color: string
  accentToken: string; port: number; version: string; minCoreVersion: string
  visibility: string; entities: Entity[]; views: Record<string, { menu: Item[] }>
}

const PRIMS = (registryData as { primitives: Array<Record<string, unknown>> }).primitives
const DATA_BRICKS = new Set(['object-list', 'collection', 'tasks', 'announcements'])
const FIELD_TYPES = ['text', 'number', 'date', 'bool', 'enum']
// Two spaces only: "Gestion" = the collaborator view (what staff AND admins
// see — they're the same back-office), and "Espace membre" = the user view.
// The admin-only delta is an advanced concept, not exposed in the no-code UI.
const VIEWS: Array<{ k: string; fr: string; en: string }> = [
  { k: 'collaborator', fr: 'Gestion', en: 'Management' },
  { k: 'user', fr: 'Espace membre', en: 'Member space' },
]
const KIND_ICON: Record<string, string> = {
  'member-list': '👥', catalog: '🛍️', quotes: '📝', invoices: '💰', 'org-members': '🤝',
  'cash-register': '💵', 'object-list': '📋', collection: '🗂️', dashboard: '📊', settings: '⚙️',
  tasks: '✅', announcements: '📣', sections: '🧱',
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const card = 'bg-c-card border border-c-border rounded-xl'
const inp = 'w-full border border-c-border rounded px-3 py-2 text-sm bg-c-card text-c-text'
const btn = 'rounded-lg bg-c-accent px-4 py-2 text-sm font-medium text-c-text hover:opacity-90 disabled:opacity-50'
const btnGhost = 'rounded-lg border border-c-border px-3 py-2 text-xs text-c-text-muted hover:bg-c-accent/5'

function blank(): Spec {
  return {
    id: '', name: { fr: '', en: '' }, icon: '🧩', description: '', color: '#6366f1',
    accentToken: 'c-accent', port: 3021, version: '0.1.0', minCoreVersion: '0.6.0',
    visibility: 'public', entities: [], views: { collaborator: { menu: [] } },
  }
}

function buildSlot(kind: string, entity: Entity | undefined, label: L): Record<string, unknown> {
  const ep = entity ? '/' + entity.name : '/items'
  const cols = (entity?.fields || []).map(f => ({ key: f.name, label: { fr: f.name, en: f.name }, ...(f.type === 'number' ? { format: 'number' } : f.type === 'date' ? { format: 'date' } : {}) }))
  const cf = (entity?.fields || []).map(f => ({ key: f.name, label: { fr: f.name, en: f.name }, type: f.type === 'bool' ? 'text' : f.type, required: f.required, ...(f.type === 'enum' && f.options ? { options: f.options.map(o => ({ value: o, label: { fr: o, en: o } })) } : {}) }))
  switch (kind) {
    case 'member-list': return { kind, display: { username: true, avatar: true, role: true, activeBadge: true } }
    case 'catalog': return { kind, layout: 'both' }
    case 'quotes': case 'invoices': case 'org-members': return { kind }
    case 'cash-register': return { kind, multiRegister: true }
    case 'settings': return { kind, blocks: [{ kind: 'profile' }, { kind: 'wallet' }, { kind: 'scanner' }] }
    case 'dashboard': return { kind, title: label, kpis: [{ label: { fr: 'Membres', en: 'Members' }, icon: '👥', core: 'members' }] }
    case 'object-list': return { kind, endpoint: ep, title: label, columns: cols.length ? cols : [{ key: 'name', label: { fr: 'Nom', en: 'Name' } }], createFields: cf }
    case 'collection': return { kind, endpoint: ep, title: label, layout: 'both', columns: cols.length ? cols : [{ key: 'name', label: { fr: 'Nom', en: 'Name' } }], createFields: cf }
    case 'announcements': return { kind, title: label, announcements: { endpoint: ep } }
    case 'tasks': return { kind, title: label, sources: [{ kind: 'query', id: entity?.name || 'items', label, endpoint: ep, item: { title: entity?.fields?.[0]?.name || 'name', tag: label } }] }
    default: return { kind }
  }
}

// Structural preview: a wireframe per primitive kind (no host components, just
// a recognizable mock so you "see" the app shape before generating).
const KIND_PREVIEW: Record<string, { label: string; layout: string }> = {
  'member-list': { label: 'Annuaire des membres', layout: 'list' },
  catalog: { label: 'Catalogue', layout: 'cards' },
  quotes: { label: 'Devis', layout: 'table' },
  invoices: { label: 'Factures', layout: 'table' },
  'org-members': { label: 'Partenaires', layout: 'list' },
  'cash-register': { label: 'Caisse', layout: 'blocks' },
  'object-list': { label: '', layout: 'table' },
  collection: { label: '', layout: 'table' },
  dashboard: { label: 'Tableau de bord', layout: 'tiles' },
  settings: { label: 'Paramètres', layout: 'blocks' },
  tasks: { label: 'Tâches', layout: 'list' },
  announcements: { label: 'Annonces', layout: 'feed' },
}
function PreviewBody({ slot }: { slot: Record<string, unknown> }) {
  const meta = KIND_PREVIEW[String(slot.kind)] || { label: String(slot.kind), layout: 'list' }
  const cols = (slot.columns as Array<{ label: L }> | undefined) || []
  const sk = (n: number) => Array.from({ length: n })
  const bar = 'rounded bg-c-border/40'
  if (meta.layout === 'table') {
    const heads = cols.length ? cols.map(c => c.label.fr) : ['Nom', 'Statut', 'Date']
    return (
      <div className="border border-c-border rounded-lg overflow-hidden">
        <div className="flex bg-c-bg text-xs text-c-text-muted px-2 py-1.5 gap-3">{heads.map((h, i) => <span key={i} className="flex-1 truncate">{h}</span>)}</div>
        {sk(3).map((_, r) => <div key={r} className="flex px-2 py-2 gap-3 border-t border-c-border">{heads.map((_, i) => <span key={i} className={`flex-1 h-3 ${bar}`} />)}</div>)}
      </div>
    )
  }
  if (meta.layout === 'cards') return <div className="grid grid-cols-3 gap-2">{sk(6).map((_, i) => <div key={i} className="border border-c-border rounded-lg p-2"><div className={`h-12 mb-1 ${bar}`} /><div className={`h-2.5 w-3/4 ${bar}`} /></div>)}</div>
  if (meta.layout === 'tiles') return <div className="grid grid-cols-3 gap-2">{sk(3).map((_, i) => <div key={i} className="border border-c-border rounded-lg p-3"><div className="h-6 w-10 rounded bg-c-accent/30 mb-1" /><div className={`h-2 w-2/3 ${bar}`} /></div>)}</div>
  if (meta.layout === 'feed') return <div className="space-y-2">{sk(3).map((_, i) => <div key={i} className="border border-c-border rounded-lg p-2"><div className={`h-3 w-1/3 mb-1 ${bar}`} /><div className={`h-2 w-full ${bar}`} /></div>)}</div>
  if (meta.layout === 'blocks') return <div className="space-y-2">{sk(3).map((_, i) => <div key={i} className="border border-c-border rounded-lg h-10" />)}</div>
  return <div className="space-y-1.5">{sk(4).map((_, i) => <div key={i} className="flex items-center gap-2 border border-c-border rounded-lg p-2"><div className="w-8 h-8 rounded-full bg-c-border/40" /><div className={`h-2.5 w-1/3 ${bar}`} /></div>)}</div>
}

export default function Builder({ i18n }: ViewSlotProps) {
  const fr = i18n.language === 'fr'
  const T = (a: string, b: string) => (fr ? a : b)
  // ---- persistence: auto-save the working draft + named projects (localStorage)
  const LS = 'studio:current', LSP = 'studio:projects', LSN = 'studio:currentName'
  const readJSON = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
  const resumed = useMemo(() => readJSON(LS), [])
  const [spec, setSpec] = useState<Spec>(() => (resumed && typeof resumed === 'object') ? { ...blank(), ...resumed } : blank())
  const [phase, setPhase] = useState<'identity' | 'build'>(() => (resumed && slug(resumed.id || '').length >= 3 && resumed.name?.fr) ? 'build' : 'identity')
  const [role, setRole] = useState('collaborator')
  const [projName, setProjName] = useState<string>(() => { try { return localStorage.getItem(LSN) || '' } catch { return '' } })
  const [projects, setProjects] = useState<Record<string, Spec>>(() => readJSON(LSP) || {})
  const up = (fn: (s: Spec) => void) => setSpec(s => { const n = structuredClone(s); fn(n); return n })

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(spec)) } catch { /* */ } }, [spec])
  useEffect(() => { try { localStorage.setItem(LSN, projName) } catch { /* */ } }, [projName])
  const persistProjects = (next: Record<string, Spec>) => { setProjects(next); try { localStorage.setItem(LSP, JSON.stringify(next)) } catch { /* */ } }
  const saveProject = () => { const name = (projName || spec.name.fr || spec.id || 'Sans titre').trim(); setProjName(name); persistProjects({ ...projects, [name]: structuredClone(spec) }) }
  const loadProject = (name: string) => { const p = projects[name]; if (!p) return; setSpec({ ...blank(), ...structuredClone(p) }); setProjName(name); setPhase(slug(p.id || '').length >= 3 && p.name?.fr ? 'build' : 'identity'); setRole('collaborator') }
  const deleteProject = (name: string) => { const next = { ...projects }; delete next[name]; persistProjects(next) }
  const newProject = () => { setSpec(blank()); setProjName(''); setRole('collaborator'); setPhase('identity') }

  const identityValid = slug(spec.id).length >= 3 && !!spec.name.fr
  const cleanSpec = useMemo(() => { const s = structuredClone(spec); s.id = slug(s.id); if (!s.entities.length) delete (s as Record<string, unknown>).entities; return s }, [spec])
  const specJson = useMemo(() => JSON.stringify(cleanSpec, null, 2), [cleanSpec])
  const totalBricks = Object.values(spec.views).reduce((n, v) => n + v.menu.length, 0)
  const exportable = identityValid && totalBricks > 0

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([specJson], { type: 'application/json' }))
    a.download = `${slug(spec.id) || 'app'}.spec.json`; a.click(); URL.revokeObjectURL(a.href)
  }

  // ---- add-brick panel -------------------------------------------------------
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState(false)
  const [pSel, setPSel] = useState(0)
  const move = (i: number, dir: -1 | 1) => up(s => { const m = s.views[role].menu; const j = i + dir; if (j < 0 || j >= m.length) return;[m[i], m[j]] = [m[j], m[i]] })
  const [d, setD] = useState({ kind: '', fr: '', en: '', icon: '', align: false, entity: '', fields: [] as Field[] })
  const startAdd = () => { setD({ kind: '', fr: '', en: '', icon: '', align: false, entity: '', fields: [] }); setAdding(true) }
  const pickKind = (k: string) => setD(x => ({ ...x, kind: k, icon: x.icon || KIND_ICON[k] || '📄', entity: DATA_BRICKS.has(k) && k !== 'announcements' ? (x.entity || '') : x.entity }))
  const commitBrick = () => {
    const label = { fr: d.fr || d.kind, en: d.en || d.fr || d.kind }
    let entity: Entity | undefined
    if (DATA_BRICKS.has(d.kind)) {
      const name = slug(d.entity || d.fr || d.kind) || d.kind
      entity = d.kind === 'announcements' ? { name, kind: 'announcements' } : { name, fields: d.fields.filter(f => f.name) }
      up(s => { if (!s.entities.find(e => e.name === entity!.name)) s.entities.push(entity!) })
    }
    const item: Item = { id: slug(d.fr || d.kind) || d.kind, label, ...(d.icon ? { icon: d.icon } : {}), ...(d.align ? { align: 'bottom' as const } : {}), slot: buildSlot(d.kind, entity, label) }
    up(s => { (s.views[role] ||= { menu: [] }).menu.push(item) })
    setAdding(false)
  }
  const needsFields = DATA_BRICKS.has(d.kind) && d.kind !== 'announcements'
  const canCommit = d.kind && (d.fr || d.kind) && (!needsFields || d.fields.some(f => f.name))

  // ---- projects bar (shown in both phases) ----------------------------------
  const savedNames = Object.keys(projects)
  const projectsBar = (
    <div className={`${card} px-3 py-2 flex flex-wrap items-center gap-2`}>
      <span className="text-xs text-c-text-muted">{T('Projet', 'Project')} :</span>
      <input className="border border-c-border rounded px-2 py-1 text-sm bg-c-card text-c-text w-44"
        placeholder={T('Sans titre', 'Untitled')} value={projName} onChange={e => setProjName(e.target.value)} />
      <button className={btnGhost} onClick={saveProject}>💾 {T('Enregistrer', 'Save')}</button>
      {savedNames.length > 0 && (
        <select className="border border-c-border rounded px-2 py-1 text-sm bg-c-card text-c-text" value=""
          onChange={e => { if (e.target.value) loadProject(e.target.value) }}>
          <option value="">📂 {T('Charger…', 'Load…')}</option>
          {savedNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      <button className={btnGhost} onClick={newProject}>+ {T('Nouveau', 'New')}</button>
      {projName && projects[projName] && <button className="text-c-error text-xs" title={T('Supprimer ce projet', 'Delete project')} onClick={() => deleteProject(projName)}>🗑</button>}
      <span className="text-[11px] text-c-success ml-auto">✓ {T('sauvegarde auto', 'auto-saved')}</span>
    </div>
  )

  // ===========================================================================
  // PHASE 1 — IDENTITY (the only assistant step)
  // ===========================================================================
  if (phase === 'identity') {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4">
        {projectsBar}
        <div>
          <h2 className="text-xl font-semibold text-c-text">{T('Nouvelle application', 'New application')} 🛠️</h2>
          <p className="text-sm text-c-text-muted">{T('Étape 1 — donnez une identité à votre app. Vous ajouterez les écrans (briques) juste après.', 'Step 1 — give your app an identity. You add the screens (bricks) right after.')}</p>
        </div>
        <div className={`${card} p-4 space-y-3`}>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-c-text">{T('Identifiant (a-z, court)', 'Id (a-z, short)')}
              <input className={inp} value={spec.id} onChange={e => up(s => { s.id = e.target.value })} placeholder="monclub" /></label>
            <label className="text-sm text-c-text">{T('Icône (emoji)', 'Icon (emoji)')}
              <input className={inp} value={spec.icon} onChange={e => up(s => { s.icon = e.target.value })} /></label>
            <label className="text-sm text-c-text">{T('Nom (FR)', 'Name (FR)')}
              <input className={inp} value={spec.name.fr} onChange={e => up(s => { s.name.fr = e.target.value })} /></label>
            <label className="text-sm text-c-text">{T('Nom (EN)', 'Name (EN)')}
              <input className={inp} value={spec.name.en} onChange={e => up(s => { s.name.en = e.target.value })} /></label>
            <label className="text-sm text-c-text">{T('Port', 'Port')}
              <input type="number" className={inp} value={spec.port} onChange={e => up(s => { s.port = +e.target.value })} /></label>
            <label className="text-sm text-c-text">{T('Accent', 'Accent')}
              <select className={inp} value={spec.accentToken} onChange={e => up(s => { s.accentToken = e.target.value })}>
                {['c-accent', 'c-success', 'c-info', 'c-warning', 'c-error'].map(a => <option key={a} value={a}>{a}</option>)}
              </select></label>
          </div>
          <label className="text-sm text-c-text block">{T('Description', 'Description')}
            <textarea className={inp} rows={2} value={spec.description} onChange={e => up(s => { s.description = e.target.value })} /></label>
          {!identityValid && <p className="text-xs text-c-warning">{T('Renseignez un identifiant (≥3 lettres) et un nom FR.', 'Set an id (≥3 letters) and a FR name.')}</p>}
        </div>
        <div className="flex justify-end">
          <button className={btn} disabled={!identityValid} onClick={() => setPhase('build')}>{T('Créer l’app', 'Create app')} →</button>
        </div>
      </div>
    )
  }

  // ===========================================================================
  // PHASE 2 — BUILDER WORKSPACE (add bricks)
  // ===========================================================================
  const menu = spec.views[role]?.menu || []

  // ---- PREVIEW (structural wireframe) ----
  if (preview) return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {projectsBar}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">{spec.icon}</span>
        <div className="mr-auto"><div className="font-semibold text-c-text">{spec.name.fr || spec.id}</div><div className="text-xs text-c-text-muted">{T('Aperçu (maquette)', 'Preview (wireframe)')}</div></div>
        <div className="flex gap-1">{VIEWS.filter(v => spec.views[v.k]).map(v => (
          <button key={v.k} onClick={() => { setRole(v.k); setPSel(0) }} className={`px-3 py-1.5 rounded-lg text-sm ${role === v.k ? 'bg-c-accent/15 text-c-accent font-medium' : 'text-c-text hover:bg-c-accent/5'}`}>{T(v.fr, v.en)}</button>
        ))}</div>
        <button className={btnGhost} onClick={() => setPreview(false)}>← {T('Édition', 'Edit')}</button>
      </div>
      <div className="flex gap-3 border border-c-border rounded-xl overflow-hidden bg-c-card" style={{ minHeight: 340 }}>
        <div className="w-44 shrink-0 bg-c-bg p-2 space-y-1 border-r border-c-border">
          <div className="text-xs text-c-text-muted px-1 mb-1 truncate">{spec.icon} {spec.name.fr}</div>
          {menu.map((it, i) => <button key={i} onClick={() => setPSel(i)} className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${pSel === i ? 'bg-c-accent/15 text-c-accent' : 'text-c-text hover:bg-c-accent/5'}`}>{it.icon} {it.label.fr}</button>)}
          {!menu.length && <div className="text-xs text-c-text-muted px-1">{T('Aucun écran', 'No screen')}</div>}
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {menu[pSel]
            ? <><div className="text-sm font-semibold text-c-text mb-3">{menu[pSel].label.fr}</div><PreviewBody slot={menu[pSel].slot} /></>
            : <div className="text-sm text-c-text-muted">{T('Sélectionnez un écran à gauche.', 'Select a screen on the left.')}</div>}
        </div>
      </div>
      <p className="text-[11px] text-c-text-muted">{T('Maquette structurelle. Le rendu réel utilisera les vrais composants du host.', 'Structural wireframe. Real rendering uses the host components.')}</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {projectsBar}
      {/* header — identity stays editable */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl">{spec.icon}</span>
        <div className="mr-auto">
          <div className="font-semibold text-c-text">{spec.name.fr || spec.id}</div>
          <div className="text-xs text-c-text-muted font-mono">{slug(spec.id)}</div>
        </div>
        <button className={btnGhost} onClick={() => setPhase('identity')}>✎ {T('Identité', 'Identity')}</button>
        <button className={btnGhost} disabled={!menu.length} onClick={() => { setPSel(0); setPreview(true) }}>👁 {T('Aperçu', 'Preview')}</button>
        <button className={btn} disabled={!exportable} onClick={download}>⬇ {T('Exporter la spec', 'Export spec')}</button>
      </div>

      {/* view selector */}
      <div className="flex gap-1 flex-wrap">
        {VIEWS.map(v => {
          const exists = !!spec.views[v.k]
          return (
            <button key={v.k} onClick={() => { if (!exists) up(s => { s.views[v.k] = { menu: [] } }); setRole(v.k) }}
              className={`px-3 py-1.5 rounded-lg text-sm ${role === v.k ? 'bg-c-accent/15 text-c-accent font-medium' : exists ? 'text-c-text hover:bg-c-accent/5' : 'text-c-text-muted border border-dashed border-c-border'}`}>
              {T(v.fr, v.en)}{exists ? ` · ${spec.views[v.k].menu.length}` : ' +'}
            </button>
          )
        })}
      </div>

      {/* bricks of the active view */}
      <div className="space-y-2">
        {menu.map((it, i) => (
          <div key={i} className={`${card} p-3 flex items-center gap-3`}>
            <span className="text-lg">{it.icon}</span>
            <div className="mr-auto">
              <div className="text-sm text-c-text font-medium">{it.label.fr}</div>
              <div className="text-xs text-c-text-muted"><span className="font-mono">{String(it.slot.kind)}</span>{it.slot.endpoint ? ` · ${String(it.slot.endpoint)}` : ''}{it.align === 'bottom' ? ' · ⤓ bas' : ''}</div>
            </div>
            <button className="text-c-text-muted text-sm hover:text-c-text disabled:opacity-30 px-1" disabled={i === 0} onClick={() => move(i, -1)} title={T('Monter', 'Up')}>↑</button>
            <button className="text-c-text-muted text-sm hover:text-c-text disabled:opacity-30 px-1" disabled={i === menu.length - 1} onClick={() => move(i, 1)} title={T('Descendre', 'Down')}>↓</button>
            <button className="text-c-text-muted text-xs hover:text-c-error" onClick={() => up(s => { s.views[role].menu.splice(i, 1) })}>{T('retirer', 'remove')}</button>
          </div>
        ))}
        {!menu.length && !adding && <p className="text-sm text-c-text-muted px-1">{T('Aucune brique dans cette vue. Ajoutez-en une.', 'No brick in this view. Add one.')}</p>}
      </div>

      {/* add brick */}
      {!adding
        ? <button className={`${btn} w-full`} onClick={startAdd}>+ {T('Ajouter une brique', 'Add a brick')}</button>
        : (
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex items-center"><div className="font-medium text-c-text">{T('Ajouter une brique', 'Add a brick')}</div>
              <button className="ml-auto text-c-text-muted text-xs" onClick={() => setAdding(false)}>✕</button></div>

            {/* palette = the registry (what's available) */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PRIMS.filter(p => p.kind !== 'sections').map(p => {
                const k = p.kind as string
                const sel = d.kind === k
                return (
                  <button key={k} onClick={() => pickKind(k)}
                    className={`text-left p-2.5 rounded-lg border ${sel ? 'border-c-accent bg-c-accent/10' : 'border-c-border hover:bg-c-accent/5'}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{KIND_ICON[k] || '📄'}</span>
                      <span className="text-sm text-c-text font-medium">{(p.title as L).fr}</span>
                      {DATA_BRICKS.has(k) && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-c-info/15 text-c-info">{T('données', 'data')}</span>}
                    </div>
                    <div className="text-[11px] text-c-text-muted line-clamp-2 mt-0.5">{String(p.purpose)}</div>
                  </button>
                )
              })}
            </div>

            {/* config of the chosen brick */}
            {d.kind && (
              <div className="space-y-2 pt-2 border-t border-c-border">
                <div className="grid sm:grid-cols-3 gap-2">
                  <input className={inp} placeholder={T('libellé (FR)', 'label (FR)')} value={d.fr} onChange={e => setD(x => ({ ...x, fr: e.target.value }))} />
                  <input className={inp} placeholder={T('libellé (EN)', 'label (EN)')} value={d.en} onChange={e => setD(x => ({ ...x, en: e.target.value }))} />
                  <input className={inp} placeholder={T('icône', 'icon')} value={d.icon} onChange={e => setD(x => ({ ...x, icon: e.target.value }))} />
                </div>
                <label className="text-xs text-c-text-muted flex items-center gap-1"><input type="checkbox" checked={d.align} onChange={e => setD(x => ({ ...x, align: e.target.checked }))} /> {T('épingler en bas du menu', 'pin to bottom of menu')}</label>

                {DATA_BRICKS.has(d.kind) && (
                  <div className="space-y-1">
                    <input className={`${inp} max-w-xs`} placeholder={T('nom des données (ex: events)', 'data name (e.g. events)')} value={d.entity} onChange={e => setD(x => ({ ...x, entity: e.target.value }))} />
                    {d.kind === 'announcements'
                      ? <p className="text-xs text-c-text-muted">{T('Champs standard d’annonces (titre, contenu, statut, date…) créés automatiquement.', 'Standard announcement fields (title, content, status, date…) created automatically.')}</p>
                      : (
                        <div className="space-y-1">
                          <div className="text-xs text-c-text-muted">{T('Champs des données :', 'Data fields:')}</div>
                          {d.fields.map((f, i) => (
                            <div key={i} className="flex flex-wrap gap-2 items-center">
                              <input className={`${inp} w-36`} placeholder={T('champ', 'field')} value={f.name} onChange={e => setD(x => { const fs = [...x.fields]; fs[i] = { ...fs[i], name: e.target.value }; return { ...x, fields: fs } })} />
                              <select className={`${inp} w-28`} value={f.type} onChange={e => setD(x => { const fs = [...x.fields]; fs[i] = { ...fs[i], type: e.target.value }; return { ...x, fields: fs } })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                              {f.type === 'enum' && <input className={`${inp} flex-1 min-w-32`} placeholder="a,b,c" value={(f.options || []).join(',')} onChange={e => setD(x => { const fs = [...x.fields]; fs[i] = { ...fs[i], options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; return { ...x, fields: fs } })} />}
                              <label className="text-xs text-c-text-muted flex items-center gap-1"><input type="checkbox" checked={!!f.required} onChange={e => setD(x => { const fs = [...x.fields]; fs[i] = { ...fs[i], required: e.target.checked }; return { ...x, fields: fs } })} />req</label>
                              <button className="text-c-error text-xs" onClick={() => setD(x => ({ ...x, fields: x.fields.filter((_, j) => j !== i) }))}>✕</button>
                            </div>
                          ))}
                          <button className="text-c-accent text-xs hover:underline" onClick={() => setD(x => ({ ...x, fields: [...x.fields, { name: '', type: 'text' }] }))}>+ {T('champ', 'field')}</button>
                        </div>
                      )}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button className={btnGhost} onClick={() => setAdding(false)}>{T('Annuler', 'Cancel')}</button>
                  <button className={btn} disabled={!canCommit} onClick={commitBrick}>{T('Ajouter', 'Add')}</button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* publish */}
      <div className={`${card} p-4 space-y-2`}>
        <div className="font-medium text-c-text">🚀 {T('Publier', 'Publish')}</div>
        {!exportable
          ? <p className="text-xs text-c-text-muted">{T('Ajoutez au moins une brique pour publier.', 'Add at least one brick to publish.')}</p>
          : (
            <>
              <ul className="text-sm text-c-text-muted space-y-0.5">
                <li>{T('Repo', 'Repo')} : <span className="font-mono text-c-text">delminator/redstars-{slug(spec.id)}</span> ({T('public', 'public')})</li>
                <li>{totalBricks} {T('écrans', 'screens')} · {(spec.entities || []).length} {T('jeux de données', 'data sets')}</li>
              </ul>
              <button className={btn} onClick={download}>⬇ {T('Télécharger la spec', 'Download spec')}</button>
              <div className="text-xs text-c-text-muted pt-1">{T('Publication (crée le repo public + déploie) via la « App Factory » :', 'Publish (creates the public repo + deploys) via the “App Factory”:')}</div>
              <code className="block text-xs text-c-text bg-c-bg rounded p-2 overflow-x-auto">gh workflow run "App Factory" -R delminator/redstars-studio -f spec="$(cat {slug(spec.id) || 'app'}.spec.json)"</code>
              <p className="text-[11px] text-c-text-muted">{T('À venir : bouton 1-clic + financement participatif + abonnement (nécessite un fournisseur de paiement + gouvernance).', 'Coming: 1-click button + crowdfunding + subscription (needs a payment provider + governance).')}</p>
            </>
          )}
        <details className="pt-1">
          <summary className="text-xs text-c-text-muted cursor-pointer">{T('Voir la spec (JSON)', 'View spec (JSON)')}</summary>
          <pre className="text-xs text-c-text overflow-x-auto max-h-96 mt-1">{specJson}</pre>
        </details>
      </div>
    </div>
  )
}
