'use client'

import { useState, useEffect } from 'react'
import AdminGate, { useAdminAuth } from '../components/AdminGate'

const API = process.env.NEXT_PUBLIC_API_BASE || ''

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init)
  if (!res.ok) throw new Error('API error')
  return res.json()
}

export default function AdminBooksPage() {
  return (
    <AdminGate>
      <BooksManager />
    </AdminGate>
  )
}

function BooksManager() {
  const { logout } = useAdminAuth()
  const [allBooks, setAllBooks] = useState<any[]>([])
  const [deletedBooks, setDeletedBooks] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [csvMsg, setCsvMsg] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [listMsg, setListMsg] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const [bTitle, setBTitle] = useState('')
  const [bAuthor, setBAuthor] = useState('')
  const [bPages, setBPages] = useState('')
  const [bCover, setBCover] = useState('')
  const [bURL, setBURL] = useState('')
  const [bPdf, setBPdf] = useState('')
  const [bAudioPlay, setBAudioPlay] = useState('')
  const [bAudioDownload, setBAudioDownload] = useState('')
  const [addedMsg, setAddedMsg] = useState<string | null>(null)

  const [editing, setEditing] = useState<any | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function loadBooks() {
    try {
      const res = await api('/api/admin/books')
      setAllBooks(res.books || [])
      setDeletedBooks(res.deletedBooks || [])
    } catch { setAllBooks([]); setDeletedBooks([]) }
  }

  useEffect(() => { loadBooks() }, [])

  function parseCsvLine(line: string) {
    const cols: string[] = []
    let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    return cols.map(c => c.trim())
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvMsg(null); setCsvError(null)
    try {
      const text = await file.text()
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0)
      const parsed: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const c = parseCsvLine(lines[i])
        if (c.length < 6) continue
        const [title, author, pages, cover, thumbnail, url, pdf, audioUrl, aPlay, aDl] = c
        const item = {
          title: title || '',
          author: author || 'N/A',
          pages: pages || 'N/A',
          cover: cover || '',
          thumbnail: thumbnail || '',
          url: url || '',
          pdf: pdf || '',
          audioUrl: audioUrl || '',
          audioPlay: aPlay || '',
          audioDownload: aDl || '',
        }
        if (item.title || item.url || item.cover) parsed.push(item)
      }
      if (parsed.length === 0) {
        setCsvError('No valid rows found. Expected header: Title,Author_Name,Number_Of_Pages,Cover_Image_URL,Thumbnail_URL,Book_URL,PDF_Download_URL,Audio_Book_URL,Audio_Play_URL,Audio_Download_URL')
        return
      }
      try {
        const res = await api('/api/admin/books', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ books: parsed }),
        })
        await loadBooks()
        setCsvMsg(`Imported ${res.inserted} books from "${file.name}" (${res.updated} updated, ${res.skipped} skipped).`)
      } catch {
        setCsvError('Failed to import — server error. Check server logs.')
      }
    } catch (err: any) {
      setCsvError(err.message || 'Failed to read CSV')
    }
    e.target.value = ''
  }

  async function addManualBook() {
    if (!bTitle.trim()) return
    const item = {
      title: bTitle.trim(),
      author: bAuthor.trim() || 'N/A',
      pages: bPages.trim() || 'N/A',
      cover: bCover.trim(),
      thumbnail: '',
      url: bURL.trim(),
      pdf: bPdf.trim(),
      audioUrl: '',
      audioPlay: bAudioPlay.trim(),
      audioDownload: bAudioDownload.trim(),
    }
    try {
      await api('/api/admin/books', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ books: [item] }),
      })
      await loadBooks()
      setBTitle(''); setBAuthor(''); setBPages(''); setBCover(''); setBURL(''); setBPdf(''); setBAudioPlay(''); setBAudioDownload('')
      setAddedMsg('Book added!')
      setTimeout(() => setAddedMsg(null), 2500)
    } catch { setAddedMsg('Failed to add book on server') }
  }

  function startEdit(b: any) {
    setEditing(b)
    setEditFields({
      bakedKey: b.key || '',
      title: b.title || '',
      author: b.author || '',
      pages: b.pages || '',
      cover: b.cover || '',
      thumbnail: b.thumbnail || '',
      url: b.url || '',
      pdf: b.pdf || '',
      audioUrl: b.audioUrl || '',
      audioPlay: b.audioPlay || '',
      audioDownload: b.audioDownload || '',
    })
  }

  async function saveEdit() {
    if (!editing) return
    if (!editFields.title?.trim()) { setListError('Title required'); return }
    setSaving(true); setListMsg(null); setListError(null)
    try {
      const payload: any = {
        title: editFields.title.trim(),
        author: editFields.author.trim() || 'N/A',
        pages: editFields.pages.trim() || 'N/A',
        cover: editFields.cover.trim(),
        thumbnail: editFields.thumbnail.trim(),
        url: editFields.url.trim(),
        pdf: editFields.pdf.trim(),
        audioUrl: editFields.audioUrl.trim(),
        audioPlay: editFields.audioPlay.trim(),
        audioDownload: editFields.audioDownload.trim(),
      }
      if (editing.custom && editing.id) payload.id = editing.id
      else if (editFields.bakedKey) payload.bakedKey = editFields.bakedKey
      await api('/api/admin/books', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ books: [payload] }),
      })
      await loadBooks()
      setListMsg(`Saved "${payload.title}"`)
      setEditing(null)
    } catch {
      setListError('Save failed — server error')
    } finally { setSaving(false) }
  }

  async function deleteBook(b: any) {
    setListMsg(null); setListError(null)
    try {
      const headers = { 'content-type': 'application/json' }
      if (b.custom && b.id) {
        await api('/api/admin/books', { method: 'DELETE', headers, body: JSON.stringify({ id: b.id }) })
        setListMsg(`Deleted "${b.title}"`)
      }
      if (b.key) {
        await api('/api/admin/books', { method: 'DELETE', headers, body: JSON.stringify({ key: b.key, title: b.title }) })
        setListMsg(`Removed "${b.title}" from the site`)
      }
      if (editing && editing.key === b.key) setEditing(null)
      await loadBooks()
    } catch {
      setListError('Failed to delete — server error')
    }
  }

  async function restoreBook(d: any) {
    try {
      await api('/api/admin/books', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ restoreKey: d.key }) })
      setListMsg(`Restored "${d.title}"`)
      await loadBooks()
    } catch { setListError('Failed to restore — server error') }
  }

  const q = search.trim().toLowerCase()
  const filtered = allBooks.filter(b =>
    !q ||
    (b.title || '').toLowerCase().includes(q) ||
    (b.author || '').toLowerCase().includes(q) ||
    (b.key || '').toLowerCase().includes(q)
  )

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-4 sm:p-6">
      <div className="max-w-[960px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a5c3a]">📚 Books Manager</h1>
            <p className="text-xs text-[#666]">Add, edit, delete books — saved to the live database.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Admin Pages</a>
            <a href="/" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Site</a>
            <button onClick={logout} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 cursor-pointer hover:bg-red-100">Logout</button>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="bg-white p-4 rounded-xl border border-[#e0e0e0] mb-4">
          <h4 className="font-bold text-[#1a5c3a] mb-2">📄 Import Books from CSV</h4>
          <p className="text-xs text-[#999] mb-2">CSV columns (header row required): <b>Title, Author_Name, Number_Of_Pages, Cover_Image_URL, Thumbnail_URL, Book_URL, PDF_Download_URL, Audio_Book_URL, Audio_Play_URL, Audio_Download_URL</b>. Extra columns are ignored; missing ones become empty.</p>
          <label className="block mb-2">
            <span className="text-xs text-[#666] block mb-1">Choose .csv file</span>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload}
              className="w-full p-2 border border-[#ccc] rounded text-sm bg-white" />
          </label>
          {csvMsg && <div className="text-xs mb-2 p-2 rounded bg-[#e8f5e9] text-[#1a5c3a]">{csvMsg}</div>}
          {csvError && <div className="text-xs mb-2 p-2 rounded bg-[#ffebee] text-red-700">{csvError}</div>}
        </div>

        {/* Manual Add */}
        <div className="bg-white p-4 rounded-xl border border-[#e0e0e0] mb-4">
          <h4 className="font-bold text-[#1a5c3a] mb-2">➕ Add Book Manually</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input type="text" value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="Title *"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bAuthor} onChange={e => setBAuthor(e.target.value)} placeholder="Author"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bPages} onChange={e => setBPages(e.target.value)} placeholder="Pages"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bCover} onChange={e => setBCover(e.target.value)} placeholder="Cover image URL"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bURL} onChange={e => setBURL(e.target.value)} placeholder="Book page URL"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bPdf} onChange={e => setBPdf(e.target.value)} placeholder="PDF download URL"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bAudioPlay} onChange={e => setBAudioPlay(e.target.value)} placeholder="Audio play URL"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={bAudioDownload} onChange={e => setBAudioDownload(e.target.value)} placeholder="Audio download URL"
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
          </div>
          <button onClick={addManualBook} disabled={!bTitle.trim()}
            className="px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40 w-full">
            ➕ Add Book
          </button>
          {addedMsg && <div className="text-xs text-[#1a5c3a] mt-2">{addedMsg}</div>}
        </div>

        {/* All Books */}
        <div className="bg-white p-4 rounded-xl border border-[#e0e0e0] mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h4 className="font-bold text-[#1a5c3a]">📚 All Books ({allBooks.length})</h4>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search title / author / url..."
              className="flex-1 min-w-[140px] p-2 border border-[#ccc] rounded text-sm" />
          </div>
          {listMsg && <div className="text-xs mb-2 p-2 rounded bg-[#e8f5e9] text-[#1a5c3a]">{listMsg}</div>}
          {listError && <div className="text-xs mb-2 p-2 rounded bg-[#ffebee] text-red-700">{listError}</div>}
          <div className="max-h-[45vh] overflow-y-auto border border-[#e0e0e0] rounded">
            {filtered.length === 0 ? (
              <p className="text-xs text-[#999] p-3">No books found.</p>
            ) : (
              filtered.map((b) => (
                <div key={b.key || b.id || b.title} className="flex items-center gap-2 p-1.5 border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#f4faf4]">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#e8f5e9] text-[#1a5c3a] whitespace-nowrap">{b.source}</span>
                  {b.deleted && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 whitespace-nowrap">HIDDEN</span>}
                  <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ direction: 'rtl' }}>{b.title}</span>
                  <span className="text-[10px] text-[#999] truncate max-w-[120px] hidden sm:block">{b.author} · {b.pages}pp</span>
                  <button onClick={() => startEdit(b)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-2 py-0.5 cursor-pointer hover:bg-[#d0ead8] whitespace-nowrap">✏️ Edit</button>
                  <button onClick={() => deleteBook(b)} className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5 cursor-pointer hover:bg-red-100 whitespace-nowrap">🗑 Delete</button>
                </div>
              ))
            )}
          </div>
          {filtered.length !== allBooks.length && (
            <p className="text-[10px] text-[#999] mt-1.5">Showing {filtered.length} of {allBooks.length} — refine the search or clear it to see everything.</p>
          )}
        </div>

        {/* Deleted / hidden — restorable */}
        {deletedBooks.length > 0 && (
          <div className="bg-[#fff5f5] p-4 rounded-xl border border-[#e8c4c4] mb-4">
            <h4 className="font-bold text-red-700 mb-2">🗑 Hidden Books ({deletedBooks.length})</h4>
            {deletedBooks.map((d: any) => (
              <div key={d.key} className="flex items-center gap-2 mb-1 p-1.5 bg-white rounded border border-[#f0c8c8]">
                <span className="text-xs flex-1 truncate" style={{ direction: 'rtl' }}>{d.title}</span>
                <button onClick={() => restoreBook(d)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b8d6c4] rounded px-2 py-0.5 cursor-pointer hover:bg-[#d0ead8]">↩ Restore</button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#fffde7] p-4 rounded-xl border border-[#e8d84a]">
          <h4 className="font-bold text-[#1a5c3a] mb-1">💡 Note</h4>
          <p className="text-xs text-[#666]">All books are stored in the website database (<code className="bg-[#e8f5e9] px-1 rounded">tbl_CustomBooks</code> + <code className="bg-[#e8f5e9] px-1 rounded">tbl_HiddenBooks</code>) and appear to <b>all visitors</b> immediately. Editing a built-in book creates an override; Delete hides it (restorable in the Hidden section). To permanently restore the original CSV book list, empty both tables and redeploy.</p>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded-xl w-[90%] max-w-[560px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#1a5c3a]">✏️ Edit Book</h4>
              <button onClick={() => setEditing(null)} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <input type="text" value={editFields.title || ''} onChange={e => setEditFields((f: any) => ({ ...f, title: e.target.value }))} placeholder="Title *"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.author || ''} onChange={e => setEditFields((f: any) => ({ ...f, author: e.target.value }))} placeholder="Author"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.pages || ''} onChange={e => setEditFields((f: any) => ({ ...f, pages: e.target.value }))} placeholder="Pages"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.cover || ''} onChange={e => setEditFields((f: any) => ({ ...f, cover: e.target.value }))} placeholder="Cover image URL"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.url || ''} onChange={e => setEditFields((f: any) => ({ ...f, url: e.target.value }))} placeholder="Book page URL"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.pdf || ''} onChange={e => setEditFields((f: any) => ({ ...f, pdf: e.target.value }))} placeholder="PDF download URL"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.audioPlay || ''} onChange={e => setEditFields((f: any) => ({ ...f, audioPlay: e.target.value }))} placeholder="Audio play URL"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
              <input type="text" value={editFields.audioDownload || ''} onChange={e => setEditFields((f: any) => ({ ...f, audioDownload: e.target.value }))} placeholder="Audio download URL"
                className="w-full p-2 border border-[#ccc] rounded text-sm" />
            </div>
            {editing.custom && editing.id ? (
              <p className="text-[10px] text-[#999] mb-2">Editing a custom book (id #{editing.id}) — will update in place.</p>
            ) : (
              <p className="text-[10px] text-[#999] mb-2">Editing a built-in book — the change is stored as an override so it stays after redeploys. Use Delete to hide it instead.</p>
            )}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40">
                {saving ? 'Saving…' : '💾 Save Changes'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 bg-[#f0f0f0] text-[#555] border-none rounded text-sm cursor-pointer hover:bg-[#e2e2e2]">Cancel</button>
            </div>
            {listError && <div className="text-xs mt-2 p-2 rounded bg-[#ffebee] text-red-700">{listError}</div>}
          </div>
        </div>
      )}
    </div>
  )
}