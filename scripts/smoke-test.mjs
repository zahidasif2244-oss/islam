/**
 * Headless smoke test: drives the real page in Chrome via CDP, clicks through
 * the Quran tab, and reports console errors + what actually rendered.
 *
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:3100'
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(p => existsSync(p))

const sleep = ms => new Promise(r => setTimeout(r, ms))

const userDataDir = mkdtempSync(path.join(tmpdir(), 'islam-smoke-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--remote-debugging-port=9333',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=390,844',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

let ws
let msgId = 0
const pending = new Map()
const consoleErrors = []
const failedRequests = []

function send(method, params = {}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text)
  return res.result?.value
}

async function waitFor(fn, timeout = 15000, label = 'condition') {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(fn)) return true
    await sleep(120)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function main() {
  // wait for the debugger endpoint
  let targets
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/list')
      targets = await res.json()
      if (targets.length) break
    } catch {}
    await sleep(250)
  }
  const page = targets.find(t => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => (ws.onopen = r))
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result)
      pending.delete(msg.id)
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''))
    } else if (msg.method === 'Network.loadingFailed') {
      failedRequests.push(msg.params.errorText)
    }
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Log.enable')

  const started = Date.now()
  await send('Page.navigate', { url: BASE + '/' })
  await waitFor(`document.readyState === 'complete'`, 30000, 'load')
  const loadMs = Date.now() - started

  // 1. homepage rendered the surah list?
  const home = await evaluate(`(() => ({
    title: document.title,
    surahCards: document.querySelectorAll('.list-card').length,
    firstSurah: document.querySelector('.list-card .font-arabic')?.textContent || '',
    fonts: [...document.fonts].map(f => f.family + ':' + f.status)
  }))()`)

  // 2. open Surah 1
  const t0 = Date.now()
  await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.list-card')];
    cards[0].querySelector('.flex-1').click();
    return true;
  })()`)
  await waitFor(`document.querySelectorAll('#quranVerses .quran-ayah').length > 0`, 20000, 'surah 1 verses')
  const surahMs = Date.now() - t0
  const surah1 = await evaluate(`(() => ({
    verses: document.querySelectorAll('#quranVerses .quran-ayah').length,
    header: document.querySelector('.surah-header h2')?.textContent || '',
    firstArabic: document.querySelector('#quranVerses .arabic')?.textContent?.slice(0, 40) || '',
    firstUrdu: document.querySelector('#quranVerses .translation.urdu')?.textContent?.slice(0, 40) || ''
  }))()`)

  // Visual check of the new Urdu face.
  try {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const fs = await import('node:fs')
    fs.mkdirSync('screenshots', { recursive: true })
    fs.writeFileSync('screenshots/surah-1.png', Buffer.from(shot.data, 'base64'))
  } catch {}

  // 3. open Al-Baqarah (the big one) via back + click
  const t1 = Date.now()
  await evaluate(`(() => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Back').click();
    return true;
  })()`)
  await sleep(300)
  await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.list-card')];
    cards[1].querySelector('.flex-1').click();
    return true;
  })()`)
  await waitFor(`document.querySelectorAll('#quranVerses .quran-ayah').length > 100`, 25000, 'baqarah verses')
  const baqarahMs = Date.now() - t1
  const baqarah = await evaluate(`(() => ({
    verses: document.querySelectorAll('#quranVerses .quran-ayah').length,
    header: document.querySelector('.surah-header h2')?.textContent || ''
  }))()`)

  // 4. Duas tab
  const t2 = Date.now()
  await evaluate(`(() => { [...document.querySelectorAll('nav ~ div button, div button')].find(b => b.textContent.trim() === 'duas').click(); return true })()`)
  await waitFor(`document.querySelectorAll('.dua-card').length > 0`, 20000, 'duas')
  const duasMs = Date.now() - t2
  const duas = await evaluate(`document.querySelectorAll('.dua-card').length`)

  // 5. Books tab
  const t3 = Date.now()
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'books').click(); return true })()`)
  await waitFor(`document.querySelectorAll('.book-flip').length > 0`, 25000, 'books')
  const booksMs = Date.now() - t3
  const books = await evaluate(`document.querySelectorAll('.book-flip').length`)

  // 6. Hadith tab
  const t4 = Date.now()
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'hadith').click(); return true })()`)
  await waitFor(`document.querySelectorAll('.hadith-card').length > 0`, 40000, 'hadith')
  const hadithMs = Date.now() - t4
  const hadith = await evaluate(`document.querySelectorAll('.hadith-card').length`)

  // 7. Quran search (client-side index)
  const t5 = Date.now()
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'quran').click(); return true })()`)
  await sleep(400)
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '🔍 Search').click(); return true })()`)
  await sleep(600)
  const searchInput = `document.querySelectorAll('input[placeholder*="Urdu words"]')[0]`
  await evaluate(`(() => {
    const input = ${searchInput};
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'رحمن رحیم');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  let searchInfo
  try {
    await waitFor(`document.querySelectorAll('.result-item').length > 0`, 20000, 'quran search results')
    searchInfo = await evaluate(`(() => ({
      results: document.querySelectorAll('.result-item').length,
      first: document.querySelector('.result-item .r-meta')?.textContent?.trim() || ''
    }))()`)
  } catch (e) {
    searchInfo = { error: e.message }
  }
  const searchMs = Date.now() - t5

  // 8. Tafseer tab + search
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'tafseer').click(); return true })()`)
  // A real reader looks at the form before typing; the tab also pre-warms the
  // tafseer column on the server during this pause.
  await sleep(2500)
  const t6 = Date.now()
  let tafseerInfo
  try {
    await evaluate(`(() => {
      const sels = [...document.querySelectorAll('select')];
      const sel = sels[sels.length - 1];
      const opt = [...sel.options].find(o => o.value);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const input = document.querySelector('input[placeholder*="Urdu text"]');
      const iset = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      iset.call(input, 'مسلمان');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`)
    await waitFor(`document.querySelectorAll('.result-item').length > 0`, 30000, 'tafseer search results')
    tafseerInfo = await evaluate(`document.querySelectorAll('.result-item').length`)
  } catch (e) {
    tafseerInfo = { error: e.message }
  }
  const tafseerMs = Date.now() - t6

  // 9. Word-by-word tab
  const t7 = Date.now()
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Word-by-Word').click(); return true })()`)
  await sleep(400)
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Load').click(); return true })()`)
  let wbwInfo
  try {
    await waitFor(`document.querySelectorAll('tbody tr').length > 0`, 15000, 'wbw rows')
    wbwInfo = await evaluate(`document.querySelectorAll('tbody tr').length`)
  } catch (e) {
    wbwInfo = { error: e.message }
  }
  const wbwMs = Date.now() - t7

  const fontsAfter = await evaluate(`[...document.fonts].map(f => f.family + ':' + f.status)`)

  console.log(JSON.stringify({
    loadMs,
    home,
    surah1: { ...surah1, ms: surahMs },
    baqarah: { ...baqarah, ms: baqarahMs },
    duas: { count: duas, ms: duasMs },
    books: { count: books, ms: booksMs },
    hadith: { count: hadith, ms: hadithMs },
    quranSearch: { ...searchInfo, ms: searchMs },
    tafseerSearch: { count: tafseerInfo, ms: tafseerMs },
    wordByWord: { rows: wbwInfo, ms: wbwMs },
    fontsAfter,
    consoleErrors: consoleErrors.slice(0, 12),
    failedRequests: [...new Set(failedRequests)].slice(0, 12),
  }, null, 2))
}

main()
  .catch(e => {
    console.error('SMOKE FAILED:', e.message)
    console.error('consoleErrors:', consoleErrors.slice(0, 10))
    process.exitCode = 1
  })
  .finally(async () => {
    try { ws?.close() } catch {}
    chrome.kill()
  })
