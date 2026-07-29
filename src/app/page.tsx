'use client'

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'

type Tab = 'quran' | 'hadith' | 'wordbyword' | 'tafseer' | 'duas' | 'topics' | 'fahmul' | 'mutradif' | 'more' | 'search' | 'about'

const API = ''

const SURAH_VERSE_COUNT = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]

let audioRef: HTMLAudioElement | null = null
function playAyah(surah: number, ayah: number) {
  if (audioRef) { audioRef.pause(); audioRef = null }
  let globalAyah = 0
  for (let i = 1; i < surah; i++) globalAyah += SURAH_VERSE_COUNT[i]
  globalAyah += (surah === 1 || surah === 9) ? ayah + 1 : ayah
  const src = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`
  audioRef = new Audio(src)
  audioRef.play().catch(() => {})
}

async function api(path: string) {
  const res = await fetch(`${API}/api${path}`)
  if (!res.ok) throw new Error('API error')
  return res.json()
}

const SettingsCtx = createContext<any>(null)
function useSettings() { return useContext(SettingsCtx) }

function arabicEl(text: string, cls = '') {
  return <span className={`font-arabic text-right text-[28px] leading-[2] text-[#1a3a1a] ${cls}`} style={{ direction: 'rtl', display: 'block' }}>{text}</span>
}

function urduEl(text: string, cls = '') {
  return <span className={`font-urdu text-right text-xl leading-relaxed text-[#2d2d2d] font-medium ${cls}`} style={{ direction: 'rtl', display: 'block' }}>{text}</span>
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('quran')
  const [homeKey, setHomeKey] = useState(0)
  const [tarjma, setTarjma] = useState('k_iman')
  const [tafseer, setTafseer] = useState('tafseer_tibyan')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tarjmaList, setTarjmaList] = useState<any[]>([])
  const [tafseerList, setTafseerList] = useState<any[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    api('/quran/translations').then(setTarjmaList).catch(() => {})
    api('/quran/tafseer_types').then(setTafseerList).catch(() => {})
    const savedTarjma = localStorage.getItem('islam360_tarjma') || 'k_iman'
    const savedTafseer = localStorage.getItem('islam360_tafseer') || 'tafseer_tibyan'
    setTarjma(savedTarjma)
    setTafseer(savedTafseer)
  }, [])

  const saveSettings = useCallback(() => {
    localStorage.setItem('islam360_tarjma', tarjma)
    localStorage.setItem('islam360_tafseer', tafseer)
    setSettingsOpen(false)
  }, [tarjma, tafseer])

  const showTab = useCallback((t: Tab) => {
    setTab(t)
  }, [])

  const goHome = useCallback(() => {
    setTab('quran')
    setHomeKey(k => k + 1)
  }, [])

  const ctxVal = { tarjma, tafseer, tarjmaList, tafseerList, showTab }

  return (
    <SettingsCtx.Provider value={ctxVal}>
      <div>
        {/* Navbar */}
        <nav className="bg-[#1a5c3a] text-white px-3 sm:px-5 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={goHome}>
            <img src="/logo.svg" alt="Quran Web" className="h-8 w-8 sm:h-11 sm:w-11" />
            <span className="text-sm sm:text-base font-bold tracking-wide hidden sm:inline">Quran Web</span>
            <span className="text-sm font-bold tracking-wide sm:hidden">QW</span>
          </div>

          {/* Font size sliders - desktop */}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded cursor-pointer" title="Arabic font size">
              <span className="text-white/80 font-semibold">Ar</span>
              <input type="range" min={14} max={50} defaultValue={28} className="w-[50px] h-1 accent-[#e8b840] cursor-pointer" onChange={e => {
                localStorage.setItem('islam360_arabic_size', e.target.value)
                const el = document.getElementById('arabicSizeLabel')
                if (el) el.textContent = e.target.value
                document.querySelectorAll('.arabic, .arabic-ayah, .r-arabic, .dua-arabic').forEach(el => (el as HTMLElement).style.fontSize = e.target.value + 'px')
              }} />
              <span className="text-white/60 min-w-[16px] text-right text-[10px]" id="arabicSizeLabel">28</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded cursor-pointer" title="Urdu font size">
              <span className="text-white/80 font-semibold">Ur</span>
              <input type="range" min={10} max={40} defaultValue={20} className="w-[50px] h-1 accent-[#e8b840] cursor-pointer" onChange={e => {
                localStorage.setItem('islam360_urdu_size', e.target.value)
                const el = document.getElementById('urduSizeLabel')
                if (el) el.textContent = e.target.value
                document.querySelectorAll('.translation.urdu, .text.urdu, .dua-urdu').forEach(el => (el as HTMLElement).style.fontSize = e.target.value + 'px')
              }} />
              <span className="text-white/60 min-w-[16px] text-right text-[10px]" id="urduSizeLabel">20</span>
            </label>
          </div>

          {/* Mobile font toggle */}
          <button onClick={() => setMobileMenuOpen(o => !o)} className={`sm:hidden ml-auto bg-white/10 px-2 py-1 rounded text-xs cursor-pointer ${mobileMenuOpen ? 'bg-white/20' : ''}`} title="Font Size">
            Aa
          </button>

          <button onClick={() => setSettingsOpen(true)} className="bg-transparent border-none text-white cursor-pointer text-lg px-1.5 shrink-0" title="Settings">&#9881;</button>
        </nav>

        {/* Mobile font slider panel */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-[#1a5c3a] px-3 pb-3 flex items-center gap-3 border-t border-white/10">
            <label className="flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded cursor-pointer">
              <span className="text-white/80 font-semibold">Arabic</span>
              <input type="range" min={14} max={50} defaultValue={28} className="w-[80px] h-1 accent-[#e8b840] cursor-pointer" onChange={e => {
                localStorage.setItem('islam360_arabic_size', e.target.value)
                const el = document.getElementById('arabicSizeLabel')
                if (el) el.textContent = e.target.value
                document.querySelectorAll('.arabic, .arabic-ayah, .r-arabic, .dua-arabic').forEach(el => (el as HTMLElement).style.fontSize = e.target.value + 'px')
              }} />
              <span className="text-white/60 min-w-[16px] text-right text-[10px]">28</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] bg-white/10 px-2 py-1 rounded cursor-pointer">
              <span className="text-white/80 font-semibold">Urdu</span>
              <input type="range" min={10} max={40} defaultValue={20} className="w-[80px] h-1 accent-[#e8b840] cursor-pointer" onChange={e => {
                localStorage.setItem('islam360_urdu_size', e.target.value)
                const el = document.getElementById('urduSizeLabel')
                if (el) el.textContent = e.target.value
                document.querySelectorAll('.translation.urdu, .text.urdu, .dua-urdu').forEach(el => (el as HTMLElement).style.fontSize = e.target.value + 'px')
              }} />
              <span className="text-white/60 min-w-[16px] text-right text-[10px]">20</span>
            </label>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-[#2a7a4e] flex px-3 sm:px-5 gap-0.5 overflow-x-auto scrollbar-none">
          {(['quran', 'hadith', 'wordbyword', 'tafseer', 'duas', 'topics', 'fahmul', 'mutradif', 'more', 'search', 'about'] as Tab[]).map(t => (
            <button key={t} onClick={() => showTab(t)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border-none cursor-pointer capitalize whitespace-nowrap shrink-0
                ${tab === t ? 'bg-[#f5f5f5] text-[#1a5c3a] font-bold rounded-t-lg' : 'text-[#ddd] hover:bg-[#3a8a5e] hover:text-white'}`}
            >{t === 'wordbyword' ? 'Word-by-Word' : t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 max-w-[1200px] mx-auto">
          {tab === 'quran' && <QuranTab key={homeKey} />}
          {tab === 'hadith' && <HadithTab />}
          {tab === 'wordbyword' && <WordByWordTab />}
          {tab === 'tafseer' && <TafseerTab />}
          {tab === 'duas' && <DuasTab />}
          {tab === 'topics' && <TopicsTab />}
          {tab === 'fahmul' && <FahmulTab />}
          {tab === 'mutradif' && <MutradifTab />}
          {tab === 'more' && <MoreTab />}
          {tab === 'search' && <SearchTab />}
          {tab === 'about' && <AboutTab />}
        </div>

        {/* Settings Modal */}
        {settingsOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[5%]">
            <div className="bg-white p-4 sm:p-5 rounded-xl w-[95%] sm:w-[90%] max-w-[450px] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#1a5c3a] text-lg font-bold">&#9881; Reading Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
              </div>
              <div className="mb-3">
                <label className="font-bold text-sm block mb-1">Tarjma (Translation):</label>
                <select value={tarjma} onChange={e => setTarjma(e.target.value)} className="w-full p-1.5 border border-[#ccc] rounded">
                  {tarjmaList.map((t: any) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="font-bold text-sm block mb-1">Tafseer (Commentary):</label>
                <select value={tafseer} onChange={e => setTafseer(e.target.value)} className="w-full p-1.5 border border-[#ccc] rounded">
                  <option value="">None</option>
                  {tafseerList.map((t: any) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <button onClick={saveSettings} className="w-full py-2 bg-[#1a5c3a] text-white border-none rounded font-bold cursor-pointer">Save Settings</button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="bg-[#1a5c3a] text-white/70 text-center text-xs py-4 mt-8">
          &copy; {new Date().getFullYear()} Quran Web. All rights reserved.
        </footer>

        {/* Word/Detail Modal */}
        <Modal />
      </div>
    </SettingsCtx.Provider>
  )
}

// ============== MODAL ==============
let modalState: any = { open: false, title: '', body: null as React.ReactNode | null }
let modalListeners: (() => void)[] = []

function openModal(title: string, body: React.ReactNode) {
  modalState = { open: true, title, body }
  modalListeners.forEach(fn => fn())
}
function closeModal() {
  modalState = { open: false, title: '', body: null }
  modalListeners.forEach(fn => fn())
}

function Modal() {
  const [, setTick] = useState(0)
  useEffect(() => {
    modalListeners.push(() => setTick(t => t + 1))
    return () => { modalListeners = [] }
  }, [])
  if (!modalState.open) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white p-3 sm:p-5 rounded-xl w-[98vw] sm:w-[95vw] max-w-[900px] h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[#1a5c3a] font-bold">{modalState.title}</h3>
          <button onClick={closeModal} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
        </div>
        <div>{modalState.body}</div>
      </div>
    </div>
  )
}

// ============== QURAN ==============
type QuranView = 'surahs' | 'parahs' | 'browse' | 'search' | 'bookmarks'

function QuranTab() {
  const [view, setView] = useState<QuranView>('surahs')
  const [surahNames, setSurahNames] = useState<any[]>([])
  const [parahNames, setParahNames] = useState<any[]>([])
  const [verses, setVerses] = useState<any[]>([])
  const [browseId, setBrowseId] = useState<number>(1)
  const [showArabic, setShowArabic] = useState(true)
  const [showTarjma, setShowTarjma] = useState(true)
  const [showTafseer, setShowTafseer] = useState(false)
  const { tarjma, tafseer, tarjmaList, tafseerList, showTab } = useSettings()

  useEffect(() => {
    api('/quran/surah_names').then(setSurahNames).catch(() => {})
    api('/quran/parah_names').then(setParahNames).catch(() => {})
  }, [])

  const bookmarks: number[] = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('islam360_bookmarks') || '[]') : []

  function toggleBm(id: number) {
    const b = JSON.parse(localStorage.getItem('islam360_bookmarks') || '[]')
    const idx = b.indexOf(id)
    if (idx > -1) b.splice(idx, 1); else b.push(id)
    localStorage.setItem('islam360_bookmarks', JSON.stringify(b))
    setView((v: QuranView) => v === 'bookmarks' ? 'bookmarks' : v)
  }

  function loadVerses(id: number, scrollAyah?: number) {
    setView('browse')
    setBrowseId(id)
    const url = `/quran/surah/${id}?tarjma=${encodeURIComponent(tarjma)}${tafseer ? `&tafseer=${encodeURIComponent(tafseer)}` : ''}`
    api(url).then(data => {
      setVerses(data)
      if (scrollAyah !== undefined) {
        setTimeout(() => {
          document.getElementById(`ayah-${scrollAyah}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 200)
      }
    })
  }

  function loadParah(id: number) {
    const url = `/quran/parah/${id}?tarjma=${encodeURIComponent(tarjma)}${tafseer ? `&tafseer=${encodeURIComponent(tafseer)}` : ''}`
    api(url).then(data => { setVerses(data); setView('browse') })
  }

  const tarjmaLabel = tarjmaList.find((t: any) => t.key === tarjma)?.label || 'Tarjma'
  const tafseerLabel = tafseerList.find((t: any) => t.key === tafseer)?.label || 'Tafseer'

  if (view === 'browse') {
    return (
      <div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setView('surahs')} className="bg-[#2a7a4e] text-[#ddd] px-4 py-1.5 text-sm border-none rounded cursor-pointer">Back</button>
          <label className="text-xs bg-[#e8f5e9] px-2.5 py-1 rounded cursor-pointer">
            <input type="checkbox" checked={showArabic} onChange={e => setShowArabic(e.target.checked)} /> Arabic
          </label>
          <label className="text-xs bg-[#e8f5e9] px-2.5 py-1 rounded cursor-pointer">
            <input type="checkbox" checked={showTarjma} onChange={e => setShowTarjma(e.target.checked)} /> {tarjmaLabel}
          </label>
          {tafseer && (
            <label className="text-xs bg-[#fff3e0] px-2.5 py-1 rounded cursor-pointer">
              <input type="checkbox" checked={showTafseer} onChange={e => setShowTafseer(e.target.checked)} /> {tafseerLabel}
            </label>
          )}
        </div>
        <div className="surah-header">
          <h2>{(surahNames.find((s: any) => s.id === browseId) as any)?.arabic} — {(surahNames.find((s: any) => s.id === browseId) as any)?.english || `Surah ${browseId}`}</h2>
          <div className="text-xs opacity-90">{verses.length} verses</div>
        </div>
        <div id="quranVerses">
          {verses.map(v => (
            <div key={v.id} className="quran-ayah" id={`ayah-${v.ayah}`}>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <div className="meta mr-auto">Surah {v.surah}:{(v.surah === 1 || v.surah === 9) ? v.ayah + 1 : (v.ayah > 0 ? v.ayah : 'Basmalah')} | Para {v.para}</div>
                <button className="bg-[#e8f5e9] border border-[#a5d6a7] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#c8e6c9]" onClick={() => wordModal(v.surah, v.ayah)} title="Word by Word">Words</button>
                <button className="bg-[#fff3e0] border border-[#e8b840] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#ffe0b2]" onClick={() => showAyahTafseer(v.surah, v.ayah)} title="Tafseer">Tafseer</button>
                {(v.surah === 1 || v.surah === 9 || v.ayah > 0) && <button className="bg-[#e3f2fd] border border-[#90caf9] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#bbdefb]" onClick={() => playAyah(v.surah, v.ayah)} title="Play Audio">&#9654;</button>}
              </div>
              {showArabic && <div className="arabic">{v.arabic}</div>}
              {showTarjma && <div className="translation urdu">{v.tarjma_text || v.urdu || v.english}</div>}
              {showTafseer && v.tafseer_text && <div className="translation urdu" style={{ background: '#fffde7', padding: '6px 8px', borderRadius: 6, marginTop: 6, borderLeft: '3px solid #e8b840', whiteSpace: 'pre-wrap' }}>{v.tafseer_text}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(['surahs', 'parahs', 'search', 'bookmarks'] as QuranView[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm border-none rounded cursor-pointer capitalize
              ${view === v ? 'bg-[#f5f5f5] text-[#1a5c3a]' : 'bg-[#2a7a4e] text-[#ddd]'}`}
          >{v === 'bookmarks' ? '⭐ Bookmarks' : v === 'search' ? '🔍 Search' : v}</button>
        ))}
      </div>
      {view === 'surahs' && (
        <div className="grid gap-1">
          {surahNames.map((s: any) => (
            <div key={s.id} className="list-card flex items-center">
              <div className="flex-1 cursor-pointer" onClick={() => loadVerses(s.id)}>
                <div className="list-name flex items-center gap-2 sm:gap-3">
                  <span className="bg-[#1a5c3a] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shrink-0">{s.id}</span>
                  <span className="font-arabic text-lg sm:text-[22px] text-[#1a3a1a]">{s.arabic}</span>
                  <span className="text-xs sm:text-sm text-[#666] truncate">{s.english}</span>
                </div>
              </div>
              <span className="text-lg sm:text-[22px] cursor-pointer px-2 sm:px-2.5 shrink-0" onClick={e => { e.stopPropagation(); toggleBm(s.id) }}>
                {bookmarks.includes(s.id) ? '⭐' : '☆'}
              </span>
            </div>
          ))}
        </div>
      )}
      {view === 'parahs' && (
        <div className="grid gap-1">
          {parahNames.map((p: any) => (
            <div key={p.id} className="list-card" onClick={() => loadParah(p.id)}>
              <div className="list-name flex items-center gap-2 sm:gap-3">
                <span className="bg-[#1a5c3a] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shrink-0">{p.id}</span>
                <span className="font-arabic text-base sm:text-xl text-[#1a3a1a]">{p.arabic_name}</span>
                <span className="text-[10px] sm:text-xs text-[#999] truncate">Surah {p.start_surah}:{p.start_ayah} &rarr; {p.end_surah}:{p.end_ayah}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {view === 'bookmarks' && (
        <div className="grid gap-1">
          {bookmarks.length === 0 && <div className="loading">No bookmarked surahs yet. ⭐ a surah to add it here.</div>}
          {bookmarks.map(id => {
            const s = surahNames.find((n: any) => n.id === id)
            if (!s) return null
            return (
              <div key={id} className="list-card flex items-center">
                <div className="flex-1 cursor-pointer" onClick={() => loadVerses(s.id)}>
                  <div className="list-name flex items-center gap-2 sm:gap-3">
                    <span className="bg-[#1a5c3a] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shrink-0">{s.id}</span>
                    <span className="font-arabic text-lg sm:text-[22px] text-[#1a3a1a]">{s.arabic}</span>
                    <span className="text-xs sm:text-sm text-[#666] truncate">{s.english}</span>
                  </div>
                </div>
                <span className="text-lg sm:text-[22px] cursor-pointer px-2 sm:px-2.5 shrink-0" onClick={e => { e.stopPropagation(); toggleBm(s.id) }}>⭐</span>
              </div>
            )
          })}
        </div>
      )}
      {view === 'search' && <QuranSearch />}
    </div>
  )
}

function QuranSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  function doSearch() {
    if (!query.trim()) return
    setSearched(true)
    api(`/quran/search?q=${encodeURIComponent(query)}`).then(setResults)
  }

  function openAyah(r: any) {
    const displayAyah = (r.surah === 1 || r.surah === 9) ? r.ayah + 1 : (r.ayah > 0 ? r.ayah : 'Basmalah')
    api(`/quran/ayahs?surah=${r.surah}&start=${r.ayah}&end=${r.ayah}`).then((verses: any[]) => {
      openModal('', <div>
        <div style={{ marginBottom: 10 }}>
          <button onClick={closeModal} className="px-3 py-1 bg-[#ddd] border-none rounded cursor-pointer">&larr; Back to results</button>
        </div>
        {verses.map((v: any) => (
          <div key={v.id} style={{ padding: 14, background: '#fafafa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Surah {r.surah}:{displayAyah}</div>
            <div className="font-arabic text-[26px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl', marginBottom: 10 }}>{v.arabic}</div>
            <div className="font-urdu text-xl text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 6 }}>{v.urdu}</div>
            {v.english && <div style={{ fontSize: 15, color: '#444', lineHeight: 1.6 }}>{v.english}</div>}
          </div>
        ))}
      </div>)
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 10, fontSize: 12, color: '#666' }}>
        Type text or ayat reference (e.g. 2:255)
      </div>
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <input type="text" placeholder="Search Quran..." value={query} onChange={e => setQuery(e.target.value)}
          onKeyUp={e => e.key === 'Enter' && doSearch()}
          className="flex-1 min-w-0 w-full p-1.5 border border-[#ccc] rounded" />
        <button onClick={doSearch} className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">Search</button>
      </div>
      {searched && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Found {results.length} results</h3>
          {results.map((r: any, i: number) => (
            <div key={i} className="result-item" onClick={() => openAyah(r)}>
              <div className="r-meta">Surah {r.surah}:{(r.surah === 1 || r.surah === 9) ? r.ayah + 1 : r.ayah}</div>
              <div className="r-arabic">{r.arabic}</div>
              <div className="r-text">{r.urdu || r.english}</div>
            </div>
          ))}
          {results.length === 0 && <div className="loading">No results found.</div>}
        </div>
      )}
    </div>
  )
}

// ============== WORD MODAL ==============
function wordModal(surah: number, ayah: number) {
  openModal(`Surah ${surah}:${ayah} - Word Analysis`, <WordModalBody surah={surah} ayah={ayah} />)
}
function WordModalBody({ surah, ayah }: { surah: number; ayah: number }) {
  const [words, setWords] = useState<any[]>([])
  useEffect(() => { api(`/quran/arabic_words?surah=${surah}&ayah=${ayah}`).then(setWords) }, [surah, ayah])
  if (!words.length) return <div className="loading">Loading...</div>
  return <div>{words.map((w, i) => (
    <div key={i} className="word-row">
      <div className="w-arabic">{w.word}</div>
      <div className="w-root">Root: {w.root || '-'}</div>
      <div className="w-meaning urdu">{w.urdu || w.meaning || '-'}</div>
      <div className="w-meaning" style={{ fontSize: 12, color: '#666' }}>{w.english || '-'}</div>
    </div>
  ))}</div>
}

function highlightText(text: string, words: string[]) {
  if (!words || words.length === 0) return text
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  const lowerWords = words.map(w => w.toLowerCase())
  return parts.map((part, i) =>
    part && lowerWords.some(w => w === part.toLowerCase())
      ? <mark key={i} className="bg-[#e8b840]/40 text-[#1a5c3a] rounded px-0.5 font-medium">{part}</mark>
      : part
  )
}

function showAyahTafseer(surah: number, ayah: number) {
  openModal(`Surah ${surah}:${ayah} - Tafseer`, <TafseerBody surah={surah} ayah={ayah} />)
}
function TafseerBody({ surah, ayah }: { surah: number; ayah: number }) {
  const { tafseer } = useSettings()
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    if (tafseer) api(`/quran/tafseer/${surah}/${ayah}`).then(setData)
  }, [surah, ayah, tafseer])
  if (!tafseer) return <div>Please select a tafseer in settings.</div>
  if (!data) return <div className="loading">Loading...</div>
  const text = data[tafseer]
  return text ? <div className="font-urdu text-right text-xl leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', whiteSpace: 'pre-wrap' }}>{text}</div>
    : <div>No tafseer available.</div>
}

// ============== HADITH ==============
function HadithTab() {
  const [books, setBooks] = useState<any[]>([])
  const [bookId, setBookId] = useState('')
  const [number, setNumber] = useState('')
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api('/hadith/books').then(b => { setBooks(b); if (b.length) { setBookId(b[0].id); loadBook(b[0].id, 1) } })
  }, [])

  function loadBook(id: string, p: number) {
    setLoading(true); setList([])
    api(`/hadith/book/${id}?page=${p}`).then(data => {
      setList(data.hadiths); setTotal(data.total); setPages(data.pages); setPage(p); setLoading(false)
    }).catch(() => setLoading(false))
  }

  function fetchHadith() {
    const num = parseInt(number)
    if (!num || !bookId) return
    api(`/hadith/hadith/${bookId}/${num}`).then((h: any) => {
      if (h && !h.error) openHadithDetail(h, bookId)
    })
  }

  const bookName = books.find((b: any) => b.id === bookId)?.name || bookId

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {books.map(b => (
          <button key={b.id} onClick={() => { setBookId(b.id); loadBook(b.id, 1) }}
            className={`px-3 py-1.5 border border-[#4a7c59] rounded text-sm cursor-pointer ${b.id === bookId ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'bg-white text-[#1a5c3a] hover:bg-[#e8f5e9]'}`}>
            {b.name} ({b.count})
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 items-end">
        <div>
          <label className="text-xs text-[#666] block mb-0.5">Hadith Number</label>
          <input type="number" value={number} onChange={e => setNumber(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fetchHadith() }}
            className="w-28 p-1.5 border border-[#ccc] rounded text-sm" />
        </div>
        <button onClick={fetchHadith}
          className="px-4 py-1.5 bg-[#1a5c3a] text-white border border-[#1a5c3a] rounded text-sm cursor-pointer hover:bg-[#2d7a4e]">Search</button>
        <span className="text-[11px] text-[#888]">select book then search for hadith number</span>
      </div>

      {loading && <div className="loading">Loading hadiths...</div>}
      {!loading && list.length === 0 && <div className="loading">Select a book to view hadiths.</div>}
      {list.map(h => (
        <div key={h.number} className="hadith-card" style={{ cursor: 'pointer' }} onClick={() => openHadithDetail(h, bookId)}>
          <div className="hadith-number">Hadith #{h.number}</div>
          <div className="arabic">{h.arabic}</div>
          {h.urdu && <div className="text urdu">{h.urdu}</div>}
          {h.urdu_ravi && <div className="narrator">{h.urdu_ravi}</div>}
          {h.english && <div className="text english">{h.english}</div>}
        </div>
      ))}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center items-center">
          <button disabled={page <= 1} onClick={() => loadBook(bookId, page - 1)}
            className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer disabled:opacity-40">Prev</button>
          <span className="text-sm text-[#666]">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => loadBook(bookId, page + 1)}
            className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function openHadithDetail(h: any, bookId: string) {
  openModal(`Hadith #${h.number}`, <HadithDetailBody h={h} bookId={bookId} />)
}

function HadithDetailBody({ h, bookId }: { h: any; bookId: string }) {
  const [detail, setDetail] = useState<any>(h)
  const [num, setNum] = useState(h.number)

  useEffect(() => {
    if (h.international_number || h.number) {
      api(`/hadith/hadith/${bookId}/${h.number}`).then((d: any) => {
        if (d && !d.error) setDetail(d)
      }).catch(() => {})
    }
  }, [h.number, bookId])

  return (
    <div className="hadith-card">
      <div style={{ fontSize: 14, marginBottom: 10, color: '#999' }}>Hadith #{detail.number}</div>
      <div style={{ fontFamily: "'NooreHuda','AlviNastaleeq','Traditional Arabic',serif", fontSize: 22, lineHeight: 2, textAlign: 'right', direction: 'rtl', color: '#1a3a1a', marginBottom: 10 }}>{detail.arabic}</div>
      {detail.urdu && <div style={{ fontFamily: "'AlviNastaleeq','JameelNastaleeq',serif", fontSize: 20, textAlign: 'right', direction: 'rtl', color: '#2d2d2d', marginBottom: 5, fontWeight: 500, lineHeight: 1.8 }}>{detail.urdu}</div>}
      {detail.urdu_ravi && <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 5 }}>{detail.urdu_ravi}</div>}
      {detail.english && <div style={{ fontSize: 14, lineHeight: 1.6, color: '#444', marginBottom: 5 }}>{detail.english}</div>}
      {detail.english_ravi && <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>{detail.english_ravi}</div>}
    </div>
  )
}

// ============== WORD BY WORD ==============
function WordByWordTab() {
  const [surah, setSurah] = useState(1)
  const [ayah, setAyah] = useState(1)
  const [data, setData] = useState<any>(null)

  function load() {
    api(`/quran/wordbyword?surah=${surah}&ayah=${ayah}`).then(setData)
  }

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Word-by-Word Analysis</h2>
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <label>Surah: <input type="number" value={surah} min={1} max={114} onChange={e => setSurah(parseInt(e.target.value) || 1)} className="w-[70px] p-1 border border-[#ccc] rounded" /></label>
        <label>Ayah: <input type="number" value={ayah} min={1} onChange={e => setAyah(parseInt(e.target.value) || 1)} className="w-[70px] p-1 border border-[#ccc] rounded" /></label>
        <button onClick={load} className="px-3 py-1 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">Load</button>
      </div>
      {data && (
        <div>
          <h3 className="text-[#1a5c3a] mb-2.5">Surah {surah}:{ayah}</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-[#1a5c3a] text-white">
                  <th className="p-1.5 sm:p-2 text-center w-8 sm:w-10 text-xs sm:text-sm">#</th>
                  <th className="p-1.5 sm:p-2 text-center text-xs sm:text-sm">Arabic</th>
                  <th className="p-1.5 sm:p-2 text-center text-xs sm:text-sm">Urdu</th>
                  <th className="p-1.5 sm:p-2 text-center text-xs sm:text-sm">English</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(data.arabic.length, data.urdu.length, data.english.length) }, (_, i) => (
                  <tr key={i} className="border-b border-[#e0e0e0]">
                    <td className="p-1 sm:p-1.5 text-center text-[10px] sm:text-xs text-[#888]">{i + 1}</td>
                    <td className="p-1 sm:p-1.5 text-right font-arabic text-base sm:text-[22px] text-[#1a3a1a]" style={{ direction: 'rtl' }}>{data.arabic[i] || ''}</td>
                    <td className="p-1 sm:p-1.5 text-right text-sm sm:text-lg text-[#1a5c3a]" style={{ fontFamily: "'AlviNastaleeq','JameelNastaleeq','Noto Nastaliq Urdu',serif", direction: 'rtl' }}>{data.urdu[i] || ''}</td>
                    <td className="p-1 sm:p-1.5 text-left text-[11px] sm:text-sm text-[#555]">{data.english[i] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!data && <div className="loading">Enter surah/ayah and click Load.</div>}
    </div>
  )
}

// ============== TAFSEER ==============
function TafseerTab() {
  const [surah, setSurah] = useState(1)
  const [ayah, setAyah] = useState(1)
  const [tfType, setTfType] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [data, setData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    api('/quran/tafseer_types').then(t => {
      setTypes(t)
      const saved = localStorage.getItem('islam360_tafseer') || 'tafseer_tibyan'
      if (saved && t.find((x: any) => x.key === saved)) setTfType(saved)
    }).catch(() => {})
  }, [])

  function load() {
    setData(null)
    setSearchResults([])
    setSearched(false)
    if (!tfType) return
    Promise.all([
      api(`/quran/tafseer/${surah}/${ayah}`),
      api(`/quran/surah/${surah}?tarjma=${encodeURIComponent(localStorage.getItem('islam360_tarjma') || 'translation_urdu')}`)
    ]).then(([tafseerData, surahData]) => {
      setData({ tafseerData, ayahData: (surahData as any[]).find((v: any) => v.ayah == ayah) })
    }).catch(() => {})
  }

  function doSearch() {
    if (!searchQuery.trim() || !tfType) return
    setSearching(true)
    setData(null)
    setSearched(true)
    setSearchResults([])
    api(`/quran/tafseer/search?q=${encodeURIComponent(searchQuery)}&type=${encodeURIComponent(tfType)}`)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }

  function openAyah(surahNum: number, ayahNum: number) {
    setSurah(surahNum)
    setAyah(ayahNum)
    setSearchResults([])
    setSearched(false)
    setData(null)
    Promise.all([
      api(`/quran/tafseer/${surahNum}/${ayahNum}`),
      api(`/quran/surah/${surahNum}?tarjma=${encodeURIComponent(localStorage.getItem('islam360_tarjma') || 'translation_urdu')}`)
    ]).then(([tafseerData, surahData]) => {
      setData({ tafseerData, ayahData: (surahData as any[]).find((v: any) => v.ayah == ayahNum) })
    }).catch(() => {})
  }

  const tafseerLabel = types.find((t: any) => t.key === tfType)?.label || ''
  const searchLabel = tafseerLabel || 'Tafseer'

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Tafseer</h2>

      <div className="bg-[#e8f5e9] p-3 rounded-lg mb-4">
        <div className="flex gap-2.5 flex-wrap items-end">
          <div>
            <label className="text-xs text-[#666] block mb-0.5">Surah</label>
            <input type="number" value={surah} min={1} max={114} onChange={e => setSurah(parseInt(e.target.value) || 1)} className="w-[70px] p-1 border border-[#ccc] rounded" />
          </div>
          <div>
            <label className="text-xs text-[#666] block mb-0.5">Ayah</label>
            <input type="number" value={ayah} min={1} onChange={e => setAyah(parseInt(e.target.value) || 1)} className="w-[70px] p-1 border border-[#ccc] rounded" />
          </div>
          <div>
            <label className="text-xs text-[#666] block mb-0.5">Tafseer</label>
            <select value={tfType} onChange={e => setTfType(e.target.value)} className="p-1 border border-[#ccc] rounded">
              <option value="">Select tafseer</option>
              {types.map((t: any) => <option key={t.key} value={t.key}>{t.label} ({t.count})</option>)}
            </select>
          </div>
          <button onClick={load} disabled={!tfType} className="px-3 py-1 bg-[#1a5c3a] text-white border-none rounded cursor-pointer disabled:opacity-40">Load Ayah</button>
        </div>
      </div>

      <div className="bg-[#fffde7] p-3 rounded-lg mb-4 border border-[#e8d84a]">
        <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Search in {searchLabel}</h3>
        <div className="flex gap-2.5 flex-wrap items-center">
          <input type="text" placeholder={`Type Urdu text to search in ${searchLabel}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyUp={e => e.key === 'Enter' && doSearch()}
            className="flex-1 min-w-0 w-full p-2 border border-[#ccc] rounded text-base" />
          <button onClick={doSearch} disabled={!tfType || !searchQuery.trim() || searching}
            className="px-4 py-2 bg-[#1a5c3a] text-white border-none rounded cursor-pointer disabled:opacity-40 font-bold">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {!tfType && <p className="text-xs text-[#e65100] mt-1">Please select a tafseer type first</p>}
      </div>

      {searching && <div className="loading">Searching...</div>}

      {searched && !searching && (
        <div className="mb-4">
          {searchResults.length > 0 ? (
            <>
              <p className="text-sm text-[#1a5c3a] font-bold mb-2">Found {searchResults.length} results for &quot;{searchQuery}&quot; in {searchLabel}</p>
              {searchResults.map((r, i) => (
                <div key={i} className="result-item" onClick={() => openAyah(r.surah, r.ayah)}>
                  <div className="r-meta">Surah {r.surah}:{(r.surah === 1 || r.surah === 9) ? r.ayah + 1 : r.ayah} | {r.tafseer_label}</div>
                  <div className="r-arabic">{r.arabic}</div>
                  <div className="r-text">{highlightText(r.tafseer, r.searchWords || searchQuery.trim().split(/\s+/))}</div>
                </div>
              ))}
            </>
          ) : (
            <div className="loading">No results found for &quot;{searchQuery}&quot; in {searchLabel}</div>
          )}
        </div>
      )}

      {data && (
        <div className="quran-ayah">
          <h3 className="text-[#1a5c3a] mb-2.5">Surah {surah}:{ayah}</h3>
          {data.ayahData && <div className="arabic">{data.ayahData.arabic}</div>}
          {data.ayahData && <div className="translation urdu">{data.ayahData.tarjma_text || data.ayahData.urdu || data.ayahData.english}</div>}
          {data.tafseerData[tfType] ? (
            <div className="translation urdu" style={{ background: '#fffde7', padding: 8, borderRadius: 6, marginTop: 6, borderLeft: '3px solid #e8b840', whiteSpace: 'pre-wrap' }}>{data.tafseerData[tfType]}</div>
          ) : <div className="loading">No tafseer available.</div>}
        </div>
      )}
    </div>
  )
}

// ============== DUAS ==============
function DuasTab() {
  const [allDuas, setAllDuas] = useState<any[]>([])
  const [source, setSource] = useState('all')

  useEffect(() => { api('/duas/all').then(setAllDuas) }, [])

  const filtered = source === 'all' ? allDuas : allDuas.filter(d => d.source === source)

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Duas & Supplications</h2>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {['all', 'tbl_dua', 'tbl_dua_Urdu', 'tbl_prayer', 'tbl_namaz_e_janaza', 'tbl_roza'].map(s => (
          <button key={s} onClick={() => setSource(s)}
            className={`px-3 py-1 text-sm border-none rounded cursor-pointer ${source === s ? 'bg-[#f5f5f5] text-[#1a5c3a]' : 'bg-[#2a7a4e] text-[#ddd]'}`}>
            {s === 'all' ? 'All' : s === 'tbl_dua' ? 'Duas' : s === 'tbl_dua_Urdu' ? 'More Duas' : s === 'tbl_prayer' ? 'Prayers' : s === 'tbl_namaz_e_janaza' ? 'Janaza' : 'Roza'}
          </button>
        ))}
      </div>
      <p className="text-xs text-[#999] mb-2.5">{filtered.length} supplications</p>
      {filtered.map((d, i) => (
        <div key={i} className="dua-card" onClick={() => openModal(d.title || 'Dua', <DuaDetail dua={d} idx={i} total={filtered.length} list={filtered} />)}>
          <div className="dua-title">{d.title || 'Dua'} <span className="text-[10px] text-[#999]">[{d.source || ''}]</span></div>
          {d.arabic && <div className="dua-arabic">{d.arabic}</div>}
          {d.urdu && <div className="dua-urdu">{d.urdu}</div>}
          {d.english && <div className="dua-english">{d.english}</div>}
          {d.desc && !d.arabic && !d.urdu && <div className="dua-urdu">{d.desc}</div>}
          {d.ref && <div className="dua-ref">{d.ref}</div>}
        </div>
      ))}
    </div>
  )
}

function DuaDetail({ dua, idx, total, list }: { dua: any; idx: number; total: number; list: any[] }) {
  return (
    <div>
      {dua.arabic && <div style={{ fontFamily: "'NooreHuda','AlviNastaleeq',serif", fontSize: 28, textAlign: 'right', direction: 'rtl', color: '#1a3a1a', lineHeight: 2, marginBottom: 15 }}>{dua.arabic}</div>}
      {dua.urdu && <div style={{ fontFamily: "'AlviNastaleeq','JameelNastaleeq',serif", fontSize: 24, textAlign: 'right', direction: 'rtl', color: '#2d2d2d', lineHeight: 2, marginBottom: 10 }}>{dua.urdu}</div>}
      {dua.desc && !dua.arabic && !dua.urdu && <div style={{ fontFamily: "'AlviNastaleeq','JameelNastaleeq',serif", fontSize: 20, textAlign: 'right', direction: 'rtl', color: '#2d2d2d', lineHeight: 2, marginBottom: 10 }}>{dua.desc}</div>}
      {dua.english && <div style={{ fontSize: 16, color: '#444', lineHeight: 1.8, marginBottom: 10 }}>{dua.english}</div>}
      {dua.ref && <div style={{ fontSize: 12, color: '#999', marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>{dua.ref}</div>}
      <div style={{ marginTop: 15, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {idx > 0 && <button onClick={() => { const d = list[idx - 1]; openModal(d.title || 'Dua', <DuaDetail dua={d} idx={idx - 1} total={total} list={list} />) }} className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">&larr; Previous</button>}
        {idx < total - 1 && <button onClick={() => { const d = list[idx + 1]; openModal(d.title || 'Dua', <DuaDetail dua={d} idx={idx + 1} total={total} list={list} />) }} className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">Next &rarr;</button>}
      </div>
    </div>
  )
}

// ============== TOPICS ==============
function TopicsTab() {
  const [view, setView] = useState<'topics' | 'amazing'>('topics')
  const [topics, setTopics] = useState<any[]>([])
  const [amazing, setAmazing] = useState<any[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => { api('/quran/topics').then(setTopics); api('/quran/amazing_topics').then(setAmazing) }, [])

  if (view === 'amazing') {
    const filtered = amazing.filter(t => (t.urdu + ' ' + t.english).toLowerCase().includes(filter.toLowerCase()))
    return (
      <div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setView('topics')} className="bg-[#2a7a4e] text-[#ddd] px-4 py-1.5 text-sm border-none rounded cursor-pointer">Topics (2101)</button>
          <button className="bg-[#f5f5f5] text-[#1a5c3a] px-4 py-1.5 text-sm border-none rounded cursor-pointer font-bold">Amazing (369)</button>
        </div>
        <p className="text-xs text-[#999] mb-2.5">{filtered.length} amazing facts</p>
        {filtered.map((t, i) => (
          <div key={i} className="topic-card" style={{ borderLeftColor: '#e8b840', cursor: 'pointer' }} onClick={() => openModal('Amazing Fact - Surah ' + t.surah + ':' + t.ayah, <AmazingDetail t={t} />)}>
            <div className="topic-ref">Surah {t.surah}:{t.ayah}</div>
            <div className="topic-urdu">{t.urdu}</div>
            {t.english && <div className="topic-eng">{t.english}</div>}
          </div>
        ))}
      </div>
    )
  }

  const filtered = topics.filter(t => (t.urdu + ' ' + t.english + ' ' + t.surah).toLowerCase().includes(filter.toLowerCase()))
  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <button className="bg-[#f5f5f5] text-[#1a5c3a] px-4 py-1.5 text-sm border-none rounded cursor-pointer font-bold">Topics (2101)</button>
        <button onClick={() => setView('amazing')} className="bg-[#2a7a4e] text-[#ddd] px-4 py-1.5 text-sm border-none rounded cursor-pointer">Amazing (369)</button>
      </div>
      <input type="text" placeholder="Search topics..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 mb-2.5 border border-[#ccc] rounded" />
      <p className="text-xs text-[#999] mb-2.5">{filtered.length} topics</p>
      {filtered.map((t, i) => (
        <div key={i} className="topic-card" style={{ cursor: 'pointer' }} onClick={() => openModal('Topic - ' + (t.urdu || t.english || ''), <TopicDetail t={t} />)}>
          <div className="topic-ref">Surah {t.surah}{t.surah_name ? ' (' + t.surah_name + ')' : ''}:{t.start_ayah + 1}-{t.end_ayah + 1} | Para {t.para}</div>
          <div className="topic-urdu">{t.urdu}</div>
          {t.english && <div className="topic-eng">{t.english}</div>}
        </div>
      ))}
    </div>
  )
}

function TopicDetail({ t }: { t: any }) {
  const { showTab } = useSettings()
  const [verses, setVerses] = useState<any[]>([])
  useEffect(() => { api(`/quran/ayahs?surah=${t.surah}&start=${t.start_ayah}&end=${t.end_ayah}`).then(setVerses) }, [t])
  return (
    <div>
      <div className="text-xs text-[#999] mb-2.5">Surah {t.surah}{t.surah_name ? ' (' + t.surah_name + ')' : ''}:{t.start_ayah + 1}-{t.end_ayah + 1} | Para {t.para}</div>
      {t.urdu && <div className="font-urdu text-right text-[22px] leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 10 }}>{t.urdu}</div>}
      {t.english && <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{t.english}</div>}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #ddd' }}>
        {verses.map(v => (
          <div key={v.id} style={{ marginBottom: 14, padding: 10, background: '#fafafa', borderRadius: 6 }}>
            <div className="text-xs text-[#999] mb-1">Ayah {(v.surah === 1 || v.surah === 9) ? v.ayah + 1 : v.ayah}</div>
            <div className="font-arabic text-[24px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl' }}>{v.arabic}</div>
            <div className="font-urdu text-lg text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginTop: 4 }}>{v.urdu}</div>
            {v.english && <div style={{ fontSize: 14, color: '#444', marginTop: 4 }}>{v.english}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AmazingDetail({ t }: { t: any }) {
  const [verses, setVerses] = useState<any[]>([])
  const dbAyah = Math.max(t.ayah - 1, 0)
  useEffect(() => { api(`/quran/ayahs?surah=${t.surah}&start=${dbAyah}&end=${dbAyah}`).then(setVerses) }, [t])
  return (
    <div>
      <div className="text-xs text-[#999] mb-2.5">Surah {t.surah}:{t.ayah}</div>
      {t.urdu && <div className="font-urdu text-right text-[22px] leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 10 }}>{t.urdu}</div>}
      {t.english && <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{t.english}</div>}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #ddd' }}>
        {verses.map(v => (
          <div key={v.id} style={{ marginBottom: 14, padding: 10, background: '#fafafa', borderRadius: 6 }}>
            <div className="text-xs text-[#999] mb-1">Ayah {t.ayah}</div>
            <div className="font-arabic text-[24px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl' }}>{v.arabic}</div>
            <div className="font-urdu text-lg text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginTop: 4 }}>{v.urdu}</div>
            {v.english && <div style={{ fontSize: 14, color: '#444', marginTop: 4 }}>{v.english}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============== FAHMUL ==============
function FahmulTab() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => { api('/quran/fahmul_quran').then(setItems) }, [])

  const filtered = items.filter(item => (item.urdu + ' ' + item.english).toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Fahmul Quran (Understanding Quran)</h2>
      <input type="text" placeholder="Search verses..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 mb-2.5 border border-[#ccc] rounded" />
      <p className="text-xs text-[#999] mb-2.5">{filtered.length} entries</p>
      {filtered.map((item, i) => (
        <div key={i} className="fahmul-card" style={{ cursor: 'pointer' }} onClick={() => openModal('Fahmul Quran #' + item.id, <FahmulDetail item={item} />)}>
          <div className="text-xs text-[#999]">#{item.id} | Count: {item.count}</div>
          <div className="fahmul-ayat">{item.ayat}</div>
          {item.ayat_ahrab && <div style={{ fontSize: 12, color: '#999', textAlign: 'right' }}>{item.ayat_ahrab}</div>}
          <div className="fahmul-text">{item.urdu}</div>
          {item.english && <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{item.english}</div>}
        </div>
      ))}
    </div>
  )
}

function FahmulDetail({ item }: { item: any }) {
  return (
    <div>
      <div className="text-xs text-[#999] mb-2">Entry #{item.id} | Count: {item.count}</div>
      {item.ayat && <div className="font-arabic text-[24px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl', marginBottom: 10 }}>{item.ayat}</div>}
      {item.ayat_ahrab && <div style={{ fontSize: 14, color: '#999', textAlign: 'right', direction: 'rtl', marginBottom: 10 }}>{item.ayat_ahrab}</div>}
      {item.urdu && <div className="font-urdu text-right text-[22px] leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 10 }}>{item.urdu}</div>}
      {item.english && <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{item.english}</div>}
    </div>
  )
}

// ============== MUTRADIF ==============
const PAGE_SIZE = 50

function MutradifTab() {
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('')

  useEffect(() => { api('/quran/mutradif').then(setItems) }, [])

  const filtered = filter ? items.filter(m => (m.heading + ' ' + m.word + ' ' + m.urdu_head + ' ' + m.details + ' ' + m.summary).toLowerCase().includes(filter.toLowerCase())) : items
  const end = Math.min((page + 1) * PAGE_SIZE, filtered.length)
  const pageItems = filtered.slice(0, end)

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Urdu Mutradif (Synonyms)</h2>
      <input type="text" placeholder="Search words..." value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} className="w-full p-2 mb-2.5 border border-[#ccc] rounded" />
      <p className="text-xs text-[#999] mb-2.5">{filtered.length} word groups &mdash; showing {end}</p>
      {pageItems.map((m, i) => (
        <div key={i} className="mutradif-card" style={{ cursor: 'pointer' }} onClick={() => openModal(m.heading || 'Mutradif', <MutradifDetail m={m} />)}>
          <div className="m-heading">{m.heading}</div>
          <div className="m-word">{m.word || m.arabic || ''}</div>
          {m.urdu_head && <div style={{ fontSize: 12, color: '#999', textAlign: 'right' }}>Head word: {m.urdu_head}</div>}
          <div className="m-details">{m.details || m.summary || ''}</div>
          <div className="m-meta">{m.total_ayat ? m.total_ayat + ' verses' : ''} {m.alphabet ? '| ' + m.alphabet : ''}</div>
        </div>
      ))}
      {end < filtered.length && (
        <div style={{ textAlign: 'center', margin: '15px 0' }}>
          <button onClick={() => setPage(p => p + 1)} className="px-6 py-2 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">Show More ({filtered.length - end} remaining)</button>
        </div>
      )}
    </div>
  )
}

function MutradifDetail({ m }: { m: any }) {
  return (
    <div>
      {(m.word || m.arabic) && <div className="font-arabic text-[26px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl', marginBottom: 8 }}>{m.word || m.arabic}</div>}
      {m.heading && <div className="font-urdu text-right text-[22px] text-[#1a5c3a] font-bold" style={{ direction: 'rtl', marginBottom: 8 }}>{m.heading}</div>}
      {m.details && <div className="font-urdu text-right text-xl leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 10 }}>{m.details}</div>}
      {m.summary && <div className="font-urdu text-right text-lg text-[#555]" style={{ direction: 'rtl', marginBottom: 10 }}>{m.summary}</div>}
      {m.urdu_head && <div style={{ fontSize: 13, color: '#999', marginTop: 5 }}>Head word: {m.urdu_head}</div>}
      <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>{m.total_ayat ? m.total_ayat + ' verses' : ''} {m.alphabet ? '| Alphabet: ' + m.alphabet : ''}</div>
    </div>
  )
}

// ============== MORE ==============
function MoreTab() {
  const [content, setContent] = useState<React.ReactNode>(null)

  const features = [
    { id: 'randomHadith', label: 'Random Hadith', icon: '🎲', desc: 'Display a random hadith from the database' },
    { id: 'subjects', label: 'English Subjects', icon: '📚', desc: 'Quran subjects in English' },
    { id: 'subjectsUrdu', label: 'Urdu Subjects', icon: '📖', desc: 'Quran subjects in Urdu' },
    { id: 'childsites', label: 'Other Websites', icon: '📂', desc: 'Websites hosted within this portal' },
  ]

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-4">More Features</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {features.map(f => (
          <div key={f.id} className="list-card" onClick={() => {
            if (f.id === 'randomHadith') loadRandomHadith(setContent)
            else if (f.id === 'subjects') loadSubjects(setContent)
            else if (f.id === 'subjectsUrdu') loadSubjectsUrdu(setContent)
            else if (f.id === 'childsites') loadChildSites(setContent)
          }}>
            <div className="list-name"><span style={{ marginRight: 8 }}>{f.icon}</span>{f.label}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 15 }}>{content}</div>
    </div>
  )
}

function OtherLinksView({ type }: { type?: 'child' | 'external' }) {
  const [links, setLinks] = useState<any[]>([])
  const [childSites, setChildSites] = useState<any[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('islam360_weblinks')
    setLinks(saved ? JSON.parse(saved) : [])
    api('/websites').then(setChildSites).catch(() => {})
  }, [])

  const showChild = !type || type === 'child'
  const showExternal = !type || type === 'external'

  if (showChild && showExternal && childSites.length === 0 && links.length === 0)
    return <div className="loading">No web links added yet. Add them from Admin Panel.</div>

  if (showChild && childSites.length === 0)
    return <div className="loading">No child websites found. Add folders inside the public/ directory.</div>

  return (
    <div>
      {showChild && childSites.length > 0 && (
        <>
          <h3 className="text-[#1a5c3a] mb-2.5">📂 Other Websites</h3>
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            {childSites.map((site, i) => (
              <div key={i} className="list-card" onClick={() => window.location.href = site.url}>
                <div className="list-name">{site.name}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {showExternal && links.length > 0 && (
        <>
          <h3 className="text-[#1a5c3a] mb-2.5">🔗 External Links</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {links.map((link, i) => (
              <div key={i} className="list-card" onClick={() => openModal(link.name, <WebLinkModalBody name={link.name} url={link.url} />)}>
                <div className="list-name">{link.name}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function loadChildSites(setContent: (c: React.ReactNode) => void) {
  setContent(<OtherLinksView type="child" />)
}

function WebLinkModalBody({ name, url }: { name: string; url: string }) {
  return (
    <div>
      <div className="text-right mb-2">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#1a5c3a] underline hover:text-[#2a7a4e] transition-colors">
          Open in New Tab &#8599;
        </a>
      </div>
      <iframe src={url}
        style={{ width: '100%', height: '80vh', border: 'none', borderRadius: 6 }} title={name} />
    </div>
  )
}

function loadRandomHadith(setContent: (c: React.ReactNode) => void) {
  setContent(<div className="loading">Loading random hadith...</div>)
  api('/hadith/random').then(h => {
    setContent(
      <div className="rand-hadees">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Hadith #{h.hadees_number}</span>
          <button onClick={() => loadRandomHadith(setContent)} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Another</button>
        </div>
        <div className="rh-arabic">{h.arabic}</div>
        {h.urdu && <div className="rh-urdu">{h.urdu}</div>}
        {h.english && <div className="rh-english">{h.english}</div>}
        {h.ravi && <div className="rh-ref">Narrator: {h.ravi}</div>}
        <div className="rh-ref">{h.kitab || h.kitab_eng || ''} {h.baab ? '- ' + h.baab : ''}</div>
      </div>
    )
  }).catch(() => setContent(<div className="error">Failed to load hadith.</div>))
}

function loadSubjects(setContent: (c: React.ReactNode) => void) {
  setContent(<div className="loading">Loading subjects...</div>)
  api('/quran/subjects').then(items => {
    setContent(<SubjectsView items={items} />)
  })
}

function SubjectsView({ items }: { items: any[] }) {
  const [filter, setFilter] = useState('')
  const filtered = items.filter((s: any) => (s.word + ' ' + s.reference).toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <h3 className="text-[#1a5c3a] mb-2.5">English Subjects ({items.length})</h3>
      <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 mb-2.5 border border-[#ccc] rounded" />
      <div id="subjList">
        {filtered.map((s: any, i: number) => (
          <div key={i} className="list-card" style={{ cursor: 'pointer' }} onClick={() => openModal('Subject: ' + s.word, <SubjectDetail s={s} />)}>
            <div className="list-name" style={{ fontSize: 14 }}>{s.word}</div>
            <div style={{ fontSize: 11, color: '#999' }}>Surah {s.surah}:{s.ayah} | {s.reference || ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubjectDetail({ s }: { s: any }) {
  const [verses, setVerses] = useState<any[]>([])
  const dbAyah = Math.max((s.ayah as any) - 1, 0)
  useEffect(() => { api(`/quran/ayahs?surah=${s.surah}&start=${dbAyah}&end=${dbAyah}`).then(setVerses) }, [s])
  return (
    <div>
      <div className="text-xs text-[#999] mb-2.5">Surah {s.surah}:{s.ayah} | {s.reference || ''}</div>
      <div id="subjVerses">
        {verses.map(v => (
          <div key={v.id} style={{ padding: 10, background: '#fafafa', borderRadius: 6, marginBottom: 10 }}>
            <div className="text-xs text-[#999] mb-1">Ayah {s.ayah}</div>
            <div className="font-arabic text-[24px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl' }}>{v.arabic}</div>
            <div className="font-urdu text-lg text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginTop: 4 }}>{v.urdu}</div>
            {v.english && <div style={{ fontSize: 14, color: '#444', marginTop: 4 }}>{v.english}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function loadSubjectsUrdu(setContent: (c: React.ReactNode) => void) {
  setContent(<div className="loading">Loading subjects...</div>)
  api('/quran/subjects/urdu').then(items => {
    setContent(<SubjectsUrduView items={items} />)
  })
}

function SubjectsUrduView({ items }: { items: any[] }) {
  const [filter, setFilter] = useState('')
  const filtered = items.filter((s: any) => (s.topic + ' ' + s.surah_name).toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <h3 className="text-[#1a5c3a] mb-2.5">Urdu Subjects ({items.length})</h3>
      <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 mb-2.5 border border-[#ccc] rounded" />
      <div id="subjUrduList">
        {filtered.map((s: any, i: number) => (
          <div key={i} className="list-card" style={{ cursor: 'pointer' }} onClick={() => openModal(s.topic, <SubjectUrduDetail s={s} />)}>
            <div className="list-name" style={{ fontFamily: "'AlviNastaleeq','JameelNastaleeq',serif", fontSize: 18, textAlign: 'right', direction: 'rtl' }}>{s.topic}</div>
            <div style={{ fontSize: 11, color: '#999' }}>Surah {s.surah}:{s.ayah} | {s.surah_name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubjectUrduDetail({ s }: { s: any }) {
  const [verses, setVerses] = useState<any[]>([])
  const dbAyah = Math.max((s.ayah as any) - 1, 0)
  useEffect(() => { api(`/quran/ayahs?surah=${s.surah}&start=${dbAyah}&end=${dbAyah}`).then(setVerses) }, [s])
  return (
    <div>
      <div className="text-xs text-[#999] mb-2.5">Surah {s.surah}:{s.ayah} | {s.surah_name}</div>
      <div className="font-urdu text-right text-[22px] leading-relaxed text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 10 }}>{s.topic}</div>
      <div id="subjUrduVerses">
        {verses.map(v => (
          <div key={v.id} style={{ padding: 10, background: '#fafafa', borderRadius: 6, marginBottom: 10 }}>
            <div className="text-xs text-[#999] mb-1">Ayah {s.ayah}</div>
            <div className="font-arabic text-[24px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl' }}>{v.arabic}</div>
            <div className="font-urdu text-lg text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginTop: 4 }}>{v.urdu}</div>
            {v.english && <div style={{ fontSize: 14, color: '#444', marginTop: 4 }}>{v.english}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============== SEARCH ==============
function SearchTab() {
  const [type, setType] = useState<'quran' | 'hadith'>('quran')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [hadithBook, setHadithBook] = useState('bukhari')
  const [searched, setSearched] = useState(false)

  useEffect(() => { api('/hadith/books').then(setBooks) }, [])

  function doSearch() {
    if (!query.trim()) return
    setSearched(true)
    if (type === 'quran') {
      api(`/quran/search?q=${encodeURIComponent(query)}`).then(setResults)
    } else {
      api(`/hadith/search/${hadithBook}?q=${encodeURIComponent(query)}`).then(setResults)
    }
  }

  return (
    <div>
      <h2 className="text-[#1a5c3a] mb-2.5">Search</h2>
      <div style={{ marginBottom: 10, fontSize: 12, color: '#666' }}>
        <b>Quran:</b> Type text or ayat reference (e.g. 2:255)<br />
        <b>Hadith:</b> Type text or hadith number
      </div>
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <select value={type} onChange={e => setType(e.target.value as any)} className="p-1.5 border border-[#ccc] rounded">
          <option value="quran">Quran</option>
          <option value="hadith">Hadith</option>
        </select>
        {type === 'hadith' && (
          <select value={hadithBook} onChange={e => setHadithBook(e.target.value)} className="p-1.5 border border-[#ccc] rounded">
            {books.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="text" placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)}
          onKeyUp={e => e.key === 'Enter' && doSearch()}
          className="flex-1 min-w-0 w-full p-1.5 border border-[#ccc] rounded" />
        <button onClick={doSearch} className="px-4 py-1.5 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">Search</button>
      </div>
      {searched && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Found {results.length} results</h3>
          {results.map((r: any, i: number) => (
            <div key={i} className="result-item" onClick={() => {
              if (type === 'quran') openSearchAyah(r)
              else openHadith(r, hadithBook)
            }}>
              <div className="r-meta">{type === 'quran' ? `Surah ${r.surah}:${(r.surah === 1 || r.surah === 9) ? r.ayah + 1 : r.ayah}` : `Hadith #${r.number}`}</div>
              <div className="r-arabic">{r.arabic}</div>
              <div className="r-text">{type === 'quran' ? (r.urdu || r.english) : highlightText(r.urdu || r.english || '', r.searchWords || query.trim().split(/\s+/))}</div>
            </div>
          ))}
          {results.length === 0 && <div className="loading">No results found.</div>}
        </div>
      )}
    </div>
  )
}

function openSearchAyah(r: any) {
  const displayAyah = (r.surah === 1 || r.surah === 9) ? r.ayah + 1 : (r.ayah > 0 ? r.ayah : 'Basmalah')
  api(`/quran/ayahs?surah=${r.surah}&start=${r.ayah}&end=${r.ayah}`).then((verses: any[]) => {
    openModal('', <div>
      <div style={{ marginBottom: 10 }}>
        <button onClick={closeModal} className="px-3 py-1 bg-[#ddd] border-none rounded cursor-pointer">&larr; Back to results</button>
      </div>
      {verses.map((v: any) => (
        <div key={v.id} style={{ padding: 14, background: '#fafafa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Surah {r.surah}:{displayAyah}</div>
          <div className="font-arabic text-[26px] text-right text-[#1a3a1a] leading-[2]" style={{ direction: 'rtl', marginBottom: 10 }}>{v.arabic}</div>
          <div className="font-urdu text-xl text-right text-[#2d2d2d]" style={{ direction: 'rtl', marginBottom: 6 }}>{v.urdu}</div>
          {v.english && <div style={{ fontSize: 15, color: '#444', lineHeight: 1.6 }}>{v.english}</div>}
        </div>
      ))}
    </div>)
  })
}

function openHadith(r: any, bookId: string) {
  api(`/hadith/hadith/${bookId}/${r.number}`).then((h: any) => {
    openModal('', <div>
      <div style={{ marginBottom: 10 }}><button onClick={closeModal} className="px-3 py-1 bg-[#1a5c3a] text-white border-none rounded cursor-pointer">&larr; Back to list</button></div>
      <div className="hadith-card" style={{ border: '3px solid #e8b840' }}>
        <div className="hadith-number">Hadith #{h.number} (International: {h.international_number})</div>
        <div className="arabic">{h.arabic}</div>
        {h.urdu && <div className="text urdu">{h.urdu}</div>}
        {h.urdu_ravi && <div className="narrator">{h.urdu_ravi}</div>}
        {h.english && <div className="text english">{h.english}</div>}
        {h.english_ravi && <div className="narrator">{h.english_ravi}</div>}
      </div>
    </div>)
  })
}

// ============== ABOUT ==============
function AboutTab() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      {/* Dedication */}
      <div className="text-center mb-6 px-4 py-3 bg-gradient-to-r from-[#fff5f5] via-white to-[#fff5f5] rounded-xl border border-[#ffcdd2] relative overflow-hidden">
        <span className="absolute text-lg animate-floatHeart" style={{ left: '10%', animationDelay: '0s' }}>❤️</span>
        <span className="absolute text-lg animate-floatHeart" style={{ left: '30%', animationDelay: '1s' }}>❤️</span>
        <span className="absolute text-lg animate-floatHeart" style={{ left: '50%', animationDelay: '0.5s' }}>❤️</span>
        <span className="absolute text-lg animate-floatHeart" style={{ left: '70%', animationDelay: '1.5s' }}>❤️</span>
        <span className="absolute text-lg animate-floatHeart" style={{ left: '90%', animationDelay: '2s' }}>❤️</span>
        <p className="text-sm sm:text-base text-[#c62828] font-medium leading-relaxed relative z-10">
          Dedicated to Prophet Muhammad (PBUH) — mercy to the universe and guide of humanity
        </p>
      </div>

      {/* Header */}
      <div className="text-center mb-8 animate-slideDown">
        <div className="w-24 h-24 bg-gradient-to-br from-[#1a5c3a] to-[#3a9a5e] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounceSlow">
          <span className="text-white text-4xl font-bold">AR</span>
        </div>
        <h1 className="text-3xl font-bold text-[#1a5c3a]">Ali Raza</h1>
        <p className="text-[#666] text-lg mt-1">Full Stack Developer</p>
      </div>

      {/* Contact + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-[#e0e0e0] flex items-center gap-3 animate-slideRight" style={{animationDelay: '0.1s', animationFillMode: 'both'}}>
          <span className="text-2xl">📍</span>
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide">Location</div>
            <div className="font-semibold">Okara, Punjab, Pakistan</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#e0e0e0] flex items-center gap-3 animate-slideRight" style={{animationDelay: '0.2s', animationFillMode: 'both'}}>
          <span className="text-2xl">📱</span>
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide">WhatsApp</div>
            <a href="https://wa.me/923216957139" className="font-semibold text-[#1a5c3a] underline hover:text-[#2a7a4e] transition-colors" target="_blank" rel="noopener noreferrer">0321-6957139</a>
          </div>
        </div>
      </div>

      {/* What I Build */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e0e0] mb-6 animate-fadeIn" style={{animationDelay: '0.3s', animationFillMode: 'both'}}>
        <h3 className="text-lg font-bold text-[#1a5c3a] mb-3">🚀 What I Build</h3>
        <div className="flex flex-wrap gap-2">
          {['Modern Web Applications', 'Android Applications', 'Desktop Software', 'End-to-End Full Stack Solutions', 'Custom Business Software'].map(s => (
            <span key={s} className="bg-gradient-to-r from-[#e8f5e9] to-[#f1f8e9] text-[#1a5c3a] px-3 py-1.5 rounded-full text-sm font-medium border border-[#a5d6a7]">{s}</span>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e0e0] mb-6 animate-fadeIn" style={{animationDelay: '0.4s', animationFillMode: 'both'}}>
        <h3 className="text-lg font-bold text-[#1a5c3a] mb-4">🛠️ Tech Stack</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide font-bold mb-2">Frontend</div>
            <div className="flex flex-wrap gap-1.5">
              {['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'PostCSS', 'Autoprefixer', 'Turbopack', 'ESLint'].map(s => (
                <span key={s} className="bg-[#e3f2fd] text-[#1565c0] px-2.5 py-1 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide font-bold mb-2">Backend</div>
            <div className="flex flex-wrap gap-1.5">
              {['Node.js', 'SQLite (sql.js)', 'Next.js API Routes', 'REST API'].map(s => (
                <span key={s} className="bg-[#fff3e0] text-[#e65100] px-2.5 py-1 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide font-bold mb-2">Languages</div>
            <div className="flex flex-wrap gap-1.5">
              {['TypeScript', 'JavaScript', 'SQL', 'HTML5', 'CSS3'].map(s => (
                <span key={s} className="bg-[#e8f5e9] text-[#2e7d32] px-2.5 py-1 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#999] uppercase tracking-wide font-bold mb-2">Mobile</div>
            <div className="flex flex-wrap gap-1.5">
              {['Android', 'Java', 'Kotlin'].map(s => (
                <span key={s} className="bg-[#f3e5f5] text-[#7b1fa2] px-2.5 py-1 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-gradient-to-r from-[#1a5c3a] to-[#2a7a4e] rounded-xl p-6 text-white mb-6 animate-fadeIn" style={{animationDelay: '0.5s', animationFillMode: 'both'}}>
        <h3 className="text-lg font-bold mb-3">💡 Services</h3>
        <p className="text-sm leading-relaxed text-[#e0f2e0]">
          I design and develop fast, scalable, and user-friendly software tailored to your business needs.
          From responsive websites and powerful web applications to Android apps and desktop solutions,
          I deliver reliable, high-quality products with a focus on performance and maintainability.
        </p>
      </div>

      {/* Freelance CTA */}
      <div className="bg-white rounded-xl p-6 border border-[#e0e0e0] text-center animate-fadeIn" style={{animationDelay: '0.6s', animationFillMode: 'both'}}>
        <h3 className="text-lg font-bold text-[#1a5c3a] mb-2">🤝 Available for Freelance Work</h3>
        <p className="text-sm text-[#666] mb-3">Open to freelance projects, long-term collaborations, and custom software development.</p>
        <p className="text-sm text-[#1a5c3a] font-semibold mb-2">Let&apos;s turn your ideas into powerful digital solutions.</p>
        <a href="https://wa.me/923216957139" target="_blank" rel="noopener noreferrer"
          className="inline-block px-6 py-2.5 bg-[#1a5c3a] text-white rounded-lg font-semibold hover:bg-[#2a7a4e] transition-colors">
          📲 Contact via WhatsApp
        </a>
      </div>

      {/* Admin Login */}
      <div className="text-center mt-8 mb-4">
        <button onClick={() => setLoginOpen(true)}
          className="text-xs text-[#bbb] hover:text-[#1a5c3a] transition-colors cursor-pointer bg-transparent border-none">
          Admin
        </button>
      </div>

      {/* Login Modal */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSuccess={() => { setLoginOpen(false); setAdminOpen(true) }} />}

      {/* Admin Panel Modal */}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  )
}

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleLogin() {
    if (email === 'REDACTED_EMAIL' && password === 'REDACTED_CREDENTIAL') {
      setError('')
      onSuccess()
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[10%]">
      <div className="bg-white p-6 rounded-xl w-[90%] max-w-[380px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#1a5c3a]">Admin Login</h3>
          <button onClick={onClose} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
        </div>
        <div className="mb-3">
          <label className="text-xs text-[#666] block mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full p-2 border border-[#ccc] rounded text-sm" />
        </div>
        <div className="mb-3">
          <label className="text-xs text-[#666] block mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full p-2 border border-[#ccc] rounded text-sm" />
        </div>
        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
        <button onClick={handleLogin}
          className="w-full py-2 bg-[#1a5c3a] text-white border-none rounded font-bold cursor-pointer hover:bg-[#2a7a4e]">Login</button>
      </div>
    </div>
  )
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [filename, setFilename] = useState('')
  const [columnName, setColumnName] = useState('tafseer_tibyan')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const [tFilename, setTFilename] = useState('')
  const [tColumnName, setTColumnName] = useState('translation_urdu')
  const [tImporting, setTImporting] = useState(false)
  const [tResult, setTResult] = useState<string | null>(null)

  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkMsg, setLinkMsg] = useState<string | null>(null)
  const [savedLinks, setSavedLinks] = useState<any[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('islam360_weblinks')
    setSavedLinks(saved ? JSON.parse(saved) : [])
  }, [])

  function addLink() {
    if (!linkName.trim() || !linkUrl.trim()) return
    const updated = [...savedLinks, { name: linkName.trim(), url: linkUrl.trim() }]
    localStorage.setItem('islam360_weblinks', JSON.stringify(updated))
    setSavedLinks(updated)
    setLinkName(''); setLinkUrl('')
    setLinkMsg('Link added!')
    setTimeout(() => setLinkMsg(null), 2000)
  }

  function removeLink(i: number) {
    const updated = savedLinks.filter((_, idx) => idx !== i)
    localStorage.setItem('islam360_weblinks', JSON.stringify(updated))
    setSavedLinks(updated)
  }

  async function handleImportTafseer() {
    if (!filename.trim() || !columnName.trim()) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/admin/import-tafseer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename.trim(), columnName: columnName.trim() })
      })
      const data = await res.json()
      if (data.error) setResult('Error: ' + data.error)
      else setResult(`Success! Updated ${data.updated} of ${data.total} rows in column "${columnName}".`)
    } catch (e: any) {
      setResult('Error: ' + e.message)
    }
    setImporting(false)
  }

  async function handleImportTarjma() {
    if (!tFilename.trim() || !tColumnName.trim()) return
    setTImporting(true); setTResult(null)
    try {
      const res = await fetch('/api/admin/import-tarjma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: tFilename.trim(), columnName: tColumnName.trim() })
      })
      const data = await res.json()
      if (data.error) setTResult('Error: ' + data.error)
      else setTResult(`Success! Updated ${data.updated} of ${data.total} rows in column "${tColumnName}".`)
    } catch (e: any) {
      setTResult('Error: ' + e.message)
    }
    setTImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[5%]">
      <div className="bg-white p-6 rounded-xl w-[90%] max-w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#1a5c3a]">&#128272; Admin Panel</h3>
          <button onClick={onClose} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
        </div>
        <p className="text-sm text-[#666] mb-4">Welcome, Ali Raza.</p>

        {/* Import sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0]">
            <h4 className="font-bold text-[#1a5c3a] mb-2">&#128229; Import Tafseer</h4>
            <p className="text-xs text-[#999] mb-2">DB needs <b>SurahNumber, AyahNumber, Tafseer</b>.</p>
            <div className="mb-2">
              <label className="text-xs text-[#666] block mb-0.5">Filename</label>
              <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                placeholder="tafseer.db" className="w-full p-2 border border-[#ccc] rounded text-sm" />
            </div>
            <div className="mb-3">
              <label className="text-xs text-[#666] block mb-0.5">Target Column</label>
              <input type="text" value={columnName} onChange={e => setColumnName(e.target.value)}
                placeholder="tafseer_tibyan" className="w-full p-2 border border-[#ccc] rounded text-sm" />
            </div>
            <button onClick={handleImportTafseer} disabled={importing || !filename.trim() || !columnName.trim()}
              className="px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40 w-full">
              {importing ? 'Importing...' : 'Import Tafseer'}
            </button>
            {result && <div className={`mt-2 text-xs p-2 rounded ${result.startsWith('Success') ? 'bg-[#e8f5e9] text-[#1a5c3a]' : 'bg-[#ffebee] text-red-700'}`}>{result}</div>}
          </div>

          <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0]">
            <h4 className="font-bold text-[#1a5c3a] mb-2">&#128221; Import Tarjma</h4>
            <p className="text-xs text-[#999] mb-2">DB needs <b>SurahNumber, AyahNumber, Translation</b>.</p>
            <div className="mb-2">
              <label className="text-xs text-[#666] block mb-0.5">Filename</label>
              <input type="text" value={tFilename} onChange={e => setTFilename(e.target.value)}
                placeholder="tarjama.db" className="w-full p-2 border border-[#ccc] rounded text-sm" />
            </div>
            <div className="mb-3">
              <label className="text-xs text-[#666] block mb-0.5">Target Column</label>
              <input type="text" value={tColumnName} onChange={e => setTColumnName(e.target.value)}
                placeholder="translation_urdu" className="w-full p-2 border border-[#ccc] rounded text-sm" />
            </div>
            <button onClick={handleImportTarjma} disabled={tImporting || !tFilename.trim() || !tColumnName.trim()}
              className="px-4 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40 w-full">
              {tImporting ? 'Importing...' : 'Import Tarjma'}
            </button>
            {tResult && <div className={`mt-2 text-xs p-2 rounded ${tResult.startsWith('Success') ? 'bg-[#e8f5e9] text-[#1a5c3a]' : 'bg-[#ffebee] text-red-700'}`}>{tResult}</div>}
          </div>
        </div>

        {/* Website Links */}
        <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0] mb-4">
          <h4 className="font-bold text-[#1a5c3a] mb-2">&#128279; Manage Web Links</h4>
          <p className="text-xs text-[#999] mb-2">Add external website URLs. They appear under <b>More &rarr; Other Web Links</b> and open inline.</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <input type="text" value={linkName} onChange={e => setLinkName(e.target.value)}
              placeholder="Site name" className="flex-1 min-w-[100px] p-2 border border-[#ccc] rounded text-sm" />
            <input type="text" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..." className="flex-[2] min-w-[150px] p-2 border border-[#ccc] rounded text-sm" />
            <button onClick={addLink} disabled={!linkName.trim() || !linkUrl.trim()}
              className="px-3 py-2 bg-[#1a5c3a] text-white border-none rounded text-sm cursor-pointer hover:bg-[#2a7a4e] disabled:opacity-40">Add</button>
          </div>
          {linkMsg && <div className="text-xs text-[#1a5c3a] mb-2">{linkMsg}</div>}
          {savedLinks.length > 0 && (
            <div>
              <div className="text-xs text-[#666] mb-1">Saved links ({savedLinks.length}):</div>
              {savedLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 p-1.5 bg-white rounded border border-[#e0e0e0]">
                  <span className="text-xs font-medium flex-1 truncate">{link.name}</span>
                  <span className="text-[10px] text-[#999] truncate max-w-[200px]">{link.url}</span>
                  <button onClick={() => removeLink(i)} className="text-xs text-red-500 bg-transparent border-none cursor-pointer hover:text-red-700">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-[#fffde7] rounded-lg border border-[#e8d84a]">
          <h4 className="font-bold text-[#1a5c3a] mb-1">&#128161; Note</h4>
          <p className="text-xs text-[#666]">After DB import, add the new column to <code className="bg-[#e8f5e9] px-1 rounded">TRANSLATION_COLUMNS</code> or <code className="bg-[#e8f5e9] px-1 rounded">TAFSEER_COLUMNS</code> in <code className="bg-[#e8f5e9] px-1 rounded">src/lib/constants.ts</code> and restart the server.</p>
        </div>
      </div>
    </div>
  )
}

// Fix unused imports warning
const _unused = { arabicEl, urduEl }
