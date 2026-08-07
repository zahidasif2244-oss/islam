'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { arabicSnippet } from '@/lib/arabic'

type Tab = 'quran' | 'hadith' | 'wordbyword' | 'tafseer' | 'duas' | 'topics' | 'fahmul' | 'mutradif' | 'more' | 'search' | 'about' | 'books'

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

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/api${path}`, init)
  if (!res.ok) throw new Error('API error')
  return res.json()
}

const SettingsCtx = createContext<any>(null)
function useSettings() { return useContext(SettingsCtx) }

const BookmarkCtx = createContext<any>(null)
function useBookmarks() { return useContext(BookmarkCtx) }

function BookmarkIcon({ saved = false, size = 15 }: { saved?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function bmItem(h: any, bookId: string, bookName: string) {
  return {
    bookId,
    bookName,
    number: h.number,
    international_number: h.international_number || '',
    arabic: h.arabic || '',
    urdu: h.urdu || '',
    urdu_ravi: h.urdu_ravi || '',
    english: h.english || '',
    english_ravi: h.english_ravi || '',
  }
}

function BookmarkBtn({ item, showText = false, className = '' }: { item: any; showText?: boolean; className?: string }) {
  const { keyFor, isBookmarked, toggleBookmark } = useBookmarks()
  const saved = isBookmarked(item.bookId, item.number)
  return (
    <button
      onClick={e => { e.stopPropagation(); toggleBookmark(item) }}
      title={saved ? 'Remove bookmark' : 'Save bookmark'}
      className={`inline-flex items-center gap-1 rounded border-none cursor-pointer shrink-0 ${saved ? 'text-[#b8860b] bg-[#fff8e1]' : 'text-[#999] bg-[#f0f0f0] hover:text-[#1a5c3a] hover:bg-[#e8f5e9]'} ${showText ? 'px-2.5 py-1 text-xs font-bold' : 'w-7 h-7 justify-center'} ${className}`}
    >
      <BookmarkIcon saved={saved} />
      {showText && (saved ? 'Bookmarked' : 'Save bookmark')}
    </button>
  )
}

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
  const [bookmarks, setBookmarks] = useState<any[]>([])

  useEffect(() => {
    try { setBookmarks(JSON.parse(localStorage.getItem('islam360_hadith_bookmarks') || '[]')) } catch { }
  }, [])

  useEffect(() => {
    const onCtx = (e: MouseEvent) => { e.preventDefault() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F12') { e.preventDefault(); return }
      if ((e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) ||
          (e.ctrlKey && ['U', 'S'].includes(e.key.toUpperCase()))) {
        e.preventDefault()
      }
    }
    document.addEventListener('contextmenu', onCtx)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('contextmenu', onCtx)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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

  const keyFor = useCallback((bookId: string, number: any) => `${bookId}:${number}`, [])
  const isBookmarked = useCallback((bookId: string, number: any) => bookmarks.some((b: any) => keyFor(b.bookId, b.number) === keyFor(bookId, number)), [bookmarks, keyFor])
  const toggleBookmark = useCallback((item: any) => {
    setBookmarks(prev => {
      const key = keyFor(item.bookId, item.number)
      const exists = prev.some((b: any) => keyFor(b.bookId, b.number) === key)
      const next = exists ? prev.filter((b: any) => keyFor(b.bookId, b.number) !== key) : [item, ...prev]
      localStorage.setItem('islam360_hadith_bookmarks', JSON.stringify(next))
      return next
    })
  }, [keyFor])
  const bookmarkCtxVal = { bookmarks, keyFor, isBookmarked, toggleBookmark }

  return (
    <BookmarkCtx.Provider value={bookmarkCtxVal}>
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
          {(['quran', 'hadith', 'wordbyword', 'tafseer', 'duas', 'topics', 'fahmul', 'mutradif', 'more', 'about', 'books'] as Tab[]).map(t => (
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
          {tab === 'books' && <BooksTab />}
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
    </BookmarkCtx.Provider>
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
type QuranView = 'surahs' | 'parahs' | 'browse' | 'search' | 'surah-bms' | 'ayat-bms'

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

  const [surahBms, setSurahBms] = useState<number[]>([])
  const [ayahBms, setAyahBms] = useState<any[]>([])

  useEffect(() => {
    try { setSurahBms(JSON.parse(localStorage.getItem('islam360_bookmarks') || '[]')) } catch { }
    try { setAyahBms(JSON.parse(localStorage.getItem('islam360_ayat_bookmarks') || '[]')) } catch { }
  }, [])

  function toggleBm(id: number) {
    setSurahBms(prev => {
      const idx = prev.indexOf(id)
      const next = idx > -1 ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('islam360_bookmarks', JSON.stringify(next))
      return next
    })
  }

  const bmKey = (surah: number, ayah: number) => `${surah}:${ayah}`
  const isAyahBm = (surah: number, ayah: number) => ayahBms.some((b: any) => bmKey(b.surah, b.ayah) === bmKey(surah, ayah))

  function toggleAyahBm(v: any) {
    setAyahBms(prev => {
      const key = bmKey(v.surah, v.ayah)
      const exists = prev.some((b: any) => bmKey(b.surah, b.ayah) === key)
      const next = exists ? prev.filter((b: any) => bmKey(b.surah, b.ayah) !== key) : [...prev, {
        id: v.id, surah: v.surah, ayah: v.ayah, para: v.para,
        arabic: v.arabic || '', urdu: v.tarjma_text || v.urdu || v.english || '',
      }]
      localStorage.setItem('islam360_ayat_bookmarks', JSON.stringify(next))
      return next
    })
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
          <div className="text-xs opacity-90 flex items-center gap-2">
            <span>{verses.length} verses</span>
            <span className="text-base cursor-pointer" onClick={() => toggleBm(browseId)} title={surahBms.includes(browseId) ? 'Remove surah bookmark' : 'Bookmark this surah'}>
              {surahBms.includes(browseId) ? '⭐' : '☆'}
            </span>
          </div>
        </div>
        <div id="quranVerses">
          {verses.map(v => (
            <div key={v.id} className="quran-ayah" id={`ayah-${v.ayah}`}>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <div className="meta mr-auto">Surah {v.surah}:{(v.surah === 1 || v.surah === 9) ? v.ayah + 1 : (v.ayah > 0 ? v.ayah : 'Basmalah')} | Para {v.para}</div>
                <button className="bg-[#e8f5e9] border border-[#a5d6a7] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#c8e6c9]" onClick={() => wordModal(v.surah, v.ayah)} title="Word by Word">Words</button>
                <button className="bg-[#fff3e0] border border-[#e8b840] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#ffe0b2]" onClick={() => showAyahTafseer(v.surah, v.ayah)} title="Tafseer">Tafseer</button>
                {(v.surah === 1 || v.surah === 9 || v.ayah > 0) && <button className="bg-[#e3f2fd] border border-[#90caf9] rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-[#bbdefb]" onClick={() => playAyah(v.surah, v.ayah)} title="Play Audio">&#9654;</button>}
                <button
                  onClick={() => toggleAyahBm(v)}
                  title={isAyahBm(v.surah, v.ayah) ? 'Remove ayah bookmark' : 'Bookmark this ayah'}
                  className={`rounded px-2 py-0.5 text-xs cursor-pointer border ${isAyahBm(v.surah, v.ayah) ? 'bg-[#fff8e1] border-[#e8b840] text-[#b8860b]' : 'bg-[#f5f5f5] border-[#e0e0e0] text-[#888] hover:bg-[#fff8e1] hover:text-[#b8860b]'}`}>
                  <BookmarkIcon saved={isAyahBm(v.surah, v.ayah)} size={13} />
                </button>
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
        {(['surahs', 'parahs', 'search', 'surah-bms', 'ayat-bms'] as QuranView[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm border-none rounded cursor-pointer capitalize
              ${view === v ? 'bg-[#f5f5f5] text-[#1a5c3a]' : 'bg-[#2a7a4e] text-[#ddd]'}`}
          >{v === 'surah-bms' ? '⭐ Surah Bookmark' : v === 'ayat-bms' ? '🔖 Ayah Bookmark' : v === 'search' ? '🔍 Search' : v}</button>
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
                {surahBms.includes(s.id) ? '⭐' : '☆'}
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
      {view === 'surah-bms' && (
        <div className="grid gap-1">
          <h3 className="text-[#1a5c3a] text-sm font-bold mb-1">Surah Bookmarks</h3>
          {surahBms.length === 0 && <div className="loading">No saved surah bookmarks yet. ⭐ a surah to add it here.</div>}
          {surahBms.map(id => {
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
      {view === 'ayat-bms' && (
        <div className="grid gap-1">
          <h3 className="text-[#1a5c3a] text-sm font-bold mb-1">Ayah Bookmarks</h3>
          {ayahBms.length === 0 && <div className="loading">No saved ayah bookmarks yet. Open a surah and tap the bookmark icon on any ayah to save it here.</div>}
          {ayahBms.map((b: any, i: number) => (
            <div key={i} className="list-card flex items-center" style={{ cursor: 'pointer' }} onClick={() => loadVerses(b.surah, b.ayah)}>
              <div className="flex-1">
                <div className="r-meta">Surah {b.surah}:{(b.surah === 1 || b.surah === 9) ? b.ayah + 1 : (b.ayah > 0 ? b.ayah : 'Basmalah')}</div>
                <div className="font-arabic text-lg sm:text-[22px] text-[#1a3a1a] leading-[1.8]" style={{ direction: 'rtl' }}>{b.arabic}</div>
                {b.urdu && <div className="font-urdu text-base sm:text-lg text-[#2d2d2d] leading-[1.8]" style={{ direction: 'rtl' }}>{b.urdu}</div>}
              </div>
              <span className="cursor-pointer px-2 sm:px-2.5 shrink-0" style={{ color: '#b8860b' }} onClick={e => { e.stopPropagation(); toggleAyahBm(b) }} title="Remove ayah bookmark">
                <BookmarkIcon saved size={18} />
              </span>
            </div>
          ))}
        </div>
      )}
      {view === 'search' && <QuranSearch />}
    </div>
  )
}

function QuranSearch() {
  const [refQuery, setRefQuery] = useState('')
  const [refResult, setRefResult] = useState<any[]>([])
  const [refSearching, setRefSearching] = useState(false)
  const [urduQuery, setUrduQuery] = useState('')
  const [urduResults, setUrduResults] = useState<any[]>([])
  const [urduSearching, setUrduSearching] = useState(false)
  const [arabicQuery, setArabicQuery] = useState('')
  const [arabicResults, setArabicResults] = useState<any[]>([])
  const [arabicSearching, setArabicSearching] = useState(false)

  useEffect(() => {
    const q = refQuery.trim()
    const match = q.match(/^(\d{1,3}):(\d{1,3})$/)
    if (!match) { setRefResult([]); setRefSearching(false); return }
    setRefSearching(true)
    const t = setTimeout(() => {
      api(`/quran/ayahs?surah=${match[1]}&start=${match[2]}`)
        .then(r => { setRefResult(r || []); setRefSearching(false) })
        .catch(() => { setRefResult([]); setRefSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [refQuery])

  useEffect(() => {
    const q = urduQuery.trim()
    if (!q) { setUrduResults([]); setUrduSearching(false); return }
    setUrduSearching(true)
    const t = setTimeout(() => {
      api(`/quran/search_text?q=${encodeURIComponent(q)}&lang=urdu`)
        .then(r => { setUrduResults(r || []); setUrduSearching(false) })
        .catch(() => { setUrduResults([]); setUrduSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [urduQuery])

  useEffect(() => {
    const q = arabicQuery.trim()
    if (!q) { setArabicResults([]); setArabicSearching(false); return }
    setArabicSearching(true)
    const t = setTimeout(() => {
      api(`/quran/search_text?q=${encodeURIComponent(q)}&lang=arabic`)
        .then(r => { setArabicResults(r || []); setArabicSearching(false) })
        .catch(() => { setArabicResults([]); setArabicSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [arabicQuery])

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

  const matchBadge = (r: any) => r.match_count && r.total_words > 1 && (
    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.match_count >= r.total_words ? 'bg-[#c8e6c9] text-[#1a5c3a]' : r.phrase_match ? 'bg-[#ffe0b2] text-[#e65100]' : 'bg-[#eceff1] text-[#546e7a]'}`}>
      {r.match_count}/{r.total_words} words{r.phrase_match ? ' · phrase' : ''}
    </span>
  )

  const ayahLabel = (r: any) => `Surah ${r.surah}:${(r.surah === 1 || r.surah === 9) ? r.ayah + 1 : (r.ayah > 0 ? r.ayah : 'Basmalah')}`

  return (
    <div>
      <div className="bg-[#e8f5e9] p-3 rounded-lg mb-4">
        <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Search by Surah:Ayah Number</h3>
        <input type="text" inputMode="numeric" placeholder="Type reference, e.g. 2:255" value={refQuery} onChange={e => setRefQuery(e.target.value)}
          className="w-full p-2 border border-[#ccc] rounded text-base" />
        <p className="text-[10px] text-[#558b2f] mt-1">Real-time — use format Surah:Ayah, e.g. 2:255.</p>
        {refSearching && <div className="loading">Loading ayah...</div>}
        {!refSearching && refQuery.trim() && refQuery.trim().includes(':') && (
          <div className="mt-2">
            {refResult.length > 0 ? refResult.map((r, i) => (
              <div key={i} className="result-item" onClick={() => openAyah(r)}>
                <div className="r-meta">{ayahLabel(r)}</div>
                <div className="r-arabic">{r.arabic}</div>
                <div className="r-text">{r.urdu || r.english}</div>
              </div>
            )) : <div className="loading">No ayah found for &quot;{refQuery.trim()}&quot;</div>}
          </div>
        )}
      </div>

      <div className="bg-[#fffde7] p-3 rounded-lg mb-4 border border-[#e8d84a]">
        <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Search by Urdu Words</h3>
        <input type="text" placeholder="Type Urdu words to search in translations..." value={urduQuery} onChange={e => setUrduQuery(e.target.value)}
          className="w-full p-2 border border-[#ccc] rounded text-base" />
        <p className="text-[10px] text-[#a1883a] mt-1">Real-time — multiple words match ANY word, best matches rank first.</p>
        {urduSearching && <div className="loading">Searching...</div>}
        {!urduSearching && urduQuery.trim() && (
          <div className="mt-2">
            {urduResults.length > 0 ? (
              <>
                <p className="text-sm text-[#1a5c3a] font-bold mb-2">Found {urduResults.length} results for &quot;{urduQuery.trim()}&quot;</p>
                {urduResults.map((r, i) => (
                  <div key={i} className="result-item" onClick={() => openAyah(r)}>
                    <div className="r-meta">{ayahLabel(r)}{matchBadge(r)}</div>
                    <div className="r-arabic">{r.arabic}</div>
                    <div className="r-text">{makeSnippet(r.urdu || r.english || '', r.searchWords || urduQuery.trim().split(/\s+/))}</div>
                  </div>
                ))}
              </>
            ) : <div className="loading">No results found for &quot;{urduQuery.trim()}&quot;</div>}
          </div>
        )}
      </div>

      <div className="bg-[#e3f2fd] p-3 rounded-lg mb-4 border border-[#90caf9]">
        <h3 className="text-[#1565c0] text-sm font-bold mb-2">Search by Arabic Words</h3>
        <input type="text" placeholder="Type Arabic words to search in Quran text..." value={arabicQuery} onChange={e => setArabicQuery(e.target.value)}
          className="w-full p-2 border border-[#ccc] rounded text-base" />
        <p className="text-[10px] text-[#1565c0] mt-1">Real-time — multiple words match ANY word, best matches rank first.</p>
        {arabicSearching && <div className="loading">Searching...</div>}
        {!arabicSearching && arabicQuery.trim() && (
          <div className="mt-2">
            {arabicResults.length > 0 ? (
              <>
                <p className="text-sm text-[#1565c0] font-bold mb-2">Found {arabicResults.length} results for &quot;{arabicQuery.trim()}&quot;</p>
                {arabicResults.map((r, i) => (
                  <div key={i} className="result-item" onClick={() => openAyah(r)}>
                    <div className="r-meta">{ayahLabel(r)}{matchBadge(r)}</div>
                    <div className="r-arabic">{arabicSnippet(r.arabic || '', r.searchWords || arabicQuery.trim().split(/\s+/))}</div>
                    <div className="r-text">{r.urdu || r.english}</div>
                  </div>
                ))}
              </>
            ) : <div className="loading">No results found for &quot;{arabicQuery.trim()}&quot;</div>}
          </div>
        )}
      </div>
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
  const escaped = words.filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  const lowerWords = words.map(w => w.toLowerCase())
  return parts.map((part, i) =>
    part && lowerWords.some(w => w === part.toLowerCase())
      ? <mark key={i} className="bg-[#e8b840]/40 text-[#1a5c3a] rounded px-0.5 font-medium">{part}</mark>
      : part
  )
}

function makeSnippet(text: string, words: string[], before = 120, after = 220) {
  const escaped = words.filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (escaped.length === 0) return text
  const re = new RegExp(escaped.join('|'), 'gi')
  const match = re.exec(text)
  if (!match) return highlightText(text, words)
  const start = Math.max(0, match.index - before)
  const end = Math.min(text.length, match.index + match[0].length + after)
  const snippet = text.slice(start, end)
  return (
    <span>
      {start > 0 ? <span className="text-[#999]">…</span> : null}
      {highlightText(snippet, words)}
      {end < text.length ? <span className="text-[#999]">…</span> : null}
    </span>
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
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [numQuery, setNumQuery] = useState('')
  const [numResults, setNumResults] = useState<any[]>([])
  const [numSearching, setNumSearching] = useState(false)
  const [wordQuery, setWordQuery] = useState('')
  const [wordResults, setWordResults] = useState<any[]>([])
  const [wordSearching, setWordSearching] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const { bookmarks } = useBookmarks()

  useEffect(() => {
    api('/hadith/books').then(b => { setBooks(b); if (b.length) { setBookId(b[0].id); loadBook(b[0].id, 1) } })
  }, [])

  function loadBook(id: string, p: number) {
    setLoading(true); setList([])
    api(`/hadith/book/${id}?page=${p}`).then(data => {
      setList(data.hadiths); setTotal(data.total); setPages(data.pages); setPage(p); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const q = numQuery.trim()
    if (!q || !bookId) { setNumResults([]); setNumSearching(false); return }
    setNumSearching(true)
    const t = setTimeout(() => {
      api(`/hadith/number/${bookId}?q=${encodeURIComponent(q)}`)
        .then(r => { setNumResults(r || []); setNumSearching(false) })
        .catch(() => { setNumResults([]); setNumSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [numQuery, bookId])

  useEffect(() => {
    const q = wordQuery.trim()
    if (!q || !bookId) { setWordResults([]); setWordSearching(false); return }
    setWordSearching(true)
    const t = setTimeout(() => {
      api(`/hadith/search/${bookId}?q=${encodeURIComponent(q)}`)
        .then(r => { setWordResults(r || []); setWordSearching(false) })
        .catch(() => { setWordResults([]); setWordSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [wordQuery, bookId])

  const searchActive = numQuery.trim().length > 0 || wordQuery.trim().length > 0
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
        <button onClick={() => setShowBookmarks(s => !s)}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-bold inline-flex items-center gap-1.5 shrink-0 ${showBookmarks ? 'bg-[#e8b840] text-[#1a5c3a]' : 'bg-white border border-[#e8b840] text-[#b8860b] hover:bg-[#fff8e1]'}`}>
          <BookmarkIcon saved={bookmarks.length > 0} size={14} />
          Bookmarked ({bookmarks.length})
        </button>
      </div>

      {showBookmarks && (
        <div className="bg-[#fffdf0] border border-[#e8d84a] rounded-lg p-3 mb-4">
          <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Saved Bookmarked Hadiths</h3>
          {bookmarks.length === 0 && <div className="loading">No bookmarks yet. Click the bookmark icon on any hadith to save it here.</div>}
          {bookmarks.map((b: any, i: number) => (
            <div key={i} className="result-item" style={{ cursor: 'pointer' }} onClick={() => openHadithDetail(b, b.bookId)}>
              <div className="r-meta flex items-center justify-between gap-2">
                <span>{b.bookName} &middot; Hadith #{b.number}{b.international_number ? ` | International: ${b.international_number}` : ''}</span>
                <BookmarkBtn item={b} />
              </div>
              {b.arabic && <div className="r-arabic">{b.arabic}</div>}
              {b.urdu && <div className="r-text">{b.urdu}</div>}
              {b.urdu_ravi && <div className="narrator">{b.urdu_ravi}</div>}
              {b.english && !b.urdu && <div className="r-text">{b.english}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#e8f5e9] p-3 rounded-lg mb-4">
        <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Search by Hadith Number</h3>
        <input type="text" inputMode="numeric" placeholder={`Type hadith number in ${bookName}...`} value={numQuery} onChange={e => setNumQuery(e.target.value)}
          className="w-full p-2 border border-[#ccc] rounded text-base" />
        <p className="text-[10px] text-[#558b2f] mt-1">Real-time — partial number matches with exact match first.</p>
        {numSearching && <div className="loading">Searching numbers...</div>}
        {!numSearching && numQuery.trim() && (
          <div className="mt-2">
            {numResults.length > 0 ? (
              <>
                <p className="text-sm text-[#1a5c3a] font-bold mb-2">Found {numResults.length} hadiths matching &quot;{numQuery.trim()}&quot;</p>
{numResults.map((r, i) => (
  <div key={i} className="result-item" onClick={() => openHadithDetail(r, bookId, bookName)}>
    <div className="r-meta flex items-center justify-between gap-2">
      <span>Hadith #{r.number}{r.international_number ? ` | International: ${r.international_number}` : ''}</span>
      <BookmarkBtn item={bmItem(r, bookId, bookName)} />
    </div>
    <div className="r-arabic">{r.arabic}</div>
    {r.urdu && <div className="r-text">{makeSnippet(r.urdu, [''])}</div>}
  </div>
))}
              </>
            ) : (
              <div className="loading">No hadith found for &quot;{numQuery.trim()}&quot;</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-[#fffde7] p-3 rounded-lg mb-4 border border-[#e8d84a]">
        <h3 className="text-[#1a5c3a] text-sm font-bold mb-2">Search by Urdu Words</h3>
        <input type="text" placeholder={`Type Urdu words to search in ${bookName}...`} value={wordQuery} onChange={e => setWordQuery(e.target.value)}
          className="w-full p-2 border border-[#ccc] rounded text-base" />
        <p className="text-[10px] text-[#a1883a] mt-1">Real-time — multiple words match ANY word, best matches (phrase / most words) rank first. Click a result to open full hadith.</p>
        {wordSearching && <div className="loading">Searching...</div>}
        {!wordSearching && wordQuery.trim() && (
          <div className="mt-2">
            {wordResults.length > 0 ? (
              <>
                <p className="text-sm text-[#1a5c3a] font-bold mb-2">Found {wordResults.length} results for &quot;{wordQuery.trim()}&quot;</p>
                {wordResults.map((r, i) => (
                  <div key={i} className="result-item" onClick={() => openHadithDetail(r, bookId, bookName)}>
                    <div className="r-meta flex items-center justify-between gap-2">
                      <span>
                        Hadith #{r.number}{r.international_number ? ` | International: ${r.international_number}` : ''}
                        {r.match_count && r.total_words > 1 && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.match_count >= r.total_words ? 'bg-[#c8e6c9] text-[#1a5c3a]' : r.phrase_match ? 'bg-[#ffe0b2] text-[#e65100]' : 'bg-[#eceff1] text-[#546e7a]'}`}>
                            {r.match_count}/{r.total_words} words{r.phrase_match ? ' · phrase' : ''}
                          </span>
                        )}
                      </span>
                      <BookmarkBtn item={bmItem(r, bookId, bookName)} />
                    </div>
                    <div className="r-arabic">{r.arabic}</div>
                    <div className="r-text">{makeSnippet(r.urdu || r.english || '', r.searchWords || wordQuery.trim().split(/\s+/))}</div>
                    {r.urdu_ravi && <div className="narrator">{r.urdu_ravi}</div>}
                  </div>
                ))}
              </>
            ) : (
              <div className="loading">No results found for &quot;{wordQuery.trim()}&quot;</div>
            )}
          </div>
        )}
      </div>

      {!searchActive && !showBookmarks && (
        <>
          {loading && <div className="loading">Loading hadiths...</div>}
          {!loading && list.length === 0 && <div className="loading">Select a book to view hadiths.</div>}
          {list.map(h => (
            <div key={h.number} className="hadith-card relative" style={{ cursor: 'pointer' }} onClick={() => openHadithDetail(h, bookId, bookName)}>
              <div className="flex items-center justify-between gap-2">
                <div className="hadith-number">Hadith #{h.number}</div>
                <BookmarkBtn item={bmItem(h, bookId, bookName)} />
              </div>
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
        </>
      )}
    </div>
  )
}

function openHadithDetail(h: any, bookId: string, bookName?: string) {
  openModal(`Hadith #${h.number}`, <HadithDetailBody h={h} bookId={bookId} bookName={bookName || h.bookName || ''} />)
}

function HadithDetailBody({ h, bookId, bookName }: { h: any; bookId: string; bookName?: string }) {
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <div style={{ fontSize: 14, color: '#999' }}>Hadith #{detail.number}{bookName ? ` — ${bookName}` : ''}</div>
        <BookmarkBtn item={bmItem(detail, bookId, bookName || detail.bookName || '')} showText />
      </div>
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

  function runSearch() {
    if (!searchQuery.trim() || !tfType) return
    setSearching(true)
    setData(null)
    setSearched(true)
    api(`/quran/tafseer/search?q=${encodeURIComponent(searchQuery)}&type=${encodeURIComponent(tfType)}`)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }

  useEffect(() => {
    if (!tfType) return
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      setSearched(false)
      setSearching(false)
      return
    }
    const t = setTimeout(runSearch, 350)
    return () => clearTimeout(t)
  }, [searchQuery, tfType])

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
            onKeyUp={e => e.key === 'Enter' && runSearch()}
            className="flex-1 min-w-0 w-full p-2 border border-[#ccc] rounded text-base" />
          <button onClick={runSearch} disabled={!tfType || !searchQuery.trim() || searching}
            className="px-4 py-2 bg-[#1a5c3a] text-white border-none rounded cursor-pointer disabled:opacity-40 font-bold">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <p className="text-[10px] text-[#a1883a] mt-1">Real-time search — type to search instantly. Multiple words match ANY word, best matches (phrase / most words) rank first. Click a result to deep dive into the full tafseer with highlights.</p>
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
                  <div className="r-meta">
                    Surah {r.surah}:{(r.surah === 1 || r.surah === 9) ? r.ayah + 1 : r.ayah} | {r.tafseer_label}
                    {r.match_count && r.total_words > 1 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.match_count >= r.total_words ? 'bg-[#c8e6c9] text-[#1a5c3a]' : r.phrase_match ? 'bg-[#ffe0b2] text-[#e65100]' : 'bg-[#eceff1] text-[#546e7a]'}`}>
                        {r.match_count}/{r.total_words} words{r.phrase_match ? ' · phrase' : ''}
                      </span>
                    )}
                  </div>
                  <div className="r-arabic">{r.arabic}</div>
                  <div className="r-text">{makeSnippet(r.tafseer, r.searchWords || searchQuery.trim().split(/\s+/))}</div>
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
            <div className="translation urdu" style={{ background: '#fffde7', padding: 8, borderRadius: 6, marginTop: 6, borderLeft: '3px solid #e8b840', whiteSpace: 'pre-wrap' }}>{searchQuery.trim() ? highlightText(data.tafseerData[tfType], searchQuery.trim().split(/\s+/)) : data.tafseerData[tfType]}</div>
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
              <div key={i} className="list-card" onClick={() => window.open(site.url, '_blank', 'noopener')}>
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
          <img src="/logo.svg" alt="Quran Web" className="h-14 w-14" />
        </div>
        <h1 className="text-3xl font-bold text-[#1a5c3a]">Quran Web Team run by CEO Ali Raza</h1>
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
      const res = await api('/admin/books')
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
        const res = await api('/admin/books', {
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
      await api('/admin/books', {
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
      await api('/admin/books', {
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
        await api('/admin/books', { method: 'DELETE', headers, body: JSON.stringify({ id: b.id }) })
        setListMsg(`Deleted "${b.title}"`)
      }
      if (b.key) {
        await api('/admin/books', { method: 'DELETE', headers, body: JSON.stringify({ key: b.key, title: b.title }) })
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
      await api('/admin/books', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ restoreKey: d.key }) })
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[5%]">
      <div className="bg-white p-6 rounded-xl w-[90%] max-w-[680px] max-h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#1a5c3a]">🔒 Admin Panel — Books Manager</h3>
          <button onClick={onClose} className="text-2xl cursor-pointer text-[#999] hover:text-[#333]">&times;</button>
        </div>
        <p className="text-sm text-[#666] mb-4">Welcome, Ali Raza. Add, edit or delete books below — changes appear in the Books tab for all visitors.</p>

        <div className="p-4 bg-[#eef7ff] rounded-lg border border-[#bcd9f0] mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-[#1a5c3a] mb-0.5">🕌 Duas Manager</h4>
            <p className="text-xs text-[#666]">Add, edit or delete duas (Duas / More Duas / Prayers / Janaza / Roza).</p>
          </div>
          <a href="/admin/duas" className="text-sm text-[#1a5c3a] bg-white border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#e8f5e9] whitespace-nowrap">Open →</a>
        </div>

        {/* CSV Upload */}
        <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0] mb-4">
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
        <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0] mb-4">
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
        <div className="p-4 bg-[#f9fdf9] rounded-lg border border-[#e0e0e0] mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h4 className="font-bold text-[#1a5c3a]">📚 All Books ({allBooks.length})</h4>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search title / author / url..."
              className="flex-1 min-w-[140px] p-2 border border-[#ccc] rounded text-sm" />
          </div>
          {listMsg && <div className="text-xs mb-2 p-2 rounded bg-[#e8f5e9] text-[#1a5c3a]">{listMsg}</div>}
          {listError && <div className="text-xs mb-2 p-2 rounded bg-[#ffebee] text-red-700">{listError}</div>}
          <div className="max-h-[40vh] overflow-y-auto border border-[#e0e0e0] rounded">
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
          <div className="p-4 bg-[#fff5f5] rounded-lg border border-[#e8c4c4] mb-4">
            <h4 className="font-bold text-red-700 mb-2">🗑 Hidden Books ({deletedBooks.length})</h4>
            {deletedBooks.map(d => (
              <div key={d.key} className="flex items-center gap-2 mb-1 p-1.5 bg-white rounded border border-[#f0c8c8]">
                <span className="text-xs flex-1 truncate" style={{ direction: 'rtl' }}>{d.title}</span>
                <button onClick={() => restoreBook(d)} className="text-[11px] text-[#1a5c3a] bg-[#e8f5e9] border border-[#b8d6c4] rounded px-2 py-0.5 cursor-pointer hover:bg-[#d0ead8]">↩ Restore</button>
              </div>
            ))}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
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

        <div className="p-4 bg-[#fffde7] rounded-lg border border-[#e8d84a]">
          <h4 className="font-bold text-[#1a5c3a] mb-1">💡 Note</h4>
          <p className="text-xs text-[#666]">All books are stored in the website database (<code className="bg-[#e8f5e9] px-1 rounded">tbl_CustomBooks</code> + <code className="bg-[#e8f5e9] px-1 rounded">tbl_HiddenBooks</code>) and appear to <b>all visitors</b> immediately. Editing a built-in book creates an override; Delete hides it (restorable in the Hidden section). To permanently restore the original CSV book list, empty both tables and redeploy.</p>
        </div>
      </div>
    </div>
  )
}

// ============== BOOKS ==============
function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.download = ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

let bookAudioEl: HTMLAudioElement | null = null
function playBookAudio(url: string, setPlaying: (v: boolean) => void) {
  if (bookAudioEl) { bookAudioEl.pause(); bookAudioEl = null }
  const el = new Audio(url)
  bookAudioEl = el
  el.play().catch(() => { setPlaying(false); bookAudioEl = null })
  el.onended = () => { if (bookAudioEl === el) bookAudioEl = null; setPlaying(false) }
  el.onpause = () => { if (bookAudioEl === el) bookAudioEl = null; setPlaying(false) }
}

function BookCard({ book }: { book: any }) {
  const [flipped, setFlipped] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const hasAudio = !!book.audioPlay
  const cover = book.cover

  const flipButtons: React.ReactNode = (
    <div className="mt-auto w-full flex flex-col gap-1.5">
      {book.pdf || book.url ? (
        <button onClick={() => triggerDownload(book.pdf || book.url)}
          className="w-full px-2 py-2 bg-[#1a5c3a] text-white text-xs sm:text-sm font-bold text-center rounded border-none cursor-pointer">
          📥 Download PDF
        </button>
      ) : <div className="w-full px-2 py-2 bg-[#f0f0f0] text-[#999] text-xs font-bold text-center rounded">PDF — N/A</div>}
      {hasAudio ? (
        <>
          <button onClick={() => {
            if (playing) { if (bookAudioEl) bookAudioEl.pause(); setPlaying(false) }
            else { setPlaying(true); playBookAudio(book.audioPlay, setPlaying) }
          }}
            className="w-full px-2 py-2 bg-[#2a7a4e] text-white text-xs sm:text-sm font-bold rounded border-none cursor-pointer">
            {playing ? '⏸ Pause' : '▶ Listen'}
          </button>
          {book.audioDownload ? (
            <button onClick={() => triggerDownload(book.audioDownload)}
              className="w-full px-2 py-2 bg-[#1a3a1a] text-white text-xs sm:text-sm font-bold text-center rounded border-none cursor-pointer">
              ⬇ Download Audio
            </button>
          ) : null}
        </>
      ) : (
        <div className="w-full px-2 py-2 bg-[#f0f0f0] text-[#999] text-xs font-bold text-center rounded">Audio — N/A</div>
      )}
    </div>
  )

  return (
    <div className={`book-flip cursor-pointer ${flipped ? 'flipped' : ''}`} style={{ aspectRatio: '3 / 4.5' }} onClick={() => setFlipped(f => !f)}>
      <div className="book-flip-inner">
        {/* FRONT: cover image */}
        <div className="book-flip-face rounded-xl overflow-hidden bg-white border border-[#e0e0e0] shadow-md flex flex-col">
          <div className="relative flex-1 overflow-hidden bg-[#e8e8e8]">
            {cover && imgOk ? (
              <img src={cover} alt={book.title} loading="lazy" className="w-full h-full object-cover" onError={() => setImgOk(false)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-arabic text-2xl text-[#1a5c3a] p-3 text-center" style={{ direction: 'rtl' }}>{book.title}</div>
            )}
            <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#1a5c3a] shadow">
              {book.source === 'Alahazrat' ? 'ALAHAZRAT' : book.source === 'Custom' ? 'CUSTOM' : 'DAWATEISLAMI'}
            </span>
            <span className="absolute bottom-1.5 left-2 text-[20px] animate-bounceSlow">👆</span>
          </div>
          <div className="px-2.5 pt-1.5 pb-2">
            <h3 className="font-urdu text-sm sm:text-[15px] font-semibold text-[#222] leading-snug line-clamp-2" style={{ direction: 'rtl' }}>{book.title}</h3>
          </div>
        </div>

        {/* BACK: info + buttons */}
        <div className="book-flip-face book-flip-back rounded-xl overflow-hidden bg-[#fffdf5] border border-[#1a5c3a]/40 shadow-lg flex flex-col p-3">
          <div className="overflow-y-auto flex-1" onClick={e => e.stopPropagation()}>
            <p className="text-[11px] text-[#1a5c3a] font-bold mb-1.5 uppercase tracking-wide">{book.source}</p>
            <h4 className="font-urdu text-sm sm:text-base font-bold text-[#222] leading-snug mb-1.5" style={{ direction: 'rtl' }}>{book.title}</h4>
            <div className="text-[11px] text-[#555] space-y-1 mb-2">
              <p style={{ direction: 'rtl' }}><span className="font-bold text-[#1a5c3a]">مصنف: </span>{book.author || 'N/A'}</p>
              <p><span className="font-bold text-[#1a5c3a]">Author: </span>{book.author || 'N/A'}</p>
              <p><span className="font-bold text-[#1a5c3a]">Pages: </span>{book.pages || 'N/A'}</p>
            </div>
            {flipButtons}
          </div>
          <button onClick={e => { e.stopPropagation(); setFlipped(false) }}
            className="mt-2 w-full text-[11px] py-1.5 bg-[#e8b840] text-[#1a3a1a] font-bold rounded border-none cursor-pointer">
            ↩ Flip Back
          </button>
        </div>
      </div>
    </div>
  )
}

function BooksTab() {
  const [books, setBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [filtered, setFiltered] = useState<any[]>([])
  const PER_PAGE = 40

  useEffect(() => {
    api('/books')
      .then((data: any[]) => {
        setBooks(data)
        setFiltered(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    const next = q
      ? books.filter(b => (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q))
      : books
    setFiltered(next)
    setPage(0)
  }, [query, books])

  const start = page * PER_PAGE
  const end = Math.min(start + PER_PAGE, filtered.length)
  const pageItems = filtered.slice(start, end)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))

  return (
    <div className="animate-fadeIn">
      <div className="relative mb-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔎  تلاش کریں — Search books by title or author..."
          className="w-full px-4 py-2.5 rounded-lg border-2 border-[#2a7a4e]/30 focus:border-[#1a5c3a] outline-none text-sm bg-white"
          style={{ direction: 'rtl' }}
        />
      </div>

      <div className="flex items-center justify-between mb-3 text-xs text-[#666]">
        <span>Showing {pageItems.length} of {filtered.length} books</span>
        <span className="text-[#999]">Total: {books.length}</span>
      </div>

      {loading ? (
        <div className="loading">Loading books...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#999] text-sm">No books found.</div>
      ) : (
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {pageItems.map((b: any, i: number) => <BookCard key={b.url || b.cover || i} book={b} />)}
        </div>
      )}

      {filtered.length > PER_PAGE && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-1.5 rounded text-sm font-semibold border-none cursor-pointer bg-[#2563eb] text-white disabled:bg-[#cbd5e1] disabled:cursor-default">
            Previous
          </button>
          <span className="text-sm text-[#444]">Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={start + PER_PAGE >= filtered.length}
            className="px-4 py-1.5 rounded text-sm font-semibold border-none cursor-pointer bg-[#2563eb] text-white disabled:bg-[#cbd5e1] disabled:cursor-default">
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// Fix unused imports warning
const _unused = { arabicEl, urduEl }
