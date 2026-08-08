'use client'

import { useState, useEffect } from 'react'
import AdminGate, { useAdminAuth } from '../components/AdminGate'

const API = process.env.NEXT_PUBLIC_API_BASE || ''

const CATEGORIES = [
  { source: 'tbl_dua', label: 'Duas' },
  { source: 'tbl_dua_Urdu', label: 'More Duas' },
  { source: 'tbl_prayer', label: 'Prayers' },
  { source: 'tbl_namaz_e_janaza', label: 'Janaza' },
  { source: 'tbl_roza', label: 'Roza' },
]

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init)
  if (!res.ok) throw new Error('API error')
  return res.json()
}

export default function AdminDuasPage() {
  return (
    <AdminGate>
      <DuasManager />
    </AdminGate>
  )
}

function DuasManager() {
  const { logout } = useAdminAuth()
  const [categories, setCategories] = useState<any[]>([])
  const [active, setActive] = useState('tbl_dua')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [f, setF] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/api/admin/duas')
      setCategories(res.categories || [])
    } catch {
      setErr('Failed to load duas')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const activeCat = categories.find(c => c.source === active)

  function openAdd() {
    setEditing(null)
    setF({ title: '', seq: '', desc: '', arabic: '', urdu: '', english: '', ref: '' })
    setShowForm(true)
  }

  function openEdit(d: any) {
    setEditing(d)
    setF({
      title: d.title || '',
      seq: d.seq ?? '',
      desc: d.desc || '',
      arabic: d.arabic || '',
      urdu: d.urdu || '',
      english: d.english || '',
      ref: d.ref || '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!f.title?.trim()) { setErr('Title required'); return }
    setSaving(true); setMsg(null); setErr(null)
    try {
      const payload = {
        table: active,
        dua: {
          ...(editing?.id ? { id: editing.id } : {}),
          title: f.title.trim(),
          seq: f.seq === '' || f.seq === undefined || f.seq === null ? null : Number(f.seq),
          desc: f.desc || '',
          arabic: f.arabic || '',
          urdu: f.urdu || '',
          english: f.english || '',
          ref: f.ref || '',
        },
      }
      const res = await api('/api/admin/duas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMsg(res.action === 'updated' ? `Updated "${f.title}"` : `Added "${f.title}"`)
      setShowForm(false)
      setEditing(null)
      await load()
    } catch {
      setErr('Save failed — server error')
    } finally { setSaving(false) }
  }

  async function remove(d: any) {
    if (!confirm(`Delete "${d.title}"? This cannot be undone.`)) return
    setMsg(null); setErr(null)
    try {
      await api('/api/admin/duas', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: active, id: d.id }),
      })
      setMsg(`Deleted "${d.title}"`)
      await load()
    } catch {
      setErr('Delete failed — server error')
    }
  }

  // ============== CSV import ==============
  function downloadSampleCsv() {
    const header = 'table,title,seq,desc,arabic,urdu,english,ref'
    const sample =
      `${active},"Sample Dua - نمونہ دعا","1","Example description",` +
      '"اللَّهُمَّ اغْفِرْ لِي ذَنْبِي","میرے گناہ معاف فرما","O Allah, forgive my sin","Reference (e.g. Bukhari)"'
    const csv = '\uFEFF' + header + '\r\n' + sample + '\r\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'duas-sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let cur = ''
    let inQ = false
    const src = text.replace(/^\uFEFF/, '')
    for (let i = 0; i < src.length; i++) {
      const ch = src[i]
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i++ } else inQ = false
        } else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { row.push(cur); cur = '' }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (ch !== '\r') cur += ch
    }
    if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row) }
    return rows.filter(r => r.some(c => c.trim() !== ''))
  }

  function parseRows(cells: string[][]): any[] {
    if (cells.length < 2) throw new Error('CSV has no data rows (only a header)')
    const headers = cells[0].map(h => h.trim().toLowerCase())
    const idx: Record<string, number> = {}
    headers.forEach((h, i) => { idx[h] = i })
    if (idx.title === undefined) throw new Error('CSV must have a "title" column — download the sample CSV for the exact format')
    const out: any[] = []
    for (let r = 1; r < cells.length; r++) {
      const g = (name: string) => (idx[name] !== undefined ? (cells[r][idx[name]] || '').trim() : '')
      out.push({
        table: g('table') || '',
        title: g('title'),
        seq: g('seq'),
        desc: g('desc'),
        arabic: g('arabic'),
        urdu: g('urdu'),
        english: g('english'),
        ref: g('ref'),
      })
    }
    return out
  }

  async function uploadCsv() {
    if (!csvFile) { setErr('Choose a .csv file first'); return }
    setUploading(true); setMsg(null); setErr(null)
    try {
      const text = await csvFile.text()
      const parsed = parseRows(parseCsv(text))
      const valid = new Set(CATEGORIES.map(c => c.source))
      const groups = new Map<string, any[]>()
      for (const row of parsed) {
        const table = valid.has(row.table) ? row.table : active
        if (!groups.has(table)) groups.set(table, [])
        groups.get(table)!.push(row)
      }
      const mainTable = groups.keys().next().value as string
      let total = 0
      let skipped = 0
      const labels: string[] = []
      for (const [table, tableRows] of groups) {
        const res = await fetch(`${API}/api/admin/duas/import`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ table, rows: tableRows }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Import failed')
        total += data.inserted || 0
        skipped += (data.skipped || []).length
        const label = CATEGORIES.find(c => c.source === table)?.label || table
        labels.push(`${label} (+${data.inserted || 0})`)
      }
      setActive(mainTable)
      setCsvFile(null)
      ;(document.getElementById('dua-csv-file') as HTMLInputElement | null)?.value && ((document.getElementById('dua-csv-file') as HTMLInputElement).value = '')
      await load()
      setMsg(`✅ Imported ${total} dua${total === 1 ? '' : 's'}: ${labels.join(', ')}${skipped ? ` — ${skipped} row(s) skipped (empty title)` : ''}`)
    } catch (e: any) {
      setErr(e.message || 'Upload failed')
    } finally { setUploading(false) }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-4 sm:p-6">
      <div className="max-w-[960px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a5c3a]">🕌 Duas Manager</h1>
            <p className="text-xs text-[#666]">Add, edit or delete duas per category — saved to the live database.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Admin Pages</a>
            <a href="/" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Site</a>
            <button onClick={logout} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 cursor-pointer hover:bg-red-100">Logout</button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c.source} onClick={() => { setActive(c.source); setShowForm(false); setEditing(null) }}
              className={`px-3 py-1.5 text-sm border-none rounded cursor-pointer ${active === c.source ? 'bg-[#1a5c3a] text-white' : 'bg-white text-[#1a5c3a] border border-[#b5d6c0] hover:bg-[#e8f5e9]'}`}>
              {c.label} <span className="text-[10px] opacity-70">({activeCat?.source === c.source ? activeCat.count : categories.find(x => x.source === c.source)?.count ?? 0})</span>
            </button>
          ))}
        </div>

        {/* CSV import */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-[#1a5c3a] text-sm">📄 Import Duas from CSV</h2>
            <button onClick={downloadSampleCsv} className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 cursor-pointer hover:bg-[#d0ead8]">⬇️ Download Sample CSV</button>
          </div>
          <p className="text-[11px] text-[#888] mb-2">
            Columns: <code className="bg-[#f5f5f5] px-1 rounded">table, title, seq, desc, arabic, urdu, english, ref</code> — only <strong>title</strong> is required.
            Leave <code className="bg-[#f5f5f5] px-1 rounded">table</code> empty to add rows into the selected tab (<strong>{activeCat?.label}</strong>), or write e.g. <code className="bg-[#f5f5f5] px-1 rounded">tbl_dua_Urdu</code> to fill a specific category.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 cursor-pointer hover:bg-[#d0ead8]">
              📁 Choose .csv File
              <input id="dua-csv-file" type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => setCsvFile(e.target.files?.[0] || null)} />
            </label>
            <button onClick={uploadCsv} disabled={!csvFile || uploading}
              className="text-xs bg-[#1a5c3a] text-white border-none rounded px-3 py-1.5 cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40">
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

        {err && <div className="text-xs mb-2 p-2 rounded bg-[#ffebee] text-red-700">{err}</div>}
        {msg && <div className="text-xs mb-2 p-2 rounded bg-[#e8f5e9] text-[#1a5c3a]">{msg}</div>}

        {/* List */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] mb-4">
          <div className="flex items-center justify-between p-3 border-b border-[#e0e0e0]">
            <h2 className="font-bold text-[#1a5c3a] text-sm">{activeCat?.label} ({activeCat?.count ?? 0})</h2>
            <button onClick={openAdd} className="px-3 py-1.5 bg-[#1a5c3a] text-white text-sm border-none rounded cursor-pointer hover:bg-[#2a7a4e]">➕ Add New Dua</button>
          </div>
          {loading ? (
            <div className="loading p-6 text-sm text-[#999]">Loading duas…</div>
          ) : !activeCat || activeCat.duas.length === 0 ? (
            <p className="text-sm text-[#999] p-6">No duas in this category yet.</p>
          ) : (
            <div className="divide-y divide-[#f0f0f0] max-h-[60vh] overflow-y-auto">
              {activeCat.duas.map((d: any) => (
                <div key={d.id} className="flex items-start gap-2 p-2.5 hover:bg-[#f8fbf8]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e8f5e9] text-[#1a5c3a]">#{d.id}</span>
                      <span className="text-[10px] text-[#999]">seq {d.seq ?? '-'}</span>
                    </div>
                    <div className="font-urdu text-sm font-semibold text-[#222] truncate mt-0.5" style={{ direction: 'rtl' }}>{d.title}</div>
                    {d.arabic && <div className="font-arabic text-sm text-[#333] truncate mt-0.5" style={{ direction: 'rtl' }}>{d.arabic}</div>}
                    {d.urdu && <div className="font-urdu text-xs text-[#555] truncate mt-0.5" style={{ direction: 'rtl' }}>{d.urdu}</div>}
                    {d.ref && <div className="font-urdu text-[10px] text-[#999] mt-0.5 truncate" style={{ direction: 'rtl' }}>{d.ref}</div>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(d)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-2 py-1 cursor-pointer hover:bg-[#d0ead8] whitespace-nowrap">✏️ Edit</button>
                    <button onClick={() => remove(d)} className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 cursor-pointer hover:bg-red-100 whitespace-nowrap">🗑 Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-5 rounded-xl w-[90%] max-w-[620px] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#1a5c3a]">{editing ? `✏️ Edit — ${activeCat?.label}` : `➕ Add New Dua — ${activeCat?.label}`}</h3>
                <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                <label className="block col-span-full">
                  <span className="text-xs text-[#666] block mb-0.5">Title *</span>
                  <input type="text" value={f.title || ''} onChange={e => setF((x: any) => ({ ...x, title: e.target.value }))}
                    className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm" style={{ direction: 'rtl' }} />
                </label>
                <label className="block">
                  <span className="text-xs text-[#666] block mb-0.5">Sequence (order) — optional</span>
                  <input type="number" value={f.seq ?? ''} onChange={e => setF((x: any) => ({ ...x, seq: e.target.value }))}
                    className="w-full p-2 border border-[#ccc] rounded text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-[#666] block mb-0.5">Reference (ref)</span>
                  <input type="text" value={f.ref || ''} onChange={e => setF((x: any) => ({ ...x, ref: e.target.value }))}
                    className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm" style={{ direction: 'rtl' }} />
                </label>
                <label className="block col-span-full">
                  <span className="text-xs text-[#666] block mb-0.5">Arabic</span>
                  <textarea rows={3} value={f.arabic || ''} onChange={e => setF((x: any) => ({ ...x, arabic: e.target.value }))}
                    className="font-arabic w-full p-2 border border-[#ccc] rounded text-sm" style={{ direction: 'rtl' }} />
                </label>
                <label className="block col-span-full">
                  <span className="text-xs text-[#666] block mb-0.5">Urdu</span>
                  <textarea rows={3} value={f.urdu || ''} onChange={e => setF((x: any) => ({ ...x, urdu: e.target.value }))}
                    className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm" style={{ direction: 'rtl' }} />
                </label>
                <label className="block col-span-full">
                  <span className="text-xs text-[#666] block mb-0.5">Description (if no Arabic/Urdu)</span>
                  <textarea rows={2} value={f.desc || ''} onChange={e => setF((x: any) => ({ ...x, desc: e.target.value }))}
                    className="font-urdu w-full p-2 border border-[#ccc] rounded text-sm" style={{ direction: 'rtl' }} />
                </label>
                <label className="block col-span-full">
                  <span className="text-xs text-[#666] block mb-0.5">English</span>
                  <textarea rows={2} value={f.english || ''} onChange={e => setF((x: any) => ({ ...x, english: e.target.value }))}
                    className="w-full p-2 border border-[#ccc] rounded text-sm" />
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40">
                  {saving ? 'Saving…' : editing ? '💾 Save Changes' : '➕ Add Dua'}
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="px-4 py-2 bg-[#f0f0f0] text-[#555] border-none rounded text-sm cursor-pointer hover:bg-[#e2e2e2]">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}