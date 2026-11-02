/**
 * Focused check: does changing the translation in Settings actually change the
 * text in the reading view, and do the English / Hindi toggles render anything?
 *
 * Usage: node scripts/check-translations.mjs [baseUrl]
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
const userDataDir = mkdtempSync(path.join(tmpdir(), 'islam-tj-'))
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${userDataDir}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const requests = []
const errors = []

const send = (method, params = {}) => {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result?.value
}
const waitFor = async (fn, timeout = 20000, label = 'cond') => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await evaluate(fn)) return true
    await sleep(120)
  }
  throw new Error('timeout: ' + label)
}
const setInput = (selector, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
})()`)

async function firstUrdu() {
  return evaluate(`(document.querySelector('#quranVerses .translation.urdu')?.textContent || '').trim().slice(0, 70)`)
}
async function firstEnglish() {
  return evaluate(`(document.querySelector('#quranVerses .translation.english')?.textContent || '').trim().slice(0, 70)`)
}
async function firstHindi() {
  return evaluate(`(document.querySelector('#quranVerses .translation.hindi')?.textContent || '').trim().slice(0, 60)`)
}

async function main() {
  let targets
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9334/json/list')).json()
      if (targets.length) break
    } catch {}
    await sleep(250)
  }
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise(r => (ws.onopen = r))
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id) }
    else if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url)
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text)
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')

  await send('Page.navigate', { url: BASE + '/' })
  await waitFor(`document.readyState === 'complete'`, 30000, 'load')
  await waitFor(`document.querySelectorAll('.list-card').length > 0`, 30000, 'home')
  // wait for hydration: the server-rendered list exists before React attaches
  await sleep(1200)

  // open surah 1
  await evaluate(`(() => { document.querySelectorAll('.list-card')[0].querySelector('.flex-1').click(); return true })()`)
  try {
    await waitFor(`document.querySelectorAll('#quranVerses .quran-ayah').length > 0`, 20000, 'surah')
  } catch (e) {
    const diag = await evaluate(`(() => ({
      cards: document.querySelectorAll('.list-card').length,
      ayahs: document.querySelectorAll('#quranVerses .quran-ayah').length,
      bodyText: document.body.innerText.slice(0, 400),
      buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 20)
    }))()`)
    console.error('DIAG', JSON.stringify(diag, null, 2))
    console.error('errors', errors, 'requests', requests.filter(u => u.includes('/data/')).slice(0, 10))
    throw e
  }
  const before = await firstUrdu()

  // open settings and pick "Tahir-ul-Qadri" (tq)
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.title === 'Settings').click(); return true })()`)
  await sleep(400)
  const optionCount = await evaluate(`document.querySelectorAll('select')[0].options.length`)
  const optionKeys = await evaluate(`[...document.querySelectorAll('select')[0].options].map(o => o.value)`)
  const tafseerOptions = await evaluate(`[...document.querySelectorAll('select')[1].options].map(o => o.value)`)

  await setInput('select', 'tq')
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Settings').click(); return true })()`)
  await sleep(1500)
  const afterTq = await firstUrdu()

  // switch to a non-Urdu script translation (Bengali) and confirm it renders
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.title === 'Settings').click(); return true })()`)
  await sleep(400)
  await setInput('select', 'translation_bengali')
  await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Settings').click(); return true })()`)
  await sleep(1500)
  const afterBengali = await firstUrdu()

  // toggle English + Hindi
  const englishBeforeToggle = await firstEnglish()
  await evaluate(`(() => {
    const box = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'English');
    box.querySelector('input').click();
    const hi = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Hindi');
    hi.querySelector('input').click();
    return true;
  })()`)
  await sleep(1200)
  const englishAfter = await firstEnglish()
  const hindiAfter = await firstHindi()

  const trRequests = [...new Set(requests.filter(u => u.includes('/data/quran/') && u.includes('/tr-')))]
  const dataRequests = [...new Set(requests.filter(u => u.includes('/data/quran/') && !u.includes('/tr-')))]

  console.log(JSON.stringify({
    translationOptions: optionCount,
    translationKeys: optionKeys,
    tafseerKeys: tafseerOptions,
    urduBefore: before,
    urduAfterTq: afterTq,
    urduChanged: before !== afterTq,
    urduAfterBengali: afterBengali,
    bengaliDiffers: afterBengali !== afterTq,
    englishBeforeToggle,
    englishAfter,
    hindiAfter,
    requestedTranslationFiles: trRequests.map(u => u.split('/data/quran/')[1]),
    requestedDataFiles: dataRequests.map(u => u.split('/data/quran/')[1]).slice(0, 12),
    errors,
  }, null, 2))
}

main()
  .catch(e => { console.error('FAILED:', e.message); process.exitCode = 1 })
  .finally(() => { try { ws?.close() } catch {}; chrome.kill() })
