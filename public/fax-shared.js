// ============================================================
// FieldAxisHQ — Shared Utilities  fax-shared.js
// ============================================================

function getSb() {
  const url = localStorage.getItem('fax_url')
  const key = localStorage.getItem('fax_key')
  if (!url || !key) { window.location.href = 'index.html'; return null }
  return window.supabase.createClient(url, key)
}
async function requireAuth(sb) {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { window.location.href = 'index.html'; return null }
  return session
}
function signOut(sb) { sb.auth.signOut(); sessionStorage.clear(); window.location.href = 'index.html' }

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb', warn: '#d97706' }
  const icons = { success: '✓', error: '✗', info: 'ℹ', warn: '⚠' }
  const t = document.createElement('div')
  t.style.cssText = ['position:fixed','bottom:22px','left:50%','transform:translateX(-50%)','z-index:9999',
    'background:#0c1220','border-radius:99px','padding:9px 18px',`border-left:3px solid ${colors[type]}`,
    'box-shadow:0 6px 24px rgba(0,0,0,.7)','display:flex','align-items:center','gap:8px',
    'font-family:DM Sans,sans-serif','font-size:13px','color:#e8edf5','white-space:nowrap',
    'animation:fadeUp .2s ease'].join(';')
  t.innerHTML = `<span style="color:${colors[type]}">${icons[type]}</span>${msg}`
  document.body.appendChild(t)
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s' }, 3000)
  setTimeout(() => t.remove(), 3300)
}

// ── MODAL ────────────────────────────────────────────────────
function openModal(title, html, onConfirm, confirmLabel = 'Save', confirmCls = 'btn-primary') {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = html
  const btn = document.getElementById('modal-confirm')
  btn.textContent = confirmLabel
  btn.className = `btn ${confirmCls}`
  btn.onclick = onConfirm
  document.getElementById('modal-ov').classList.add('show')
}
function closeModal() { document.getElementById('modal-ov').classList.remove('show') }

// ── FORMATTERS ───────────────────────────────────────────────
function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) } catch { return d } }
function fmtTime(d) { if (!d) return '—'; try { return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) } catch { return d } }
function fmtDateTime(d) { if (!d) return '—'; return fmtDate(d) + ' ' + fmtTime(d) }
function fmtHours(h) { if (!h) return '0h'; const hrs = Math.floor(h), m = Math.round((h-hrs)*60); return m > 0 ? `${hrs}h ${m}m` : `${hrs}h` }
function fmtCurrency(n, dec = 0) { if (n == null) return '—'; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) }
function fmtPct(n) { if (n == null) return '—'; return n.toFixed(1) + '%' }
function isOverdue(due, status) { return due && !['complete','cancelled'].includes(status) && new Date(due) < new Date() }

// ── BADGES ───────────────────────────────────────────────────
function statusBadge(s) {
  const m = { pending:['bg-amber','Pending'], in_progress:['bg-blue','In Progress'], blocked:['bg-amber','Blocked'], pm_review:['bg-purple','PM Review'], complete:['bg-green','Complete'], cancelled:['bg-gray','Cancelled'],
    staged:['bg-amber','Staged'], signed_out:['bg-blue','Signed Out'], installed:['bg-green','Installed'], partial_install:['bg-teal','Partial'], not_staged:['bg-gray','Not Staged'],
    not_started:['bg-gray','Not Started'], active:['bg-blue','Active'], closed:['bg-green','Closed'],
    approved:['bg-green','Approved'], rejected:['bg-red','Rejected'], open:['bg-amber','Open'] }
  const [cls, label] = m[s] || ['bg-gray', s || '—']
  return `<span class="badge ${cls}">${label}</span>`
}
function phaseBadge(p) {
  const m = { not_started:['bg-gray','Not Started'], pre_construction:['bg-blue','Pre-Con'], rough_in:['bg-amber','Rough-in'], trim_out:['bg-teal','Trim-out'], inspection:['bg-purple','Inspection'], closeout:['bg-green','Closeout'], complete:['bg-green','Complete'] }
  const [cls, label] = m[p] || ['bg-gray', p || '—']
  return `<span class="badge ${cls}">${label}</span>`
}
function roleBadge(r) {
  const m = { admin:'bg-purple', pm:'bg-blue', stager:'bg-amber', foreman:'bg-teal', technician:'bg-green', requestor:'bg-blue', signout:'bg-gray', sub_lead:'bg-amber', sub_worker:'bg-gray' }
  return `<span class="badge ${m[r]||'bg-gray'}">${r}</span>`
}

// ── AVATAR ───────────────────────────────────────────────────
const AV_COLORS = [['#1a2e50','#60a5fa'],['#0f2a1f','#4ade80'],['#2d1a08','#fb923c'],['#1e1040','#a78bfa'],['#0a2535','#38bdf8'],['#2e0f0f','#f87171'],['#0f2820','#6ee7b7'],['#28240a','#fcd34d']]
function avStyle(name) { const i = (name||'').charCodeAt(0) % AV_COLORS.length; const [bg,c] = AV_COLORS[i]; return `background:${bg};color:${c}` }
function initials(n) { return (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

// ── GPS ──────────────────────────────────────────────────────
function gpsDistFt(la1,ln1,la2,ln2) {
  const R=20902231,dL=(la2-la1)*Math.PI/180,dN=(ln2-ln1)*Math.PI/180
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2
  return Math.round(R*2*Math.asin(Math.sqrt(a)))
}

// ── GEOCODE (Nominatim free) ──────────────────────────────────
async function geocodeAddr(addr) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=us`, { headers: { 'User-Agent':'FieldAxisHQ/1.0' } })
    const j = await r.json()
    if (!j.length) return null
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), formatted: j[0].display_name }
  } catch { return null }
}
async function addrSuggest(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=us`, { headers: { 'User-Agent':'FieldAxisHQ/1.0' } })
    const j = await r.json()
    return j.map(x => ({ label: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }))
  } catch { return [] }
}

// ── AUDIT LOG ────────────────────────────────────────────────
async function auditLog(sb, action, jobId, detail, gpsLat, gpsLng, distFt) {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return
  await sb.from('audit_log').insert({ job_id: jobId, user_id: session.user.id, action, entity_type: 'job', gps_lat: gpsLat||null, gps_lng: gpsLng||null, dist_from_site_ft: distFt||null, detail }).catch(() => {})
}

// ── CSV DOWNLOAD ─────────────────────────────────────────────
function dlCSV(content, filename) {
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content)
  a.download = filename; a.click()
}
function toCSV(rows) { return rows.map(r => r.map(c => '"'+(String(c||'').replace(/"/g,'""'))+'"').join(',')).join('\n') }

// ── PHASE STEPS ──────────────────────────────────────────────
const PHASES = ['not_started','pre_construction','rough_in','trim_out','inspection','closeout','complete']
const PHASE_LABELS = { not_started:'Not Started', pre_construction:'Pre-Con', rough_in:'Rough-in', trim_out:'Trim-out', inspection:'Inspection', closeout:'Closeout', complete:'Complete' }
function phaseBar(current) {
  const idx = PHASES.indexOf(current)
  return `<div class="phase-bar">${PHASES.map((p,i) => `<div class="phase-step ${i < idx ? 'done' : i === idx ? 'active' : ''}" title="${PHASE_LABELS[p]}"></div>`).join('')}</div>`
}

// ── LOADING SPINNER ──────────────────────────────────────────
function loadingHTML(msg = 'Loading…') { return `<div class="loading"><div class="spin"></div>${msg}</div>` }
function emptyHTML(icon, title, sub = '') { return `<div class="empty-state"><div class="es-icon">${icon}</div><div class="es-title">${title}</div>${sub?`<div class="es-sub">${sub}</div>`:''}</div>` }
