import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

const HTML = /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upload Analysis · Dev</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e8e8e8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; width: 100%; max-width: 460px }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 24px; color: #fff }
  .step { display: none }
  .step.active { display: block }
  label { display: block; font-size: 13px; color: #888; margin-bottom: 6px; margin-top: 16px }
  label:first-of-type { margin-top: 0 }
  input[type=email], input[type=text], input[type=password] {
    width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333;
    border-radius: 8px; color: #e8e8e8; font-size: 15px; outline: none
  }
  input:focus { border-color: #555 }
  input[type=file] { display: none }
  .file-label {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    background: #111; border: 1px dashed #444; border-radius: 8px; cursor: pointer;
    font-size: 14px; color: #888; transition: border-color .15s
  }
  .file-label:hover { border-color: #666; color: #aaa }
  .file-label.has-file { border-color: #3a6 ; color: #5c9 }
  button {
    width: 100%; margin-top: 20px; padding: 11px; background: #2563eb;
    border: none; border-radius: 8px; color: #fff; font-size: 15px;
    font-weight: 500; cursor: pointer; transition: background .15s
  }
  button:hover { background: #1d4ed8 }
  button:disabled { background: #333; color: #666; cursor: not-allowed }
  .note { margin-top: 12px; font-size: 13px; color: #666; text-align: center }
  .note a { color: #4a8eff; cursor: pointer; text-decoration: none }
  .note a:hover { text-decoration: underline }
  .status-box {
    margin-top: 20px; padding: 14px; background: #111; border-radius: 8px;
    border: 1px solid #2a2a2a; font-size: 13px; line-height: 1.6
  }
  .status-box .row { display: flex; justify-content: space-between; gap: 8px }
  .status-box .val { color: #fff; font-weight: 500 }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 12px; font-weight: 600; letter-spacing: .3px
  }
  .badge.pending  { background: #2a2208; color: #f59e0b }
  .badge.done     { background: #052e16; color: #22c55e }
  .badge.failed   { background: #2d0a0a; color: #ef4444 }
  .badge.timeout  { background: #1e1229; color: #a78bfa }
  .err { margin-top: 12px; padding: 10px 12px; background: #2d0a0a; border-radius: 8px; font-size: 13px; color: #ef4444 }
  .user-tag { font-size: 12px; color: #555; margin-bottom: 20px }
</style>
</head>
<body>
<div class="card">
  <h1>📤 Upload Analysis <span style="color:#555;font-weight:400">dev</span></h1>

  <!-- STEP 1: email -->
  <div class="step active" id="step-email">
    <label>Email</label>
    <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
    <button id="btn-otp">Получить код →</button>
    <div id="err-email" class="err" style="display:none"></div>
  </div>

  <!-- STEP 2: otp -->
  <div class="step" id="step-otp">
    <p class="user-tag" id="otp-hint"></p>
    <label>Код из письма</label>
    <input id="code" type="text" placeholder="123456" maxlength="6" inputmode="numeric">
    <div id="reg-fields" style="display:none">
      <label>Имя</label>
      <input id="first-name" type="text" placeholder="Иван">
      <label>Фамилия</label>
      <input id="last-name" type="text" placeholder="Иванов">
    </div>
    <button id="btn-verify">Войти →</button>
    <div class="note"><a id="link-back">← Другой email</a></div>
    <div id="err-otp" class="err" style="display:none"></div>
  </div>

  <!-- STEP 3: upload -->
  <div class="step" id="step-upload">
    <p class="user-tag" id="upload-hint"></p>
    <label for="file-input">Файл анализа (PDF / JPG / PNG)</label>
    <label class="file-label" for="file-input" id="file-label">
      <span>📎</span><span id="file-name">Выбрать файл...</span>
    </label>
    <input id="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png">
    <button id="btn-upload" disabled>Загрузить</button>
    <div class="note"><a id="link-logout">Выйти</a></div>
    <div id="err-upload" class="err" style="display:none"></div>
    <div id="status-box" class="status-box" style="display:none">
      <div class="row"><span style="color:#888">ID</span><span class="val" id="s-id">—</span></div>
      <div class="row" style="margin-top:6px"><span style="color:#888">Статус</span><span id="s-status">—</span></div>
    </div>
  </div>
</div>

<script>
const API = '/api/v1'
let token = sessionStorage.getItem('dev_token')
let userEmail = sessionStorage.getItem('dev_email')

function show(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'))
  document.getElementById(stepId).classList.add('active')
}

function err(id, msg) {
  const el = document.getElementById(id)
  el.textContent = msg
  el.style.display = msg ? 'block' : 'none'
}

function setStatus(id, status) {
  document.getElementById('status-box').style.display = 'block'
  document.getElementById('s-id').textContent = id
  const el = document.getElementById('s-status')
  el.innerHTML = '<span class="badge ' + status + '">' + status.toUpperCase() + '</span>'
}

async function api(method, path, body, isForm) {
  const headers = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (!isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.error?.code || 'Ошибка ' + res.status)
  return data
}

// restore session
if (token && userEmail) {
  document.getElementById('upload-hint').textContent = userEmail
  show('step-upload')
}

// step 1 → 2
document.getElementById('btn-otp').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim()
  if (!email) return
  const btn = document.getElementById('btn-otp')
  btn.disabled = true; btn.textContent = 'Отправка...'
  err('err-email', '')
  try {
    const { isNewUser } = await api('POST', '/auth/request-otp', { email })
    document.getElementById('otp-hint').textContent = 'Код отправлен на ' + email
    document.getElementById('reg-fields').style.display = isNewUser ? 'block' : 'none'
    document.getElementById('btn-verify').textContent = isNewUser ? 'Зарегистрироваться →' : 'Войти →'
    show('step-otp')
  } catch (e) {
    err('err-email', e.message)
  } finally {
    btn.disabled = false; btn.textContent = 'Получить код →'
  }
})

document.getElementById('link-back').addEventListener('click', () => {
  err('err-otp', '')
  show('step-email')
})

// step 2 → 3
document.getElementById('btn-verify').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim()
  const code  = document.getElementById('code').value.trim()
  const isNew = document.getElementById('reg-fields').style.display !== 'none'
  const btn   = document.getElementById('btn-verify')
  btn.disabled = true; btn.textContent = 'Проверка...'
  err('err-otp', '')
  try {
    let data
    if (isNew) {
      const firstName = document.getElementById('first-name').value.trim()
      const lastName  = document.getElementById('last-name').value.trim()
      data = await api('POST', '/auth/register', { email, code, firstName, lastName, consentPd: true })
    } else {
      data = await api('POST', '/auth/verify-otp', { email, code })
    }
    token = data.accessToken
    userEmail = email
    sessionStorage.setItem('dev_token', token)
    sessionStorage.setItem('dev_email', email)
    document.getElementById('upload-hint').textContent = email
    show('step-upload')
  } catch (e) {
    err('err-otp', e.message)
  } finally {
    btn.disabled = false
    btn.textContent = document.getElementById('reg-fields').style.display !== 'none'
      ? 'Зарегистрироваться →' : 'Войти →'
  }
})

// file picker
document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0]
  const label = document.getElementById('file-label')
  const name  = document.getElementById('file-name')
  if (file) {
    name.textContent = file.name
    label.classList.add('has-file')
    document.getElementById('btn-upload').disabled = false
  } else {
    name.textContent = 'Выбрать файл...'
    label.classList.remove('has-file')
    document.getElementById('btn-upload').disabled = true
  }
})

// upload
document.getElementById('btn-upload').addEventListener('click', async () => {
  const file = document.getElementById('file-input').files[0]
  if (!file) return
  const btn = document.getElementById('btn-upload')
  btn.disabled = true; btn.textContent = 'Загрузка...'
  err('err-upload', '')
  try {
    const form = new FormData()
    form.append('file', file)
    const { analysisId } = await api('POST', '/analysis/upload', form, true)
    setStatus(analysisId, 'pending')
    listenStatus(analysisId)
  } catch (e) {
    err('err-upload', e.message)
    btn.disabled = false; btn.textContent = 'Загрузить'
  }
})

async function listenStatus(analysisId) {
  const btn = document.getElementById('btn-upload')
  btn.textContent = 'Обработка...'
  try {
    const res = await fetch(API + '/analysis/' + analysisId + '/events', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    const text = await res.text()
    const match = text.match(/data: (.+)/)
    if (match) {
      const { status } = JSON.parse(match[1])
      setStatus(analysisId, status)
    }
  } catch {
    setStatus(analysisId, 'failed')
  } finally {
    btn.disabled = false; btn.textContent = 'Загрузить'
    document.getElementById('file-input').value = ''
    document.getElementById('file-name').textContent = 'Выбрать файл...'
    document.getElementById('file-label').classList.remove('has-file')
  }
}

document.getElementById('link-logout').addEventListener('click', () => {
  sessionStorage.removeItem('dev_token')
  sessionStorage.removeItem('dev_email')
  token = null; userEmail = null
  document.getElementById('email').value = ''
  document.getElementById('code').value = ''
  err('err-upload', '')
  document.getElementById('status-box').style.display = 'none'
  show('step-email')
})
</script>
</body>
</html>`

const devtoolsRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get('/dev/upload', async (_request, reply) => {
        return reply.type('text/html').send(HTML)
    })
}

export default devtoolsRoutes
