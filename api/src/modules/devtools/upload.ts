import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

const HTML = /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Анализы · Dev</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0c0c0c; color: #d4d4d4;
  min-height: 100vh; padding: 32px 16px;
}
.container { max-width: 700px; margin: 0 auto }

/* header */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 28px;
}
.topbar h1 { font-size: 16px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px }
.tag { font-size: 11px; background: #1e3a5f; color: #60a5fa;
  padding: 2px 7px; border-radius: 4px; font-weight: 500 }
.user-info { display: flex; align-items: center; gap: 14px; font-size: 13px; color: #555 }
.user-info span { color: #777 }
.user-info a { color: #444; cursor: pointer; text-decoration: underline; font-size: 12px }
.user-info a:hover { color: #888 }

/* auth */
.auth-card {
  background: #141414; border: 1px solid #222; border-radius: 12px;
  padding: 28px; max-width: 420px; margin: 0 auto;
}
.auth-card h2 { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 20px }
label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; margin-top: 14px }
label:first-of-type { margin-top: 0 }
input[type=email], input[type=text] {
  width: 100%; padding: 9px 12px; background: #0c0c0c;
  border: 1px solid #252525; border-radius: 8px;
  color: #e0e0e0; font-size: 14px; outline: none; transition: border-color .15s;
}
input:focus { border-color: #444 }
.btn {
  display: block; width: 100%; margin-top: 16px; padding: 10px;
  background: #1d4ed8; border: none; border-radius: 8px;
  color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s;
}
.btn:hover { background: #1e40af }
.btn:disabled { background: #1a1a1a; color: #444; cursor: not-allowed }
.link { font-size: 12px; color: #555; cursor: pointer; margin-top: 10px;
  display: inline-block; text-decoration: underline }
.link:hover { color: #888 }
.err { padding: 10px 12px; background: #1f0808; border-radius: 8px;
  font-size: 13px; color: #f87171; margin-top: 12px }

/* drop zone */
input[type=file] { display: none }
.drop-zone {
  border: 1px dashed #282828; border-radius: 12px;
  padding: 28px 24px; text-align: center; cursor: pointer;
  transition: border-color .15s, background .15s; background: #111; margin-bottom: 24px;
}
.drop-zone:hover, .drop-zone.drag { border-color: #2563eb; background: #0e1520 }
.drop-zone p { font-size: 14px; color: #555 }
.drop-zone p strong { color: #888 }
.drop-zone small { font-size: 12px; color: #3a3a3a; margin-top: 5px; display: block }

/* section heading */
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.section-head h2 { font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .5px }
.section-head a { font-size: 12px; color: #444; cursor: pointer; text-decoration: underline }
.section-head a:hover { color: #777 }

/* analysis card */
.analysis-card {
  background: #141414; border: 1px solid #202020; border-radius: 10px;
  margin-bottom: 10px; overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; cursor: pointer; user-select: none;
  transition: background .1s;
}
.card-header:hover { background: #191919 }
.card-header.no-click { cursor: default }
.card-header.no-click:hover { background: transparent }
.card-icon { font-size: 16px; flex-shrink: 0 }
.card-title { flex: 1; min-width: 0 }
.card-name { font-size: 13px; font-weight: 500; color: #ccc;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.card-date { font-size: 11px; color: #444; margin-top: 2px }
.badge {
  flex-shrink: 0; font-size: 10px; font-weight: 700; padding: 3px 7px;
  border-radius: 4px; letter-spacing: .4px; text-transform: uppercase;
}
.badge-pending    { background: #201a06; color: #fbbf24 }
.badge-processing { background: #091524; color: #60a5fa }
.badge-done       { background: #051a0d; color: #34d399 }
.badge-failed     { background: #1a0707; color: #f87171 }
.badge-timeout    { background: #130c1e; color: #c084fc }
.chevron { font-size: 12px; color: #3a3a3a; margin-left: 6px; transition: transform .2s; flex-shrink: 0 }
.chevron.open { transform: rotate(90deg) }

/* card body */
.card-body { display: none; border-top: 1px solid #1c1c1c }
.card-body.open { display: block }

.card-meta {
  display: flex; flex-wrap: wrap; gap: 5px 20px;
  padding: 10px 14px; border-bottom: 1px solid #191919;
}
.meta-item { font-size: 12px; color: #555 }
.meta-item b { color: #888; font-weight: 500 }

/* markers table */
table { width: 100%; border-collapse: collapse; font-size: 13px }
thead th {
  padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 500;
  color: #444; border-bottom: 1px solid #1c1c1c; white-space: nowrap;
}
tbody tr { border-bottom: 1px solid #191919 }
tbody tr:last-child { border-bottom: none }
tbody tr:hover { background: #191919 }
td { padding: 7px 12px; vertical-align: middle }
.td-name { color: #aaa }
.td-val  { font-weight: 600; white-space: nowrap }
.td-unit { color: #484848; white-space: nowrap }
.td-ref  { color: #383838; white-space: nowrap; font-size: 12px }
.val-ok   { color: #ccc }
.val-high { color: #f87171 }
.val-low  { color: #60a5fa }
.arrow { font-size: 10px; margin-left: 2px }
.section-row td {
  padding: 8px 12px 3px; font-size: 10px; color: #3a3a3a;
  font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
}
.no-markers { padding: 14px 12px; font-size: 13px; color: #3a3a3a; text-align: center }
.card-loading { padding: 14px 12px; font-size: 13px; color: #444; text-align: center }
.empty-state { padding: 32px; text-align: center; font-size: 14px; color: #333 }
</style>
</head>
<body>
<div class="container">

  <div class="topbar">
    <h1>Анализы <span class="tag">dev</span></h1>
    <div class="user-info" id="user-info" style="display:none">
      <span id="user-email-label"></span>
      <a id="link-logout">выйти</a>
    </div>
  </div>

  <!-- AUTH -->
  <div id="auth-section">
    <div class="auth-card" id="step-email">
      <h2>Войти</h2>
      <label>Email</label>
      <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
      <button class="btn" id="btn-otp">Получить код</button>
      <div id="err-email" class="err" style="display:none"></div>
    </div>
    <div class="auth-card" id="step-otp" style="display:none">
      <h2 id="otp-title">Введите код</h2>
      <label>Код из письма</label>
      <input id="code" type="text" placeholder="123456" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
      <div id="reg-fields" style="display:none">
        <label>Имя</label>
        <input id="first-name" type="text" placeholder="Иван">
        <label>Фамилия</label>
        <input id="last-name" type="text" placeholder="Иванов">
      </div>
      <button class="btn" id="btn-verify">Войти</button>
      <div><a class="link" id="link-back">← Другой email</a></div>
      <div id="err-otp" class="err" style="display:none"></div>
    </div>
  </div>

  <!-- APP -->
  <div id="app-section" style="display:none">
    <div class="drop-zone" id="drop-zone">
      <p><strong>Перетащите файлы сюда</strong> или нажмите для выбора</p>
      <small>PDF, JPG, PNG · до 10 МБ · можно несколько</small>
      <input id="file-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png">
    </div>

    <div id="new-section" style="display:none">
      <div class="section-head"><h2>Новые</h2></div>
      <div id="new-list"></div>
    </div>

    <div class="section-head" style="margin-top:4px">
      <h2>Все анализы</h2>
      <a id="btn-refresh">↻ обновить</a>
    </div>
    <div id="history-list"><div class="empty-state">Загрузка...</div></div>
  </div>
</div>

<script>
const API = '/api/v1'
let token = sessionStorage.getItem('dev_token')
let userEmail = sessionStorage.getItem('dev_email')

// ── utils ────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = 'block' }
function hide(id) { document.getElementById(id).style.display = 'none' }
function setErr(id, msg) {
  const el = document.getElementById(id)
  el.textContent = msg; el.style.display = msg ? 'block' : 'none'
}

async function apiFetch(method, path, body, isForm) {
  const headers = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (!isForm && body) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, {
    method, headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.error?.code || 'HTTP ' + res.status)
  return data
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

// ── markers / meta rendering ────────────────────────────────────
function buildMetaHtml(a) {
  const items = [
    a.labName          ? ['Лаборатория', a.labName] : null,
    a.patientFullName  ? ['Пациент', a.patientFullName + (a.patientAge ? ', ' + a.patientAge + ' л.' : '')] : null,
    a.patientGender    ? ['Пол', a.patientGender === 'male' ? 'М' : 'Ж'] : null,
    a.sampleTakenAt    ? ['Забор', a.sampleTakenAt] : null,
    a.reportDate       ? ['Отчёт', a.reportDate] : null,
  ].filter(Boolean)
  if (!items.length) return ''
  return '<div class="card-meta">' +
    items.map(([k, v]) => '<span class="meta-item"><b>' + k + ':</b> ' + v + '</span>').join('') +
    '</div>'
}

function buildMarkersHtml(markers) {
  if (!markers || !markers.length)
    return '<div class="no-markers">Маркеры не найдены</div>'

  const sections = {}
  markers.forEach(m => {
    const s = m.section || ''
    if (!sections[s]) sections[s] = []
    sections[s].push(m)
  })
  const multiSection = Object.keys(sections).length > 1

  let rows = ''
  Object.entries(sections).forEach(([section, ms]) => {
    if (multiSection && section)
      rows += '<tr class="section-row"><td colspan="4">' + section + '</td></tr>'
    ms.forEach(m => {
      const dir = m.outOfRangeDirection
      const cls = !m.isOutOfRange ? 'val-ok' : (dir === 'high' ? 'val-high' : 'val-low')
      const arrow = !m.isOutOfRange ? '' : (dir === 'high' ? '<span class="arrow">▲</span>' : '<span class="arrow">▼</span>')
      const ref = (m.referenceMin != null && m.referenceMax != null)
        ? m.referenceMin + ' – ' + m.referenceMax
        : (m.referenceRaw || '—')
      rows += '<tr>' +
        '<td class="td-name">' + m.name + '</td>' +
        '<td class="td-val ' + cls + '">' + (m.value ?? '—') + arrow + '</td>' +
        '<td class="td-unit">' + (m.unit || '') + '</td>' +
        '<td class="td-ref">' + ref + '</td>' +
        '</tr>'
    })
  })

  return '<table><thead><tr>' +
    '<th>Показатель</th><th>Значение</th><th>Ед.</th><th>Норма</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>'
}

// ── card factory ────────────────────────────────────────────────
function createCard({ id, name, status, date, clickable }) {
  const cardId = 'card-' + id
  const icon = { done: '📋', failed: '❌', pending: '⏳', processing: '⚙️', timeout: '⌛' }[status] || '📄'

  const el = document.createElement('div')
  el.className = 'analysis-card'; el.id = cardId
  el.innerHTML =
    '<div class="card-header' + (clickable ? '' : ' no-click') + '" data-id="' + id + '">' +
      '<span class="card-icon">' + icon + '</span>' +
      '<div class="card-title">' +
        '<div class="card-name" title="' + (name || '') + '">' + (name || 'Без имени') + '</div>' +
        (date ? '<div class="card-date">' + fmtDate(date) + '</div>' : '') +
      '</div>' +
      '<span class="badge badge-' + status + '">' + status + '</span>' +
      (clickable ? '<span class="chevron">›</span>' : '') +
    '</div>' +
    '<div class="card-body"></div>'

  if (clickable) {
    el.querySelector('.card-header').addEventListener('click', () => toggleCard(el, id))
  }
  return el
}

async function toggleCard(el, analysisId) {
  const header  = el.querySelector('.card-header')
  const body    = el.querySelector('.card-body')
  const chevron = el.querySelector('.chevron')
  const isOpen  = body.classList.contains('open')

  if (isOpen) {
    body.classList.remove('open'); chevron.classList.remove('open'); return
  }

  chevron.classList.add('open'); body.classList.add('open')
  if (body.dataset.loaded) return

  body.innerHTML = '<div class="card-loading">Загрузка...</div>'
  try {
    const a = await apiFetch('GET', '/analysis/' + analysisId)
    body.dataset.loaded = '1'
    body.innerHTML = buildMetaHtml(a) + buildMarkersHtml(a.markers)
  } catch (e) {
    body.innerHTML = '<div class="err" style="margin:12px">' + e.message + '</div>'
  }
}

function setBadge(el, status) {
  const b = el.querySelector('.badge')
  b.className = 'badge badge-' + status; b.textContent = status
  const icon = { done: '📋', failed: '❌', pending: '⏳', processing: '⚙️', timeout: '⌛' }[status] || '📄'
  const ci = el.querySelector('.card-icon'); if (ci) ci.textContent = icon
}

// ── history ─────────────────────────────────────────────────────
async function loadHistory() {
  const list = document.getElementById('history-list')
  list.innerHTML = '<div class="empty-state">Загрузка...</div>'
  try {
    const analyses = await apiFetch('GET', '/analysis')
    if (!analyses.length) {
      list.innerHTML = '<div class="empty-state">Анализов пока нет</div>'; return
    }
    list.innerHTML = ''
    analyses.forEach(a => {
      const card = createCard({
        id: a.id, name: a.fileOriginalName, status: a.status,
        date: a.createdAt, clickable: a.status === 'done',
      })
      list.appendChild(card)
    })
  } catch (e) {
    list.innerHTML = '<div class="err" style="margin:12px">' + e.message + '</div>'
  }
}

document.getElementById('btn-refresh').addEventListener('click', loadHistory)

// ── session ──────────────────────────────────────────────────────
function enterApp() {
  hide('auth-section'); show('app-section'); show('user-info')
  document.getElementById('user-email-label').textContent = userEmail
  loadHistory()
}

if (token && userEmail) enterApp()

// ── auth ─────────────────────────────────────────────────────────
document.getElementById('btn-otp').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim()
  if (!email) return
  const btn = document.getElementById('btn-otp')
  btn.disabled = true; btn.textContent = 'Отправка...'
  setErr('err-email', '')
  try {
    const { isNewUser } = await apiFetch('POST', '/auth/request-otp', { email })
    document.getElementById('otp-title').textContent = isNewUser ? 'Регистрация' : 'Введите код'
    document.getElementById('reg-fields').style.display = isNewUser ? 'block' : 'none'
    document.getElementById('btn-verify').textContent = isNewUser ? 'Зарегистрироваться' : 'Войти'
    hide('step-email'); show('step-otp')
    document.getElementById('code').focus()
  } catch (e) { setErr('err-email', e.message) }
  finally { btn.disabled = false; btn.textContent = 'Получить код' }
})

document.getElementById('email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-otp').click()
})

document.getElementById('link-back').addEventListener('click', () => {
  setErr('err-otp', ''); hide('step-otp'); show('step-email')
})

document.getElementById('btn-verify').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim()
  const code  = document.getElementById('code').value.trim()
  const isNew = document.getElementById('reg-fields').style.display !== 'none'
  const btn   = document.getElementById('btn-verify')
  btn.disabled = true; btn.textContent = 'Проверка...'
  setErr('err-otp', '')
  try {
    let data
    if (isNew) {
      const firstName = document.getElementById('first-name').value.trim()
      const lastName  = document.getElementById('last-name').value.trim()
      data = await apiFetch('POST', '/auth/register', { email, code, firstName, lastName, consentPd: true })
    } else {
      data = await apiFetch('POST', '/auth/verify-otp', { email, code })
    }
    token = data.accessToken; userEmail = email
    sessionStorage.setItem('dev_token', token)
    sessionStorage.setItem('dev_email', email)
    enterApp()
  } catch (e) { setErr('err-otp', e.message) }
  finally {
    btn.disabled = false
    btn.textContent = document.getElementById('reg-fields').style.display !== 'none' ? 'Зарегистрироваться' : 'Войти'
  }
})

document.getElementById('code').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-verify').click()
})

document.getElementById('link-logout').addEventListener('click', () => {
  sessionStorage.removeItem('dev_token'); sessionStorage.removeItem('dev_email')
  token = null; userEmail = null
  document.getElementById('new-list').innerHTML = ''
  document.getElementById('history-list').innerHTML = ''
  hide('app-section'); hide('user-info'); hide('new-section'); show('auth-section')
  hide('step-otp'); show('step-email')
})

// ── drop zone ────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')

dropZone.addEventListener('click', () => fileInput.click())
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag') })
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'))
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag')
  handleFiles(e.dataTransfer.files)
})
fileInput.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = '' })

function handleFiles(files) {
  Array.from(files).forEach(uploadFile)
}

// ── upload ───────────────────────────────────────────────────────
async function uploadFile(file) {
  const tmpId = 'tmp-' + Math.random().toString(36).slice(2)
  const newList = document.getElementById('new-list')
  show('new-section')

  const card = createCard({ id: tmpId, name: file.name, status: 'pending', date: null, clickable: false })
  newList.prepend(card)

  try {
    const form = new FormData()
    form.append('file', file)
    const result = await apiFetch('POST', '/analysis/upload', form, true)
    const analysisId = result.analysisId ?? result[0]?.analysisId

    // Ждём SSE
    const res = await fetch(API + '/analysis/' + analysisId + '/events', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    const text = await res.text()
    const match = text.match(/data: (.+)/)
    const status = match ? JSON.parse(match[1]).status : 'failed'

    setBadge(card, status)

    if (status === 'done') {
      // Открываем заголовок для клика и загружаем детали
      const header = card.querySelector('.card-header')
      header.dataset.id = analysisId
      header.classList.remove('no-click')
      header.insertAdjacentHTML('beforeend', '<span class="chevron">›</span>')
      header.addEventListener('click', () => toggleCard(card, analysisId))

      // Сразу раскрываем результат
      const body = card.querySelector('.card-body')
      body.classList.add('open')
      body.innerHTML = '<div class="card-loading">Загрузка результатов...</div>'
      const a = await apiFetch('GET', '/analysis/' + analysisId)
      body.dataset.loaded = '1'
      body.innerHTML = buildMetaHtml(a) + buildMarkersHtml(a.markers)
      card.querySelector('.chevron').classList.add('open')
    }

    // Обновляем историю
    await loadHistory()
  } catch (e) {
    setBadge(card, 'failed')
    card.querySelector('.card-body').innerHTML =
      '<div class="err" style="margin:12px">' + e.message + '</div>'
    card.querySelector('.card-body').classList.add('open')
  }
}
</script>
</body>
</html>`

const devtoolsRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get('/dev/upload', async (_request, reply) => {
        return reply.type('text/html').send(HTML)
    })
}

export default devtoolsRoutes
