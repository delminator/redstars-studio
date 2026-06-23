// redstars-studio — the in-app application builder.
//
// Reads the primitive registry (the catalogue of host capabilities), lets you
// compose an APP SPEC visually — identity, data entities, screens (menus of
// primitives) — with a live structural preview, then exports the spec. The
// codegen (redstars/tools/builder/generate.mjs) turns that spec into a real,
// deployable app repo. V1: compose + export. Publish (repo + crowdfunding) next.
import { useState, useMemo } from 'react'
import type { ViewSlotProps } from '@delminator/core-ui'
import registryData from '../primitive-registry.json'

type L = { fr: string; en: string }
type Field = { name: string; type: string; required?: boolean; options?: string[] }
type Entity = { name: string; kind?: string; label?: L; fields?: Field[] }
type Item = { id: string; label: L; icon?: string; align?: 'bottom'; slot: Record<string, unknown> }
type Spec = {
  id: string; name: L; icon: string; description: string; color: string
  accentToken: string; port: number; version: string; minCoreVersion: string
  visibility: string; entities: Entity[]; views: Record<string, { menu: Item[] }>
}

const PRIMS = (registryData as { primitives: Array<Record<string, unknown>> }).primitives
const ENTITY_BACKED = new Set(['object-list', 'collection', 'tasks', 'dashboard', 'announcements'])
const ROLES = ['collaborator', 'admin', 'user'] as const
const FIELD_TYPES = ['text', 'number', 'date', 'bool', 'enum']

function blank(): Spec {
  return {
    id: '', name: { fr: '', en: '' }, icon: '🧩', description: '', color: '#6366f1',
    accentToken: 'c-accent', port: 3021, version: '0.1.0', minCoreVersion: '0.6.0',
    visibility: 'public', entities: [], views: { collaborator: { menu: [] } },
  }
}

function defaultSlot(kind: string, entity: Entity | undefined, label: L): Record<string, unknown> {
  const ep = entity ? '/' + entity.name : '/items'
  const cols = (entity?.fields || []).map(f => ({ key: f.name, label: { fr: f.name, en: f.name }, ...(f.type === 'number' ? { format: 'number' } : f.type === 'date' ? { format: 'date' } : {}) }))
  const cf = (entity?.fields || []).map(f => ({ key: f.name, label: { fr: f.name, en: f.name }, type: f.type === 'bool' ? 'text' : f.type, required: f.required, ...(f.type === 'enum' && f.options ? { options: f.options.map(o => ({ value: o, label: { fr: o, en: o } })) } : {}) }))
  switch (kind) {
    case 'member-list': return { kind, display: { username: true, avatar: true, role: true, activeBadge: true } }
    case 'catalog': return { kind, layout: 'both' }
    case 'quotes': case 'invoices': case 'org-members': return { kind }
    case 'cash-register': return { kind, multiRegister: true }
    case 'settings': return { kind, blocks: [{ kind: 'profile' }, { kind: 'wallet' }, { kind: 'scanner' }] }
    case 'object-list': return { kind, endpoint: ep, title: label, columns: cols.length ? cols : [{ key: 'name', label: { fr: 'Nom', en: 'Name' } }], createFields: cf }
    case 'collection': return { kind, endpoint: ep, title: label, layout: 'both', columns: cols.length ? cols : [{ key: 'name', label: { fr: 'Nom', en: 'Name' } }], createFields: cf }
    case 'announcements': return { kind, title: label, announcements: { endpoint: ep } }
    case 'tasks': return { kind, title: label, sources: [{ kind: 'query', id: entity?.name || 'items', label, endpoint: ep, item: { title: entity?.fields?.[0]?.name || 'name', tag: label } }] }
    case 'dashboard': return { kind, title: label, kpis: [{ label: { fr: 'Membres', en: 'Members' }, icon: '👥', core: 'members' }, ...(entity ? [{ label, icon: '📦', source: ep }] : [])], blocks: entity ? [{ kind: 'list', title: label, source: ep, primary: entity.fields?.[0]?.name || 'name' }] : [] }
    default: return { kind }
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const card = 'bg-c-card border border-c-border rounded-xl'
const inp = 'w-full border border-c-border rounded px-3 py-2 text-sm bg-c-card text-c-text'
const btn = 'rounded-lg bg-c-accent px-3 py-2 text-xs font-medium text-c-text hover:opacity-90 disabled:opacity-50'

export default function Builder({ i18n }: ViewSlotProps) {
  const fr = i18n.language === 'fr'
  const T = (a: string, b: string) => (fr ? a : b)
  const [spec, setSpec] = useState<Spec>(blank)
  const [tab, setTab] = useState<'id' | 'data' | 'screens' | 'bricks' | 'gen'>('id')
  const [role, setRole] = useState<string>('collaborator')
  const up = (fn: (s: Spec) => void) => setSpec(s => { const n = structuredClone(s); fn(n); return n })

  const cleanSpec = useMemo(() => {
    const s = structuredClone(spec)
    s.id = slug(s.id)
    if (!s.entities.length) delete (s as Record<string, unknown>).entities
    return s
  }, [spec])
  const specJson = useMemo(() => JSON.stringify(cleanSpec, null, 2), [cleanSpec])
  const valid = slug(spec.id).length >= 3 && spec.name.fr && (spec.views.collaborator?.menu.length ?? 0) > 0

  const download = () => {
    const blob = new Blob([specJson], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${slug(spec.id) || 'app'}.spec.json`; a.click()
    URL.revokeObjectURL(a.href)
  }

  // ----- add a screen (menu item bound to a primitive) -----
  const [draft, setDraft] = useState({ id: '', fr: '', en: '', icon: '📄', kind: 'object-list', entity: '', align: false })
  const addScreen = () => {
    const label = { fr: draft.fr || draft.id, en: draft.en || draft.fr || draft.id }
    const entity = spec.entities.find(e => e.name === draft.entity)
    const item: Item = { id: slug(draft.id) || draft.kind, label, ...(draft.icon ? { icon: draft.icon } : {}), ...(draft.align ? { align: 'bottom' as const } : {}), slot: defaultSlot(draft.kind, entity, label) }
    up(s => { (s.views[role] ||= { menu: [] }).menu.push(item) })
    setDraft({ id: '', fr: '', en: '', icon: '📄', kind: draft.kind, entity: '', align: false })
  }

  // ----- add an entity -----
  const [edraft, setEdraft] = useState<{ name: string; announce: boolean; fields: Field[] }>({ name: '', announce: false, fields: [] })
  const addEntity = () => {
    if (!slug(edraft.name)) return
    up(s => s.entities.push(edraft.announce ? { name: slug(edraft.name), kind: 'announcements' } : { name: slug(edraft.name), fields: edraft.fields }))
    setEdraft({ name: '', announce: false, fields: [] })
  }

  const TabBtn = ({ k, label }: { k: typeof tab; label: string }) => (
    <button onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-sm ${tab === k ? 'bg-c-accent/15 text-c-accent font-medium' : 'text-c-text-muted hover:bg-c-accent/5'}`}>{label}</button>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-c-text">{T('Créateur d’application', 'Application builder')} {spec.icon}</h2>
        <p className="text-sm text-c-text-muted">{T('Composez votre app sans code, puis générez le repo.', 'Compose your app with no code, then generate the repo.')}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        <TabBtn k="id" label={T('1 · Identité', '1 · Identity')} />
        <TabBtn k="data" label={T('2 · Données', '2 · Data')} />
        <TabBtn k="screens" label={T('3 · Écrans', '3 · Screens')} />
        <TabBtn k="bricks" label={T('Briques dispo.', 'Available bricks')} />
        <TabBtn k="gen" label={T('4 · Générer', '4 · Generate')} />
      </div>

      {/* ---------- IDENTITY ---------- */}
      {tab === 'id' && (
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
        </div>
      )}

      {/* ---------- DATA / ENTITIES ---------- */}
      {tab === 'data' && (
        <div className="space-y-3">
          <div className={`${card} p-4 space-y-2`}>
            <div className="font-medium text-c-text">{T('Ajouter une entité (table)', 'Add an entity (table)')}</div>
            <div className="flex flex-wrap gap-2 items-end">
              <input className={`${inp} w-44`} placeholder={T('nom (ex: events)', 'name (e.g. events)')} value={edraft.name} onChange={e => setEdraft(d => ({ ...d, name: e.target.value }))} />
              <label className="text-xs text-c-text-muted flex items-center gap-1"><input type="checkbox" checked={edraft.announce} onChange={e => setEdraft(d => ({ ...d, announce: e.target.checked }))} /> {T('preset Annonces', 'Announcements preset')}</label>
            </div>
            {!edraft.announce && (
              <div className="space-y-1">
                {edraft.fields.map((f, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center text-sm">
                    <input className={`${inp} w-36`} placeholder={T('champ', 'field')} value={f.name} onChange={e => setEdraft(d => { const fs = [...d.fields]; fs[i] = { ...fs[i], name: e.target.value }; return { ...d, fields: fs } })} />
                    <select className={`${inp} w-28`} value={f.type} onChange={e => setEdraft(d => { const fs = [...d.fields]; fs[i] = { ...fs[i], type: e.target.value }; return { ...d, fields: fs } })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                    {f.type === 'enum' && <input className={`${inp} flex-1 min-w-32`} placeholder="a,b,c" value={(f.options || []).join(',')} onChange={e => setEdraft(d => { const fs = [...d.fields]; fs[i] = { ...fs[i], options: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }; return { ...d, fields: fs } })} />}
                    <label className="text-xs text-c-text-muted flex items-center gap-1"><input type="checkbox" checked={!!f.required} onChange={e => setEdraft(d => { const fs = [...d.fields]; fs[i] = { ...fs[i], required: e.target.checked }; return { ...d, fields: fs } })} />req</label>
                    <button className="text-c-error text-xs" onClick={() => setEdraft(d => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }))}>✕</button>
                  </div>
                ))}
                <button className="text-c-accent text-xs hover:underline" onClick={() => setEdraft(d => ({ ...d, fields: [...d.fields, { name: '', type: 'text' }] }))}>+ {T('champ', 'field')}</button>
              </div>
            )}
            <button className={btn} onClick={addEntity}>+ {T('Ajouter l’entité', 'Add entity')}</button>
          </div>
          {spec.entities.map((e, i) => (
            <div key={i} className={`${card} p-3 flex items-center gap-2 text-sm`}>
              <span className="font-mono text-c-text">{spec.id ? slug(spec.id) + '_' : ''}{e.name}</span>
              <span className="text-c-text-muted">{e.kind === 'announcements' ? T('(annonces)', '(announcements)') : (e.fields || []).map(f => f.name).join(', ')}</span>
              <button className="ml-auto text-c-error text-xs" onClick={() => up(s => { s.entities.splice(i, 1) })}>{T('supprimer', 'remove')}</button>
            </div>
          ))}
          {!spec.entities.length && <p className="text-sm text-c-text-muted px-1">{T('Aucune entité — les primitives sur données core (catalogue, membres, caisse…) n’en ont pas besoin.', 'No entity — core-data primitives (catalog, members, register…) need none.')}</p>}
        </div>
      )}

      {/* ---------- SCREENS ---------- */}
      {tab === 'screens' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {ROLES.map(r => (
              <button key={r} onClick={() => setRole(r)} className={`px-3 py-1.5 rounded-lg text-sm ${role === r ? 'bg-c-accent/15 text-c-accent font-medium' : 'text-c-text-muted hover:bg-c-accent/5'}`}>
                {r === 'collaborator' ? T('Vue staff', 'Staff') : r === 'admin' ? T('Vue admin', 'Admin') : T('Vue membre', 'Member')}
              </button>
            ))}
          </div>
          <div className={`${card} p-4 space-y-2`}>
            <div className="font-medium text-c-text">{T('Ajouter un écran', 'Add a screen')}</div>
            <div className="grid md:grid-cols-2 gap-2">
              <input className={inp} placeholder={T('id (ex: events)', 'id (e.g. events)')} value={draft.id} onChange={e => setDraft(d => ({ ...d, id: e.target.value }))} />
              <input className={inp} placeholder={T('icône', 'icon')} value={draft.icon} onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))} />
              <input className={inp} placeholder={T('libellé FR', 'label FR')} value={draft.fr} onChange={e => setDraft(d => ({ ...d, fr: e.target.value }))} />
              <input className={inp} placeholder={T('libellé EN', 'label EN')} value={draft.en} onChange={e => setDraft(d => ({ ...d, en: e.target.value }))} />
              <select className={inp} value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}>
                {PRIMS.map(p => <option key={p.kind as string} value={p.kind as string}>{(p.title as L).fr} — {p.kind as string}</option>)}
              </select>
              {ENTITY_BACKED.has(draft.kind)
                ? <select className={inp} value={draft.entity} onChange={e => setDraft(d => ({ ...d, entity: e.target.value }))}>
                    <option value="">{T('— entité —', '— entity —')}</option>
                    {spec.entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                : <div className="text-xs text-c-text-muted self-center">{T('données core — aucune entité requise', 'core data — no entity needed')}</div>}
            </div>
            <label className="text-xs text-c-text-muted flex items-center gap-1"><input type="checkbox" checked={draft.align} onChange={e => setDraft(d => ({ ...d, align: e.target.checked }))} /> {T('épingler en bas', 'pin to bottom')}</label>
            {ENTITY_BACKED.has(draft.kind) && !draft.entity && <p className="text-xs text-c-warning">{T('Cette brique a besoin d’une entité (onglet Données).', 'This brick needs an entity (Data tab).')}</p>}
            <button className={btn} disabled={ENTITY_BACKED.has(draft.kind) && !draft.entity} onClick={addScreen}>+ {T('Ajouter l’écran', 'Add screen')}</button>
          </div>
          {(spec.views[role]?.menu || []).map((it, i) => (
            <div key={i} className={`${card} p-3 flex items-center gap-2 text-sm`}>
              <span>{it.icon}</span>
              <span className="text-c-text font-medium">{it.label.fr}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-c-accent/10 text-c-accent">{String(it.slot.kind)}</span>
              {it.align === 'bottom' && <span className="text-xs text-c-text-muted">⤓</span>}
              <button className="ml-auto text-c-error text-xs" onClick={() => up(s => { s.views[role].menu.splice(i, 1) })}>{T('supprimer', 'remove')}</button>
            </div>
          ))}
          {!(spec.views[role]?.menu || []).length && <p className="text-sm text-c-text-muted px-1">{T('Aucun écran dans cette vue.', 'No screen in this view.')}</p>}
        </div>
      )}

      {/* ---------- AVAILABLE BRICKS (the registry / audit) ---------- */}
      {tab === 'bricks' && (
        <div className="grid md:grid-cols-2 gap-3">
          {PRIMS.map(p => (
            <div key={p.kind as string} className={`${card} p-3 space-y-1`}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-c-text">{(p.title as L).fr}</span>
                <span className="text-xs font-mono text-c-text-muted">{p.kind as string}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${p.noCode === 'full' ? 'bg-c-success/15 text-c-success' : p.noCode === 'partial' ? 'bg-c-warning/15 text-c-warning' : 'bg-c-card text-c-text-muted'}`}>{T('no-code', 'no-code')}: {String(p.noCode)}</span>
              </div>
              <p className="text-xs text-c-text-muted">{String(p.purpose)}</p>
              <div className="text-xs text-c-text-muted">{T('données', 'data')}: {String(p.dataSource)}{p.needsBackend ? ' · ' + T('entité requise', 'entity required') : ''}</div>
              <div className="text-xs text-c-text-muted">{T('config', 'config')}: {Object.keys((p.config as Record<string, unknown>) || {}).join(', ') || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- GENERATE ---------- */}
      {tab === 'gen' && (
        <div className="space-y-3">
          {!valid && <p className="text-sm text-c-warning">{T('Renseignez un id (≥3), un nom FR, et au moins un écran staff.', 'Set an id (≥3), a FR name, and at least one staff screen.')}</p>}
          <div className="flex gap-2">
            <button className={btn} disabled={!valid} onClick={download}>⬇ {T('Télécharger la spec', 'Download spec')}</button>
            <button className={btn} disabled={!valid} onClick={() => navigator.clipboard?.writeText(specJson)}>{T('Copier le JSON', 'Copy JSON')}</button>
          </div>
          <div className={`${card} p-3`}>
            <div className="text-xs text-c-text-muted mb-1">{T('Puis, pour générer le repo de l’app :', 'Then, to generate the app repo:')}</div>
            <code className="text-xs text-c-text block bg-c-bg rounded p-2 overflow-x-auto">node redstars/tools/builder/generate.mjs {slug(spec.id) || 'app'}.spec.json</code>
            <div className="text-xs text-c-text-muted mt-1">{T('→ crée redstars-' + (slug(spec.id) || 'app') + ' (UI + pod + migrations + CI). Publication (repo public + crowdfunding) : à venir.', '→ creates redstars-' + (slug(spec.id) || 'app') + ' (UI + pod + migrations + CI). Publish (public repo + crowdfunding): coming.')}</div>
          </div>
          <details className={`${card} p-3`}>
            <summary className="text-sm text-c-text cursor-pointer">{T('Voir la spec (JSON)', 'View spec (JSON)')}</summary>
            <pre className="text-xs text-c-text overflow-x-auto mt-2 max-h-96">{specJson}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
