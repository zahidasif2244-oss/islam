'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminGate, { useAdminAuth } from '../components/AdminGate'
import { downloadCsv, parseCsv } from '@/lib/csv'
import {
  TOPIC_KINDS,
  applyTopicOverride,
  mergeTopicOverrides,
  normalizeTopic,
  topicRowKey,
  type TopicKind,
} from '@/lib/topic-merge'

const API = process.env.NEXT_PUBLIC_API_BASE || ''
const PAGE_SIZE = 100

const TOPIC_CSV_HEADER = [
  'kind', 'id', 'surah', 'surah_name', 'start_ayah', 'end_ayah', 'ayah', 'para', 'urdu', 'english',
]

const KIND_LABEL: Record<TopicKind, string> = { topics: 'Topics', amazing: 'Amazing' }
const KIND_SINGULAR: Record<TopicKind, string> = { topics: 'Topic', amazing: 'Amazing Fact' }
const KIND_ICON: Record<TopicKind, string> = { topics: '📖', amazing: '✨' }

const EMPTY_FORM = {
  surah: '1',
  surah_name: '',
  start_ayah: '0',
  end_ayah: '0',
  ayah: '1',
  para: '1',
  urdu: '',
  english: '',
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `API error (${res.status})`)
  return data
}

async function fetchJsonList(url: string): Promise<any[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export default function AdminTopicsPage() {
  return (
    <AdminGate>
      <TopicsManager />
    </AdminGate>
  )
}

function TopicsManager() {
  const { logout } = useAdminAuth()

  const [kind, setKind] = useState<TopicKind>('topics')
  const [baked, setBaked] = useState<{ topics: any[]; amazing: any[] }>({ topics: [], amazing: [] })
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [exportAll, setExportAll] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [topics, amazing, overlay] = await Promise.all([
        fetchJsonList('/data/static/topics.json'),
        fetchJsonList('/data/static/amazing_topics.json'),
        api('/api/admin/topics'),
      ])
      setBaked({ topics, amazing })
      setRows(Array.isArray(overlay?.rows) ? overlay.rows : [])
    } catch (e: any) {
      setErr(e?.message || 'Failed to load topics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const merged = useMemo(() => ({
    topics: mergeTopicOverrides(baked.topics, rows, 'topics'),
    amazing: mergeTopicOverrides(baked.amazing, rows, 'amazing'),
  }), [baked, rows])

  const overridesByKey = useMemo(() => {
    const map = new Map<string, any>()
    for (const row of rows) {
      map.set(String(row.key || topicRowKey(row.kind, row.id)), row)
    }
    return map
  }, [rows])

  const bakedIds = useMemo(() => ({
    topics: new Set(baked.topics.map((t: any) => Number(t.id))),
    amazing: new Set(baked.amazing.map((t: any) => Number(t.id))),
  }), [baked])

  const hidden = useMemo(() => {
    const out: any[] = []
    for (const item of baked[kind]) {
      const key = topicRowKey(kind, item.id)
      const override = overridesByKey.get(key)
      if (override?.deleted) {
        out.push({ ...applyTopicOverride(item, override, kind), key })
      }
    }
    return out
  }, [baked, kind, overridesByKey])

  const visible = merged[kind]
  const totalVisible = merged.topics.length + merged.amazing.length

  const q = search.trim().toLowerCase()
  const filtered = q
    ? visible.filter((t: any) =>
        [t.id, t.surah, t.surah_name, t.start_ayah, t.end_ayah, t.ayah, t.para, t.urdu, t.english]
          .some(v => String(v ?? '').toLowerCase().includes(q))
      )
    : visible

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function maxBakedId(k: TopicKind): number {
    return baked[k].reduce((max: number, b: any) => Math.max(max, Number(b.id) || 0), 0)
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setErr(null)
    setMsg(null)
    setFormOpen(true)
  }

  function openEdit(t: any) {
    setEditing(t)
    setForm({
      surah: String(t.surah ?? 1),
      surah_name: t.surah_name ?? '',
      start_ayah: String(t.start_ayah ?? 0),
      end_ayah: String(t.end_ayah ?? 0),
      ayah: String(t.ayah ?? 1),
      para: String(t.para ?? 1),
      urdu: t.urdu ?? '',
      english: t.english ?? '',
    })
    setErr(null)
    setMsg(null)
    setFormOpen(true)
  }

  async function save() {
    const normalized = normalizeTopic(kind, form)
    if (!normalized.ok) {
      setErr(normalized.error)
      return
    }

    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const payload: any = { kind, topic: normalized.value }
      if (editing) {
        payload.id = editing.id
        payload.custom = !bakedIds[kind].has(Number(editing.id))
      } else {
        payload.create = true
        payload.maxId = maxBakedId(kind)
      }

      const res = await api('/api/admin/topics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setMsg(
        res.action === 'inserted'
          ? `Added ${KIND_SINGULAR[kind]} #${res.row?.id} — the public tab will show it on reload.`
          : `Updated ${KIND_SINGULAR[kind]} #${res.row?.id} — the public tab will show it on reload.`
      )
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Save failed — server error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(t: any) {
    const custom = !bakedIds[kind].has(Number(t.id))
    const label = KIND_SINGULAR[kind].toLowerCase()
    const prompt = custom
      ? `Delete this ${label} #${t.id}? This cannot be undone.`
      : `Hide this ${label} #${t.id}? You can restore it later from the Hidden section.`
    if (!confirm(prompt)) return

    setMsg(null)
    setErr(null)
    try {
      await api('/api/admin/topics', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id: t.id, custom }),
      })
      if (editing && Number(editing.id) === Number(t.id)) {
        setFormOpen(false)
        setEditing(null)
      }
      setMsg(custom ? `Deleted ${label} #${t.id}.` : `Hidden ${label} #${t.id} — restore it below if needed.`)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Delete failed — server error')
    }
  }

  async function restore(t: any) {
    setMsg(null)
    setErr(null)
    try {
      await api('/api/admin/topics', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id: t.id, restore: true }),
      })
      setMsg(`Restored ${KIND_SINGULAR[kind].toLowerCase()} #${t.id}.`)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Restore failed — server error')
    }
  }

  function toggleSelection(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function exportCsv() {
    setMsg(null)
    setErr(null)
    const all: Array<{ kind: TopicKind; t: any }> = [
      ...merged.topics.map(t => ({ kind: 'topics' as TopicKind, t })),
      ...merged.amazing.map(t => ({ kind: 'amazing' as TopicKind, t })),
    ]
    const chosen = exportAll
      ? all
      : all.filter(({ kind: k, t }) => selected.has(topicRowKey(k, t.id)))

    if (chosen.length === 0) {
      setErr(exportAll ? 'No topics available to export.' : 'Select at least one topic to export.')
      return
    }

    const data = chosen.map(({ kind: k, t }) => [
      k,
      t.id ?? '',
      t.surah ?? '',
      t.surah_name ?? '',
      t.start_ayah ?? '',
      t.end_ayah ?? '',
      t.ayah ?? '',
      t.para ?? '',
      t.urdu ?? '',
      t.english ?? '',
    ])
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`topics-${exportAll ? 'all' : 'selected'}-${date}.csv`, TOPIC_CSV_HEADER, data)
    setMsg(`Exported ${data.length} row${data.length === 1 ? '' : 's'} to CSV.`)
  }

  function downloadSampleCsv() {
    downloadCsv('topics-sample.csv', TOPIC_CSV_HEADER, [
      ['topics', '', 1, 'الفاتحہ', 0, 7, '', 1, 'نمونہ موضوع — replace me', 'Sample topic — replace me'],
      ['amazing', '', 2, '', '', '', 1, '', 'نمونہ حقیقت — replace me', 'Sample amazing fact — replace me'],
    ])
  }

  function buildImportRows(cells: string[][]): any[] {
    if (cells.length < 2) throw new Error('CSV has no data rows (only a header).')

    const headers = cells[0].map(h => h.trim().toLowerCase())
    const idx: Record<string, number> = {}
    headers.forEach((h, i) => { if (h) idx[h] = i })
    if (idx.surah === undefined) {
      throw new Error('CSV must have a "surah" column — download the sample CSV for the exact format.')
    }

    const out: any[] = []
    for (let r = 1; r < cells.length; r++) {
      const get = (name: string) =>
        idx[name] === undefined ? '' : String(cells[r][idx[name]] ?? '').trim()

      const kindText = get('kind').toLowerCase()
      if (kindText && kindText !== 'topics' && kindText !== 'amazing') {
        throw new Error(`Unknown kind "${get('kind')}" on row ${r + 1}. Use "topics" or "amazing".`)
      }
      const rowKind: TopicKind = kindText ? (kindText as TopicKind) : kind

      const id = get('id')
      if (id && !/^\d+$/.test(id)) {
        throw new Error(`Invalid id "${id}" on row ${r + 1}.`)
      }

      out.push({
        kind: rowKind,
        ...(id ? { id, custom: !bakedIds[rowKind].has(Number(id)) } : { custom: true }),
        surah: get('surah'),
        surah_name: get('surah_name'),
        start_ayah: get('start_ayah'),
        end_ayah: get('end_ayah'),
        ayah: get('ayah'),
        para: get('para'),
        urdu: get('urdu'),
        english: get('english'),
      })
    }
    return out
  }

  async function uploadCsv() {
    if (!csvFile) {
      setErr('Choose a .csv file first')
      return
    }

    setUploading(true)
    setMsg(null)
    setErr(null)
    try {
      const text = await csvFile.text()
      const parsed = buildImportRows(parseCsv(text))
      if (parsed.length === 0) throw new Error('No valid rows found in the CSV.')

      const res = await api('/api/admin/topics/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: parsed,
          maxId: { topics: maxBakedId('topics'), amazing: maxBakedId('amazing') },
        }),
      })

      await load()
      const skipped = Array.isArray(res.skipped) ? res.skipped : []
      const detail = skipped.length
        ? ` — ${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped: ` +
          skipped.slice(0, 3).map((s: any) => `row ${s.row} (${s.reason})`).join('; ') +
          (skipped.length > 3 ? '…' : '')
        : ''
      setMsg(
        `Imported ${res.inserted || 0} new and updated ${res.updated || 0} topic row` +
        `${(res.inserted || 0) + (res.updated || 0) === 1 ? '' : 's'}${detail}`
      )
      setCsvFile(null)
      const input = document.getElementById('topics-csv-file') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (e: any) {
      setErr(e?.message || 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-4 sm:p-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a5c3a]">📖 Topics Manager</h1>
            <p className="text-xs text-[#666]">Add, edit, delete and import topics for the Topics and Amazing tabs.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Admin Pages</a>
            <a href="/" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Site</a>
            <button onClick={logout} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 cursor-pointer hover:bg-red-100">Logout</button>
          </div>
        </div>

        <div className="flex gap-1.5 mb-4 flex-wrap">
          {TOPIC_KINDS.map(k => (
            <button
              key={k}
              onClick={() => { setKind(k); setSearch(''); setPage(0); setMsg(null); setErr(null) }}
              className={`px-3 py-1.5 text-sm border-none rounded cursor-pointer ${kind === k ? 'bg-[#1a5c3a] text-white' : 'bg-white text-[#1a5c3a] border border-[#b5d6c0] hover:bg-[#e8f5e9]'}`}
            >
              {KIND_ICON[k]} {KIND_LABEL[k]} <span className="text-[10px] opacity-70">({merged[k].length})</span>
            </button>
          ))}
        </div>

        {err && <div className="text-xs mb-2 p-2 rounded bg-[#ffebee] text-red-700">{err}</div>}
        {msg && <div className="text-xs mb-2 p-2 rounded bg-[#e8f5e9] text-[#1a5c3a]">{msg}</div>}

        {/* CSV import */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="font-bold text-[#1a5c3a] text-sm">📄 Import Topics from CSV</h2>
            <button onClick={downloadSampleCsv} className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 cursor-pointer hover:bg-[#d0ead8]">⬇️ Download Sample CSV</button>
          </div>
          <p className="text-[11px] text-[#888] mb-2">
            Columns: <code className="bg-[#f5f5f5] px-1 rounded">{TOPIC_CSV_HEADER.join(', ')}</code>.
            Leave <code className="bg-[#f5f5f5] px-1 rounded">id</code> empty to create a new row, or keep an exported id to update it.
            Leave <code className="bg-[#f5f5f5] px-1 rounded">kind</code> empty to use the selected tab (<strong>{KIND_LABEL[kind]}</strong>).
            For Amazing rows only <code className="bg-[#f5f5f5] px-1 rounded">ayah</code> is used; for Topics use <code className="bg-[#f5f5f5] px-1 rounded">start_ayah</code>, <code className="bg-[#f5f5f5] px-1 rounded">end_ayah</code> and <code className="bg-[#f5f5f5] px-1 rounded">para</code>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 cursor-pointer hover:bg-[#d0ead8]">
              📁 Choose .csv File
              <input
                id="topics-csv-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => setCsvFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={uploadCsv}
              disabled={!csvFile || uploading || loading}
              className="text-xs bg-[#1a5c3a] text-white border-none rounded px-3 py-1.5 cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40"
            >
              {uploading ? '⏳ Uploading…' : '📤 Upload CSV'}
            </button>
            {csvFile && (
              <span className="text-[11px] text-[#666]">
                {csvFile.name} ({csvFile.size} bytes)
                <button onClick={() => setCsvFile(null)} className="ml-1 text-red-500 cursor-pointer">✕</button>
              </span>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[#e0e0e0]">
            <h2 className="font-bold text-[#1a5c3a] text-sm">{KIND_ICON[kind]} {KIND_LABEL[kind]} ({visible.length})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="🔍 Search id / surah / text..."
                className="p-2 border border-[#ccc] rounded text-sm min-w-[190px]"
              />
              <button onClick={openAdd} className="px-3 py-1.5 bg-[#1a5c3a] text-white text-sm border-none rounded cursor-pointer hover:bg-[#2a7a4e]">➕ Add New {KIND_SINGULAR[kind]}</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#f0f0f0] bg-[#fbfdfb]">
            <label className="flex items-center gap-1.5 text-xs text-[#1a5c3a] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={exportAll}
                onChange={e => setExportAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1a5c3a] cursor-pointer"
              />
              Export all topics ({totalVisible})
            </label>
            <button onClick={exportCsv} className="text-xs bg-[#1a5c3a] text-white border-none rounded px-3 py-1.5 cursor-pointer hover:bg-[#2a7a4e]">⬇️ Export CSV</button>
            {!exportAll && (
              <span className="text-[11px] text-[#666]">
                {selected.size} selected
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} className="ml-2 text-red-500 bg-transparent border-none cursor-pointer hover:underline">Clear</button>
                )}
              </span>
            )}
            <span className="text-[10px] text-[#999] ml-auto">Hidden rows are excluded from exports.</span>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-[#999]">Loading topics…</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[#999] p-6">
              {visible.length === 0 ? `No ${KIND_LABEL[kind].toLowerCase()} yet.` : 'No rows match this search.'}
            </p>
          ) : (
            <div className="divide-y divide-[#f0f0f0] max-h-[60vh] overflow-y-auto">
              {pageItems.map((t: any) => {
                const key = topicRowKey(kind, t.id)
                const override = overridesByKey.get(key)
                const custom = !bakedIds[kind].has(Number(t.id))
                const edited = !!override && !override.deleted && !custom
                return (
                  <div key={key} className="flex items-start gap-2 p-2.5 hover:bg-[#f8fbf8]">
                    <input
                      type="checkbox"
                      checked={exportAll || selected.has(key)}
                      disabled={exportAll}
                      onChange={() => toggleSelection(key)}
                      title={exportAll ? 'Uncheck "Export all topics" to pick individual rows' : 'Select this row for export'}
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 accent-[#1a5c3a] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e8f5e9] text-[#1a5c3a]">#{t.id}</span>
                        {custom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#e3f2fd] text-[#1565c0]">CUSTOM</span>}
                        {edited && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fff3e0] text-[#e65100]">EDITED</span>}
                        <span className="text-[10px] text-[#999]">
                          {kind === 'topics'
                            ? `Surah ${t.surah}${t.surah_name ? ` (${t.surah_name})` : ''}:${Number(t.start_ayah) + 1}-${Number(t.end_ayah) + 1} | Para ${t.para}`
                            : `Surah ${t.surah}:${t.ayah}`}
                        </span>
                      </div>
                      {t.urdu && <div className="font-urdu text-sm font-semibold text-[#222] mt-0.5" style={{ direction: 'rtl' }}>{t.urdu}</div>}
                      {t.english && <div className="text-xs text-[#555] mt-0.5">{t.english}</div>}
                      {!t.urdu && !t.english && <div className="text-xs text-[#999] mt-0.5">(no text)</div>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openEdit(t)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-2 py-1 cursor-pointer hover:bg-[#d0ead8] whitespace-nowrap">✏️ Edit</button>
                      <button onClick={() => remove(t)} className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 cursor-pointer hover:bg-red-100 whitespace-nowrap">🗑 Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 p-2 border-t border-[#f0f0f0]">
              <button
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="text-xs px-2.5 py-1 bg-[#e8f5e9] text-[#1a5c3a] border border-[#b5d6c0] rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >← Prev</button>
              <span className="text-[11px] text-[#666]">Page {safePage + 1} of {totalPages} · {filtered.length} rows</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                className="text-xs px-2.5 py-1 bg-[#e8f5e9] text-[#1a5c3a] border border-[#b5d6c0] rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >Next →</button>
            </div>
          )}
        </div>

        {/* Hidden / restorable baked rows */}
        {hidden.length > 0 && (
          <div className="bg-[#fff5f5] rounded-xl border border-[#e8c4c4] p-3 mb-4">
            <h4 className="font-bold text-red-700 text-sm mb-1">🗑 Hidden {KIND_LABEL[kind]} ({hidden.length})</h4>
            <p className="text-[11px] text-[#a55] mb-2">These baked rows are hidden from the public tab. Restore one to show it again.</p>
            <div className="max-h-[30vh] overflow-y-auto">
              {hidden.map((t: any) => (
                <div key={t.key} className="flex items-center gap-2 mb-1 p-1.5 bg-white rounded border border-[#f0c8c8]">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">#{t.id}</span>
                  <span className="text-xs flex-1 truncate" style={{ direction: 'rtl' }}>{t.urdu || t.english || `#${t.id}`}</span>
                  <button onClick={() => restore(t)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b8d6c4] rounded px-2 py-0.5 cursor-pointer hover:bg-[#d0ead8]">↩ Restore</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#fffde7] p-4 rounded-xl border border-[#e8d84a]">
          <h4 className="font-bold text-[#1a5c3a] mb-1">💡 Note</h4>
          <p className="text-xs text-[#666]">
            The public lists come from <code className="bg-[#e8f5e9] px-1 rounded">/data/static/topics.json</code> and{' '}
            <code className="bg-[#e8f5e9] px-1 rounded">amazing_topics.json</code>. Admin edits and new rows are stored in{' '}
            <code className="bg-[#e8f5e9] px-1 rounded">tbl_TopicOverrides</code> and appear on the public
            <b> Topics</b> and <b>Amazing</b> tabs after a reload. Editing a baked row creates an override;
            Delete hides it (restorable above), while deleting a custom row removes it permanently.
          </p>
        </div>
      </div>

      {/* Add / edit form */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded-xl w-[90%] max-w-[620px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#1a5c3a]">
                {editing
                  ? `✏️ Edit ${KIND_SINGULAR[kind]} #${editing.id}`
                  : `➕ Add New ${KIND_SINGULAR[kind]} — ${KIND_LABEL[kind]}`}
              </h3>
              <button onClick={() => { setFormOpen(false); setEditing(null) }} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <label className="block">
                <span className="text-xs text-[#666] block mb-0.5">Surah * (1–114)</span>
                <input
                  type="number"
                  min={1}
                  max={114}
                  value={form.surah ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, surah: e.target.value }))}
                  className="w-full p-2 border border-[#ccc] rounded text-sm"
                />
              </label>

              {kind === 'topics' ? (
                <>
                  <label className="block">
                    <span className="text-xs text-[#666] block mb-0.5">Surah name</span>
                    <input
                      type="text"
                      value={form.surah_name ?? ''}
                      onChange={e => setForm((f: any) => ({ ...f, surah_name: e.target.value }))}
                      placeholder="e.g. الفاتحہ"
                      className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm"
                      style={{ direction: 'rtl' }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#666] block mb-0.5">Start ayah (0-based) *</span>
                    <input
                      type="number"
                      min={0}
                      max={285}
                      value={form.start_ayah ?? ''}
                      onChange={e => setForm((f: any) => ({ ...f, start_ayah: e.target.value }))}
                      className="w-full p-2 border border-[#ccc] rounded text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#666] block mb-0.5">End ayah (0-based, inclusive) *</span>
                    <input
                      type="number"
                      min={0}
                      max={286}
                      value={form.end_ayah ?? ''}
                      onChange={e => setForm((f: any) => ({ ...f, end_ayah: e.target.value }))}
                      className="w-full p-2 border border-[#ccc] rounded text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#666] block mb-0.5">Para * (1–30)</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.para ?? ''}
                      onChange={e => setForm((f: any) => ({ ...f, para: e.target.value }))}
                      className="w-full p-2 border border-[#ccc] rounded text-sm"
                    />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="text-xs text-[#666] block mb-0.5">Ayah * (1–286)</span>
                  <input
                    type="number"
                    min={1}
                    max={286}
                    value={form.ayah ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, ayah: e.target.value }))}
                    className="w-full p-2 border border-[#ccc] rounded text-sm"
                  />
                </label>
              )}

              <label className="block col-span-full">
                <span className="text-xs text-[#666] block mb-0.5">Urdu</span>
                <textarea
                  rows={4}
                  value={form.urdu ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, urdu: e.target.value }))}
                  className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm"
                  style={{ direction: 'rtl' }}
                  placeholder="اردو متن"
                />
              </label>

              <label className="block col-span-full">
                <span className="text-xs text-[#666] block mb-0.5">English</span>
                <textarea
                  rows={3}
                  value={form.english ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, english: e.target.value }))}
                  className="w-full p-2 border border-[#ccc] rounded text-sm"
                  placeholder="English text"
                />
              </label>
            </div>

            <p className="text-[10px] text-[#999] mb-2">
              {editing
                ? !bakedIds[kind].has(Number(editing.id))
                  ? 'This is a custom row — saving updates it in place.'
                  : 'This is a baked row — the change is stored as an override so it survives redeploys.'
                : 'New rows are created in the database overlay and appear on the public tab after a reload.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40"
              >
                {saving ? 'Saving…' : editing ? '💾 Save Changes' : `➕ Add ${KIND_SINGULAR[kind]}`}
              </button>
              <button
                onClick={() => { setFormOpen(false); setEditing(null) }}
                className="px-4 py-2 bg-[#f0f0f0] text-[#555] border-none rounded text-sm cursor-pointer hover:bg-[#e2e2e2]"
              >Cancel</button>
            </div>
            {err && <div className="text-xs mt-2 p-2 rounded bg-[#ffebee] text-red-700">{err}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
