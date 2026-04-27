/**
 * FieldAxisHQ — Server v1.0
 * Field Operations + Warehouse + Subcontractor Management
 * Node.js, zero npm dependencies.
 * Backend: Supabase (database) + Cloudinary (files/photos)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT         = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET || 'fax-' + crypto.randomBytes(16).toString('hex');
const SESSION_HOURS = 24;
const SB_URL       = process.env.SUPABASE_URL || '';
// ── EMBEDDED HTML (always up to date, bypasses file system) ──────────
const HTML_INDEX  = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FieldAxisHQ — Sign In</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060a10;color:#e8edf5;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.box{width:100%;max-width:380px;padding:20px}
.logo{text-align:center;margin-bottom:32px}
.logo-mark{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;background:linear-gradient(135deg,#e8edf5,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:11px;color:#414e63;letter-spacing:.15em;text-transform:uppercase;margin-top:4px}
.card{background:#0c1220;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:28px}
.role-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px}
.role-tab{padding:12px;border:1.5px solid rgba(255,255,255,.08);border-radius:10px;cursor:pointer;text-align:center;transition:.15s}
.role-tab:hover{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.03)}
.role-tab.active{border-color:#2563eb;background:rgba(37,99,235,.1)}
.role-tab .icon{font-size:20px;margin-bottom:5px}
.role-tab .lbl{font-size:13px;font-weight:500}
.role-tab .sub{font-size:10px;color:#8a96ab;margin-top:2px}
.fg{margin-bottom:14px}
label{font-size:10px;font-weight:500;color:#414e63;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:5px}
input{width:100%;padding:11px 13px;background:#131c2e;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e8edf5;font-size:14px;font-family:'DM Sans',sans-serif;transition:.15s}
input:focus{outline:none;border-color:#2563eb;background:#1a2540}
.btn{width:100%;padding:13px;background:#2563eb;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:.15s;margin-top:6px}
.btn:hover{background:#1d4ed8}.btn:disabled{opacity:.5;cursor:not-allowed}
.err{background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.25);border-radius:8px;padding:10px 13px;font-size:12px;color:#f87171;margin-bottom:14px;display:none}
</style>
</head>
<body>
<div class="box">
  <div class="logo">
    <div class="logo-mark">FieldAxisHQ</div>
    <div class="logo-sub">Field Operations Platform</div>
  </div>
  <div class="card">
    <div class="role-tabs">
      <div class="role-tab active" id="tab-admin" onclick="setRole('admin')">
        <div class="icon">🖥</div><div class="lbl">Admin / PM</div><div class="sub">Full access</div>
      </div>
      <div class="role-tab" id="tab-worker" onclick="setRole('worker')">
        <div class="icon">🔧</div><div class="lbl">Field Worker</div><div class="sub">Jobs &amp; check-in</div>
      </div>
    </div>
    <div class="err" id="err"></div>
    <div class="fg"><label>Email</label><input type="email" id="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="fg"><label>Password</label><input type="password" id="pw" placeholder="••••••••" autocomplete="current-password"></div>
    <button class="btn" id="signin-btn" onclick="doSignIn()">Sign In</button>
  </div>
</div>
<script>
const sb = window.supabase.createClient('https://htkvgfmbcoozmkiairvt.supabase.co','sb_publishable_1U37N6iZ8Is4mF_aR9kThg_DS7wExWO')
let role = 'admin'
function setRole(r) {
  role = r
  document.getElementById('tab-admin').classList.toggle('active', r==='admin')
  document.getElementById('tab-worker').classList.toggle('active', r==='worker')
}
document.getElementById('pw').addEventListener('keydown', e => { if(e.key==='Enter') doSignIn() })
async function doSignIn() {
  const email = document.getElementById('email').value.trim()
  const pw = document.getElementById('pw').value
  const errEl = document.getElementById('err')
  const btn = document.getElementById('signin-btn')
  errEl.style.display = 'none'
  if (!email || !pw) { errEl.textContent='Enter email and password'; errEl.style.display='block'; return }
  btn.disabled = true; btn.textContent = 'Signing in…'
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw })
  if (error) { errEl.textContent = error.message; errEl.style.display='block'; btn.disabled=false; btn.textContent='Sign In'; return }
  // Check role from profile
  const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
  const userRole = profile?.role || 'sub_worker'
  if (role === 'admin' && !['admin','pm','foreman','stager','signout','requestor','technician'].includes(userRole)) {
    errEl.textContent = 'You do not have admin access. Use Field Worker login.'; errEl.style.display='block'; btn.disabled=false; btn.textContent='Sign In'; return
  }
  window.location.href = ['admin','pm','foreman','stager','signout','requestor','technician'].includes(userRole) ? 'admin.html' : 'worker.html'
}
// Auto-redirect if already logged in (unless ?signout=1 in URL)
if (!window.location.search.includes('signout')) {
  sb.auth.getSession().then(({data:{session}}) => {
    if (!session) return
    sb.from('profiles').select('role').eq('id',session.user.id).single().then(({data:p}) => {
      const r = p?.role||'sub_worker'
      window.location.href = ['admin','pm','foreman','stager','signout','requestor','technician'].includes(r) ? 'admin.html' : 'worker.html'
    })
  })
}
</script>
</body>
</html>
`
const HTML_ADMIN  = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FieldAxisHQ Admin v2</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:'DM Sans',sans-serif;background:#060a10;color:#e8edf5;font-size:13px;display:flex}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#1a2540;border-radius:2px}
#sidebar{width:215px;min-width:215px;background:#0c1220;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;height:100vh;overflow-y:auto}
.logo{padding:15px 14px 11px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.logo-mark{font-family:Syne,sans-serif;font-size:15px;font-weight:800;background:linear-gradient(135deg,#e8edf5,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:9px;color:#414e63;letter-spacing:.12em;text-transform:uppercase;margin-top:1px}
.nav-section{padding:9px 12px 2px;font-size:9px;font-weight:600;color:#414e63;letter-spacing:.1em;text-transform:uppercase}
.nav-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;color:#8a96ab;font-size:12px;margin:1px 5px;transition:.15s;user-select:none;white-space:nowrap}
.nav-item:hover{background:#131c2e;color:#e8edf5}.nav-item.active{background:#1a2540;color:#e8edf5}
.nav-item svg{width:13px;height:13px;flex-shrink:0;opacity:.75}
.nb{margin-left:auto;background:#dc2626;color:#fff;font-size:9px;padding:1px 5px;border-radius:9px;font-weight:700}
.sidebar-foot{margin-top:auto;padding:9px;border-top:1px solid rgba(255,255,255,.06)}
.user-pill{display:flex;align-items:center;gap:8px;padding:7px;background:#131c2e;border-radius:7px;cursor:pointer}
.user-pill:hover{background:#1a2540}
.av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-family:Syne,sans-serif;flex-shrink:0}
#main{flex:1;display:flex;flex-direction:column;height:100vh;overflow:hidden;min-width:0}
.topbar{height:48px;padding:0 18px;background:#0c1220;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.topbar-title{font-family:Syne,sans-serif;font-size:14px;font-weight:700}
.tb-right{display:flex;gap:7px;align-items:center}
#page-area{flex:1;overflow-y:auto;padding:18px}
.btn{padding:7px 13px;border-radius:7px;font-size:12px;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:#131c2e;color:#e8edf5;font-family:'DM Sans',sans-serif;transition:.15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.btn:hover{background:#1a2540}.btn:active{opacity:.8}.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-p{background:#2563eb;color:#fff;border-color:#2563eb}.btn-p:hover{background:#1d4ed8}
.btn-g{background:rgba(22,163,74,.12);color:#16a34a;border-color:rgba(22,163,74,.2)}
.btn-r{background:rgba(220,38,38,.12);color:#dc2626;border-color:rgba(220,38,38,.2)}
.btn-a{background:rgba(217,119,6,.12);color:#d97706;border-color:rgba(217,119,6,.2)}
.btn-ghost{border-color:transparent;background:transparent;color:#8a96ab}.btn-ghost:hover{background:#131c2e;color:#e8edf5}
.btn-sm{padding:4px 9px;font-size:11px}.btn-full{width:100%;justify-content:center}
.fg{margin-bottom:12px}
.fl{font-size:10px;font-weight:500;color:#414e63;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px}
.fi,.fs,.ft{width:100%;padding:8px 11px;border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:13px;font-family:'DM Sans',sans-serif;background:#131c2e;color:#e8edf5;transition:.15s}
.fi:focus,.fs:focus,.ft:focus{outline:none;border-color:#2563eb;background:#1a2540}
.ft{resize:vertical;min-height:70px;line-height:1.5}
.fi::placeholder,.ft::placeholder{color:#414e63}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.four{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
.card{background:#0c1220;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px;margin-bottom:13px}
.card-title{font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px}
.stat{background:#0c1220;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:13px}
.stat-label{font-size:10px;color:#414e63;font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
.stat-value{font-size:24px;font-weight:300}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{text-align:left;padding:8px 11px;border-bottom:1px solid rgba(255,255,255,.06);color:#414e63;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.tbl td{padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
.tbl tbody tr:hover td{background:rgba(255,255,255,.02);cursor:pointer}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;white-space:nowrap}
.bg-green{background:rgba(22,163,74,.12);color:#16a34a}.bg-amber{background:rgba(217,119,6,.12);color:#d97706}
.bg-blue{background:rgba(37,99,235,.12);color:#60a5fa}.bg-red{background:rgba(220,38,38,.12);color:#dc2626}
.bg-gray{background:#1a2540;color:#8a96ab}.bg-teal{background:rgba(13,148,136,.12);color:#2dd4bf}
.bg-purple{background:rgba(124,58,237,.12);color:#a78bfa}.bg-orange{background:rgba(234,88,12,.12);color:#fb923c}
.tab-bar{display:flex;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto;background:#0c1220}
.tab-bar::-webkit-scrollbar{display:none}
.tab{padding:10px 14px;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;color:#414e63;transition:.15s;white-space:nowrap;flex-shrink:0;user-select:none}
.tab:hover{color:#8a96ab}.tab.active{color:#2563eb;border-bottom-color:#2563eb;font-weight:500}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.modal-box{background:#0c1220;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:22px;width:100%;max-width:580px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.9)}
.modal-title{font-family:Syne,sans-serif;font-size:15px;font-weight:700;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.modal-close{cursor:pointer;color:#414e63;font-size:20px;line-height:1;padding:2px 6px;border-radius:4px}.modal-close:hover{color:#e8edf5;background:#131c2e}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.06)}
.loading{padding:40px;text-align:center;color:#414e63;font-size:12px;display:flex;align-items:center;justify-content:center;gap:9px}
.empty{padding:36px;text-align:center;color:#414e63}
.empty-icon{font-size:32px;margin-bottom:8px}
.pbar{height:4px;background:#1a2540;border-radius:2px;overflow:hidden}
.pb{height:100%;border-radius:2px;background:#2563eb}
.pb.g{background:#16a34a}.pb.a{background:#d97706}.pb.r{background:#dc2626}
.gps-live{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(22,163,74,.12);color:#16a34a;border-radius:20px;font-size:10px;font-weight:500}
.pulse{width:6px;height:6px;border-radius:50%;background:currentColor;animation:pulse 1.4s infinite;display:inline-block}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
.spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.1);border-top-color:#2563eb;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.sec-hdr{font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.08em;padding:11px 0 7px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.upload-zone{border:1.5px dashed rgba(255,255,255,.1);border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:.15s}
.upload-zone:hover{border-color:#2563eb;background:rgba(37,99,235,.04)}
.upload-zone input{display:none}
.file-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#1a2540;border:1px solid rgba(255,255,255,.08);border-radius:6px;font-size:11px;color:#8a96ab;margin:2px}
.rm{cursor:pointer;color:#414e63;margin-left:2px}.rm:hover{color:#dc2626}
.alert-row{display:flex;gap:9px;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.06);margin-bottom:5px;align-items:flex-start}
.adot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px}
.part-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);background:#131c2e;border-radius:6px;margin-bottom:4px}
.chk-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.chk-item:last-child{border-bottom:none}
.chk-box{width:18px;height:18px;border-radius:5px;border:1.5px solid rgba(255,255,255,.15);cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:.15s}
.chk-box.ck{background:#16a34a;border-color:#16a34a}.chk-box.ck::after{content:'✓';color:#fff;font-size:10px;font-weight:700}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.photo-card{background:#131c2e;border:1px solid rgba(255,255,255,.06);border-radius:9px;overflow:hidden;cursor:pointer}
.photo-thumb{width:100%;height:90px;object-fit:cover;display:block}
.photo-ph{width:100%;height:90px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#414e63}
.fin-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.fin-row:last-child{border-bottom:none}
.addr-dd{position:absolute;left:0;right:0;top:100%;z-index:200;background:#0c1220;border:1px solid rgba(255,255,255,.12);border-top:none;border-radius:0 0 8px 8px;box-shadow:0 8px 24px rgba(0,0,0,.7);max-height:160px;overflow-y:auto;display:none}
.addr-item{padding:8px 12px;font-size:12px;color:#8a96ab;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04)}
.addr-item:hover{background:#131c2e;color:#e8edf5}
.scan-cam{position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:4/3;width:100%;margin-bottom:8px}
.scan-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.scan-rect{width:65%;max-width:240px;aspect-ratio:3/1;border:2px solid rgba(255,255,255,.85);border-radius:6px;box-shadow:0 0 0 2000px rgba(0,0,0,.45)}
.scan-line{position:absolute;left:4px;right:4px;height:2px;background:rgba(255,80,50,.9);border-radius:2px;animation:scanA 2s ease-in-out infinite}
@keyframes scanA{0%,100%{top:10%}50%{top:85%}}
.scan-status{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:11px;color:rgba(255,255,255,.9);background:rgba(0,0,0,.5);padding:4px}
.batch-item{display:flex;align-items:center;gap:9px;padding:9px 11px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:7px;margin-bottom:5px}
.bi-info{flex:1;min-width:0}.bi-name{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bi-bc{font-size:10px;color:#414e63;margin-top:1px}
.qty-ctrl{display:flex;align-items:center;gap:5px;flex-shrink:0}
.qty-ctrl button{width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:#0c1220;cursor:pointer;font-size:14px;color:#e8edf5;display:flex;align-items:center;justify-content:center}
.qty-ctrl span{font-size:14px;font-weight:600;min-width:24px;text-align:center}
.sched-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sched-item{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;align-items:flex-start}
.sched-item:last-child{border-bottom:none}
.markup-toolbar{display:flex;gap:6px;padding:9px;background:#131c2e;border-radius:7px;margin-bottom:8px;flex-wrap:wrap;align-items:center}
.mt-btn{padding:5px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:#0c1220;color:#8a96ab;cursor:pointer;font-size:11px;font-family:'DM Sans',sans-serif;transition:.15s}
.mt-btn:hover{background:#1a2540;color:#e8edf5}.mt-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
.dot-swatch{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;flex-shrink:0}
.dot-swatch.sel{border-color:#fff}
.legend-item{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#131c2e;border-radius:6px;margin-bottom:5px}
.markup-canvas-wrap{position:relative;display:inline-block;width:100%;overflow:auto;background:#1a2540;border-radius:8px;border:1px solid rgba(255,255,255,.08)}
#markup-canvas{cursor:crosshair;display:block}
.safety-card{border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:13px;margin-bottom:9px;background:#0c1220}
.safety-ack-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.timeline-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.timeline-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
.doc-row{display:flex;align-items:center;gap:9px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
.doc-row:last-child{border-bottom:none}
.mode-toggle{display:flex;border:1px solid rgba(255,255,255,.1);border-radius:7px;overflow:hidden;margin-bottom:10px}
.mode-toggle button{flex:1;padding:8px;font-size:12px;font-weight:500;background:#131c2e;border:none;cursor:pointer;color:#8a96ab;font-family:inherit;transition:.15s}
.mode-toggle button.active{background:#2563eb;color:#fff}
.progress-stages{display:flex;gap:3px;margin:8px 0}
.ps{flex:1;height:5px;border-radius:99px;background:#1a2540}
.ps.done{background:#16a34a}.ps.cur{background:#d97706}

/* ── MOBILE RESPONSIVE ────────────────────────────────────────── */
#mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99;backdrop-filter:blur(2px)}
#hamburger{display:none;background:none;border:none;cursor:pointer;padding:6px;color:#e8edf5;flex-shrink:0}
#hamburger svg{width:22px;height:22px}

@media(max-width:768px){
  body{font-size:14px}
  #hamburger{display:flex;align-items:center}
  #mobile-overlay{display:none}
  #mobile-overlay.open{display:block}

  /* Sidebar slides in from left */
  #sidebar{
    position:fixed;left:-220px;top:0;bottom:0;z-index:100;
    transition:transform .25s cubic-bezier(.4,0,.2,1);
    transform:translateX(0);
    box-shadow:none;
  }
  #sidebar.open{
    transform:translateX(220px);
    box-shadow:4px 0 30px rgba(0,0,0,.5);
  }

  /* Main area takes full width */
  #main{width:100%;min-width:0}

  /* Topbar */
  .topbar{padding:0 10px;gap:6px}
  .topbar-title{font-size:14px}
  #topbar-actions{gap:5px;flex-wrap:wrap;max-width:calc(100vw - 120px);overflow:hidden}
  #topbar-actions .btn{padding:4px 8px;font-size:11px}
  #topbar-actions select.fs{font-size:11px;padding:4px 6px;max-width:120px}

  /* Page area */
  #page-area{padding:10px!important}

  /* Cards and forms */
  .card{padding:12px}
  .two,.three,.four{grid-template-columns:1fr!important}
  .stats{grid-template-columns:repeat(2,1fr)!important}

  /* Tables: make scrollable */
  .card > table,.tbl{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;font-size:11px}

  /* Job detail tabs: scrollable */
  .tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;gap:0}
  .tab{white-space:nowrap;padding:8px 12px;font-size:11px;flex-shrink:0}

  /* Job detail split layout: stack vertically */
  .jd-grid{grid-template-columns:1fr!important}

  /* Modal: full screen on mobile */
  .modal-box{
    width:100%!important;max-width:100%!important;
    margin:0!important;border-radius:16px 16px 0 0!important;
    position:fixed!important;bottom:0!important;left:0!important;right:0!important;top:auto!important;
    max-height:90vh;overflow-y:auto;
  }
  .modal-wrap{align-items:flex-end!important;padding:0!important}

  /* Dispatch board: stack */
  #page-area [style*="grid-template-columns:280px"]{
    display:flex!important;flex-direction:column!important;height:auto!important
  }
  #dispatch-left{max-height:35vh;border-right:none!important;border-bottom:1px solid rgba(255,255,255,.07)}

  /* Job map: stack */
  #page-area [style*="grid-template-columns:1fr 300px"]{
    display:flex!important;flex-direction:column!important;height:auto!important
  }

  /* Buttons: larger tap targets */
  .btn{min-height:36px;padding:7px 12px}
  .btn-sm{min-height:30px;padding:4px 10px}
  .nav-item{padding:9px 10px;font-size:13px}

  /* Photos grid: 2 cols on phone */
  .photo-grid{grid-template-columns:repeat(2,1fr)!important}

  /* Safety compliance grid: scrollable */
  #page-area .card [style*="overflow-x:auto"]{overflow-x:auto;-webkit-overflow-scrolling:touch}

  /* Notifications bell */
  #notif-badge{top:-2px!important;right:-2px!important}

  /* Daily reports filters: wrap */
  #page-area [style*="grid-template-columns:1fr 1fr 1fr 1fr"]{
    grid-template-columns:1fr 1fr!important
  }
}

@media(max-width:420px){
  .stats{grid-template-columns:repeat(2,1fr)!important}
  .photo-grid{grid-template-columns:repeat(2,1fr)!important}
  #topbar-actions .btn{font-size:10px;padding:3px 6px}
}
</style>
</head>
<body>
<div id="mobile-overlay" onclick="closeSidebar()"></div>
<div id="sidebar">
  <div class="logo"><div class="logo-mark">FieldAxisHQ</div><div class="logo-sub">v2 · Operations</div></div>
  <div style="flex:1;padding:4px 0;overflow-y:auto">
    <div class="nav-section">Overview</div>
    <div class="nav-item active" onclick="P('dashboard',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>Dashboard</div>
    <div class="nav-item" onclick="P('jobs',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9h4"/></svg>All Jobs</div>
    <div class="nav-item" onclick="P('newjob',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/></svg>New Job</div>
    <div class="nav-item" onclick="P('schedule',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v4M11 1v4"/></svg>Schedule</div>
    <div class="nav-item" onclick="P('dispatch',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="6" height="5" rx="1"/><rect x="9" y="4" width="6" height="5" rx="1"/><path d="M4 9v4M12 9v4M1 13h6M9 13h6"/></svg>Dispatch Board</div>
    <div class="nav-item" onclick="pgJobMap()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 3l4 1.5L9 3l6 2v8l-6-2-4 1.5L1 11V3z"/><path d="M5 4.5v9M9 3v9"/></svg>Job Map</div>
    <div class="nav-section">Daily Ops</div>
    <div class="nav-item" onclick="P('daily',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10v10H3z"/><path d="M3 7h10M7 3v10"/></svg>Daily Reports</div>
    <div class="nav-item" onclick="P('jobwalks',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13L8 3l6 10H2z"/><path d="M8 8v3M8 12.5v.5"/></svg>Job Walks</div>
    <div class="nav-item" onclick="P('punch',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M3 4h10M3 12h7"/></svg>Punch List</div>
    <div class="nav-section">Warehouse</div>
    <div class="nav-item" onclick="P('scan',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2"/><path d="M4 8h8"/></svg>Scan Parts</div>
    <div class="nav-item" onclick="P('catalog',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>Catalog</div>
    <div class="nav-item" onclick="P('inventory',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="8" width="3" height="6"/><rect x="6.5" y="5" width="3" height="9"/><rect x="11" y="2" width="3" height="12"/></svg>Stock</div>
    <div class="nav-item" onclick="P('orders',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10l-1.5 7H4.5L3 3z"/><circle cx="6" cy="13.5" r="1"/><circle cx="11" cy="13.5" r="1"/></svg>Orders</div>
    <div class="nav-section">Field</div>
    <div class="nav-item" onclick="P('gps',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2C5.8 2 4 3.8 4 6c0 3.5 4 8 4 8s4-4.5 4-8c0-2.2-1.8-4-4-4z"/><circle cx="8" cy="6" r="1.5"/></svg>GPS Tracking</div>
    <div class="nav-item" onclick="P('hours',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>Hours</div>
    <div class="nav-item" onclick="P('companies',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="7" width="14" height="8" rx="1"/><path d="M4 7V5a4 4 0 018 0v2"/></svg>Sub Companies</div>
    <div class="nav-section">Safety</div>
    <div class="nav-item" onclick="P('safety',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l6 3v5c0 3-6 6-6 6S2 13 2 10V5z"/><path d="M5.5 8l2 2 3-3"/></svg>Safety Topics<span class="nb" id="nb-safety" style="display:none">!</span></div>
    <div class="nav-section">Finance</div>
    <div class="nav-item" onclick="P('financials',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12l3-4 3 2 3-5 3 3"/></svg>Financials</div>
    <div class="nav-item" onclick="P('reports',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13V8m4 5V5m4 8V2"/></svg>Reports</div>
    <div class="nav-section">Admin</div>
    <div class="nav-item" onclick="P('documents',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="1" width="10" height="14" rx="1"/><path d="M6 5h4M6 8h4M6 11h2"/></svg>Documents</div>
    <div class="nav-item" onclick="P('users',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>Users</div>
  </div>
  <div class="sidebar-foot">
    <div class="user-pill" onclick="doSignOut()">
      <div class="av" id="user-av" style="width:28px;height:28px;font-size:10px"></div>
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="user-name">…</div><div style="font-size:10px;color:#414e63">Sign out</div></div>
    </div>
  </div>
</div>

<div id="main">
  <div class="topbar">
    <button id="hamburger" onclick="toggleSidebar()" aria-label="Menu">
      <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h16M3 11h16M3 16h16"/>
      </svg>
    </button>
    <div class="topbar-title" id="page-title">Dashboard</div>
    <div class="tb-right" id="topbar-actions">
      <div style="position:relative;cursor:pointer" onclick="P('notifications',null)" title="Notifications">
        <div style="font-size:18px;line-height:1;padding:4px 6px">🔔</div>
        <div id="notif-badge" style="display:none;position:absolute;top:0;right:0;background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:99px;min-width:16px;text-align:center">0</div>
      </div>
    </div>
  </div>
  <div id="page-area"><div class="loading"><div class="spin"></div> Loading…</div></div>
</div>

<div id="modal" style="display:none" onclick="if(event.target.id==='modal')closeModal()">
  <div class="modal-bg">
    <div class="modal-box">
      <div class="modal-title"><span id="modal-title-txt"></span><span class="modal-close" onclick="closeModal()">×</span></div>
      <div id="modal-body"></div>
      <div class="modal-footer" id="modal-footer">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-p" id="modal-ok">Save</button>
      </div>
    </div>
  </div>
</div>
<script>
const sb=window.supabase.createClient('https://htkvgfmbcoozmkiairvt.supabase.co','sb_publishable_1U37N6iZ8Is4mF_aR9kThg_DS7wExWO')
let ME=null,allJobs=[],allCatalog=[]
let currentJobId=null,currentJob=null
// ── BOOT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',async()=>{
  const{data:{session}}=await sb.auth.getSession()
  if(!session){location.href='index.html';return}
  const{data:p}=await sb.from('profiles').select('*').eq('id',session.user.id).single()
  ME=p||{id:session.user.id,full_name:session.user.email,role:'admin'}
  const nm=ME.full_name||session.user.email
  document.getElementById('user-name').textContent=nm
  const av=document.getElementById('user-av')
  av.textContent=ini(nm);Object.assign(av.style,avS(nm))
  P('dashboard',document.querySelector('.nav-item'))
  checkSafetyBadge()
})
function doSignOut(){sb.auth.signOut().then(()=>{location.href='index.html?signout=1'})}

// ── NAVIGATION ────────────────────────────────────────────────
const PAGE_TITLES={dashboard:'Dashboard',notifications:'Notifications',dispatch:'Dispatch Board',jobs:'All Jobs',newjob:'New Job',schedule:'Schedule & Milestones',daily:'Daily Reports',jobwalks:'Job Walks',punch:'Punch List',scan:'Scan Parts',catalog:'Parts Catalog',inventory:'Stock / Inventory',orders:'Orders',gps:'GPS Tracking',hours:'Labor Hours',companies:'Sub Companies',safety:'Safety Topics',financials:'Financials',reports:'Reports & Exports',documents:'Document Vault',users:'Users',jobdetail:'Job Detail'}
function P(page,navEl){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'))
  if(navEl)navEl.classList.add('active')
  document.getElementById('page-title').textContent=PAGE_TITLES[page]||page
  document.getElementById('topbar-actions').innerHTML=''
  const a=document.getElementById('page-area')
  a.innerHTML='<div class="loading"><div class="spin"></div> Loading…</div>'
  const map={dashboard:pgDash,jobs:pgJobs,newjob:pgNewJob,schedule:pgSchedule,dispatch:pgDispatch,daily:pgDaily,jobwalks:pgJobWalks,punch:pgPunch,scan:pgScan,catalog:pgCatalog,inventory:pgInventory,orders:pgOrders,gps:pgGPS,hours:pgHours,companies:pgCompanies,safety:pgSafety,financials:pgFinancials,reports:pgReports,documents:pgDocuments,users:pgUsers,notifications:pgNotifications}
  if(map[page])map[page]()
  else a.innerHTML='<div class="empty">Coming soon</div>'
}
// ── MODAL ─────────────────────────────────────────────────────
function modal(title,html,onOk,okLabel='Save',hideFooter=false){
  document.getElementById('modal-title-txt').textContent=title
  document.getElementById('modal-body').innerHTML=html
  const btn=document.getElementById('modal-ok');btn.textContent=okLabel;btn.onclick=onOk
  const ft=document.getElementById('modal-footer');ft.style.display=hideFooter?'none':'flex'
  document.getElementById('modal').style.display='block'
}
function closeModal(){document.getElementById('modal').style.display='none'}
// ── HELPERS ───────────────────────────────────────────────────
function toast(msg,type='success'){const c={success:'#16a34a',error:'#dc2626',warn:'#d97706',info:'#2563eb'};const i={success:'✓',error:'✗',warn:'⚠',info:'ℹ'};const t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#0c1220;border-radius:99px;padding:10px 20px;border-left:3px solid '+c[type]+';box-shadow:0 6px 24px rgba(0,0,0,.9);display:flex;align-items:center;gap:8px;font-size:13px;color:#e8edf5;white-space:nowrap;pointer-events:none';t.innerHTML='<span style="color:'+c[type]+'">'+i[type]+'</span>'+msg;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s'},2800);setTimeout(()=>t.remove(),3100)}
function beep(){try{const a=new AudioContext();const o=a.createOscillator();const g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=1200;g.gain.setValueAtTime(.4,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.start();o.stop(a.currentTime+.15)}catch{}}
function v(id){return(document.getElementById(id)||{}).value||''}
function fN(id){const n=parseFloat(v(id));return isNaN(n)?null:n}
function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function ini(n){return(n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
const AVC=[['#1a2e50','#60a5fa'],['#0f2a1f','#4ade80'],['#2d1a08','#fb923c'],['#1e1040','#a78bfa'],['#0a2535','#38bdf8'],['#2e0f0f','#f87171'],['#0f2820','#6ee7b7'],['#28240a','#fcd34d']]
function avS(n){const i=(n||'').charCodeAt(0)%AVC.length;return{background:AVC[i][0],color:AVC[i][1]}}
function fd(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}}
function ft(d){if(!d)return'—';try{return new Date(d).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}catch{return d}}
function fdt(d){return fd(d)+' '+ft(d)}
function fh(h){if(!h)return'0h';const hr=Math.floor(h),m=Math.round((h-hr)*60);return m?hr+'h '+m+'m':hr+'h'}
function fm(n,d=0){if(n==null)return'—';return'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}
function isOD(due,phase){return due&&phase!=='complete'&&new Date(due)<new Date()}
function daysAway(d){if(!d)return null;return Math.round((new Date(d)-new Date())/86400000)}

const STAGES=['not_started','parts_ordered','parts_staged','in_progress','pre_test','pre_tested','ready_for_final','complete']
const STAGE_LABELS={not_started:'Not Started',parts_ordered:'Parts Ordered',parts_staged:'Parts Staged',in_progress:'In Progress',pre_test:'Ready for Pre-test',pre_tested:'Pre-Tested',ready_for_final:'Ready for Final',complete:'Complete'}
const STAGE_COLORS={not_started:'bg-gray',parts_ordered:'bg-orange',parts_staged:'bg-amber',in_progress:'bg-blue',pre_test:'bg-amber',pre_tested:'bg-teal',ready_for_final:'bg-purple',complete:'bg-green'}
function stageBadge(p){return\`<span class="badge \${STAGE_COLORS[p]||'bg-gray'}">\${STAGE_LABELS[p]||p||'—'}</span>\`}
function roleBadge(r){const m={admin:'bg-purple',pm:'bg-blue',stager:'bg-amber',foreman:'bg-teal',technician:'bg-green',sub_lead:'bg-amber',sub_worker:'bg-gray'};return\`<span class="badge \${m[r]||'bg-gray'}">\${r||'—'}</span>\`}
function empty(icon,txt){return\`<div class="empty"><div class="empty-icon">\${icon}</div><div style="color:#414e63;font-size:12px">\${txt}</div></div>\`}
function ld(){return'<div class="loading"><div class="spin"></div> Loading…</div>'}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
async function pgDash(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="P(\\'newjob\\',null)">+ New Job</button>'
  try {
  // Run queries individually so one failure doesn't break everything
  const {data:jobs,error:jobsError} = await sb.from('jobs').select('*').order('created_at',{ascending:false})
  if(jobsError) throw new Error('Jobs: '+jobsError.message)
  const {data:ci=[]} = await sb.from('checkins').select('id,job_id,worker_id,checkin_at,checkout_at,profiles:worker_id(full_name),jobs(name)').is('checkout_at',null).order('checkin_at',{ascending:false}).limit(20).then(r=>r).catch(()=>({data:[]}))
  const {data:parts=[]} = await sb.from('job_parts').select('id,job_id,status,assigned_qty').in('status',['staged','signed_out']).then(r=>r).catch(()=>({data:[]}))
  const {data:low=[]} = await sb.from('inventory').select('id,name,qty,min_qty').gt('min_qty',0).then(r=>r).catch(()=>({data:[]}))
  const {data:safety=[]} = await sb.from('safety_topics').select('id,title,week_of').order('created_at',{ascending:false}).limit(5).then(r=>r).catch(()=>({data:[]}))
  // Load worker names for check-ins separately (avoid join issues)
  let ciWithNames = ci||[]
  if(ciWithNames.length){
    const workerIds=[...new Set(ciWithNames.map(c=>c.worker_id).filter(Boolean))]
    const jobIds=[...new Set(ciWithNames.map(c=>c.job_id).filter(Boolean))]
    const [{data:wProfiles},{data:ciJobs}]=await Promise.all([
      sb.from('profiles').select('id,full_name').in('id',workerIds),
      sb.from('jobs').select('id,name').in('id',jobIds)
    ]).catch(()=>[{data:[]},{data:[]}])
    const wMap={}; (wProfiles||[]).forEach(p=>wMap[p.id]=p.full_name)
    const jMap={}; (ciJobs||[]).forEach(j=>jMap[j.id]=j.name)
    ciWithNames=ciWithNames.map(c=>({...c,workerName:wMap[c.worker_id]||'?',jobName:jMap[c.job_id]||''}))
  }
  allJobs=jobs||[]
  const active=allJobs.filter(j=>j.phase!=='complete')
  const staged=(parts||[]).filter(p=>p.status==='staged')
  const out=(parts||[]).filter(p=>p.status==='signed_out')
  const lowStock=(low||[]).filter(i=>i.qty<=i.min_qty)
  const checkins=ciWithNames
  // Upcoming milestones in next 14 days
  const soon=[]
  allJobs.forEach(j=>{
    const fields=[['expected_onsite_date','Expected On Site'],['next_visit_date','Next Visit'],['date_closeout','Closeout'],['due_date','Due']]
    fields.forEach(([f,lbl])=>{if(j[f]){const da=daysAway(j[f]);if(da!=null&&da>=0&&da<=14)soon.push({job:j.name,type:lbl,date:j[f],da,id:j.id})}})
  })
  soon.sort((a,b)=>a.da-b.da)
  document.getElementById('page-area').innerHTML=\`
  <div class="stats">
    <div class="stat"><div class="stat-label">Active Jobs</div><div class="stat-value">\${active.length}</div><div style="font-size:10px;color:#414e63;margin-top:2px">\${active.filter(j=>isOD(j.due_date,j.phase)).length} overdue</div></div>
    <div class="stat"><div class="stat-label">Parts Staged</div><div class="stat-value" style="color:#d97706">\${staged.length}</div></div>
    <div class="stat"><div class="stat-label">Checked Out</div><div class="stat-value" style="color:#60a5fa">\${out.length}</div></div>
    <div class="stat"><div class="stat-label">On Site Now</div><div class="stat-value" style="color:#16a34a">\${checkins.length}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 280px;gap:13px">
    <div>
      <div class="card">
        <div class="card-title">Active Jobs <button class="btn btn-sm btn-ghost" onclick="P('jobs',null)">All →</button></div>
        \${active.length?\`<table class="tbl"><thead><tr><th>Job</th><th>Stage</th><th>Due</th></tr></thead><tbody>\${active.slice(0,8).map(j=>\`<tr onclick="openJob('\${j.id}')"><td><div style="font-weight:500">\${j.name}</div><div style="font-size:10px;color:#414e63">\${j.address||''}</div></td><td>\${stageBadge(j.phase)}</td><td style="font-size:11px;color:\${isOD(j.due_date,j.phase)?'#dc2626':'#8a96ab'}">\${fd(j.due_date)}</td></tr>\`).join('')}</tbody></table>\`:empty('📋','No active jobs')}
      </div>
      <div class="card">
        <div class="card-title">⚠ Due Within 14 Days</div>
        \${soon.length?soon.map(s=>\`<div class="sched-item" onclick="openJob('\${s.id}')"><div class="sched-dot" style="background:\${s.da<=3?'#dc2626':s.da<=7?'#d97706':'#16a34a'};margin-top:4px"></div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${s.job}</div><div style="font-size:10px;color:#414e63">\${s.type} · \${fd(s.date)}</div></div><span class="badge \${s.da<=3?'bg-red':s.da<=7?'bg-amber':'bg-green'}">\${s.da===0?'Today':s.da+'d'}</span></div>\`).join(''):empty('📅','All clear — nothing due in 14 days')}
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Low Stock</div>
        \${lowStock.length?lowStock.slice(0,5).map(i=>\`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px"><span>\${i.name}</span><span style="color:#dc2626;font-weight:500">\${i.qty}/\${i.min_qty}</span></div>\`).join(''):'<div style="font-size:12px;color:#414e63">All stock OK ✓</div>'}
      </div>
      <div class="card">
        <div class="card-title">Live Check-ins</div>
        \${checkins.length?checkins.slice(0,5).map(c=>\`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div class="av" style="width:22px;height:22px;font-size:8px;\${Object.entries(avS(c.workerName)).map(([k,v])=>k+':'+v).join(';')}">\${ini(c.workerName)}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${c.workerName||'?'}</div><div style="font-size:10px;color:#414e63">\${c.jobName||''} · \${ft(c.checkin_at)}</div></div><span class="gps-live" style="font-size:9px"><span class="pulse"></span></span></div>\`).join(''):'<div style="font-size:12px;color:#414e63">No one on site</div>'}
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">🔔 Safety Pending</div>
        \${(safety||[]).length?(safety||[]).map(s=>\`<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px"><div style="font-weight:500">\${s.safety_topics?.title||'Topic'}</div><div style="color:#414e63;margin-top:1px">\${s.assigned_name} · Week of \${fd(s.safety_topics?.week_of)}</div></div>\`).join(''):'<div style="font-size:12px;color:#414e63">No pending safety reviews ✓</div>'}
        <button class="btn btn-sm" style="margin-top:8px;width:100%;justify-content:center" onclick="P('safety',null)">Manage Safety →</button>
      </div>
    </div>
  </div>\`
  } catch(e) {
    console.error('Dashboard:',e)
    document.getElementById('page-area').innerHTML='<div style="padding:20px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:10px"><div style="color:#dc2626;font-weight:600;margin-bottom:6px">⚠ Failed to load — database not ready</div><div style="font-size:12px;color:#f87171;word-break:break-all">'+e.message+'</div><div style="font-size:11px;color:#8a96ab;margin-top:8px">Run <strong>supabase-fix.sql</strong> in Supabase SQL Editor, then refresh.</div></div>'
  }
}
// ══════════════════════════════════════════
// ALL JOBS
// ══════════════════════════════════════════
async function pgJobs(){
  document.getElementById('topbar-actions').innerHTML=\`
    <label class="btn btn-sm" style="cursor:pointer">⬇ Import Excel<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importJobsExcel(this)"></label>
    <button class="btn btn-sm" onclick="exportJobsExcel()">⬆ Export</button>
    <button class="btn btn-p btn-sm" onclick="P('newjob',null)">+ New Job</button>\`
  try {
    const{data:jobs,error}=await sb.from('jobs').select('*').order('created_at',{ascending:false})
    if(error) throw error
    allJobs=jobs||[]
    renderJobsTable('')
  } catch(e) {
    const errMsg=e.message||String(e)
    document.getElementById('page-area').innerHTML='<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:10px;padding:18px;margin:0"><div style="font-weight:600;color:#dc2626;margin-bottom:6px">Failed to load jobs</div><div style="font-size:12px;color:#f87171;font-family:monospace;word-break:break-all;margin-bottom:8px">'+errMsg+'</div><div style="font-size:11px;color:#8a96ab">To fix: go to Supabase Dashboard → SQL Editor → run <strong>supabase-fix.sql</strong> from the zip, then refresh this page.</div></div>'
  }
}
function renderJobsTable(q){
  const rows=allJobs.filter(j=>!q||j.name.toLowerCase().includes(q.toLowerCase())||(j.address||'').toLowerCase().includes(q.toLowerCase()))
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:12px;display:flex;gap:8px">
    <input class="fi" placeholder="Search jobs…" style="max-width:280px" oninput="renderJobsTable(this.value)" value="\${q}">
    <select class="fs" style="width:160px" onchange="filterJobsByStage(this.value)"><option value="">All Stages</option>\${STAGES.map(s=>\`<option value="\${s}">\${STAGE_LABELS[s]}</option>\`).join('')}</select>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  \${rows.length?\`<table class="tbl"><thead><tr><th>Job</th><th>GC</th><th>Stage</th><th>Due Date</th><th>Next Visit</th><th>Project Manager</th><th>Contract</th><th>Progress</th></tr></thead><tbody>\${rows.map(j=>\`<tr onclick="openJob('\${j.id}')"><td><div style="font-weight:500">\${j.name}</div><div style="font-size:10px;color:#414e63">\${j.address||''}</div></td><td style="font-size:11px;color:#8a96ab">\${j.gc_company||'—'}</td><td>\${stageBadge(j.phase)}</td><td style="font-size:11px;color:\${isOD(j.due_date,j.phase)?'#dc2626':'#8a96ab'}">\${fd(j.due_date)}</td><td style="font-size:11px;color:\${daysAway(j.next_visit_date)!=null&&daysAway(j.next_visit_date)<=7?'#d97706':'#8a96ab'}">\${fd(j.next_visit_date)}</td><td style="font-size:11px">\${j.project_manager||'—'}</td><td style="font-size:11px">\${j.contract_value?fm(j.contract_value):'—'}</td><td><div class="pbar" style="width:70px"><div class="pb g" style="width:\${j.pct_complete||0}%"></div></div><div style="font-size:9px;color:#414e63;margin-top:2px">\${j.pct_complete||0}%</div></td></tr>\`).join('')}</tbody></table>\`:empty('📋','No jobs found')}
  </div>\`
}
function filterJobsByStage(stage){
  const rows=stage?allJobs.filter(j=>j.phase===stage):allJobs
  const a=document.getElementById('page-area')
  a.querySelector('table tbody').innerHTML=rows.map(j=>\`<tr onclick="openJob('\${j.id}')"><td><div style="font-weight:500">\${j.name}</div></td><td>\${j.gc_company||'—'}</td><td>\${stageBadge(j.phase)}</td><td style="font-size:11px">\${fd(j.due_date)}</td><td style="font-size:11px">\${fd(j.next_visit_date)}</td><td>\${j.contract_value?fm(j.contract_value):'—'}</td><td><div class="pbar" style="width:60px"><div class="pb g" style="width:\${j.pct_complete||0}%"></div></div></td></tr>\`).join('')
}
async function importJobsExcel(input){
  const file=input.files[0];if(!file)return
  const data=await file.arrayBuffer()
  const wb=XLSX.read(data,{type:'array'})
  const ws=wb.Sheets[wb.SheetNames[0]]
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''})
  if(!rows.length){toast('No data found in file','error');return}
  let created=0,errors=0
  for(const r of rows){
    if(!r['Job Name']&&!r['name'])continue
    const job={id:uuid(),name:r['Job Name']||r['name']||'',address:r['Address']||r['address']||'',gc_company:r['GC Company']||r['gc_company']||'',gc_contact:r['GC Contact']||'',gc_phone:r['GC Phone']||'',phase:r['Stage']||r['phase']||'not_started',due_date:r['Due Date']||r['due_date']||null,contract_value:parseFloat(r['Contract Value']||r['contract_value'])||null,next_visit_date:r['Next Visit']||null,expected_onsite_date:r['Expected On Site']||null,archived:false,pct_complete:0,created_by:ME?.full_name,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
    const{error}=await sb.from('jobs').insert(job)
    if(error)errors++;else created++
  }
  toast(\`Imported \${created} jobs\${errors?' ('+errors+' errors)':''}\`,errors?'warn':'success')
  pgJobs()
}
async function exportJobsExcel(){
  const{data:jobs}=await sb.from('jobs').select('*').order('created_at',{ascending:false})
  const rows=(jobs||[]).map(j=>({'Job Name':j.name,'Address':j.address||'','GC Company':j.gc_company||'','GC Contact':j.gc_contact||'','GC Phone':j.gc_phone||'','Stage':j.phase,'Due Date':j.due_date||'','Next Visit':j.next_visit_date||'','Expected On Site':j.expected_onsite_date||'','Contract Value':j.contract_value||'','% Complete':j.pct_complete||0,'Completion Date':j.completion_date||''}))
  const ws=XLSX.utils.json_to_sheet(rows)
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Jobs')
  XLSX.writeFile(wb,'FieldAxisHQ-Jobs-'+new Date().toISOString().split('T')[0]+'.xlsx')
  toast('Excel exported')
}

// ══════════════════════════════════════════
// JOB DETAIL
// ══════════════════════════════════════════
async function openJob(id){
  currentJobId=id
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'))
  document.getElementById('page-title').textContent='Job Detail'
  document.getElementById('topbar-actions').innerHTML=\`<button class="btn btn-sm" onclick="P('jobs',null)">← Jobs</button>\`
  const{data:job}=await sb.from('jobs').select('*').eq('id',id).single()
  currentJob=job
  renderJobDetail()
}
function renderJobDetail(){
  const j=currentJob
  const si=STAGES.indexOf(j.phase)
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:14px">
    <div style="font-family:Syne,sans-serif;font-size:18px;font-weight:700">\${j.name}</div>
    <div style="font-size:12px;color:#8a96ab;margin-top:3px">\${j.address||''}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:9px;flex-wrap:wrap">
      \${j.urgent_pm_visit?'<div style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);border-radius:7px;padding:4px 10px;font-size:12px;font-weight:600;color:#ef4444">🔥 Urgent PM Visit Required</div>':''}
      \${stageBadge(j.phase)}
      <select class="fs" style="width:180px;padding:5px 9px;font-size:12px" onchange="updateJobStage(this.value)">\${STAGES.map(s=>\`<option value="\${s}" \${j.phase===s?'selected':''}>\${STAGE_LABELS[s]}</option>\`).join('')}</select>
      <input type="number" class="fi" style="width:70px;padding:5px 8px;font-size:12px" value="\${j.pct_complete||0}" min="0" max="100" title="% Complete" onchange="updateJobPct(this.value)">%
      \${j.due_date?\`<span style="font-size:11px;color:\${isOD(j.due_date,j.phase)?'#dc2626':'#8a96ab'}">Due \${fd(j.due_date)}</span>\`:''}
    </div>
    <div class="progress-stages" style="margin-top:10px">\${STAGES.map((s,i)=>\`<div class="ps \${i<si?'done':i===si?'cur':''}" title="\${STAGE_LABELS[s]}"></div>\`).join('')}</div>
  </div>
  <div class="tab-bar">
    <div class="tab active" onclick="JT(this,'jt-info')">Info</div>
    <div class="tab" onclick="JT(this,'jt-scope')">Scope</div>
    <div class="tab" onclick="JT(this,'jt-workers')">Workers</div>
    <div class="tab" onclick="JT(this,'jt-parts')">Parts</div>
    <div class="tab" onclick="JT(this,'jt-daily')">Daily Reports</div>
    <div class="tab" onclick="JT(this,'jt-walks')">Job Walks</div>
    <div class="tab" onclick="JT(this,'jt-photos')">Photos</div>
    <div class="tab" onclick="JT(this,'jt-checklist')">Checklist</div>
    <div class="tab" onclick="JT(this,'jt-punch')">Punch List</div>
    <div class="tab" onclick="JT(this,'jt-pm')">PM Review</div>
    <div class="tab" onclick="JT(this,'jt-co')">Change Orders</div>
    <div class="tab" onclick="JT(this,'jt-fin')">Financials</div>
    <div class="tab" onclick="JT(this,'jt-subs')">Sub Assignments</div>
    <div class="tab" onclick="JT(this,'jt-asbuilts')">Plans &amp; As-builts</div>
    <div class="tab" onclick="JT(this,'jt-pmvisits')">PM Visits</div>
    <div class="tab" onclick="JT(this,'jt-docs')">Documents</div>
    <div class="tab" onclick="JT(this,'jt-log')">Daily Log</div>
  </div>
  <div id="jt-content" style="padding:16px"></div>\`
  _curTab='jt-info';loadJT('jt-info')
}
let _curTab=null
function JT(el,id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));el.classList.add('active')
  _curTab=id;loadJT(id)
}
async function loadJT(id){
  const el=document.getElementById('jt-content');if(!el)return
  el.innerHTML=ld()
  const j=currentJob
  if(id==='jt-info') renderInfoTab(el,j)
  else if(id==='jt-scope') renderScopeTab(el,j)
  else if(id==='jt-workers') await renderWorkersTab(el)
  else if(id==='jt-parts') await renderPartsTab(el)
  else if(id==='jt-daily') await renderJobDailyTab(el)
  else if(id==='jt-walks') await renderJobWalksTab(el)
  else if(id==='jt-photos') await renderPhotosTab(el)
  else if(id==='jt-checklist') await renderChecklistTab(el)
  else if(id==='jt-punch') await renderPunchTab(el)
  else if(id==='jt-pm') await renderPmTab(el)
  else if(id==='jt-co') await renderCOTab(el)
  else if(id==='jt-fin') await renderJobFinTab(el)
  else if(id==='jt-subs') await renderSubAssignTab(el)
  else if(id==='jt-asbuilts') await renderAsbuiltsTab(el)
  else if(id==='jt-pmvisits') await renderPmVisitsTab(el)
  else if(id==='jt-docs') await renderDocsTab(el)
  else if(id==='jt-log') await renderLogTab(el)
}
async function updateJobStage(phase){await sb.from('jobs').update({phase,updated_at:new Date().toISOString()}).eq('id',currentJobId);currentJob.phase=phase;toast('Stage updated')}
async function updateJobPct(pct){await sb.from('jobs').update({pct_complete:parseInt(pct)||0,updated_at:new Date().toISOString()}).eq('id',currentJobId);currentJob.pct_complete=parseInt(pct)||0;toast('Progress updated')}

// INFO TAB
function renderInfoTab(el,j){
  el.innerHTML=\`<div class="two">
  <div>
    <div class="fg"><label class="fl">Job Name</label><input class="fi" id="ed-name" value="\${j.name||''}"></div>
    <div class="fg" style="position:relative"><label class="fl">Project Address</label><input class="fi" id="ed-addr" value="\${j.address||''}" oninput="addrAC(this.value,'ed-addr-dd')"><div id="ed-addr-dd" class="addr-dd"></div></div>
    <div class="two"><div class="fg"><label class="fl">GPS Lat</label><input class="fi" id="ed-lat" value="\${j.gps_lat||''}" style="font-family:'DM Mono',monospace;font-size:11px"></div><div class="fg"><label class="fl">GPS Lng</label><input class="fi" id="ed-lng" value="\${j.gps_lng||''}" style="font-family:'DM Mono',monospace;font-size:11px"></div></div>
    <div class="fg"><label class="fl">Check-in Radius</label><select class="fs" id="ed-rad"><option value="100">100ft</option><option value="250">250ft</option><option value="500">500ft</option><option value="750">750ft</option><option value="1000">1000ft</option></select></div>
    <div class="fg"><label class="fl">GC Company</label><input class="fi" id="ed-gc" value="\${j.gc_company||''}"></div>
    <div class="two"><div class="fg"><label class="fl">GC Contact</label><input class="fi" id="ed-gcc" value="\${j.gc_contact||''}"></div><div class="fg"><label class="fl">GC Phone</label><input class="fi" id="ed-gcp" value="\${j.gc_phone||''}"></div></div>
    <div class="two"><div class="fg"><label class="fl">Superintendent</label><input class="fi" id="ed-sup" value="\${j.super_name||''}"></div><div class="fg"><label class="fl">Super Phone</label><input class="fi" id="ed-supp" value="\${j.super_phone||''}"></div></div>
    <div class="fg"><label class="fl">Project Manager (Internal)</label><select class="fs" id="ed-pm"><option value="">— Unassigned —</option></select></div>
    <div class="two"><div class="fg"><label class="fl">PM Visit Schedule</label><select class="fs" id="ed-pmschedule"><option value="none">No visits</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="milestone">Milestones only</option></select></div><div class="fg"><label class="fl">Next PM Visit Due</label><input class="fi" type="date" id="ed-pmvisit" value="\${j.next_pm_visit||''}"></div></div>
    <div class="fg"><label style="display:flex;align-items:center;gap:9px;cursor:pointer"><input type="checkbox" id="ed-urgent-pm" \${j.urgent_pm_visit?'checked':''} style="width:16px;height:16px;accent-color:#ef4444"><span style="font-size:13px">🔥 <strong>Urgent PM Visit Required</strong> — flags this job on the map with a fire icon</span></label></div>
  </div>
  <div>
    <div class="sec-hdr">Key Dates</div>
    <div class="two"><div class="fg"><label class="fl">Start Date</label><input class="fi" type="date" id="ed-start" value="\${j.date_start||''}"></div><div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="ed-due" value="\${j.due_date||''}"></div></div>
    <div class="two"><div class="fg"><label class="fl">Expected On Site</label><input class="fi" type="date" id="ed-eos" value="\${j.expected_onsite_date||''}"></div><div class="fg"><label class="fl">Next Visit Date</label><input class="fi" type="date" id="ed-nvd" value="\${j.next_visit_date||''}"></div></div>
    <div class="two"><div class="fg"><label class="fl">Rough-in</label><input class="fi" type="date" id="ed-dr" value="\${j.date_roughin||''}"></div><div class="fg"><label class="fl">Trim-out</label><input class="fi" type="date" id="ed-dt" value="\${j.date_trimout||''}"></div></div>
    <div class="two"><div class="fg"><label class="fl">Inspection</label><input class="fi" type="date" id="ed-di" value="\${j.date_inspection||''}"></div><div class="fg"><label class="fl">Closeout</label><input class="fi" type="date" id="ed-dco" value="\${j.date_closeout||''}"></div></div>
    <div class="fg"><label class="fl">Completion Date</label><input class="fi" type="date" id="ed-comp" value="\${j.completion_date||''}"></div>
    <div class="sec-hdr">Budget</div>
    <div class="two"><div class="fg"><label class="fl">Contract $</label><input class="fi" type="number" id="ed-cv" value="\${j.contract_value||''}"></div><div class="fg"><label class="fl">Labor Rate/hr</label><input class="fi" type="number" id="ed-lr" value="\${j.labor_rate||''}"></div></div>
    <div class="two"><div class="fg"><label class="fl">Labor Budget</label><input class="fi" type="number" id="ed-lb" value="\${j.labor_budget||''}"></div><div class="fg"><label class="fl">Material Budget</label><input class="fi" type="number" id="ed-mb" value="\${j.material_budget||''}"></div></div>
  </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:4px">
    <button class="btn btn-p" onclick="saveInfoTab()">Save Changes</button>
    <button class="btn btn-a" onclick="archiveJob()">Archive Job</button>
    \${ME?.role==='admin'?'<button class="btn" style="background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);color:#dc2626" onclick="deleteJobConfirm()">🗑 Delete Job</button>':''}
  </div>

  <!-- PERMITS & APPROVED PLANS -->
  <div class="sec-hdr" style="margin-top:18px">Permits & Approved Plans</div>
  <div id="job-permits-section">
    <div style="font-size:12px;color:#414e63">Loading…</div>
  </div>\`
  setTimeout(async()=>{
    document.getElementById('ed-rad').value=j.gps_radius_ft||250
    if(document.getElementById('ed-pmschedule'))document.getElementById('ed-pmschedule').value=j.pm_visit_schedule||'none'
    // Populate PM dropdown from employee list
    const{data:pmUsers}=await sb.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')
    const sel=document.getElementById('ed-pm')
    if(sel&&pmUsers){
      sel.innerHTML='<option value="">— Unassigned —</option>'+(pmUsers||[]).map(p=>'<option value="'+p.full_name+'"'+( j.project_manager===p.full_name?' selected':'')+'>'+p.full_name+' ('+p.role+')</option>').join('')
      if(j.project_manager&&!(pmUsers||[]).find(p=>p.full_name===j.project_manager)){
        sel.innerHTML+='<option value="'+j.project_manager+'" selected>'+j.project_manager+' (not in system)</option>'
      }
    }
  },50)
}

// ══════════════════════════════════════════
// PERMITS & APPROVED PLANS
// ══════════════════════════════════════════
const PERMIT_TYPES=['Permit','Approved Plan','Inspection Report','City Approval','Engineering Stamp','Other']

async function loadJobPermits(){
  const el=document.getElementById('job-permits-section')
  if(!el||!currentJobId)return
  const{data:permits}=await sb.from('job_documents')
    .select('*').eq('job_id',currentJobId).eq('doc_category','permit')
    .order('created_at',{ascending:false})
  renderPermitsList(el, permits||[])
}

function renderPermitsList(el, permits){
  let html=''
  if(permits.length){
    html+='<div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:8px;overflow:hidden;margin-bottom:10px">'
    html+=permits.map(p=>{
      const ext=(p.file_name||'').split('.').pop().toLowerCase()
      const icon=ext==='pdf'?'📄':['png','jpg','jpeg','gif'].includes(ext)?'🖼':'📎'
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<div style="font-size:18px;flex-shrink:0">'+icon+'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.file_name+'</div>'
        +'<div style="font-size:10px;color:#414e63;margin-top:1px">'+(p.doc_type||'Document')+' · Uploaded '+fd(p.created_at)+' by '+(p.uploaded_by||'—')+'</div>'
        +'</div>'
        +'<div style="display:flex;gap:5px;flex-shrink:0">'
        +(p.file_url?'<a href="'+p.file_url+'" target="_blank" class="btn btn-sm">⬇ View</a>':'')
        +'<button class="btn btn-sm" style="color:#dc2626" data-pid="'+p.id+'" onclick="deletePermit(this.dataset.pid)">✕</button>'
        +'</div>'
        +'</div>'
    }).join('')
    html+='</div>'
  }
  // Upload form
  html+='<div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 14px">'
  html+='<div style="font-size:11px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px">Upload Permit or Approved Plan</div>'
  html+='<div class="two" style="margin-bottom:9px">'
  html+='<div class="fg"><label class="fl">Document Type</label>'
  html+='<select class="fs" id="permit-type">'+PERMIT_TYPES.map(t=>'<option value="'+t+'">'+t+'</option>').join('')+'</select></div>'
  html+='<div class="fg"><label class="fl">Description (optional)</label><input class="fi" id="permit-desc" placeholder="e.g. Electrical permit 2024-001"></div>'
  html+='</div>'
  html+='<div id="permit-drop-zone" style="border:2px dashed rgba(255,255,255,.12);border-radius:7px;padding:20px;text-align:center;cursor:pointer;transition:.2s" '
  html+='ondragover="ondragover_permit(event)" '
  html+='ondragleave="ondragleave_permit(event)" '
  html+='ondrop="handlePermitDrop(event)" '
  html+='onclick="document.getElementById(\\"permit-file-input\\").click()">'
  html+='<div style="font-size:22px;margin-bottom:6px">📎</div>'
  html+='<div style="font-size:12px;color:#8a96ab">Click or drag & drop</div>'
  html+='<div style="font-size:10px;color:#414e63;margin-top:3px">PDF, PNG, JPG up to 20MB</div>'
  html+='<input type="file" id="permit-file-input" style="display:none" accept=".pdf,.png,.jpg,.jpeg,.gif" onchange="uploadPermitFile(this.files[0])">'
  html+='</div>'
  html+='<div id="permit-upload-progress" style="display:none;margin-top:8px;font-size:11px;color:#414e63"></div>'
  html+='</div>'
  el.innerHTML=html
}

function ondragover_permit(e){e.preventDefault();e.currentTarget.style.borderColor='rgba(37,99,235,.6)'}
function ondragleave_permit(e){e.currentTarget.style.borderColor='rgba(255,255,255,.12)'}
function handlePermitDrop(e){
  e.preventDefault()
  document.getElementById('permit-drop-zone').style.borderColor='rgba(255,255,255,.12)'
  const file=e.dataTransfer.files[0]
  if(file)uploadPermitFile(file)
}

async function uploadPermitFile(file){
  if(!file)return
  const maxMB=20
  if(file.size>maxMB*1024*1024){toast('File too large — max '+maxMB+'MB','error');return}
  const prog=document.getElementById('permit-upload-progress')
  if(prog){prog.style.display='block';prog.textContent='Uploading…'}
  try{
    const docType=document.getElementById('permit-type')?.value||'Permit'
    const desc=document.getElementById('permit-desc')?.value||''
    const ext=file.name.split('.').pop()
    const path='permits/'+currentJobId+'/'+uuid()+'.'+ext
    // Try Supabase storage
    let fileUrl=null
    const{data:upData,error:upErr}=await sb.storage.from('fieldtrack-plans').upload(path,file,{contentType:file.type,upsert:false})
    if(!upErr){
      const{data:urlData}=sb.storage.from('fieldtrack-plans').getPublicUrl(path)
      fileUrl=urlData?.publicUrl
    }
    // Store record
    const{error}=await sb.from('job_documents').insert({
      id:uuid(),job_id:currentJobId,
      doc_category:'permit',
      doc_type:docType,
      file_name:desc||file.name,
      file_url:fileUrl,
      storage_path:path,
      uploaded_by:ME?.full_name,
      created_at:new Date().toISOString()
    })
    if(error)throw error
    if(prog)prog.style.display='none'
    toast(docType+' uploaded')
    loadJobPermits()
  }catch(e){
    if(prog){prog.textContent='Upload failed: '+e.message;prog.style.color='#dc2626'}
    toast('Upload failed: '+e.message,'error')
  }
}

async function deletePermit(id){
  if(!confirm('Delete this document?'))return
  const{data:doc}=await sb.from('job_documents').select('storage_path').eq('id',id).single()
  if(doc?.storage_path)await sb.storage.from('fieldtrack-plans').remove([doc.storage_path]).catch(()=>{})
  await sb.from('job_documents').delete().eq('id',id)
  toast('Deleted','warn')
  loadJobPermits()
}

async function saveInfoTab(){
  const u={name:v('ed-name'),address:v('ed-addr'),gps_lat:fN('ed-lat'),gps_lng:fN('ed-lng'),gps_radius_ft:parseInt(v('ed-rad'))||250,gc_company:v('ed-gc'),gc_contact:v('ed-gcc'),gc_phone:v('ed-gcp'),super_name:v('ed-sup'),super_phone:v('ed-supp'),project_manager:v('ed-pm'),pm_visit_schedule:v('ed-pmschedule')||'none',next_pm_visit:v('ed-pmvisit')||null,urgent_pm_visit:document.getElementById('ed-urgent-pm')?.checked||false,date_start:v('ed-start')||null,due_date:v('ed-due')||null,expected_onsite_date:v('ed-eos')||null,next_visit_date:v('ed-nvd')||null,date_roughin:v('ed-dr')||null,date_trimout:v('ed-dt')||null,date_inspection:v('ed-di')||null,date_closeout:v('ed-dco')||null,completion_date:v('ed-comp')||null,contract_value:fN('ed-cv'),labor_rate:fN('ed-lr'),labor_budget:fN('ed-lb'),material_budget:fN('ed-mb'),updated_at:new Date().toISOString()}
  const{error}=await sb.from('jobs').update(u).eq('id',currentJobId)
  if(error){toast(error.message,'error');return}
  currentJob={...currentJob,...u};document.getElementById('page-title').textContent=u.name;toast('Saved')
}
async function archiveJob(){if(!confirm('Archive this job?'))return;await sb.from('jobs').update({archived:true}).eq('id',currentJobId);toast('Archived');P('jobs',null)}

async function deleteJobConfirm(){
  // Guard: admin only
  if(ME?.role!=='admin'){toast('Only admins can delete jobs','error');return}
  const jobName=currentJob?.name||'this job'
  // Step 1: First confirmation
  const step1=confirm('DELETE JOB — Step 1 of 2\\n\\nYou are about to permanently delete:\\n"'+jobName+'"\\n\\nThis will also delete ALL associated data including:\\n• Daily reports\\n• Parts & materials\\n• Photos\\n• Checklists & punch lists\\n• Job walks & plans\\n• Hours & check-ins\\n\\nThis CANNOT be undone.\\n\\nClick OK to continue to step 2.')
  if(!step1)return
  // Step 2: Type job name to confirm
  const typed=prompt('DELETE JOB — Step 2 of 2\\n\\nTo confirm deletion, type the job name exactly as shown below:\\n\\n'+jobName)
  if(typed===null)return // cancelled
  if(typed.trim()!==jobName.trim()){
    toast('Job name did not match — deletion cancelled','error')
    return
  }
  // Perform delete
  const btn=event?.target
  if(btn){btn.disabled=true;btn.textContent='Deleting…'}
  try{
    // Delete in correct order to respect foreign keys
    await sb.from('dispatch_assignments').delete().eq('job_id',currentJobId)
    await sb.from('daily_reports').delete().eq('job_id',currentJobId)
    await sb.from('job_parts').delete().eq('job_id',currentJobId)
    await sb.from('job_photos').delete().eq('job_id',currentJobId)
    await sb.from('job_checklist_items').delete().eq('job_id',currentJobId)
    await sb.from('punch_list').delete().eq('job_id',currentJobId)
    await sb.from('job_walks').delete().eq('job_id',currentJobId)
    await sb.from('job_walk_plans').delete().eq('job_id',currentJobId)
    await sb.from('pm_visits').delete().eq('job_id',currentJobId)
    await sb.from('pm_inspections').delete().eq('job_id',currentJobId)
    await sb.from('change_orders').delete().eq('job_id',currentJobId)
    await sb.from('job_sub_assignments').delete().eq('job_id',currentJobId)
    await sb.from('job_workers').delete().eq('job_id',currentJobId)
    await sb.from('checkins').delete().eq('job_id',currentJobId)
    await sb.from('job_documents').delete().eq('job_id',currentJobId)
    await sb.from('notifications').delete().eq('meta->>job_id',currentJobId)
    // Finally delete the job itself
    const{error}=await sb.from('jobs').delete().eq('id',currentJobId)
    if(error)throw error
    toast('"'+jobName+'" permanently deleted')
    P('jobs',null)
  }catch(e){
    toast('Delete failed: '+e.message,'error')
    if(btn){btn.disabled=false;btn.textContent='🗑 Delete Job'}
  }
}
function renderScopeTab(el,j){
  el.innerHTML=\`
  <div class="fg"><label class="fl">Scope of Work</label><textarea class="ft" id="sc-scope" style="min-height:120px">\${j.scope||''}</textarea></div>
  <div class="fg"><label class="fl">Install Notes</label><textarea class="ft" id="sc-notes">\${j.install_notes||''}</textarea></div>
  <div class="fg"><label class="fl">Job Walk Notes</label><textarea class="ft" id="sc-jwn">\${j.job_walk_notes||''}</textarea></div>
  <div class="two"><div class="fg"><label class="fl">Job Walk By</label><input class="fi" id="sc-jwb" value="\${j.job_walk_by||''}"></div><div class="fg"><label class="fl">Job Walk Date</label><input class="fi" type="date" id="sc-jwd" value="\${j.job_walk_date||''}"></div></div>
  <button class="btn btn-p" onclick="saveScope()">Save</button>\`
}
async function saveScope(){const{error}=await sb.from('jobs').update({scope:v('sc-scope'),install_notes:v('sc-notes'),job_walk_notes:v('sc-jwn'),job_walk_by:v('sc-jwb'),job_walk_date:v('sc-jwd')||null,updated_at:new Date().toISOString()}).eq('id',currentJobId);if(error)toast(error.message,'error');else toast('Saved')}

// ADDRESS AUTOCOMPLETE
let _addrDeb=null
async function addrAC(val,ddId){
  clearTimeout(_addrDeb);const dd=document.getElementById(ddId);if(!dd)return
  if(val.length<4){dd.style.display='none';return}
  _addrDeb=setTimeout(async()=>{try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(val)+'&format=json&limit=5&countrycodes=us',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();if(!j.length){dd.style.display='none';return};dd.innerHTML=j.map(x=>\`<div class="addr-item" onclick="selAddr('\${x.display_name.replace(/'/g,"\\\\'")}','\${x.lat}','\${x.lon}','\${ddId}')">\${x.display_name.substring(0,80)}</div>\`).join('');dd.style.display='block'}catch{}},350)
}
function selAddr(label,lat,lng,ddId){
  const dd=document.getElementById(ddId);if(dd)dd.style.display='none'
  if(ddId==='ed-addr-dd'){document.getElementById('ed-addr').value=label;document.getElementById('ed-lat').value=lat;document.getElementById('ed-lng').value=lng;toast('GPS set')}
  if(ddId==='nj-addr-dd'){document.getElementById('nj-addr').value=label;document.getElementById('nj-lat').value=lat;document.getElementById('nj-lng').value=lng;document.getElementById('nj-gps-ok').style.display='block';document.getElementById('nj-coords').textContent=parseFloat(lat).toFixed(5)+', '+parseFloat(lng).toFixed(5);toast('GPS set')}
}
document.addEventListener('click',e=>{document.querySelectorAll('.addr-dd').forEach(dd=>{if(!dd.contains(e.target))dd.style.display='none'})})
// WORKERS TAB
async function renderWorkersTab(el){
  const[{data:workers},{data:ci}]=await Promise.all([
    sb.from('job_workers').select('id,worker_id,is_active').eq('job_id',currentJobId).eq('is_active',true),
    sb.from('checkins').select('*').eq('job_id',currentJobId).order('checkin_at',{ascending:false})
  ])
  const wIds2=(workers||[]).map(w=>w.worker_id).filter(Boolean)
  const{data:wProfiles}=wIds2.length?await sb.from('profiles').select('id,full_name,email,is_lead').in('id',wIds2):{data:[]}
  const totalHrs=(ci||[]).reduce((s,c)=>s+(c.hours_logged||0),0)
  el.innerHTML=\`
  <div class="sec-hdr">Assigned Workers <button class="btn btn-sm btn-p" onclick="addWorkerModal()">+ Add</button></div>
  \${(workers||[]).map(w=>{const p=wProfiles.find(x=>x.id===w.worker_id)||{};return\`<div style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:#131c2e;border:1px solid rgba(255,255,255,.06);border-radius:7px;margin-bottom:6px"><div class="av" style="width:28px;height:28px;font-size:10px;\${Object.entries(avS(p.full_name)).map(([k,val])=>k+':'+val).join(';')}">\${ini(p.full_name)}</div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${p.full_name||'?'}\${p.is_lead?' <span style="font-size:9px;color:#d97706">LEAD</span>':''}</div><div style="font-size:10px;color:#414e63">\${p.email||''}</div></div><button class="btn btn-sm btn-ghost" style="color:#dc2626" onclick="removeWorker('\${w.id}')">Remove</button></div>\`}).join('')||'<div style="font-size:12px;color:#414e63;margin-bottom:12px">No workers assigned</div>'}
  <div class="sec-hdr" style="margin-top:14px">GPS Check-in Log</div>
  \${(ci||[]).length?\`<table class="tbl"><thead><tr><th>Worker</th><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Distance</th></tr></thead><tbody>\${(ci||[]).map(c=>\`<tr><td>\${c.workerName||'?'}</td><td style="font-size:11px;color:#8a96ab">\${fd(c.checkin_at)}</td><td style="font-size:11px">\${ft(c.checkin_at)}</td><td style="font-size:11px">\${c.checkout_at?ft(c.checkout_at):'<span class="gps-live" style="font-size:9px"><span class="pulse"></span>Active</span>'}</td><td style="font-weight:500">\${c.hours_logged?fh(c.hours_logged):'—'}</td><td>\${c.checkin_dist_ft!=null?\`<span class="badge bg-green">\${c.checkin_dist_ft}ft</span>\`:'—'}</td></tr>\`).join('')}</tbody></table>\`:'<div style="font-size:12px;color:#414e63">No check-ins yet</div>'}
  <div style="margin-top:11px;background:#131c2e;border:1px solid rgba(255,255,255,.06);border-radius:7px;padding:10px 13px;display:flex;gap:20px">
    <div><div style="font-size:10px;color:#414e63">TOTAL HOURS</div><div style="font-size:20px;font-weight:300;margin-top:2px">\${fh(totalHrs)}</div></div>
    <div><div style="font-size:10px;color:#414e63">EST LABOR COST</div><div style="font-size:20px;font-weight:300;margin-top:2px;color:#60a5fa">\${fm(totalHrs*(currentJob?.labor_rate||0))}</div></div>
  </div>\`
}
async function addWorkerModal(){
  const{data:all}=await sb.from('profiles').select('id,full_name,email').eq('is_active',true)
  const{data:ex}=await sb.from('job_workers').select('worker_id').eq('job_id',currentJobId).eq('is_active',true)
  const exIds=new Set((ex||[]).map(e=>e.worker_id))
  modal('Add Worker',\`<div class="fg"><label class="fl">Select Worker</label><select class="fs" id="aw-sel"><option value="">— Select —</option>\${(all||[]).filter(w=>!exIds.has(w.id)).map(w=>\`<option value="\${w.id}">\${w.full_name} (\${w.email||''})</option>\`).join('')}</select></div>\`,
  async()=>{const wid=v('aw-sel');if(!wid)return;await sb.from('job_workers').upsert({id:uuid(),job_id:currentJobId,worker_id:wid,is_active:true,added_by:ME?.full_name,added_at:new Date().toISOString()},{onConflict:'job_id,worker_id'});closeModal();toast('Added');loadJT('jt-workers')})
}
async function removeWorker(id){await sb.from('job_workers').update({is_active:false}).eq('id',id);toast('Removed');loadJT('jt-workers')}


function buildPartsTable(parts){
  if(!parts||!parts.length) return empty('📦','No parts on this job yet — use Scan Parts to add')
  // Check for variance
  const overParts=parts.filter(p=>(p.installed_qty||0)>p.assigned_qty)
  const underParts=parts.filter(p=>p.status==='installed'&&(p.installed_qty||0)<p.assigned_qty)
  let varHtml=''
  if(overParts.length) varHtml+='<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:7px;padding:9px 12px;margin-bottom:9px;font-size:12px;color:#dc2626">⚠ Over-issued: '+overParts.map(p=>p.part_name+' (assigned '+p.assigned_qty+', installed '+(p.installed_qty||0)+')').join(', ')+'</div>'
  if(underParts.length) varHtml+='<div style="background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.2);border-radius:7px;padding:9px 12px;margin-bottom:9px;font-size:12px;color:#d97706">⚠ Under-installed: '+underParts.map(p=>p.part_name+' (assigned '+p.assigned_qty+', installed '+(p.installed_qty||0)+')').join(', ')+'</div>'
  return varHtml+'<table class="tbl"><thead><tr><th>Part Name</th><th>Barcode</th><th>Assigned</th><th>Installed</th><th>Remaining</th><th>Status</th><th>Staged By</th><th>Checked Out By</th></tr></thead><tbody>'+
    parts.map(p=>{
      const installed=p.installed_qty||0
      const remaining=p.assigned_qty-installed
      const pct=p.assigned_qty>0?Math.round(installed/p.assigned_qty*100):0
      const bc=p.status==='staged'?'bg-amber':p.status==='signed_out'?'bg-blue':p.status==='installed'?'bg-green':p.status==='partial_install'?'bg-teal':'bg-gray'
      const varColor=installed>p.assigned_qty?'color:#dc2626':remaining===0?'color:#16a34a':'color:#8a96ab'
      return '<tr><td style="font-weight:500">'+p.part_name+'</td>'+
        '<td style="font-size:10px;color:#414e63">'+p.part_id+'</td>'+
        '<td style="font-weight:500">'+p.assigned_qty+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:7px"><div class="pbar" style="width:50px"><div class="pb g" style="width:'+Math.min(100,pct)+'%"></div></div><span style="font-size:11px;'+varColor+'">'+installed+'</span></div></td>'+
        '<td style="font-size:12px;'+varColor+'">'+remaining+'</td>'+
        '<td><span class="badge '+bc+'">'+p.status.replace(/_/g,' ')+'</span></td>'+
        '<td style="font-size:11px;color:#8a96ab">'+(p.staged_by||'—')+'</td>'+
        '<td style="font-size:11px;color:#8a96ab">'+(p.checked_out_by||'—')+'</td></tr>'
    }).join('')+'</tbody></table>'
}

// PARTS TAB (per job view)
async function renderPartsTab(el){
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  el.innerHTML=\`
  <div style="display:flex;gap:8px;margin-bottom:13px">
    <button class="btn btn-p btn-sm" onclick="P('scan',null)">📷 Go to Scanner</button>
    <button class="btn btn-sm" onclick="loadJT('jt-parts')">↻ Refresh</button>
    <button class="btn btn-a btn-sm" onclick="checkPartsVariance('\${currentJobId}').then(()=>loadJT('jt-parts'))">⚠ Check Variance</button>
  </div>
  <div class="stats" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat"><div class="stat-label">Staged</div><div class="stat-value" style="color:#d97706">\${(parts||[]).filter(p=>p.status==='staged').length}</div></div>
    <div class="stat"><div class="stat-label">Checked Out</div><div class="stat-value" style="color:#60a5fa">\${(parts||[]).filter(p=>p.status==='signed_out').length}</div></div>
    <div class="stat"><div class="stat-label">Installed</div><div class="stat-value" style="color:#16a34a">\${(parts||[]).filter(p=>p.status==='installed').length}</div></div>
    <div class="stat"><div class="stat-label">Total Items</div><div class="stat-value">\${(parts||[]).reduce((s,p)=>s+p.assigned_qty,0)}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  \${buildPartsTable(parts)}
  </div>\`
}

// DAILY REPORTS TAB (per job)
async function renderJobDailyTab(el){
  const{data:reports}=await sb.from('daily_reports').select('*').eq('job_id',currentJobId).order('report_date',{ascending:false})
  el.innerHTML=\`
  <div style="margin-bottom:12px"><button class="btn btn-p btn-sm" onclick="newDailyModal('\${currentJobId}')">+ New Daily Report</button></div>
  \${(reports||[]).map(r=>\`<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px"><div><div style="font-weight:600;font-size:13px">\${fd(r.report_date)}</div><div style="font-size:11px;color:#414e63">By \${r.submitted_by||'—'} · \${r.crew_count} crew · \${fh(r.hours_worked)} worked</div></div><span class="badge bg-blue">\${r.weather||'N/A'} \${r.temp_high?r.temp_high+'°/'+r.temp_low+'°':''}</span></div>
  \${r.work_performed?\`<div style="margin-bottom:8px"><div style="font-size:10px;color:#414e63;margin-bottom:3px">WORK PERFORMED</div><div style="font-size:12px;color:#8a96ab;white-space:pre-wrap">\${r.work_performed}</div></div>\`:''}
  \${r.issues?\`<div style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.15);border-radius:7px;padding:8px 10px;font-size:12px;color:#dc2626">\${r.issues}</div>\`:''}
  <div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-sm" onclick="emailReport(\${JSON.stringify(r).replace(/"/g,'&quot;')})">📧 Email Report</button><button class="btn btn-sm btn-ghost" onclick="dlDailyReport(\${JSON.stringify(r).replace(/"/g,'&quot;')})">⬇ Download</button></div></div>\`).join('')||empty('📋','No daily reports for this job')}\` 
}
function dlDailyReport(r){
  const jobName=_drJobs&&_drJobs[r.job_id]?_drJobs[r.job_id]:currentJob?.name||r.job_id||'Unknown'
  const content=\`DAILY REPORT\\n\${'='.repeat(40)}\\nJob: \${jobName}\\nDate: \${fd(r.report_date)}\\nSubmitted By: \${r.submitted_by||'—'}\\nCrew Count: \${r.crew_count}\\nHours Worked: \${fh(r.hours_worked)}\\nWeather: \${r.weather} \${r.temp_high?r.temp_high+'°/'+r.temp_low+'°':''}\\n\\nWORK PERFORMED:\\n\${r.work_performed||'—'}\\n\\nMATERIALS USED:\\n\${r.materials_used||'—'}\\n\\nEQUIPMENT USED:\\n\${r.equipment_used||'—'}\\n\\nISSUES:\\n\${r.issues||'None'}\\n\\nVISITORS:\\n\${r.visitors||'None'}\`
  const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(content);a.download='Daily-Report-'+r.report_date+'.txt';a.click()
}
function emailReport(r){
  const subject=encodeURIComponent('Daily Report — '+currentJob?.name+' — '+fd(r.report_date))
  const body=encodeURIComponent('Daily Report\\n\\nJob: '+currentJob?.name+'\\nDate: '+fd(r.report_date)+'\\nCrew: '+r.crew_count+'\\n\\nWork Performed:\\n'+r.work_performed+'\\n\\nIssues:\\n'+(r.issues||'None'))
  window.open('mailto:?subject='+subject+'&body='+body)
}

// JOB WALKS TAB (per job)
async function renderJobWalksTab(el){
  const{data:walks}=await sb.from('job_walks').select('*').eq('job_id',currentJobId).order('walk_date',{ascending:false})
  el.innerHTML=\`
  <div style="margin-bottom:12px"><button class="btn btn-p btn-sm" onclick="newWalkModal('\${currentJobId}')">+ New Job Walk</button></div>
  \${(walks||[]).map(w=>\`<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="openJobWalk('\${w.id}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px"><div><div style="font-weight:600;font-size:13px">Job Walk — \${fd(w.walk_date)}</div><div style="font-size:11px;color:#414e63">By \${w.walked_by||'—'} · \${w.attendees||'No attendees listed'}</div></div><span class="badge \${w.status==='complete'?'bg-green':'bg-amber'}">\${w.status}</span></div>
  \${w.scope_notes?\`<div style="font-size:12px;color:#8a96ab;margin-bottom:6px">\${w.scope_notes.substring(0,150)}\${w.scope_notes.length>150?'…':''}</div>\`:''}
  \${w.issues_found?\`<div style="font-size:11px;color:#d97706">⚠ Issues: \${w.issues_found.substring(0,100)}</div>\`:''}
  <div style="font-size:10px;color:#414e63;margin-top:5px">Click to view details & markup plans →</div></div>\`).join('')||empty('🚶','No job walks recorded yet')}\` 
}

async function openJobWalk(walkId){
  const{data:walk}=await sb.from('job_walks').select('*').eq('id',walkId).single()
  const{data:plans}=await sb.from('job_walk_plans').select('*').eq('job_walk_id',walkId)
  modal('Job Walk — '+fd(walk.walk_date),\`
  <div class="two" style="margin-bottom:12px">
    <div><div style="font-size:10px;color:#414e63">WALKED BY</div><div style="font-size:13px;font-weight:500;margin-top:2px">\${walk.walked_by||'—'}</div></div>
    <div><div style="font-size:10px;color:#414e63">ATTENDEES</div><div style="font-size:13px;font-weight:500;margin-top:2px">\${walk.attendees||'—'}</div></div>
  </div>
  \${walk.scope_notes?\`<div style="margin-bottom:10px"><div style="font-size:10px;color:#414e63;margin-bottom:3px">SCOPE NOTES</div><div style="font-size:12px;color:#8a96ab;white-space:pre-wrap">\${walk.scope_notes}</div></div>\`:''}
  \${walk.issues_found?\`<div style="margin-bottom:10px;background:rgba(220,38,38,.08);border-radius:7px;padding:9px 11px"><div style="font-size:10px;color:#dc2626;margin-bottom:3px">ISSUES FOUND</div><div style="font-size:12px;color:#dc2626;white-space:pre-wrap">\${walk.issues_found}</div></div>\`:''}
  \${walk.action_items?\`<div style="margin-bottom:10px"><div style="font-size:10px;color:#414e63;margin-bottom:3px">ACTION ITEMS</div><div style="font-size:12px;color:#8a96ab;white-space:pre-wrap">\${walk.action_items}</div></div>\`:''}
  <div class="sec-hdr">Plans & Markup</div>
  \${(plans||[]).length?(plans||[]).map(p=>\`<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div>📄</div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${p.file_name}</div></div><button class="btn btn-sm" onclick="openMarkup('\${p.id}','\${p.url}','\${walk.id}')">✏ Markup</button><a href="\${p.url}" target="_blank" class="btn btn-sm">View</a></div>\`).join(''):'<div style="font-size:12px;color:#414e63;margin-bottom:8px">No plans uploaded</div>'}
  <label class="btn btn-sm btn-p" style="cursor:pointer;margin-top:6px">+ Upload Plan<input type="file" style="display:none" accept=".pdf,.png,.jpg,.jpeg" onchange="uploadWalkPlan(this.files,'\${walkId}')"></label>\`,
  ()=>closeModal(),'Close',false)
  document.getElementById('modal-footer').innerHTML='<button class="btn" onclick="closeModal()">Close</button>'
}

// MARKUP PAGE
async function openMarkup(planId,planUrl,walkId){
  closeModal()
  // Load existing markup
  const{data:plan}=await sb.from('job_walk_plans').select('*').eq('id',planId).single()
  const markup=plan?.markup_json||{dots:[],textboxes:[],legend:[]}
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
    <button class="btn btn-sm" onclick="openJobWalk('\${walkId}')">← Back</button>
    <span style="font-size:13px;font-weight:500">\${plan?.file_name||'Plan'} — Markup</span>
    <button class="btn btn-sm btn-p" onclick="saveMarkup('\${planId}')">💾 Save Markup</button>
    <button class="btn btn-sm btn-g" onclick="downloadMarkup()">⬇ Download</button>
  </div>
  <div class="two" style="gap:14px">
    <div>
      <div class="markup-toolbar">
        <span style="font-size:10px;color:#414e63;margin-right:4px">MODE:</span>
        <button class="mt-btn active" id="mt-dot" onclick="setMT('dot',this)">● Dot</button>
        <button class="mt-btn" id="mt-text" onclick="setMT('text',this)">T Text</button>
        <button class="mt-btn" id="mt-move" onclick="setMT('move',this)">✋ Move</button>
        <button class="mt-btn" id="mt-del" onclick="setMT('del',this)">🗑 Delete</button>
        <span style="font-size:10px;color:#414e63;margin-left:8px">COLOR:</span>
        \${['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#0d9488','#ec4899','#000000'].map(c=>\`<div class="dot-swatch" style="background:\${c}" onclick="setDotColor('\${c}',this)" title="\${c}"></div>\`).join('')}
        <span style="font-size:10px;color:#414e63;margin-left:8px">SIZE:</span>
        <select class="fi" style="width:60px;padding:3px 5px;font-size:11px" id="dot-size-sel"><option value="8">S</option><option value="12" selected>M</option><option value="18">L</option><option value="24">XL</option></select>
      </div>
      <div class="markup-canvas-wrap">
        <canvas id="markup-canvas" width="800" height="600"></canvas>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Legend <button class="btn btn-sm btn-p" onclick="addLegendItem()">+ Add</button></div>
        <div id="legend-list"></div>
      </div>
      <div class="card" style="margin-top:10px">
        <div class="card-title">Text Boxes</div>
        <div id="textbox-list"></div>
      </div>
    </div>
  </div>\`
  initMarkupCanvas(planUrl, markup, planId)
}

let _markup={dots:[],textboxes:[],legend:[]},_mtMode='dot',_dotColor='#dc2626',_selectedId=null
function setMT(mode,btn){_mtMode=mode;document.querySelectorAll('.mt-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
function setDotColor(c,el){_dotColor=c;document.querySelectorAll('.dot-swatch').forEach(s=>s.classList.remove('sel'));el.classList.add('sel')}

function initMarkupCanvas(url, existingMarkup, planId){
  _markup=JSON.parse(JSON.stringify(existingMarkup))
  const canvas=document.getElementById('markup-canvas')
  if(!canvas)return
  const ctx=canvas.getContext('2d')
  const img=new Image();img.crossOrigin='anonymous'
  img.onload=()=>{
    canvas.width=img.naturalWidth||800;canvas.height=img.naturalHeight||600
    canvas.style.maxWidth='100%'
    drawMarkup(ctx,img)
    renderLegend();renderTextboxList()
  }
  img.onerror=()=>{ctx.fillStyle='#1a2540';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#414e63';ctx.font='16px DM Sans';ctx.textAlign='center';ctx.fillText('PDF preview not available — download to view',canvas.width/2,canvas.height/2);ctx.fillText('Dots and text will still be saved',canvas.width/2,canvas.height/2+30);drawMarkup(ctx,null)}
  img.src=url
  canvas.onclick=e=>{
    const rect=canvas.getBoundingClientRect()
    const scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height
    const cx=(e.clientX-rect.left)*scaleX,cy=(e.clientY-rect.top)*scaleY
    if(_mtMode==='dot'){
      const size=parseInt(document.getElementById('dot-size-sel')?.value||12)
      _markup.dots.push({id:uuid(),x:cx,y:cy,color:_dotColor,size,label:''})
      drawMarkup(ctx,img);renderLegend()
    } else if(_mtMode==='text'){
      const txt=prompt('Enter text:');if(!txt)return
      _markup.textboxes.push({id:uuid(),x:cx,y:cy,text:txt,color:'#e8edf5',size:14})
      drawMarkup(ctx,img);renderTextboxList()
    } else if(_mtMode==='del'){
      const hit=findHit(cx,cy)
      if(hit){if(hit.type==='dot')_markup.dots=_markup.dots.filter(d=>d.id!==hit.id);else _markup.textboxes=_markup.textboxes.filter(t=>t.id!==hit.id);drawMarkup(ctx,img);renderLegend();renderTextboxList()}
    }
  }
}
function findHit(cx,cy){
  for(const d of _markup.dots){if(Math.sqrt((cx-d.x)**2+(cy-d.y)**2)<d.size+4)return{...d,type:'dot'}}
  for(const t of _markup.textboxes){if(cx>t.x-5&&cx<t.x+150&&cy>t.y-t.size&&cy<t.y+5)return{...t,type:'text'}}
  return null
}
function drawMarkup(ctx,img){
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height)
  if(img)ctx.drawImage(img,0,0)
  for(const d of _markup.dots){ctx.beginPath();ctx.arc(d.x,d.y,d.size/2,0,Math.PI*2);ctx.fillStyle=d.color;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.stroke();if(d.label){ctx.fillStyle=d.color;ctx.font='11px DM Sans';ctx.fillText(d.label,d.x+d.size/2+3,d.y+4)}}
  for(const t of _markup.textboxes){ctx.font=t.size+'px DM Sans';ctx.fillStyle='rgba(0,0,0,.6)';const w=ctx.measureText(t.text).width;ctx.fillRect(t.x-2,t.y-t.size,w+4,t.size+4);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,t.y)}
}
function renderLegend(){
  const el=document.getElementById('legend-list');if(!el)return
  el.innerHTML=_markup.legend.map((l,i)=>\`<div class="legend-item"><div style="width:14px;height:14px;border-radius:50%;background:\${l.color};flex-shrink:0;border:1.5px solid rgba(255,255,255,.3)"></div><input style="flex:1;background:transparent;border:none;color:#e8edf5;font-size:12px;font-family:'DM Sans',sans-serif" value="\${l.label}" oninput="_markup.legend[\${i}].label=this.value" placeholder="Legend entry…"><button onclick="_markup.legend.splice(\${i},1);renderLegend()" style="background:none;border:none;cursor:pointer;color:#414e63;font-size:14px">×</button></div>\`).join('')||'<div style="font-size:11px;color:#414e63">Add legend entries to explain your dots</div>'
}
function addLegendItem(){_markup.legend.push({id:uuid(),color:_dotColor,label:''});renderLegend()}
function renderTextboxList(){
  const el=document.getElementById('textbox-list');if(!el)return
  el.innerHTML=_markup.textboxes.map((t,i)=>\`<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="font-size:11px;flex:1;color:#8a96ab">\${t.text}</div><button onclick="_markup.textboxes.splice(\${i},1);renderTextboxList();const c=document.getElementById('markup-canvas');if(c){const ctx=c.getContext('2d');drawMarkup(ctx,document.querySelector('#markup-canvas + img')||null)}" style="background:none;border:none;cursor:pointer;color:#414e63;font-size:14px">×</button></div>\`).join('')||'<div style="font-size:11px;color:#414e63">No text boxes added</div>'
}
async function saveMarkup(planId){
  const{error}=await sb.from('job_walk_plans').update({markup_json:_markup}).eq('id',planId)
  if(error)toast(error.message,'error');else toast('Markup saved')
}
async function downloadMarkup(){
  const canvas=document.getElementById('markup-canvas');if(!canvas)return
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='plan-markup-'+new Date().toISOString().split('T')[0]+'.png';a.click();toast('Downloading…')
}
async function uploadWalkPlan(files,walkId){
  for(const f of files){
    const path=\`walks/\${walkId}/plans/\${Date.now()}_\${f.name}\`
    const{error,data}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true})
    if(!error){const{data:{publicUrl}}=sb.storage.from('fieldtrack-plans').getPublicUrl(path);await sb.from('job_walk_plans').insert({id:uuid(),job_walk_id:walkId,job_id:currentJobId,file_name:f.name,storage_path:path,url:publicUrl,markup_json:{dots:[],textboxes:[],legend:[]},created_at:new Date().toISOString()})}
  }
  toast('Plan uploaded');openJobWalk(walkId)
}

// PHOTOS TAB
async function renderPhotosTab(el){
  const{data:photos}=await sb.from('job_photos').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  const photoList=photos||[]
  // Build upload zone
  let html='<label class="upload-zone" style="margin-bottom:12px;cursor:pointer;display:block;text-align:center;padding:18px;border:2px dashed rgba(255,255,255,.1);border-radius:9px">'
  html+='<input type="file" multiple accept="image/*" onchange="uploadPhotos(this.files)" style="display:none">'
  html+='<div style="font-size:28px;color:#414e63">📷</div>'
  html+='<div style="font-size:12px;color:#8a96ab;margin-top:6px">Click to upload photos</div>'
  html+='<div style="font-size:10px;color:#414e63;margin-top:3px">JPG, PNG, HEIC — multiple allowed</div>'
  html+='</label>'
  html+='<div id="photo-upload-status"></div>'
  if(!photoList.length){el.innerHTML=html+empty('📷','No photos yet — click above to upload');return}
  html+='<div style="font-size:11px;color:#414e63;margin-bottom:8px">'+photoList.length+' photo'+(photoList.length!==1?'s':'')+'</div>'
  html+='<div class="photo-grid">'
  for(const p of photoList){
    if(p.url){
      html+='<img src="'+p.url+'" class="photo-thumb" loading="lazy" style="cursor:pointer" data-url="'+p.url+'" onclick="openPhoto(this)" onerror="this.style.opacity=.3">'
    } else {
      html+='<div style="height:100px;display:flex;align-items:center;justify-content:center;color:#414e63;font-size:24px">🖼</div>'
    }



    html+='<div style="padding:5px 7px;display:flex;align-items:center;justify-content:space-between">'
    html+='<div style="font-size:10px;color:#8a96ab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">'+(p.file_name||p.type||'photo')+'</div>'
    html+='<button data-pid="'+p.id+'" data-sp="'+(p.storage_path||'')+'" data-pu="'+(p.url||'')+'" '+
      'onclick="deleteJobPhoto(this.dataset.pid,this.dataset.sp,this.dataset.pu)" '+
      'style="background:none;border:none;cursor:pointer;color:#414e63;font-size:12px;padding:2px 4px" title="Delete">✕</button>'
    html+='</div></div>'
  }
  html+='</div>'
  el.innerHTML=html
}

async function uploadPhotos(files){
  const el=document.getElementById('photo-upload-status')
  if(el)el.innerHTML='<div style="font-size:11px;color:#414e63">Uploading '+files.length+' photo'+(files.length>1?'s':'')+'…</div>'
  let ok=0,fail=0
  for(const f of files){
    try{
      const path='jobs/'+currentJobId+'/photos/'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_')
      const{error:upErr}=await sb.storage.from('fieldtrack-photos').upload(path,f,{upsert:true,contentType:f.type})
      if(upErr){
        // Try fieldtrack-plans bucket as fallback
        const{error:upErr2}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true,contentType:f.type})
        if(upErr2){
          console.error('Upload error:',upErr.message,upErr2.message)
          fail++; continue
        }
        const{data:u}=sb.storage.from('fieldtrack-plans').getPublicUrl(path)
        await sb.from('job_photos').insert({id:uuid(),job_id:currentJobId,url:u.publicUrl,storage_path:path,file_name:f.name,type:'progress',uploaded_by:ME?.full_name,created_at:new Date().toISOString()})
      } else {
        const{data:u}=sb.storage.from('fieldtrack-photos').getPublicUrl(path)
        await sb.from('job_photos').insert({id:uuid(),job_id:currentJobId,url:u.publicUrl,storage_path:path,file_name:f.name,type:'progress',uploaded_by:ME?.full_name,created_at:new Date().toISOString()})
      }
      ok++
    }catch(e){console.error('Photo upload error:',e);fail++}
  }
  if(fail>0) toast(fail+' photo'+(fail>1?'s':'')+' failed to upload — check Supabase Storage buckets exist','error')
  if(ok>0) toast(ok+' photo'+(ok>1?'s':'')+' uploaded')
  loadJT('jt-photos')
}

// CHECKLIST TAB
async function renderChecklistTab(el){
  const{data:items}=await sb.from('job_checklist_items').select('*').eq('job_id',currentJobId).order('sort_order')
  const done=(items||[]).filter(i=>i.is_checked).length
  el.innerHTML=\`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-weight:500">Checklist <span style="font-size:11px;color:#414e63">\${done}/\${(items||[]).length}</span></span><button class="btn btn-sm btn-p" onclick="addCheckItem()">+ Add</button></div>
  <div class="pbar" style="margin-bottom:13px"><div class="pb g" style="width:\${(items||[]).length?Math.round(done/(items||[]).length*100):0}%"></div></div>
  \${(items||[]).map(i=>\`<div class="chk-item"><div class="chk-box \${i.is_checked?'ck':''}" onclick="toggleCheck('\${i.id}',\${!i.is_checked})"></div><div style="flex:1"><div style="font-size:13px;\${i.is_checked?'text-decoration:line-through;color:#414e63':'color:#e8edf5'}">\${i.item_text}</div>\${i.section?\`<div style="font-size:10px;color:#2563eb;margin-top:1px">§ \${i.section}</div>\`:''}</div><button class="btn btn-sm btn-ghost" style="color:#dc2626" onclick="delCheckItem('\${i.id}')">×</button></div>\`).join('')||empty('✅','Add checklist items')}\` 
}
async function addCheckItem(){modal('Add Item',\`<div class="fg"><label class="fl">Item *</label><input class="fi" id="ci-t"></div><div class="fg"><label class="fl">Section</label><input class="fi" id="ci-s" placeholder="Install, Closeout…"></div>\`,async()=>{const t=v('ci-t').trim();if(!t)return;const{data:last}=await sb.from('job_checklist_items').select('sort_order').eq('job_id',currentJobId).order('sort_order',{ascending:false}).limit(1).single();await sb.from('job_checklist_items').insert({id:uuid(),job_id:currentJobId,item_text:t,section:v('ci-s')||null,sort_order:(last?.sort_order||0)+1,is_checked:false});closeModal();loadJT('jt-checklist')})}
async function toggleCheck(id,val){await sb.from('job_checklist_items').update({is_checked:val,checked_by:val?ME?.id:null,checked_at:val?new Date().toISOString():null}).eq('id',id);loadJT('jt-checklist')}
async function delCheckItem(id){await sb.from('job_checklist_items').delete().eq('id',id);loadJT('jt-checklist')}

// PUNCH LIST TAB (per job)
async function renderPunchTab(el){
  const{data:items}=await sb.from('punch_list').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  el.innerHTML=\`<div style="margin-bottom:12px"><button class="btn btn-p btn-sm" onclick="addPunchItem('\${currentJobId}',true)">+ Add Punch Item</button></div>
  <table class="tbl"><thead><tr><th>Item</th><th>Location</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>
  \${(items||[]).map(i=>\`<tr><td style="font-weight:500">\${i.item}</td><td style="font-size:11px;color:#8a96ab">\${i.location||'—'}</td><td style="font-size:11px">\${i.assigned_to||'—'}</td><td><span class="badge \${i.priority==='urgent'?'bg-red':i.priority==='high'?'bg-amber':'bg-gray'}">\${i.priority}</span></td><td><span class="badge \${i.status==='complete'?'bg-green':'bg-amber'}">\${i.status}</span></td><td style="font-size:11px">\${fd(i.due_date)}</td><td>\${i.status!=='complete'?\`<button class="btn btn-sm btn-g" onclick="completePunch('\${i.id}')">Done</button>\`:''}</td></tr>\`).join('')}</tbody></table>
  \${!(items||[]).length?empty('✅','No punch list items'):''}\` 
}
async function completePunch(id){await sb.from('punch_list').update({status:'complete',completed_at:new Date().toISOString(),completed_by:ME?.full_name}).eq('id',id);loadJT('jt-punch')}

// PM REVIEW TAB
async function renderPmTab(el){
  const{data:insps}=await sb.from('pm_inspections').select('*').eq('job_id',currentJobId).order('visited_at',{ascending:false})
  el.innerHTML=\`<div style="margin-bottom:12px"><button class="btn btn-p btn-sm" onclick="logPmVisit()">+ Log Visit</button></div>
  \${(insps||[]).map(ins=>\`<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div><div style="font-weight:500">\${ins.visit_type==='final'?'Final Sign-off':'Inspection'} — \${fd(ins.visited_at)}</div><div style="font-size:11px;color:#414e63">\${ins.pm_name||''}</div></div><span class="badge \${ins.approved_at?'bg-green':ins.rejected_at?'bg-red':'bg-gray'}">\${ins.approved_at?'Approved':ins.rejected_at?'Rejected':'Pending'}</span></div>
  <div style="font-size:12px;color:#8a96ab">\${ins.work_observed||'—'}</div>
  \${ins.issues_noted?\`<div style="font-size:12px;color:#d97706;margin-top:6px">\${ins.issues_noted}</div>\`:''}
  \${!ins.approved_at&&!ins.rejected_at?\`<div style="display:flex;gap:7px;margin-top:10px"><button class="btn btn-sm btn-g" onclick="approveInsp('\${ins.id}')">✓ Approve</button><button class="btn btn-sm btn-r" onclick="rejectInsp('\${ins.id}')">Reject</button></div>\`:''}</div>\`).join('')||empty('🔍','No PM inspections yet')}\`
}
async function logPmVisit(){modal('Log PM Visit',\`<div class="fg"><label class="fl">Type</label><select class="fs" id="ins-t"><option value="midpoint">Midpoint</option><option value="final">Final</option></select></div><div class="fg"><label class="fl">Work Observed</label><textarea class="ft" id="ins-o"></textarea></div><div class="fg"><label class="fl">Issues</label><textarea class="ft" id="ins-i"></textarea></div>\`,async()=>{const{error}=await sb.from('pm_inspections').insert({id:uuid(),job_id:currentJobId,pm_name:ME?.full_name,visit_type:v('ins-t'),work_observed:v('ins-o'),issues_noted:v('ins-i'),visited_at:new Date().toISOString(),created_at:new Date().toISOString()});if(error)toast(error.message,'error');else{closeModal();loadJT('jt-pm')}})}
async function approveInsp(id){await sb.from('pm_inspections').update({approved_at:new Date().toISOString()}).eq('id',id);await sb.from('jobs').update({phase:'complete'}).eq('id',currentJobId);currentJob.phase='complete';toast('Approved');loadJT('jt-pm')}
async function rejectInsp(id){const r=prompt('Reason:');if(!r)return;await sb.from('pm_inspections').update({rejected_at:new Date().toISOString(),rejection_reason:r}).eq('id',id);toast('Rejected','warn');loadJT('jt-pm')}

// CHANGE ORDERS TAB
async function renderCOTab(el){
  const{data:cos}=await sb.from('change_orders').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  el.innerHTML=\`<div style="margin-bottom:12px"><button class="btn btn-p btn-sm" onclick="newCO()">+ New Change Order</button></div>
  \${(cos||[]).map(co=>\`<div class="card" style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;margin-bottom:7px"><div><div style="font-weight:500">\${co.co_number||'CO'} — \${co.title}</div><div style="font-size:11px;color:#414e63">\${fd(co.created_at)} · \${co.created_by||''}</div></div><span class="badge \${co.status==='signed'?'bg-green':'bg-amber'}">\${(co.status||'').replace('_',' ')}</span></div>
  <div style="font-size:12px;color:#8a96ab;margin-bottom:8px">\${co.description||''}</div>
  <div style="display:flex;gap:16px"><div><div style="font-size:10px;color:#414e63">VALUE</div><div style="color:#d97706">\${co.value>=0?'+':''}\${fm(co.value)}</div></div><div><div style="font-size:10px;color:#414e63">PM SIGNED</div><div style="font-size:11px;color:\${co.pm_signed_at?'#16a34a':'#d97706'}">\${co.pm_signed_at?'✓ '+fd(co.pm_signed_at):'Pending'}</div></div></div>
  \${!co.pm_signed_at?\`<button class="btn btn-sm btn-g" style="margin-top:8px" onclick="signCO('\${co.id}')">✓ PM Sign</button>\`:''}</div>\`).join('')||empty('📝','No change orders')}\` 
}
async function newCO(){const{data:last}=await sb.from('change_orders').select('co_number').eq('job_id',currentJobId).order('created_at',{ascending:false}).limit(1).single();const num='CO-'+((parseInt((last?.co_number||'CO-0').split('-')[1])||0)+1+'').padStart(3,'0');modal('New Change Order',\`<div class="fg"><label class="fl">Title *</label><input class="fi" id="co-t"></div><div class="fg"><label class="fl">Description</label><textarea class="ft" id="co-d"></textarea></div><div class="two"><div class="fg"><label class="fl">Value ($)</label><input class="fi" type="number" id="co-v" step="0.01"></div><div class="fg"><label class="fl">Days Added</label><input class="fi" type="number" id="co-dy" value="0"></div></div>\`,async()=>{const t=v('co-t').trim();if(!t)return;await sb.from('change_orders').insert({id:uuid(),job_id:currentJobId,co_number:num,title:t,description:v('co-d'),value:parseFloat(v('co-v'))||0,days_added:parseInt(v('co-dy'))||0,status:'pending_sub',created_by:ME?.full_name,created_at:new Date().toISOString()});closeModal();loadJT('jt-co')})}
async function signCO(id){await sb.from('change_orders').update({pm_signed_by:ME?.full_name,pm_signed_at:new Date().toISOString(),status:'signed'}).eq('id',id);toast('Signed');loadJT('jt-co')}

// FINANCIALS TAB (per job)
async function renderJobFinTab(el){
  const{data:ci}=await sb.from('checkins').select('hours_logged').eq('job_id',currentJobId)
  const hrs=(ci||[]).reduce((s,c)=>s+(c.hours_logged||0),0)
  const j=currentJob
  const labor=hrs*(j.labor_rate||0)
  const profit=(j.contract_value||0)-labor
  const margin=j.contract_value>0?profit/j.contract_value*100:null
  el.innerHTML=\`<button class="btn btn-sm" style="float:right;margin-bottom:11px" onclick="editBudget()">Edit Budget</button>
  <div class="two">
    <div class="card"><div class="card-title">Revenue</div><div class="fin-row"><span style="color:#8a96ab">Contract Value</span><span style="font-weight:500">\${fm(j.contract_value)}</span></div><div class="fin-row"><span style="color:#8a96ab">Labor Budget</span><span>\${fm(j.labor_budget)}</span></div><div class="fin-row"><span style="color:#8a96ab">Material Budget</span><span>\${fm(j.material_budget)}</span></div></div>
    <div class="card"><div class="card-title">Costs</div><div class="fin-row"><span style="color:#8a96ab">Labor (\${fh(hrs)} @ \${fm(j.labor_rate||0)}/hr)</span><span>\${fm(labor)}</span></div><div class="fin-row"><span style="font-weight:600">Total Cost</span><span style="font-weight:600">\${fm(labor)}</span></div></div>
  </div>
  <div class="card" style="background:\${profit>=0?'rgba(22,163,74,.08)':'rgba(220,38,38,.08)'};border-color:\${profit>=0?'rgba(22,163,74,.2)':'rgba(220,38,38,.2)'}">
    <div style="font-size:26px;font-weight:300;color:\${profit>=0?'#16a34a':'#dc2626'}">\${fm(profit)} \${margin!=null?'('+margin.toFixed(1)+'% margin)':''}</div>
    <div style="font-size:12px;color:#8a96ab;margin-top:3px">Gross Profit · \${fh(hrs)} logged</div>
  </div>\` 
}
function editBudget(){const j=currentJob;modal('Edit Budget',\`<div class="two"><div class="fg"><label class="fl">Contract $</label><input class="fi" type="number" id="eb-cv" value="\${j.contract_value||''}"></div><div class="fg"><label class="fl">Labor Rate/hr</label><input class="fi" type="number" id="eb-lr" value="\${j.labor_rate||''}"></div></div><div class="two"><div class="fg"><label class="fl">Labor Budget</label><input class="fi" type="number" id="eb-lb" value="\${j.labor_budget||''}"></div><div class="fg"><label class="fl">Material Budget</label><input class="fi" type="number" id="eb-mb" value="\${j.material_budget||''}"></div></div>\`,async()=>{const u={contract_value:fN('eb-cv'),labor_rate:fN('eb-lr'),labor_budget:fN('eb-lb'),material_budget:fN('eb-mb')};await sb.from('jobs').update(u).eq('id',currentJobId);currentJob={...currentJob,...u};closeModal();toast('Saved');loadJT('jt-fin')})}

// DOCUMENTS TAB (per job)
async function renderDocsTab(el){
  const{data:docs}=await sb.from('job_documents').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  el.innerHTML=\`<label class="btn btn-p btn-sm" style="cursor:pointer;margin-bottom:12px">+ Upload Document<input type="file" style="display:none" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" onchange="uploadJobDoc(this.files)"></label>
  \${(docs||[]).map(d=>\`<div class="doc-row"><div style="font-size:18px">\${d.file_name.endsWith('.pdf')?'📄':d.file_name.match(/\\.(png|jpg|jpeg)$/i)?'🖼':'📎'}</div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${d.name}</div><div style="font-size:10px;color:#414e63">\${d.category||'General'} · \${d.uploaded_by||''} · \${fd(d.created_at)}</div></div><a href="\${d.url}" target="_blank" class="btn btn-sm">View</a></div>\`).join('')||empty('📁','No documents uploaded')}\` 
}
function openPhoto(el){const u=el.dataset.url;if(u)window.open(u,'_blank')}
async function deleteJobPhoto(id, storagePath, url){
  if(!confirm('Delete this photo?'))return
  if(storagePath){
    await sb.storage.from('fieldtrack-photos').remove([storagePath]).catch(()=>{})
    await sb.storage.from('fieldtrack-plans').remove([storagePath]).catch(()=>{})
  }
  await sb.from('job_photos').delete().eq('id',id)
  toast('Photo deleted','warn')
  loadJT('jt-photos')
}
async function uploadJobDoc(files){for(const f of files){const path=\`jobs/\${currentJobId}/docs/\${Date.now()}_\${f.name}\`;const{error}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true});if(!error){const{data:{publicUrl}}=sb.storage.from('fieldtrack-plans').getPublicUrl(path);await sb.from('job_documents').insert({id:uuid(),job_id:currentJobId,name:f.name,file_name:f.name,category:'general',storage_path:path,url:publicUrl,uploaded_by:ME?.full_name,created_at:new Date().toISOString()})}};toast('Uploaded');loadJT('jt-docs')}

// DAILY LOG TAB
async function renderLogTab(el){
  const{data:logs}=await sb.from('daily_logs').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  el.innerHTML=\`<div style="margin-bottom:12px"><div class="two" style="margin-bottom:7px"><select class="fs" id="log-type"><option value="note">Note</option><option value="issue">Issue</option><option value="progress">Progress</option><option value="delivery">Delivery</option></select><button class="btn btn-p" onclick="addLog()">Add</button></div><textarea class="ft" id="log-txt" placeholder="Field note…"></textarea></div>
  \${(logs||[]).map(l=>\`<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;font-weight:600;color:\${l.type==='issue'?'#dc2626':l.type==='progress'?'#16a34a':'#414e63'}">\${(l.type||'NOTE').toUpperCase()}</span><span style="font-size:10px;color:#414e63">\${l.author||''} · \${fdt(l.created_at)}</span></div><div style="font-size:13px;color:#8a96ab;white-space:pre-wrap">\${l.content}</div></div>\`).join('')||'<div style="font-size:12px;color:#414e63">No entries</div>'}\`
}
async function addLog(){const c=v('log-txt').trim();if(!c)return;await sb.from('daily_logs').insert({id:uuid(),job_id:currentJobId,type:v('log-type'),content:c,author:ME?.full_name,created_at:new Date().toISOString()});document.getElementById('log-txt').value='';toast('Added');loadJT('jt-log')}
// ══════════════════════════════════════════
// NEW JOB PAGE
// ══════════════════════════════════════════
async function pgNewJob(){
  const[{data:companies},{data:pmUsers}]=await Promise.all([sb.from('companies').select('id,name').eq('is_active',true).order('name'),sb.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')])
  document.getElementById('page-area').innerHTML=\`<div class="two">
  <div>
    <div class="card">
      <div class="fg"><label class="fl">Job Name *</label><input class="fi" id="nj-name" placeholder="Project name"></div>
      <div class="fg" style="position:relative"><label class="fl">Project Address *</label><input class="fi" id="nj-addr" placeholder="Start typing…" autocomplete="off" oninput="addrAC(this.value,'nj-addr-dd')"><div id="nj-addr-dd" class="addr-dd"></div>
      <div id="nj-gps-ok" style="display:none;font-size:10px;color:#16a34a;margin-top:4px">✓ GPS: <span id="nj-coords"></span></div><input type="hidden" id="nj-lat"><input type="hidden" id="nj-lng"></div>
      <div class="three"><div class="fg"><label class="fl">Radius</label><select class="fs" id="nj-rad"><option value="100">100ft</option><option value="250" selected>250ft</option><option value="500">500ft</option><option value="750">750ft</option><option value="1000">1000ft</option></select></div>
      <div class="fg"><label class="fl">Start</label><input class="fi" type="date" id="nj-start"></div>
      <div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="nj-due"></div></div>
      <div class="three"><div class="fg"><label class="fl">Expected On Site</label><input class="fi" type="date" id="nj-eos"></div>
      <div class="fg"><label class="fl">Next Visit</label><input class="fi" type="date" id="nj-nvd"></div>
      <div class="fg"><label class="fl">Closeout Date</label><input class="fi" type="date" id="nj-dco"></div></div>
      <div class="three"><div class="fg"><label class="fl">Contract $</label><input class="fi" type="number" id="nj-cv"></div>
      <div class="fg"><label class="fl">Labor Budget</label><input class="fi" type="number" id="nj-lb"></div>
      <div class="fg"><label class="fl">Labor Rate/hr</label><input class="fi" type="number" id="nj-lr"></div></div>
      <div class="fg"><label class="fl">GC Company</label><input class="fi" id="nj-gc"></div>
      <div class="two"><div class="fg"><label class="fl">GC Contact</label><input class="fi" id="nj-gcc"></div><div class="fg"><label class="fl">GC Phone</label><input class="fi" id="nj-gcp"></div></div>
      <div class="two"><div class="fg"><label class="fl">Superintendent</label><input class="fi" id="nj-sup"></div><div class="fg"><label class="fl">Super Phone</label><input class="fi" id="nj-supp"></div></div>
      <div class="fg"><label class="fl">Project Manager (Internal)</label><select class="fs" id="nj-pm"><option value="">— Assign PM —</option></select></div>
      <div class="fg"><label class="fl">PM Visit Schedule</label><select class="fs" id="nj-pmschedule"><option value="none">No scheduled visits</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="milestone">At milestones only</option></select></div>
      <div class="fg"><label class="fl">Next PM Visit Due</label><input class="fi" type="date" id="nj-pmvisit"></div>
    </div>
  </div>
  <div>
    <div class="card">
      <div class="fg"><label class="fl">Sub Company</label><select class="fs" id="nj-co" onchange="loadNjWorkers()"><option value="">— None —</option>\${(companies||[]).map(c=>\`<option value="\${c.id}">\${c.name}</option>\`).join('')}</select></div>
      <div class="fg"><label class="fl">Workers</label><div id="nj-workers" style="background:#131c2e;border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:9px;min-height:44px"><div style="font-size:11px;color:#414e63">Select a company first</div></div></div>
      <div class="fg"><label class="fl">PM Review</label><select class="fs" id="nj-pmr"><option value="midpoint_and_final">Mid-point &amp; Final</option><option value="final_only">Final only</option><option value="none">None</option></select></div>
      <div class="fg"><label class="fl">Scope of Work</label><textarea class="ft" id="nj-scope"></textarea></div>
      <div class="fg"><label class="fl">Install Notes</label><textarea class="ft" id="nj-notes" style="min-height:55px"></textarea></div>
    </div>
    <div class="card">
      <div class="card-title">Milestone Dates</div>
      <div class="two"><div class="fg"><label class="fl">Rough-in</label><input class="fi" type="date" id="nj-dr"></div><div class="fg"><label class="fl">Trim-out</label><input class="fi" type="date" id="nj-dt"></div></div>
      <div class="two"><div class="fg"><label class="fl">Inspection</label><input class="fi" type="date" id="nj-di"></div><div class="fg"><label class="fl">Contract Signed</label><input class="fi" type="date" id="nj-dc"></div></div>
    </div>
    <button class="btn btn-p btn-full" id="nj-btn" onclick="submitNewJob()">Create Job</button>
  </div></div>\`
  setTimeout(()=>populateNjPM(pmUsers),100)
}
async function populateNjPM(pmUsers){
  const sel=document.getElementById('nj-pm');if(!sel)return
  // Always fetch fresh from DB - ignore passed users if empty
  const{data,error}=await sb.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')
  let users=(!error&&data&&data.length)?data:(pmUsers||[])
  if(!users.length){
    // Last resort - try without any filter
    const{data:all}=await sb.from('profiles').select('id,full_name,role').order('full_name').limit(100)
    users=all||[]
  }
  if(!users.length){
    sel.innerHTML='<option value="">— Add employees in Users page first —</option>'
    return
  }
  sel.innerHTML='<option value="">— Unassigned —</option>'+users.map(p=>'<option value="'+p.full_name+'">'+p.full_name+(p.role?' ('+p.role+')':'')+'</option>').join('')
}
async function loadNjWorkers(){const coId=v('nj-co');const wrap=document.getElementById('nj-workers');if(!wrap)return;if(!coId){wrap.innerHTML='<div style="font-size:11px;color:#414e63">Select a company first</div>';return};const{data}=await sb.from('profiles').select('id,full_name,is_lead').eq('company_id',coId).eq('is_active',true);wrap.innerHTML=(data||[]).map(w=>\`<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px"><input type="checkbox" id="w-\${w.id}" value="\${w.id}" \${w.is_lead?'checked':''}><label for="w-\${w.id}" style="font-size:12px;color:#8a96ab">\${w.full_name}\${w.is_lead?' (Lead)':''}</label></div>\`).join('')||'<div style="font-size:11px;color:#414e63">No workers</div>'}
async function submitNewJob(){
  const name=v('nj-name').trim();if(!name){toast('Job name required','error');return}
  const btn=document.getElementById('nj-btn');btn.disabled=true;btn.textContent='Creating…'
  let lat=parseFloat(v('nj-lat'))||null,lng=parseFloat(v('nj-lng'))||null
  if(!lat&&v('nj-addr')){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(v('nj-addr'))+'&format=json&limit=1',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();if(j[0]){lat=parseFloat(j[0].lat);lng=parseFloat(j[0].lon)}}catch{}}
  const job={id:uuid(),name,address:v('nj-addr'),gps_lat:lat,gps_lng:lng,gps_radius_ft:parseInt(v('nj-rad'))||250,date_start:v('nj-start')||null,due_date:v('nj-due')||null,expected_onsite_date:v('nj-eos')||null,next_visit_date:v('nj-nvd')||null,date_closeout:v('nj-dco')||null,contract_value:fN('nj-cv'),labor_budget:fN('nj-lb'),labor_rate:fN('nj-lr'),gc_company:v('nj-gc'),gc_contact:v('nj-gcc'),gc_phone:v('nj-gcp'),super_name:v('nj-sup'),super_phone:v('nj-supp'),scope:v('nj-scope'),install_notes:v('nj-notes'),company_id:v('nj-co')||null,pm_review_type:v('nj-pmr'),project_manager:v('nj-pm')||null,pm_visit_schedule:v('nj-pmschedule')||'none',next_pm_visit:v('nj-pmvisit')||null,date_roughin:v('nj-dr')||null,date_trimout:v('nj-dt')||null,date_inspection:v('nj-di')||null,date_contract:v('nj-dc')||null,phase:'not_started',pct_complete:0,archived:false,created_by:ME?.full_name,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  const{data:created,error}=await sb.from('jobs').insert(job).select().single()
  if(error){toast(error.message,'error');btn.disabled=false;btn.textContent='Create Job';return}
  document.querySelectorAll('#nj-workers input[type=checkbox]:checked').forEach(async cb=>await sb.from('job_workers').insert({id:uuid(),job_id:created.id,worker_id:cb.value,is_active:true,added_by:ME?.full_name,added_at:new Date().toISOString()}))
  toast('Job created!');allJobs.unshift(created);openJob(created.id)
}

// ══════════════════════════════════════════
// SCHEDULE PAGE
// ══════════════════════════════════════════
async function pgSchedule(){
  const{data:jobs}=await sb.from('jobs').select('*').eq('archived',false).order('name')
  const events=[];const today=new Date();today.setHours(0,0,0,0)
  ;(jobs||[]).forEach(j=>{
    const fields=[['expected_onsite_date','📍 Expected On Site','#60a5fa'],['next_visit_date','🔄 Next Visit','#d97706'],['date_roughin','🔨 Rough-in','#fb923c'],['date_trimout','✂ Trim-out','#2dd4bf'],['date_inspection','🔍 Inspection','#a78bfa'],['date_closeout','📋 Closeout','#16a34a'],['due_date','⚑ Due Date','#dc2626']]
    fields.forEach(([f,lbl,color])=>{if(j[f]){const da=daysAway(j[f]);events.push({job:j.name,jobId:j.id,type:lbl,date:j[f],da,color,phase:j.phase})}})
  })
  events.sort((a,b)=>new Date(a.date)-new Date(b.date))
  const upcoming=events.filter(e=>e.da>=0&&e.da<=14)
  const past=events.filter(e=>e.da<0).slice(0,10)
  const future=events.filter(e=>e.da>14).slice(0,20)
  document.getElementById('page-area').innerHTML=\`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div>
      <div class="card">
        <div class="card-title" style="color:#d97706">⚠ Due in Next 14 Days (\${upcoming.length})</div>
        \${upcoming.length?upcoming.map(e=>\`<div class="sched-item" onclick="openJob('\${e.jobId}')"><div class="sched-dot" style="background:\${e.da<=3?'#dc2626':e.da<=7?'#d97706':'#16a34a'};margin-top:5px"></div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${e.job}</div><div style="font-size:10px;color:#414e63">\${e.type} · \${fd(e.date)}</div></div><span class="badge \${e.da<=3?'bg-red':e.da<=7?'bg-amber':'bg-green'}">\${e.da===0?'Today':e.da+'d'}</span></div>\`).join(''):empty('✅','Nothing due in next 14 days')}
      </div>
      <div class="card">
        <div class="card-title">Past Due / Recent</div>
        \${past.length?past.map(e=>\`<div class="sched-item" onclick="openJob('\${e.jobId}')"><div class="sched-dot" style="background:#dc2626;margin-top:5px"></div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${e.job}</div><div style="font-size:10px;color:#414e63">\${e.type} · \${fd(e.date)}</div></div><span class="badge bg-red">\${Math.abs(e.da)}d ago</span></div>\`).join(''):empty('✅','No past due items')}
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Upcoming (Beyond 2 Weeks)</div>
        \${future.length?future.map(e=>\`<div class="sched-item" onclick="openJob('\${e.jobId}')"><div class="sched-dot" style="background:\${e.color};margin-top:5px"></div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${e.job}</div><div style="font-size:10px;color:#414e63">\${e.type} · \${fd(e.date)}</div></div><span class="badge bg-gray">\${e.da}d</span></div>\`).join(''):empty('📅','No future events')}
      </div>
    </div>
  </div>\`
}

// ══════════════════════════════════════════
// DAILY REPORTS PAGE
// ══════════════════════════════════════════
let _drAll=[], _drJobs={}
async function pgDaily(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="newDailyModal()">+ New Report</button>'
  // Fetch reports with job names
  const[{data:reports},{data:jobs}]=await Promise.all([
    sb.from('daily_reports').select('*').order('report_date',{ascending:false}).limit(500),
    sb.from('jobs').select('id,name').order('name')
  ])
  _drAll=reports||[]
  _drJobs={}; (jobs||[]).forEach(j=>_drJobs[j.id]=j.name)
  // Build employee list for filter
  const employees=[...new Set(_drAll.map(r=>r.submitted_by).filter(Boolean))].sort()
  const today=new Date().toISOString().split('T')[0]
  const thirtyDaysAgo=new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  document.getElementById('page-area').innerHTML=
    '<div style="background:#0c1220;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:14px;margin-bottom:13px">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:flex-end">'+
    '<div><label class="fl">Job</label><select class="fs" id="dr-f-job" onchange="filterDailyReports()"><option value="">All Jobs</option>'+
    (jobs||[]).map(j=>'<option value="'+j.id+'">'+j.name+'</option>').join('')+
    '</select></div>'+
    '<div><label class="fl">From Date</label><input class="fi" type="date" id="dr-f-from" value="'+thirtyDaysAgo+'" onchange="filterDailyReports()"></div>'+
    '<div><label class="fl">To Date</label><input class="fi" type="date" id="dr-f-to" value="'+today+'" onchange="filterDailyReports()"></div>'+
    '<div><label class="fl">Employee</label><select class="fs" id="dr-f-emp" onchange="filterDailyReports()"><option value="">All Employees</option>'+
    employees.map(e=>'<option value="'+e+'">'+e+'</option>').join('')+
    '</select></div>'+
    '<button class="btn btn-sm" onclick="clearDrFilters()">Clear</button>'+
    '</div></div>'+
    '<div id="dr-results"></div>'
  filterDailyReports()
}
function clearDrFilters(){
  const today=new Date().toISOString().split('T')[0]
  const ago=new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  document.getElementById('dr-f-job').value=''
  document.getElementById('dr-f-from').value=ago
  document.getElementById('dr-f-to').value=today
  document.getElementById('dr-f-emp').value=''
  filterDailyReports()
}
function filterDailyReports(){
  const jobId=document.getElementById('dr-f-job')?.value||''
  const from=document.getElementById('dr-f-from')?.value||''
  const to=document.getElementById('dr-f-to')?.value||''
  const emp=document.getElementById('dr-f-emp')?.value||''
  let rows=_drAll.filter(r=>{
    if(jobId&&r.job_id!==jobId)return false
    if(from&&r.report_date<from)return false
    if(to&&r.report_date>to)return false
    if(emp&&r.submitted_by!==emp)return false
    return true
  })
  const el=document.getElementById('dr-results')
  if(!el)return
  if(!rows.length){el.innerHTML=empty('📋','No reports match your filters');return}
  let html='<div style="font-size:11px;color:#414e63;margin-bottom:8px">'+rows.length+' report'+(rows.length!==1?'s':'')+' found</div>'
  html+='<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>'
  html+='<th>Date</th><th>Job</th><th>Submitted By</th><th>Crew</th><th>Hours</th><th>Weather</th><th>Issues</th><th></th>'
  html+='</tr></thead><tbody>'
  for(const r of rows){
    const jobName=_drJobs[r.job_id]||r.job_id||'—'
    const hasIssues=r.issues&&r.issues.trim()
    html+='<tr onclick="viewDailyReport(\\"'+r.id+'\\")" style="cursor:pointer">'
    html+='<td style="font-weight:500;white-space:nowrap">'+fd(r.report_date)+'</td>'
    html+='<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+jobName+'</td>'
    html+='<td style="font-size:12px">'+( r.submitted_by||'—')+'</td>'
    html+='<td>'+r.crew_count+'</td>'
    html+='<td>'+fh(r.hours_worked)+'</td>'
    html+='<td style="font-size:11px;color:#8a96ab">'+(r.weather||'—')+(r.temp_high?' '+r.temp_high+'°':'')+'</td>'
    html+='<td>'+(hasIssues?'<span class="badge bg-red">Yes</span>':'<span style="font-size:11px;color:#414e63">—</span>')+'</td>'
    html+='<td><button class="btn btn-sm" onclick="event.stopPropagation();dlDailyReportById(\\"'+r.id+'\\")">⬇</button></td>'
    html+='</tr>'
  }
  html+='</tbody></table></div>'
  el.innerHTML=html
}
async function viewDailyReport(id){
  const{data:r}=await sb.from('daily_reports').select('*').eq('id',id).single()
  modal('Daily Report — '+fd(r.report_date),\`
  <div class="two" style="margin-bottom:12px">
    <div><div class="fl">JOB</div><div style="font-weight:500">\${_drJobs[r.job_id]||r.job_id||'—'}</div></div>
    <div><div class="fl">DATE</div><div style="font-weight:500">\${fd(r.report_date)}</div></div>
  </div>
  <div class="four" style="margin-bottom:12px">
    <div><div class="fl">CREW</div><div style="font-weight:500">\${r.crew_count}</div></div>
    <div><div class="fl">HOURS</div><div style="font-weight:500">\${fh(r.hours_worked)}</div></div>
    <div><div class="fl">WEATHER</div><div style="font-weight:500">\${r.weather||'—'}</div></div>
    <div><div class="fl">TEMP</div><div style="font-weight:500">\${r.temp_high?r.temp_high+'°/'+r.temp_low+'°':'—'}</div></div>
  </div>
  \${r.work_performed?\`<div class="fg"><div class="fl">Work Performed</div><div style="font-size:12px;color:#8a96ab;white-space:pre-wrap;background:#131c2e;padding:9px;border-radius:7px">\${r.work_performed}</div></div>\`:''}
  \${(r.installed_parts&&r.installed_parts.length)?\`<div class="fg"><div class="fl" style="margin-bottom:7px">Parts Installed Today</div><div style="background:#131c2e;border-radius:7px;overflow:hidden">\${r.installed_parts.map(p=>'<div style="display:flex;justify-content:space-between;padding:7px 11px;border-bottom:1px solid rgba(255,255,255,.04)"><span style="font-size:12px">'+p.part_name+'</span><span style="font-size:12px;font-weight:600;color:#16a34a">'+p.installed_qty+' installed</span></div>').join('')}</div></div>\`:''}
  \${r.equipment_used?\`<div class="fg"><div class="fl">Equipment</div><div style="font-size:12px;color:#8a96ab">\${r.equipment_used}</div></div>\`:''}
  \${r.issues?\`<div style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.15);border-radius:7px;padding:10px 12px;margin-bottom:9px"><div class="fl" style="color:#dc2626">Issues</div><div style="font-size:12px;color:#dc2626;white-space:pre-wrap">\${r.issues}</div></div>\`:''}
  \${r.visitors?\`<div class="fg"><div class="fl">Visitors</div><div style="font-size:12px;color:#8a96ab">\${r.visitors}</div></div>\`:''}\`,
  ()=>closeModal(),'Close',false)
  document.getElementById('modal-footer').innerHTML='<button class="btn" onclick="closeModal()">Close</button><button class="btn btn-sm" onclick="dlDailyReportById(\\''+id+'\\')">⬇ Download</button>'
}
async function dlDailyReportById(id){const{data:r}=await sb.from('daily_reports').select('*').eq('id',id).single();dlDailyReport({...r,jobs:r.jobs})}
function newDailyModal(jobIdOverride){
  const jobSel=(!jobIdOverride&&allJobs.length)?
    '<div class="fg"><label class="fl">Job *</label><select class="fs" id="dr-job" onchange="drLoadParts(this.value)"><option value="">— Select —</option>'+allJobs.map(j=>'<option value="'+j.id+'">'+j.name+'</option>').join('')+'</select></div>':
    (jobIdOverride?'<input type="hidden" id="dr-job" value="'+jobIdOverride+'">':'')
  const html=jobSel+
    '<div class="two">'+
    '<div class="fg"><label class="fl">Report Date</label><input class="fi" type="date" id="dr-date" value="'+new Date().toISOString().split('T')[0]+'"></div>'+
    '<div class="fg"><label class="fl">Crew Count</label><input class="fi" type="number" id="dr-crew" value="1" min="0"></div>'+
    '</div>'+
    '<div class="three">'+
    '<div class="fg"><label class="fl">Hours Worked</label><input class="fi" type="number" id="dr-hrs" step="0.5" min="0"></div>'+
    '<div class="fg"><label class="fl">Weather</label><input class="fi" id="dr-wx" placeholder="Sunny, Rainy…"></div>'+
    '<div class="fg"><label class="fl">Temp Hi/Lo (°F)</label><div style="display:flex;gap:5px"><input class="fi" type="number" id="dr-th" placeholder="Hi"><input class="fi" type="number" id="dr-tl" placeholder="Lo"></div></div>'+
    '</div>'+
    '<div class="fg"><label class="fl">Work Performed *</label><textarea class="ft" id="dr-work" style="min-height:80px" placeholder="Describe work completed today…"></textarea></div>'+
    '<div id="dr-parts-section" style="margin-bottom:12px">'+
    (jobIdOverride?'<div id="dr-parts-wrap"><div style="font-size:11px;color:#414e63">Loading parts…</div></div>':
    '<div id="dr-parts-wrap"><div style="font-size:11px;color:#414e63">Select a job to see staged parts</div></div>')+
    '</div>'+
    '<div class="fg"><label class="fl">Equipment Used</label><input class="fi" id="dr-eq"></div>'+
    '<div class="fg"><label class="fl">Issues / Delays</label><textarea class="ft" id="dr-iss" placeholder="Any problems, delays, safety issues?"></textarea></div>'+
    '<div class="fg"><label class="fl">Visitors</label><input class="fi" id="dr-vis" placeholder="Inspectors, owner reps…"></div>'
  modal('New Daily Report', html, async()=>{
    const jobId=v('dr-job');if(!jobId){toast('Select a job','error');return}
    const work=v('dr-work').trim();if(!work){toast('Work performed required','error');return}
    // Collect installed parts from the form
    const installedParts=[]
    document.querySelectorAll('.dr-part-row').forEach(row=>{
      const partId=row.dataset.partId
      const partName=row.dataset.partName
      const available=parseInt(row.dataset.available)||0
      const installed=parseInt(row.querySelector('.dr-part-qty')?.value)||0
      if(installed>0) installedParts.push({part_id:partId,part_name:partName,installed_qty:installed,available_qty:available})
    })
    const{error}=await sb.from('daily_reports').insert({id:uuid(),job_id:jobId,report_date:v('dr-date'),crew_count:parseInt(v('dr-crew'))||0,hours_worked:parseFloat(v('dr-hrs'))||0,weather:v('dr-wx'),temp_high:fN('dr-th'),temp_low:fN('dr-tl'),work_performed:work,equipment_used:v('dr-eq'),issues:v('dr-iss'),visitors:v('dr-vis'),installed_parts:installedParts,submitted_by:ME?.full_name,submitted_at:new Date().toISOString(),created_at:new Date().toISOString()})
    if(error){toast(error.message,'error');return}
    // Update job_parts installed_qty and subtract from available
    for(const ip of installedParts){
      const{data:part}=await sb.from('job_parts').select('id,installed_qty,assigned_qty').eq('job_id',jobId).eq('part_id',ip.part_id).single()
      if(part){
        const newInstalled=(part.installed_qty||0)+ip.installed_qty
        const newStatus=newInstalled>=part.assigned_qty?'installed':'partial_install'
        await sb.from('job_parts').update({installed_qty:newInstalled,status:newStatus,updated_at:new Date().toISOString()}).eq('id',part.id)
      }
    }
    // Check if job is complete - run over/under check
    if(installedParts.length) await checkPartsVariance(jobId)
    closeModal();toast('Report saved OK');if(jobIdOverride)loadJT('jt-daily');else pgDaily()
  })
  // Load parts if job is pre-selected
  if(jobIdOverride) setTimeout(()=>drLoadParts(jobIdOverride),100)
}

async function drLoadParts(jobId){
  const wrap=document.getElementById('dr-parts-wrap');if(!wrap)return
  if(!jobId){wrap.innerHTML='<div style="font-size:11px;color:#414e63">Select a job to see staged parts</div>';return}
  wrap.innerHTML='<div style="font-size:11px;color:#414e63">Loading parts…</div>'
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',jobId).in('status',['staged','signed_out','partial_install'])
  if(!parts?.length){wrap.innerHTML='<div style="font-size:11px;color:#414e63;padding:8px 0">No staged parts on this job yet</div>';return}
  let html='<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Parts Staged on Job — Enter Qty Installed Today</div>'
  html+='<div style="background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;overflow:hidden">'
  for(const p of parts){
    const available=p.assigned_qty-(p.installed_qty||0)
    if(available<=0) continue
    html+='<div class="dr-part-row" data-part-id="'+p.part_id+'" data-part-name="'+p.part_name+'" data-available="'+available+'" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04)">'
    html+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.part_name+'</div>'
    html+='<div style="font-size:10px;color:#414e63">'+p.part_id+' · '+available+' available ('+( p.installed_qty||0)+' already installed)</div></div>'
    html+='<div style="display:flex;align-items:center;gap:5px;flex-shrink:0">'
    html+='<button onclick="this.nextElementSibling.value=Math.max(0,parseInt(this.nextElementSibling.value||0)-1)" style="width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:#0c1220;cursor:pointer;color:#e8edf5;font-size:14px">−</button>'
    html+='<input type="number" class="dr-part-qty fi" value="0" min="0" max="'+available+'" style="width:60px;text-align:center;padding:4px 6px">'
    html+='<button onclick="this.previousElementSibling.value=Math.min('+available+',parseInt(this.previousElementSibling.value||0)+1)" style="width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:#0c1220;cursor:pointer;color:#e8edf5;font-size:14px">+</button>'
    html+='</div></div>'
  }
  html+='</div>'
  wrap.innerHTML=html
}

async function checkPartsVariance(jobId){
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',jobId)
  if(!parts?.length) return
  const{data:job}=await sb.from('jobs').select('name,phase').eq('id',jobId).single()
  const overParts=[],underParts=[]
  for(const p of parts){
    const installed=p.installed_qty||0
    const assigned=p.assigned_qty||0
    if(installed>assigned) overParts.push({name:p.part_name,over:installed-assigned,id:p.part_id})
    else if(installed<assigned&&(job?.phase==='complete'||p.status==='installed'))
      underParts.push({name:p.part_name,under:assigned-installed,id:p.part_id})
  }
  if(overParts.length||underParts.length){
    const msg=[]
    if(overParts.length) msg.push('OVER on: '+overParts.map(p=>p.name+' (+'+p.over+')').join(', '))
    if(underParts.length) msg.push('UNDER on: '+underParts.map(p=>p.name+' (−'+p.under+')').join(', '))
    // Save notification
    await sb.from('notifications').insert({id:uuid(),type:'parts_variance',title:'Parts Variance — '+(job?.name||jobId),message:msg.join(' | '),meta:{job_id:jobId,over:overParts,under:underParts},read:false,created_at:new Date().toISOString()})
    toast('Parts variance detected — check notifications','warn')
  }
}

// ══════════════════════════════════════════
// JOB WALKS PAGE
// ══════════════════════════════════════════
async function pgJobWalks(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="newWalkModal()">+ New Job Walk</button>'
  const{data:walks}=await sb.from('job_walks').select('*').order('walk_date',{ascending:false}).limit(40)
  document.getElementById('page-area').innerHTML=\`
  <div class="card" style="padding:0;overflow:hidden">
  \${(walks||[]).length?\`<table class="tbl"><thead><tr><th>Date</th><th>Job</th><th>Walked By</th><th>Attendees</th><th>Status</th><th>Issues</th></tr></thead><tbody>\${(walks||[]).map(w=>\`<tr onclick="openJobWalk('\${w.id}')"><td style="font-weight:500">\${fd(w.walk_date)}</td><td>\${w.job_id||'—'}</td><td style="font-size:11px">\${w.walked_by||'—'}</td><td style="font-size:11px;color:#8a96ab">\${w.attendees||'—'}</td><td><span class="badge \${w.status==='complete'?'bg-green':'bg-amber'}">\${w.status}</span></td><td style="font-size:11px;color:\${w.issues_found?'#d97706':'#414e63'}">\${w.issues_found?'Yes':'None'}</td></tr>\`).join('')}</tbody></table>\`:empty('🚶','No job walks recorded')}
  </div>\`
}
function newWalkModal(jobIdOverride){
  let jobSel=''
  if(!jobIdOverride)jobSel=\`<div class="fg"><label class="fl">Job *</label><select class="fs" id="wk-job"><option value="">— Select —</option>\${allJobs.map(j=>\`<option value="\${j.id}">\${j.name}</option>\`).join('')}</select></div>\`
  modal('New Job Walk',\`
  \${jobIdOverride?\`<input type="hidden" id="wk-job" value="\${jobIdOverride}">\`:jobSel}
  <div class="two">
    <div class="fg"><label class="fl">Walk Date *</label><input class="fi" type="date" id="wk-date" value="\${new Date().toISOString().split('T')[0]}"></div>
    <div class="fg"><label class="fl">Walked By</label><input class="fi" id="wk-by" value="\${ME?.full_name||''}"></div>
  </div>
  <div class="fg"><label class="fl">Attendees</label><input class="fi" id="wk-att" placeholder="Names of everyone present"></div>
  <div class="fg"><label class="fl">Scope / Conditions</label><textarea class="ft" id="wk-scope" placeholder="Site conditions, access, scope observations…"></textarea></div>
  <div class="fg"><label class="fl">Measurements / Notes</label><textarea class="ft" id="wk-meas"></textarea></div>
  <div class="fg"><label class="fl">Issues Found</label><textarea class="ft" id="wk-iss" placeholder="Problems, concerns, items requiring attention…"></textarea></div>
  <div class="fg"><label class="fl">Action Items</label><textarea class="ft" id="wk-act" placeholder="What needs to happen and by whom…"></textarea></div>
  <div class="two"><div class="fg"><label class="fl">Follow-up Date</label><input class="fi" type="date" id="wk-fup"></div><div class="fg"><label class="fl">Status</label><select class="fs" id="wk-status"><option value="open">Open</option><option value="complete">Complete</option></select></div></div>\`,
  async()=>{
    const jobId=v('wk-job');if(!jobId){toast('Select a job','error');return}
    const{data:walk,error}=await sb.from('job_walks').insert({id:uuid(),job_id:jobId,walk_date:v('wk-date'),walked_by:v('wk-by'),attendees:v('wk-att'),scope_notes:v('wk-scope'),measurements:v('wk-meas'),issues_found:v('wk-iss'),action_items:v('wk-act'),follow_up_date:v('wk-fup')||null,status:v('wk-status'),created_at:new Date().toISOString()}).select().single()
    if(error)toast(error.message,'error');else{closeModal();toast('Job walk saved OK');if(jobIdOverride)loadJT('jt-walks');else{openJobWalk(walk.id)}}
  })
}

// ══════════════════════════════════════════
// PUNCH LIST PAGE (global)
// ══════════════════════════════════════════
async function pgPunch(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="addPunchItem()">+ Add Item</button>'
  const{data:items}=await sb.from('punch_list').select('*').order('created_at',{ascending:false})
  document.getElementById('page-area').innerHTML=\`
  <div class="card" style="padding:0;overflow:hidden">
  \${(items||[]).length?\`<table class="tbl"><thead><tr><th>Item</th><th>Job</th><th>Location</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>\${(items||[]).map(i=>\`<tr><td style="font-weight:500">\${i.item}</td><td style="font-size:11px">\${i.job_id||'—'}</td><td style="font-size:11px;color:#8a96ab">\${i.location||'—'}</td><td style="font-size:11px">\${i.assigned_to||'—'}</td><td><span class="badge \${i.priority==='urgent'?'bg-red':i.priority==='high'?'bg-amber':'bg-gray'}">\${i.priority}</span></td><td><span class="badge \${i.status==='complete'?'bg-green':'bg-amber'}">\${i.status}</span></td><td style="font-size:11px">\${fd(i.due_date)}</td><td>\${i.status!=='complete'?\`<button class="btn btn-sm btn-g" onclick="completePunchGlobal('\${i.id}')">Done</button>\`:''}</td></tr>\`).join('')}</tbody></table>\`:empty('✅','No punch list items')}
  </div>\`
}
function addPunchItem(jobIdOverride,reloadTab){
  let jobSel=''
  if(!jobIdOverride)jobSel=\`<div class="fg"><label class="fl">Job *</label><select class="fs" id="pl-job"><option value="">— Select —</option>\${allJobs.map(j=>\`<option value="\${j.id}">\${j.name}</option>\`).join('')}</select></div>\`
  modal('Add Punch Item',\`
  \${jobIdOverride?\`<input type="hidden" id="pl-job" value="\${jobIdOverride}">\`:jobSel}
  <div class="fg"><label class="fl">Item *</label><input class="fi" id="pl-item" placeholder="What needs to be fixed/completed?"></div>
  <div class="two"><div class="fg"><label class="fl">Location</label><input class="fi" id="pl-loc" placeholder="Room, area, zone…"></div>
  <div class="fg"><label class="fl">Assigned To</label><input class="fi" id="pl-ass"></div></div>
  <div class="two"><div class="fg"><label class="fl">Priority</label><select class="fs" id="pl-pri"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
  <div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="pl-due"></div></div>\`,
  async()=>{const jobId=v('pl-job');if(!jobId){toast('Select a job','error');return};const item=v('pl-item').trim();if(!item)return;const{error}=await sb.from('punch_list').insert({id:uuid(),job_id:jobId,item,location:v('pl-loc'),assigned_to:v('pl-ass'),priority:v('pl-pri'),status:'open',due_date:v('pl-due')||null,created_by:ME?.full_name,created_at:new Date().toISOString()});if(error)toast(error.message,'error');else{closeModal();toast('Added');if(reloadTab)loadJT('jt-punch');else pgPunch()}})
}
async function completePunchGlobal(id){await sb.from('punch_list').update({status:'complete',completed_at:new Date().toISOString(),completed_by:ME?.full_name}).eq('id',id);toast('Done OK');pgPunch()}

// ══════════════════════════════════════════
// SCAN PARTS PAGE — Full barcode scanning
// ══════════════════════════════════════════
let _scanMode='stage',_batch=[],_camRunning=false,_scanJobId=null
async function pgScan(){
  const{data:jobs}=await sb.from('jobs').select('id,name').eq('archived',false).order('name')
  allJobs=jobs||[]
  const{data:cat}=await sb.from('catalog').select('*').order('name')
  allCatalog=cat||[]
  document.getElementById('page-area').innerHTML=
    '<div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">'+
    // LEFT: Scanner
    '<div>'+
    '<div class="card" style="margin-bottom:12px">'+
    // Job select
    '<div class="fg"><label class="fl">Job *</label>'+
    '<select class="fs" id="sc-job" onchange="_scanJobId=this.value;loadJobPartsPanel()">'+
    '<option value="">— Select job —</option>'+
    allJobs.map(j=>'<option value="'+j.id+'">'+j.name+'</option>').join('')+
    '</select></div>'+
    // Mode toggle
    '<div class="mode-toggle" style="margin-bottom:12px">'+
    '<button class="active" id="mt-stage" data-m="stage" onclick="setScanMode(this.dataset.m,this)">📥 Stage In</button>'+
    '<button id="mt-out" data-m="out" onclick="setScanMode(this.dataset.m,this)">📤 Check Out</button>'+
    '<button id="mt-return" data-m="return" onclick="setScanMode(this.dataset.m,this)">↩ Return</button>'+
    '</div>'+
    // Camera section — html5-qrcode manages the video internally
    '<div id="cam-wrap" style="display:none;margin-bottom:12px">'+
    '<div id="cam-viewport-wrap" style="width:100%;border-radius:10px;overflow:hidden;background:#000;min-height:60px"></div>'+
    '<canvas id="scan-canvas" style="display:none"></canvas>'+
    '<div id="cam-status" style="padding:7px 12px;background:rgba(6,10,16,.9);font-size:12px;color:#8a96ab;text-align:center;border-radius:0 0 10px 10px">Aim at barcode</div>'+
    '</div>'+
    // Camera button
    '<div style="display:flex;gap:8px;margin-bottom:10px">'+
    '<button class="btn btn-p" id="cam-toggle-btn" onclick="toggleCam()" style="flex:1;justify-content:center">📷 Start Camera Scanner</button>'+
    '<button class="btn btn-sm" onclick="testBeep()">🔊</button>'+
    '</div>'+
    // Manual input
    '<div class="fg"><label class="fl">Barcode / Part # <span style="color:#414e63">(scan or type — Enter to add)</span></label>'+
    '<input class="fi" id="sc-bc" placeholder="Scan or type part number…" autocomplete="off" inputmode="text" '+
    'oninput="liveResolveBC(this.value)" '+
    'onkeydown="scanBcKeydown(event)" '+
    '</div>'+
    '<div id="sc-resolve" style="display:none;margin-bottom:9px"></div>'+
    '<div id="sc-qty-row" style="display:none;margin-bottom:9px">'+
    '<label class="fl">Quantity</label>'+
    '<div style="display:flex;gap:8px;align-items:center">'+
    '<button class="btn btn-sm" onclick="adjManualQty(-1)">−</button>'+
    '<input class="fi" type="number" id="sc-qty" value="1" min="1" style="width:70px;text-align:center">'+
    '<button class="btn btn-sm" onclick="adjManualQty(1)">+</button>'+
    '<button class="btn btn-p btn-sm" onclick="scanAddBtnClick()">Add</button>'+
    '</div></div>'+
    // Batch
    '<div id="batch-list" style="display:none">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
    '<span style="font-weight:600;font-size:13px" id="batch-title">Staging Batch</span>'+
    '<span style="background:#e8edf5;color:#060a10;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px" id="batch-cnt">0</span>'+
    '</div>'+
    '<div id="batch-items"></div>'+
    '<div style="display:flex;gap:7px;margin-top:9px">'+
    '<button class="btn btn-p btn-sm" id="commit-btn" onclick="commitBatch()" style="flex:2">Commit to Job</button>'+
    '<button class="btn btn-r btn-sm" onclick="clearBatch()">Clear</button>'+
    '</div></div>'+
    '</div></div>'+
    // RIGHT: Parts panel
    '<div>'+
    '<div class="card" style="margin-bottom:10px">'+
    '<div class="card-title">Parts on Job <button class="btn btn-sm btn-ghost" onclick="loadJobPartsPanel()">↻</button></div>'+
    '<div id="job-parts-panel"><div style="font-size:12px;color:#414e63">Select a job to see its parts</div></div>'+
    '</div>'+
    '<div class="card">'+
    '<div class="card-title">Recent Scans</div>'+
    '<div id="scan-events-panel"></div>'+
    '</div></div></div>'

  loadScanEvents()
}

// Add scan line animation CSS
if(!document.getElementById('scan-anim-css')){
  const s=document.createElement('style');s.id='scan-anim-css'
  s.textContent='@keyframes scanLine{0%{top:0}50%{top:calc(100% - 2px)}100%{top:0}}'
  document.head.appendChild(s)
}

function setScanMode(m,btn){
  _scanMode=m
  document.querySelectorAll('#mt-stage,#mt-out,#mt-return').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active')
  const titles={stage:'Staging Batch',out:'Check-out Batch',return:'Return Batch'}
  const el=document.getElementById('batch-title');if(el)el.textContent=titles[m]||m
}

function testBeep(){beep()}
let _resolvedPart=null,_bcDeb=null

function scanAddBtnClick(){
  addToBatch(null,null)
  const bc=document.getElementById('sc-bc');if(bc)bc.value=''
  const res=document.getElementById('sc-resolve');if(res)res.style.display='none'
}
function scanBcKeydown(e){
  if(e.key!=='Enter')return
  addToBatch(null,null)
  const bc=document.getElementById('sc-bc');if(bc)bc.value=''
  const res=document.getElementById('sc-resolve');if(res)res.style.display='none'
}
function liveResolveBC(val){
  clearTimeout(_bcDeb);const el=document.getElementById('sc-resolve');const qr=document.getElementById('sc-qty-row');if(!el)return
  if(!val||val.length<2){el.style.display='none';qr.style.display='none';_resolvedPart=null;return}
  _bcDeb=setTimeout(()=>{
    const match=allCatalog.filter(c=>
      c.barcode.toLowerCase()===val.toLowerCase()||
      c.barcode.toLowerCase().includes(val.toLowerCase())||
      (c.part_number||'').toLowerCase().includes(val.toLowerCase())||
      (c.name||'').toLowerCase().includes(val.toLowerCase())
    ).slice(0,5)
    if(!match.length){
      el.innerHTML='<div style="font-size:11px;color:#414e63;padding:6px 9px;background:#131c2e;border-radius:6px">Not in catalog — will add as new part</div>'
      el.style.display='block';_resolvedPart={barcode:val,name:val,part_number:'',description:''};qr.style.display='block';return
    }
    el.innerHTML=match.map(cm=>'<div style="padding:9px 11px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:7px;cursor:pointer;margin-bottom:4px" '+
      'data-bc="'+cm.barcode+'" data-name="'+cm.name.replace(/"/g,'&quot;')+'" onclick="selectCatalogPart(this.dataset.bc,this.dataset.name)">'+
      '<div style="font-size:13px;font-weight:500">'+cm.name+'</div>'+
      '<div style="font-size:10px;color:#414e63">'+cm.barcode+(cm.part_number?' · #'+cm.part_number:'')+(cm.description?' · '+cm.description.substring(0,40):'')+'</div></div>'
    ).join('')
    el.style.display='block'
    if(match.length===1){_resolvedPart=match[0];qr.style.display='block'}
  },200)
}

function selectCatalogPart(bc,name){
  document.getElementById('sc-bc').value=bc
  document.getElementById('sc-resolve').style.display='none'
  document.getElementById('sc-qty-row').style.display='block'
  _resolvedPart=allCatalog.find(c=>c.barcode===bc)||{barcode:bc,name,part_number:'',description:''}
}

function adjManualQty(d){const el=document.getElementById('sc-qty');if(!el)return;el.value=Math.max(1,(parseInt(el.value)||1)+d)}

function addToBatch(bc,name){
  const barcode=bc||v('sc-bc').trim();if(!barcode)return
  const qty=parseInt(v('sc-qty'))||1
  const part=_resolvedPart||allCatalog.find(c=>c.barcode===barcode)||{barcode,name:name||barcode,part_number:'',description:''}
  const ex=_batch.find(b=>b.barcode===barcode)
  if(ex){ex.qty+=qty}else{_batch.push({barcode,name:part.name,part_number:part.part_number||'',description:part.description||'',qty})}
  beep();renderBatch()
  toast('Added: '+part.name+' ×'+qty)
  document.getElementById('sc-qty').value=1
  _resolvedPart=null
}

function renderBatch(){
  const bl=document.getElementById('batch-list');if(!bl)return
  if(!_batch.length){bl.style.display='none';return}
  bl.style.display='block'
  document.getElementById('batch-cnt').textContent=_batch.reduce((s,b)=>s+b.qty,0)
  document.getElementById('batch-items').innerHTML=_batch.map((b,i)=>
    '<div class="batch-item">'+
    '<div class="bi-info"><div class="bi-name">'+b.name+'</div><div class="bi-bc">'+b.barcode+(b.part_number?' · #'+b.part_number:'')+'</div></div>'+
    '<div class="qty-ctrl">'+
    '<button data-i="'+i+'" onclick="adjBatch(parseInt(this.dataset.i),-1)">−</button>'+
    '<span>'+b.qty+'</span>'+
    '<button data-i="'+i+'" onclick="adjBatch(parseInt(this.dataset.i),1)">+</button>'+
    '</div>'+
    '<button style="background:none;border:none;cursor:pointer;color:#414e63;font-size:16px;padding:2px 5px" data-i="'+i+'" onclick="rmBatch(parseInt(this.dataset.i))">×</button>'+
    '</div>'
  ).join('')
}

function adjBatch(i,d){_batch[i].qty=Math.max(1,_batch[i].qty+d);renderBatch()}
function rmBatch(i){_batch.splice(i,1);renderBatch()}
function clearBatch(){_batch=[];renderBatch()}

async function commitBatch(){
  const jobId=document.getElementById('sc-job')?.value;if(!jobId){toast('Select a job first','error');return}
  if(!_batch.length){toast('Batch is empty','warn');return}
  const btn=document.getElementById('commit-btn');btn.disabled=true;btn.textContent='Processing…'
  const now=new Date().toISOString()
  const statusMap={stage:'staged',out:'signed_out',return:'staged'}
  try{
    for(const item of _batch){
      const{data:existing}=await sb.from('job_parts').select('*').eq('job_id',jobId).eq('part_id',item.barcode).maybeSingle()
      if(existing){
        const update={assigned_qty:existing.assigned_qty+item.qty,status:statusMap[_scanMode],updated_at:now}
        if(_scanMode==='stage'){update.staged_by=ME?.full_name;update.staged_at=now}
        if(_scanMode==='out'){update.checked_out_by=ME?.full_name;update.checked_out_at=now;update.taken_qty=(existing.taken_qty||0)+item.qty}
        await sb.from('job_parts').update(update).eq('id',existing.id)
      }else{
        const row={id:uuid(),job_id:jobId,part_id:item.barcode,part_name:item.name,status:statusMap[_scanMode],assigned_qty:item.qty,taken_qty:_scanMode==='out'?item.qty:0,staged_by:_scanMode==='stage'?ME?.full_name:null,staged_at:_scanMode==='stage'?now:null,checked_out_by:_scanMode==='out'?ME?.full_name:null,checked_out_at:_scanMode==='out'?now:null,notes:item.description||'',created_at:now,updated_at:now}
        await sb.from('job_parts').insert(row)
      }
      await sb.from('scan_events').insert({id:uuid(),job_id:jobId,part_id:item.barcode,part_name:item.name,action:_scanMode==='stage'?'stage_in':_scanMode==='out'?'check_out':'return',qty:item.qty,scanned_by:ME?.full_name||'?',scanned_at:now,device_info:navigator.userAgent.slice(0,60)})
      if(_scanMode!=='return'){const{data:inv}=await sb.from('inventory').select('qty').eq('id',item.barcode).maybeSingle();if(inv)await sb.from('inventory').update({qty:Math.max(0,inv.qty-item.qty),updated_at:now}).eq('id',item.barcode)}
    }
    const action=_scanMode==='stage'?'Staged':_scanMode==='out'?'Checked out':'Returned'
    toast(action+' '+_batch.length+' part type(s)')
    clearBatch();loadJobPartsPanel();loadScanEvents()
  }catch(e){toast(e.message,'error')}
  btn.disabled=false;btn.textContent='Commit to Job'
}

async function loadJobPartsPanel(){
  const jobId=document.getElementById('sc-job')?.value;const el=document.getElementById('job-parts-panel');if(!el)return
  if(!jobId){el.innerHTML='<div style="font-size:12px;color:#414e63">Select a job</div>';return}
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',jobId).order('created_at',{ascending:false})
  if(!(parts||[]).length){el.innerHTML='<div style="font-size:12px;color:#414e63">No parts on this job yet</div>';return}
  el.innerHTML='<table class="tbl"><thead><tr><th>Part</th><th>Qty</th><th>Status</th><th>By</th></tr></thead><tbody>'+
    (parts||[]).map(p=>'<tr><td style="font-weight:500;font-size:12px">'+p.part_name+'</td><td>'+p.assigned_qty+'</td>'+
    '<td><span class="badge '+(p.status==='staged'?'bg-amber':p.status==='signed_out'?'bg-blue':'bg-green')+'">'+p.status.replace('_',' ')+'</span></td>'+
    '<td style="font-size:10px;color:#8a96ab">'+(p.staged_by||p.checked_out_by||'—')+'</td></tr>').join('')+
    '</tbody></table>'
}

async function loadScanEvents(){
  const el=document.getElementById('scan-events-panel');if(!el)return
  const{data:events}=await sb.from('scan_events').select('*').order('scanned_at',{ascending:false}).limit(15)
  if(!(events||[]).length){el.innerHTML='<div style="font-size:12px;color:#414e63">No recent scans</div>';return}
  el.innerHTML=events.map(e=>
    '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">'+
    '<span class="badge '+(e.action==='stage_in'?'bg-amber':e.action==='check_out'?'bg-blue':'bg-green')+'" style="flex-shrink:0">'+e.action.replace('_',' ')+'</span>'+
    '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e.part_name+' ×'+e.qty+'</div>'+
    '<div style="font-size:10px;color:#414e63">'+(e.scanned_by||'?')+' · '+fdt(e.scanned_at)+'</div></div></div>'
  ).join('')
}

// ── CAMERA SCANNING ───────────────────────────────────────────
// Uses native BarcodeDetector API (Chrome/Android/iOS 16+)
// Falls back to ZXing WASM for older browsers
// ── CAMERA SCANNING (html5-qrcode) ──────────────────────────
let _h5scanner=null, _scanActive=false, _lastCode='', _lastCodeTime=0

async function toggleCam(){
  if(_scanActive){stopCam();return}
  const btn=document.getElementById('cam-toggle-btn')
  const wrap=document.getElementById('cam-wrap')
  const status=document.getElementById('cam-status')
  if(!wrap)return
  wrap.style.display='block'
  if(btn)btn.textContent='⏹ Stop Camera'
  if(status)status.textContent='Loading scanner…'

  // Load html5-qrcode if not already loaded
  if(!window.Html5Qrcode){
    try{
      await new Promise((res,rej)=>{
        const s=document.createElement('script')
        s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
        s.onload=()=>setTimeout(res,100) // small delay to ensure exports are ready
        s.onerror=rej
        document.head.appendChild(s)
      })
    }catch{
      if(status)status.textContent='Failed to load scanner — check internet connection'
      if(btn)btn.textContent='📷 Start Camera Scanner'
      wrap.style.display='none'
      return
    }
  }

  // Replace the video element with a div that html5-qrcode will manage
  const camViewport=document.getElementById('cam-viewport-wrap')
  if(!camViewport)return
  camViewport.innerHTML='<div id="h5q-reader"></div>'

  try{
    _h5scanner=new Html5Qrcode('h5q-reader',{verbose:false})
    const config={
      fps:10,
      qrbox:{width:250,height:150},
      aspectRatio:1.777,
      formatsToSupport:[
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ]
    }
    await _h5scanner.start(
      {facingMode:'environment'},
      config,
      (code)=>handleDetected(code),
      ()=>{} // ignore errors during scan (normal when no barcode in frame)
    )
    _scanActive=true
    if(btn)btn.textContent='⏹ Stop Camera'
    if(status)status.textContent='Ready — aim at barcode'
    // Style the h5q reader
    const rdr=document.getElementById('h5q-reader')
    if(rdr){
      rdr.style.border='none'
      rdr.style.borderRadius='10px'
      rdr.style.overflow='hidden'
    }
  }catch(e){
    const err=e.message||String(e)
    let msg
    if(err.includes('permission')||err.includes('Permission')||err.includes('NotAllowed')){
      msg=location.protocol!=='https:'
        ?'Needs HTTPS — your URL must start with https://'
        :'Camera denied — tap 🔒 in address bar → Site settings → Camera → Allow → Refresh'
    } else if(err.includes('NotFound')||err.includes('no camera')){
      msg='No camera found on this device'
    } else if(err.includes('NotReadable')||err.includes('busy')){
      msg='Camera in use by another app — close other apps and try again'
    } else {
      msg='Camera error: '+err.substring(0,80)
    }
    if(status)status.textContent=msg
    toast(msg,'error')
    if(_h5scanner)try{await _h5scanner.stop()}catch{}
    _h5scanner=null
    wrap.style.display='none'
    if(btn)btn.textContent='📷 Start Camera Scanner'
  }
}

function handleDetected(code){
  if(!code)return
  const now=Date.now()
  if(code===_lastCode&&now-_lastCodeTime<2000)return
  _lastCode=code;_lastCodeTime=now
  beep()
  const status=document.getElementById('cam-status')
  if(status)status.textContent='✓ '+code
  const bc=document.getElementById('sc-bc');if(bc)bc.value=code
  liveResolveBC(code)
  const match=allCatalog.find(c=>c.barcode===code)
  if(match){
    addToBatch(code,match.name)
    const bc2=document.getElementById('sc-bc');if(bc2)bc2.value=''
    const res=document.getElementById('sc-resolve');if(res)res.style.display='none'
    if(status)status.textContent='Added: '+match.name+' — aim at next'
  } else {
    if(status)status.textContent='Code: '+code+' — not in catalog, set qty and add'
  }
}

async function stopCam(){
  _scanActive=false
  if(_h5scanner){
    try{await _h5scanner.stop()}catch{}
    try{_h5scanner.clear()}catch{}
    _h5scanner=null
  }
  const wrap=document.getElementById('cam-wrap');if(wrap)wrap.style.display='none'
  const btn=document.getElementById('cam-toggle-btn');if(btn)btn.textContent='📷 Start Camera Scanner'
  const vp=document.getElementById('cam-viewport-wrap');if(vp)vp.innerHTML=''
}

// Stop camera when navigating away
const _origP=window.P
window.P=async function(page,el){if(_scanActive)await stopCam();return _origP(page,el)}

// ══════════════════════════════════════════
// CATALOG PAGE
// ══════════════════════════════════════════
async function pgCatalog(){
  document.getElementById('topbar-actions').innerHTML=\`
    <label class="btn btn-sm" style="cursor:pointer">⬇ Import CSV<input type="file" accept=".csv" style="display:none" onchange="importCatalogCSV(this)"></label>
    <button class="btn btn-sm" onclick="exportCatalogCSV()">⬆ Export CSV</button>
    <button class="btn btn-p btn-sm" onclick="addCatalogModal()">+ Add Part</button>\`
  const{data:cat}=await sb.from('catalog').select('*').order('name')
  allCatalog=cat||[]
  renderCatalogTable('')
}
function renderCatalogTable(q){
  const f=allCatalog.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase())||c.barcode.toLowerCase().includes(q.toLowerCase())||(c.part_number||'').toLowerCase().includes(q.toLowerCase())||(c.category||'').toLowerCase().includes(q.toLowerCase()))
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:12px"><input class="fi" placeholder="Search catalog by name, barcode, or part #…" style="max-width:360px" oninput="renderCatalogTable(this.value)" value="\${q}"></div>
  <div class="card" style="padding:0;overflow:hidden">
  \${f.length?\`<table class="tbl"><thead><tr><th>Name</th><th>Barcode</th><th>Part #</th><th>Category</th><th>Description</th><th>Unit Cost</th><th>UOM</th><th>Vendor</th><th></th></tr></thead><tbody>
  \${f.map(c=>\`<tr><td style="font-weight:500">\${c.name}</td><td style="font-size:10px;font-family:'DM Mono',monospace;color:#8a96ab">\${c.barcode}</td><td style="font-size:11px;color:#8a96ab">\${c.part_number||'—'}</td><td style="font-size:11px">\${c.category||'—'}</td><td style="font-size:11px;color:#8a96ab;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${c.description||'—'}</td><td style="font-size:11px">\${c.unit_cost?fm(c.unit_cost,2):'—'}</td><td style="font-size:11px;color:#8a96ab">\${c.unit_of_measure||'ea'}</td><td style="font-size:11px;color:#8a96ab">\${c.vendor||'—'}</td><td><button class="btn btn-sm" onclick="editCatalogModal('\${c.barcode}')">Edit</button><button class="btn btn-sm btn-ghost" style="color:#dc2626;margin-left:3px" onclick="delCatalog('\${c.barcode}')">Del</button></td></tr>\`).join('')}
  </tbody></table>\`:empty('📋','No parts in catalog — add or import CSV')}
  </div>\`
}
function addCatalogModal(){
  modal('Add Part to Catalog',\`
  <div class="fg"><label class="fl">Barcode *</label><input class="fi" id="ca-bc" placeholder="UPC, EAN, or custom barcode"></div>
  <div class="fg"><label class="fl">Part Name *</label><input class="fi" id="ca-nm"></div>
  <div class="two"><div class="fg"><label class="fl">Part Number</label><input class="fi" id="ca-pn" placeholder="Manufacturer #"></div><div class="fg"><label class="fl">Category</label><input class="fi" id="ca-cat" placeholder="Electrical, Plumbing…"></div></div>
  <div class="fg"><label class="fl">Description</label><textarea class="ft" id="ca-desc" style="min-height:55px"></textarea></div>
  <div class="three"><div class="fg"><label class="fl">Unit Cost ($)</label><input class="fi" type="number" id="ca-cost" step="0.01"></div><div class="fg"><label class="fl">Unit of Measure</label><select class="fs" id="ca-uom"><option value="each">Each</option><option value="ft">Foot</option><option value="lf">Linear Ft</option><option value="box">Box</option><option value="roll">Roll</option><option value="lb">Pound</option><option value="gal">Gallon</option></select></div><div class="fg"><label class="fl">Vendor</label><input class="fi" id="ca-vendor"></div></div>\`,
  async()=>{
    const bc=v('ca-bc').trim(),nm=v('ca-nm').trim()
    if(!bc||!nm){toast('Barcode and name required','error');return}
    const{error}=await sb.from('catalog').insert({barcode:bc,name:nm,part_number:v('ca-pn'),category:v('ca-cat'),description:v('ca-desc'),unit_cost:parseFloat(v('ca-cost'))||0,unit_of_measure:v('ca-uom')||'each',vendor:v('ca-vendor')})
    if(error)toast(error.message,'error');else{closeModal();toast('Part added');pgCatalog()}
  })
}
function editCatalogModal(bc){
  const c=allCatalog.find(x=>x.barcode===bc);if(!c)return
  modal('Edit Part — '+c.name,\`
  <div style="font-size:11px;color:#414e63;margin-bottom:10px;font-family:'DM Mono',monospace">Barcode: \${c.barcode}</div>
  <div class="fg"><label class="fl">Part Name *</label><input class="fi" id="ec-nm" value="\${c.name||''}"></div>
  <div class="two"><div class="fg"><label class="fl">Part Number</label><input class="fi" id="ec-pn" value="\${c.part_number||''}"></div><div class="fg"><label class="fl">Category</label><input class="fi" id="ec-cat" value="\${c.category||''}"></div></div>
  <div class="fg"><label class="fl">Description</label><textarea class="ft" id="ec-desc" style="min-height:55px">\${c.description||''}</textarea></div>
  <div class="three"><div class="fg"><label class="fl">Unit Cost ($)</label><input class="fi" type="number" id="ec-cost" value="\${c.unit_cost||''}" step="0.01"></div><div class="fg"><label class="fl">UOM</label><input class="fi" id="ec-uom" value="\${c.unit_of_measure||'each'}"></div><div class="fg"><label class="fl">Vendor</label><input class="fi" id="ec-vendor" value="\${c.vendor||''}"></div></div>\`,
  async()=>{
    const{error}=await sb.from('catalog').update({name:v('ec-nm'),part_number:v('ec-pn'),category:v('ec-cat'),description:v('ec-desc'),unit_cost:parseFloat(v('ec-cost'))||0,unit_of_measure:v('ec-uom')||'each',vendor:v('ec-vendor')}).eq('barcode',bc)
    if(error)toast(error.message,'error');else{closeModal();toast('Updated');pgCatalog()}
  })
}
async function delCatalog(bc){if(!confirm('Delete this part from catalog?'))return;const{error}=await sb.from('catalog').delete().eq('barcode',bc);if(error)toast(error.message,'error');else{toast('Deleted');pgCatalog()}}
async function importCatalogCSV(input){
  const file=input.files[0];if(!file)return
  const text=await file.text()
  const lines=text.split('\\n').filter(l=>l.trim())
  const hdrs=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase())
  let added=0,updated=0,errors=0
  for(const line of lines.slice(1)){
    const vals=line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
    const row={}
    hdrs.forEach((h,i)=>row[h]=vals[i]||'')
    const bc=row['barcode']||row['upc']||row['part barcode']
    const nm=row['name']||row['part name']||row['description']
    if(!bc||!nm)continue
    const data={barcode:bc,name:nm,part_number:row['part number']||row['part#']||'',category:row['category']||'',description:row['description']||row['notes']||'',unit_cost:parseFloat(row['unit cost']||row['cost']||row['price'])||0,unit_of_measure:row['uom']||row['unit']||'each',vendor:row['vendor']||row['supplier']||''}
    const{error}=await sb.from('catalog').upsert(data,{onConflict:'barcode'})
    if(error)errors++;else added++
  }
  toast(\`Imported \${added} parts\${errors?' ('+errors+' errors)':''}\`,errors?'warn':'success')
  pgCatalog()
  input.value=''
}
async function exportCatalogCSV(){
  const{data:cat}=await sb.from('catalog').select('*').order('name')
  const rows=[['Barcode','Name','Part Number','Category','Description','Unit Cost','UOM','Vendor']]
  ;(cat||[]).forEach(c=>rows.push([c.barcode,c.name,c.part_number||'',c.category||'',c.description||'',c.unit_cost||0,c.unit_of_measure||'each',c.vendor||'']))
  const csv=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='FieldAxisHQ-Catalog-'+new Date().toISOString().split('T')[0]+'.csv';a.click();toast('Catalog exported')
}

// ══════════════════════════════════════════
// INVENTORY PAGE
// ══════════════════════════════════════════
async function pgInventory(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="adjStockModal()">+ Adjust Stock</button>'
  const{data:inv}=await sb.from('inventory').select('*').order('name')
  const rows=inv||[]
  document.getElementById('page-area').innerHTML=\`
  <div class="stats" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat"><div class="stat-label">Total Items</div><div class="stat-value">\${rows.length}</div></div>
    <div class="stat"><div class="stat-label">Low Stock</div><div class="stat-value" style="color:#dc2626">\${rows.filter(i=>i.min_qty>0&&i.qty<=i.min_qty).length}</div></div>
    <div class="stat"><div class="stat-label">Out of Stock</div><div class="stat-value" style="color:#dc2626">\${rows.filter(i=>i.qty<=0).length}</div></div>
  </div>
  <div style="margin-bottom:12px"><input class="fi" placeholder="Search stock…" style="max-width:300px" id="inv-search" oninput="filterInv(this.value)"></div>
  <div class="card" style="padding:0;overflow:hidden" id="inv-table-wrap">
  \${renderInvTable(rows)}
  </div>\`
}
function renderInvTable(rows){
  return rows.length?\`<table class="tbl"><thead><tr><th>Name</th><th>Barcode/ID</th><th>Qty</th><th>Min Qty</th><th>Status</th><th></th></tr></thead><tbody>\${rows.map(i=>{const low=i.min_qty>0&&i.qty<=i.min_qty;const out=i.qty<=0;return\`<tr><td style="font-weight:500">\${i.name}</td><td style="font-size:10px;font-family:'DM Mono',monospace;color:#8a96ab">\${i.id}</td><td style="font-weight:600;color:\${out?'#dc2626':low?'#d97706':'#e8edf5'}">\${i.qty}</td><td style="color:#414e63">\${i.min_qty||0}</td><td>\${out?'<span class="badge bg-red">Out of Stock</span>':low?'<span class="badge bg-amber">Low Stock</span>':'<span class="badge bg-green">OK</span>'}</td><td><button class="btn btn-sm" onclick="adjStockModal('\${i.id}','\${(i.name||'').replace(/'/g,"\\\\'")}',\${i.qty},\${i.min_qty||0})">Adjust</button></td></tr>\`}).join('')}</tbody></table>\`:empty('📦','No inventory items')
}
let _invCache=[]
async function pgInventoryLoad(){const{data}=await sb.from('inventory').select('*').order('name');_invCache=data||[];return _invCache}
function filterInv(q){const el=document.getElementById('inv-table-wrap');if(!el)return;const rows=(window._invAllRows||[]).filter(i=>!q||(i.name||'').toLowerCase().includes(q.toLowerCase())||i.id.toLowerCase().includes(q.toLowerCase()));el.innerHTML=renderInvTable(rows)}
function adjStockModal(id='',name='',qty=0,min=0){
  const isNew=!id
  modal(isNew?'Add Stock Item':'Adjust: '+name,\`
  \${isNew?\`<div class="fg"><label class="fl">Barcode/ID *</label><input class="fi" id="iv-id" placeholder="Use same barcode as catalog"></div><div class="fg"><label class="fl">Name</label><input class="fi" id="iv-nm"></div>\`:''}
  <div class="two">
    <div class="fg"><label class="fl">\${isNew?'Starting Qty':'Add / Remove Qty'}</label><input class="fi" type="number" id="iv-qty" value="0"></div>
    <div class="fg"><label class="fl">Min Qty Alert</label><input class="fi" type="number" id="iv-min" value="\${min}" min="0"></div>
  </div>
  \${!isNew?\`<div style="font-size:12px;color:#8a96ab;margin-bottom:8px">Current qty: <strong style="color:#e8edf5">\${qty}</strong> → New: <strong id="iv-preview" style="color:#60a5fa">\${qty}</strong></div>\`:''}\`,
  async()=>{
    const iid=isNew?v('iv-id').trim():id;if(!iid)return
    const inm=isNew?v('iv-nm'):name
    const delta=parseInt(v('iv-qty'))||0
    const minQ=parseInt(v('iv-min'))||0
    if(isNew){const{error}=await sb.from('inventory').insert({id:iid,name:inm,qty:delta,min_qty:minQ,updated_at:new Date().toISOString()});if(error){toast(error.message,'error');return}}
    else{const{data:cur}=await sb.from('inventory').select('qty').eq('id',iid).single();const newQ=Math.max(0,(cur?.qty||0)+delta);await sb.from('inventory').update({qty:newQ,min_qty:minQ,updated_at:new Date().toISOString()}).eq('id',iid)}
    closeModal();toast('Stock updated OK');pgInventory()
  })
  if(!isNew){setTimeout(()=>{const el=document.getElementById('iv-qty');if(el)el.addEventListener('input',()=>{const prev=document.getElementById('iv-preview');if(prev)prev.textContent=Math.max(0,qty+(parseInt(el.value)||0))})},50)}
}

// ══════════════════════════════════════════
// ORDERS PAGE
// ══════════════════════════════════════════
async function pgOrders(){
  const[{data:orders},{data:jobs}]=await Promise.all([
    sb.from('orders').select('*').order('created_at',{ascending:false}),
    sb.from('jobs').select('id,name').eq('archived',false).order('name')
  ])
  const{data:cat}=await sb.from('catalog').select('*').order('name')
  allCatalog=cat||[]
  window._ordItems=[]
  document.getElementById('page-area').innerHTML=\`
  <div class="card" style="margin-bottom:14px">
    <div class="card-title">New Order Request</div>
    <div class="two"><div class="fg"><label class="fl">Job *</label><select class="fs" id="ord-job"><option value="">— Select —</option>\${(jobs||[]).map(j=>\`<option value="\${j.id}">\${j.name}</option>\`).join('')}</select></div><div class="fg"><label class="fl">Notes</label><input class="fi" id="ord-notes"></div></div>
    <div id="ord-items-display" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px"></div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input class="fi" id="ord-bc" placeholder="Barcode or part name" style="flex:1" oninput="liveResolveBC(this.value)">
      <input class="fi" id="ord-qty" type="number" value="1" min="1" style="width:65px">
      <button class="btn btn-p btn-sm" onclick="addOrdItem()">Add</button>
    </div>
    <button class="btn btn-p btn-full" onclick="submitOrder()">Submit Order</button>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  \${(orders||[]).length?\`<table class="tbl"><thead><tr><th>Job</th><th>Items</th><th>By</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>\${(orders||[]).map(o=>{const items=typeof o.items==='string'?JSON.parse(o.items||'[]'):(o.items||[]);return\`<tr><td style="font-weight:500">\${o.job_id}</td><td style="font-size:11px;color:#8a96ab">\${items.length} type(s), \${items.reduce((s,i)=>s+(i.qty||0),0)} total</td><td style="font-size:11px">\${o.created_by||'—'}</td><td style="font-size:11px">\${fd(o.created_at)}</td><td><span class="badge \${o.status==='staged'?'bg-green':o.status==='approved'?'bg-blue':o.status==='rejected'?'bg-red':'bg-amber'}">\${o.status}</span></td><td style="display:flex;gap:5px">\${o.status==='pending'?\`<button class="btn btn-sm btn-g" onclick="approveOrder('\${o.id}')">Stage</button><button class="btn btn-sm btn-r" onclick="rejectOrder('\${o.id}')">Reject</button>\`:''}</td></tr>\`}).join('')}</tbody></table>\`:empty('🛒','No orders yet')}
  </div>\`
}
function addOrdItem(){
  if(!window._ordItems)window._ordItems=[]
  const bc=v('ord-bc').trim(),qty=parseInt(v('ord-qty'))||1;if(!bc)return
  const cat=allCatalog.find(c=>c.barcode===bc||c.name.toLowerCase()===bc.toLowerCase())
  window._ordItems.push({partId:bc,name:cat?.name||bc,qty})
  document.getElementById('ord-bc').value='';document.getElementById('ord-qty').value=1
  document.getElementById('ord-items-display').innerHTML=window._ordItems.map((i,x)=>\`<div class="file-chip">\${i.name} ×\${i.qty}<span class="rm" onclick="window._ordItems.splice(\${x},1);document.getElementById('ord-items-display').innerHTML=window._ordItems.map((i,y)=>'<div class=file-chip>'+i.name+' ×'+i.qty+'</div>').join('')">×</span></div>\`).join('')
}
async function submitOrder(){
  const jobId=v('ord-job');if(!jobId){toast('Select a job','error');return}
  if(!window._ordItems?.length){toast('Add at least one part','warn');return}
  const{data:job}=await sb.from('jobs').select('name').eq('id',jobId).single()
  const{error}=await sb.from('orders').insert({id:uuid(),job_id:job?.name||jobId,items:window._ordItems,notes:v('ord-notes'),status:'pending',created_by:ME?.full_name,created_at:new Date().toISOString()})
  if(error)toast(error.message,'error');else{toast('Order submitted');window._ordItems=[];pgOrders()}
}
async function approveOrder(id){await sb.from('orders').update({status:'staged',staged_by:ME?.full_name,staged_at:new Date().toISOString()}).eq('id',id);toast('Staged OK');pgOrders()}
async function rejectOrder(id){const n=prompt('Reason for rejection:');if(n===null)return;await sb.from('orders').update({status:'rejected',rejected_by:ME?.full_name,rejection_note:n,rejected_at:new Date().toISOString()}).eq('id',id);toast('Rejected','warn');pgOrders()}

// ══════════════════════════════════════════
// GPS TRACKING PAGE
// ══════════════════════════════════════════
async function pgGPS(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-sm" onclick="pgGPS()">↻ Refresh</button>'
  const today=new Date().toISOString().split('T')[0]
  const{data:ciRaw}=await sb.from('checkins').select('*').gte('checkin_at',today+'T00:00:00').order('checkin_at',{ascending:false})
  const wIds=[...new Set((ciRaw||[]).map(c=>c.worker_id).filter(Boolean))]
  const jIds=[...new Set((ciRaw||[]).map(c=>c.job_id).filter(Boolean))]
  const[{data:gpsProf},{data:gpsJobs}]=await Promise.all([
    wIds.length?sb.from('profiles').select('id,full_name,companies(name)').in('id',wIds):Promise.resolve({data:[]}),
    jIds.length?sb.from('jobs').select('id,name').in('id',jIds):Promise.resolve({data:[]})
  ])
  const gpsWMap={}; (gpsProf||[]).forEach(p=>{gpsWMap[p.id]={name:p.full_name,company:p.companies?.name||'—'}})
  const gpsJMap={}; (gpsJobs||[]).forEach(j=>gpsJMap[j.id]=j.name)
  const ci=(ciRaw||[]).map(c=>({...c,workerName:gpsWMap[c.worker_id]?.name||'?',companyName:gpsWMap[c.worker_id]?.company||'—',jobName:gpsJMap[c.job_id]||'—'}))
  document.getElementById('page-area').innerHTML=\`
  <div class="stats" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat"><div class="stat-label">Currently On Site</div><div class="stat-value" style="color:#16a34a">\${(ci||[]).filter(c=>!c.checkout_at).length}</div></div>
    <div class="stat"><div class="stat-label">Check-ins Today</div><div class="stat-value">\${(ci||[]).length}</div></div>
    <div class="stat"><div class="stat-label">Total Hours Today</div><div class="stat-value">\${fh((ci||[]).reduce((s,c)=>s+(c.hours_logged||0),0))}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  \${(ci||[]).length?\`<table class="tbl"><thead><tr><th>Worker</th><th>Company</th><th>Job</th><th>In</th><th>Out</th><th>Hours</th><th>Distance</th><th>GPS</th></tr></thead><tbody>\${(ci||[]).map(c=>\`<tr>
    <td><div style="display:flex;align-items:center;gap:7px"><div class="av" style="width:22px;height:22px;font-size:8px;\${Object.entries(avS(c.profiles?.full_name)).map(([k,val])=>k+':'+val).join(';')}">\${ini(c.profiles?.full_name)}</div>\${c.workerName||'?'}</div></td>
    <td style="font-size:11px;color:#8a96ab">\${c.companyName||'—'}</td>
    <td>\${c.jobName||'—'}</td>
    <td style="font-size:11px">\${ft(c.checkin_at)}</td>
    <td style="font-size:11px">\${c.checkout_at?ft(c.checkout_at):'<span class="gps-live" style="font-size:9px"><span class="pulse"></span>On Site</span>'}</td>
    <td style="font-weight:500">\${c.hours_logged?fh(c.hours_logged):'—'}</td>
    <td>\${c.checkin_dist_ft!=null?\`<span class="badge bg-green">\${c.checkin_dist_ft}ft</span>\`:'—'}</td>
    <td style="font-size:10px;color:#414e63;font-family:'DM Mono',monospace">\${c.checkin_lat?c.checkin_lat.toFixed(4)+','+c.checkin_lng.toFixed(4):'—'}</td>
  </tr>\`).join('')}</tbody></table>\`:empty('📍','No check-ins today')}
  </div>\`
}

// ══════════════════════════════════════════
// HOURS PAGE
// ══════════════════════════════════════════
async function pgHours(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-sm" onclick="exportHoursExcel()">⬆ Export Excel</button>'
  const[{data:ciHoursRaw},{data:profiles}]=await Promise.all([
    sb.from('checkins').select('*').not('hours_logged','is',null).order('checkin_at',{ascending:false}).limit(200),
    sb.from('profiles').select('id,full_name,role,companies(name)').eq('is_active',true)
  ])
  const byTech={},byJob={}
  ;(ci||[]).forEach(c=>{
    const n=c.workerName||'?'
    const j=c.jobName||c.job_id
    if(!byTech[n])byTech[n]={name:n,role:c.workerRole||'—',company:c.workerCompany,hours:0,days:new Set()}
    byTech[n].hours+=(c.hours_logged||0)
    byTech[n].days.add(c.checkin_at?.split('T')[0])
    if(!byJob[j])byJob[j]={name:j,hours:0,checkins:0}
    byJob[j].hours+=(c.hours_logged||0)
    byJob[j].checkins++
  })
  const techRows=Object.values(byTech).sort((a,b)=>b.hours-a.hours)
  const jobRows=Object.values(byJob).sort((a,b)=>b.hours-a.hours)
  document.getElementById('page-area').innerHTML=\`
  <div class="two">
    <div class="card"><div class="card-title">By Technician / Worker</div>
    \${techRows.length?\`<table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Days</th><th>Total Hours</th></tr></thead><tbody>\${techRows.map(t=>\`<tr><td style="font-weight:500">\${t.name}</td><td>\${roleBadge(t.role)}</td><td style="font-size:11px;color:#8a96ab">\${t.company}</td><td>\${t.days.size}</td><td style="font-weight:500;font-family:'DM Mono',monospace">\${fh(t.hours)}</td></tr>\`).join('')}</tbody></table>\`:empty('⏱','No hours data')}
    </div>
    <div class="card"><div class="card-title">By Job</div>
    \${jobRows.length?\`<table class="tbl"><thead><tr><th>Job</th><th>Check-ins</th><th>Total Hours</th></tr></thead><tbody>\${jobRows.map(j=>\`<tr><td style="font-weight:500">\${j.name}</td><td>\${j.checkins}</td><td style="font-weight:500;font-family:'DM Mono',monospace">\${fh(j.hours)}</td></tr>\`).join('')}</tbody></table>\`:empty('⏱','No hours data')}
    </div>
  </div>
  <div class="card">
    <div class="card-title">All Check-in Records</div>
    \${(ci||[]).length?\`<table class="tbl"><thead><tr><th>Worker</th><th>Job</th><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Dist</th></tr></thead><tbody>\${(ci||[]).slice(0,50).map(c=>\`<tr><td style="font-weight:500">\${c.workerName||'?'}</td><td>\${c.jobName||'—'}</td><td style="font-size:11px">\${fd(c.checkin_at)}</td><td style="font-size:11px">\${ft(c.checkin_at)}</td><td style="font-size:11px">\${c.checkout_at?ft(c.checkout_at):'Active'}</td><td style="font-weight:500">\${fh(c.hours_logged)}</td><td>\${c.checkin_dist_ft!=null?c.checkin_dist_ft+'ft':'—'}</td></tr>\`).join('')}</tbody></table>\`:empty('⏱','No check-in records')}
  </div>\`
}
async function exportHoursExcel(){
  const{data:ci}=await sb.from('checkins').select('*').not('hours_logged','is',null).order('checkin_at',{ascending:false})
  const rows=(ci||[]).map(c=>({'Worker':c.workerName||'?','Role':c.workerRole||'—','Company':c.workerCompany,'Job':c.jobName||'—','Date':c.checkin_at?.split('T')[0],'Check-in':ft(c.checkin_at),'Check-out':c.checkout_at?ft(c.checkout_at):'—','Hours':c.hours_logged||0,'Distance (ft)':c.checkin_dist_ft||'—'}))
  const ws=XLSX.utils.json_to_sheet(rows)
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Hours')
  XLSX.writeFile(wb,'FieldAxisHQ-Hours-'+new Date().toISOString().split('T')[0]+'.xlsx')
  toast('Hours exported')
}

// ══════════════════════════════════════════
// SUB COMPANIES PAGE
// ══════════════════════════════════════════
async function pgCompanies(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="addCompanyModal()">+ Add Company</button>'
  const[{data:cos},{data:profiles}]=await Promise.all([
    sb.from('companies').select('*').eq('is_active',true).order('name'),
    sb.from('profiles').select('*').eq('is_active',true)
  ])
  const byC={};(profiles||[]).forEach(p=>{if(p.company_id){if(!byC[p.company_id])byC[p.company_id]=[];byC[p.company_id].push(p)}})
  document.getElementById('page-area').innerHTML=(cos||[]).map(co=>{
    const ws=byC[co.id]||[]
    const insExp=co.ins_expiry?daysAway(co.ins_expiry):null
    const insStatus=insExp===null?'unknown':insExp<0?'expired':insExp<30?'expiring':'ok'
    return\`<div class="card" style="margin-bottom:13px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div><div style="font-family:Syne,sans-serif;font-size:15px;font-weight:700">\${co.name}</div><div style="font-size:11px;color:#414e63;margin-top:2px">\${co.trade||''} \${co.license_num?'· Lic: '+co.license_num:''} \${co.email?'· '+co.email:''}</div></div>
      <div style="display:flex;gap:7px;align-items:center">
        <span class="badge \${insStatus==='ok'?'bg-green':insStatus==='expiring'?'bg-amber':'bg-red'}">\${insStatus==='ok'?'GL Insurance OK':insStatus==='expiring'?'Ins Expiring Soon':'Ins Expired/Unknown'}</span>
        \${co.ins_expiry?\`<span style="font-size:10px;color:#414e63">Exp: \${fd(co.ins_expiry)}</span>\`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
      \${ws.map(w=>\`<div style="background:#131c2e;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;display:flex;gap:10px;align-items:flex-start">
        <div class="av" style="width:38px;height:38px;font-size:13px;flex-shrink:0;\${Object.entries(avS(w.full_name)).map(([k,val])=>k+':'+val).join(';')}">\${ini(w.full_name)}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:12px">\${w.full_name}\${w.is_lead?' <span style="font-size:9px;color:#d97706">LEAD</span>':''}</div><div style="font-size:10px;color:#414e63;margin-top:1px">\${w.email||''}</div><div style="font-size:10px;color:#414e63">\${w.phone||''}</div><div style="margin-top:5px">\${roleBadge(w.role)}</div></div>
      </div>\`).join('')}
      <div style="background:#131c2e;border:1.5px dashed rgba(255,255,255,.08);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;min-height:80px" onclick="addWorkerToCoModal('\${co.id}')">
        <div style="text-align:center;color:#414e63"><div style="font-size:20px">+</div><div style="font-size:11px;margin-top:3px">Add Worker</div></div>
      </div>
    </div>
    </div>\`
  }).join('')||empty('🏢','No sub companies yet')
}
function addCompanyModal(){
  modal('Add Sub Company',\`
  <div class="fg"><label class="fl">Company Name *</label><input class="fi" id="nc-nm"></div>
  <div class="two"><div class="fg"><label class="fl">Trade</label><input class="fi" id="nc-tr" placeholder="HVAC, Electrical…"></div><div class="fg"><label class="fl">License #</label><input class="fi" id="nc-lic"></div></div>
  <div class="two"><div class="fg"><label class="fl">Email</label><input class="fi" id="nc-em" type="email"></div><div class="fg"><label class="fl">Phone</label><input class="fi" id="nc-ph"></div></div>
  <div class="fg"><label class="fl">GL Insurance Expiry</label><input class="fi" id="nc-ins" type="date"></div>\`,
  async()=>{const nm=v('nc-nm').trim();if(!nm)return;const{error}=await sb.from('companies').insert({id:uuid(),name:nm,trade:v('nc-tr'),license_num:v('nc-lic'),email:v('nc-em'),phone:v('nc-ph'),ins_expiry:v('nc-ins')||null,is_active:true,created_at:new Date().toISOString()});if(error)toast(error.message,'error');else{closeModal();toast('Company added');pgCompanies()}})
}
function addWorkerToCoModal(coId){
  modal('Add Worker',\`
  <div class="fg"><label class="fl">Full Name *</label><input class="fi" id="nw-nm"></div>
  <div class="fg"><label class="fl">Email *</label><input class="fi" id="nw-em" type="email"></div>
  <div class="fg"><label class="fl">Phone</label><input class="fi" id="nw-ph"></div>
  <div class="fg"><label class="fl">Role</label><select class="fs" id="nw-rl"><option value="sub_worker">Worker</option><option value="sub_lead">Lead</option><option value="technician">Technician</option><option value="foreman">Foreman</option></select></div>\`,
  async()=>{const nm=v('nw-nm').trim(),em=v('nw-em').trim();if(!nm||!em){toast('Name and email required','error');return};const{error}=await sb.from('profiles').insert({id:uuid(),company_id:coId,full_name:nm,email:em,phone:v('nw-ph'),role:v('nw-rl'),is_lead:v('nw-rl')==='sub_lead',is_active:true,created_at:new Date().toISOString()});if(error)toast(error.message,'error');else{closeModal();toast('Worker added — invite via Supabase Auth to set password');pgCompanies()}})
}

// ══════════════════════════════════════════
// SAFETY TOPICS PAGE
// ══════════════════════════════════════════
async function checkSafetyBadge(){
  try{const{count}=await sb.from('safety_assignments').select('id',{count:'exact',head:true}).is('acknowledged_at',null);const b=document.getElementById('nb-safety');if(b){b.textContent=count||0;b.style.display=count>0?'inline-block':'none'}}catch{}
}
async function pgSafety(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-sm" onclick="exportSafetyCSV()">⬆ Export Report</button>'+
    '<button class="btn btn-p btn-sm" onclick="newSafetyTopicModal()">+ New Topic</button>'
  const[{data:topics},{data:allAcks},{data:allAssigns}]=await Promise.all([
    sb.from('safety_topics').select('*').order('week_of',{ascending:false,nullsFirst:false}),
    sb.from('safety_acks').select('*,profiles:profile_id(full_name,role,companies(name))').order('acknowledged_at',{ascending:false}),
    sb.from('safety_assignments').select('*,profiles:profile_id(full_name,role,companies(name))').order('assigned_at',{ascending:false})
  ])
  // Stats
  const totalTopics=(topics||[]).length
  const totalAssigned=new Set((allAssigns||[]).map(a=>a.profile_id)).size
  const totalAcked=new Set((allAcks||[]).map(a=>a.profile_id)).size
  const pendingCount=(allAssigns||[]).filter(a=>{
    return !((allAcks||[]).find(ak=>ak.topic_id===a.topic_id&&ak.profile_id===a.profile_id))
  }).length
  const pa=document.getElementById('page-area')
  let html=
    '<div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">'+
    '<div class="stat"><div class="stat-label">Topics</div><div class="stat-value">'+totalTopics+'</div></div>'+
    '<div class="stat"><div class="stat-label">Assigned To</div><div class="stat-value">'+totalAssigned+'</div></div>'+
    '<div class="stat"><div class="stat-label">Completed</div><div class="stat-value" style="color:#16a34a">'+totalAcked+'</div></div>'+
    '<div class="stat"><div class="stat-label">Pending</div><div class="stat-value" style="color:'+(pendingCount?'#dc2626':'#16a34a')+'">'+pendingCount+'</div></div>'+
    '</div>'
  // Tab bar: Topics | Compliance Report
  const svTopicCls=window._safetyView!=='report'?'btn-p':''
  const svReportCls=window._safetyView==='report'?'btn-p':''
  html+='<div style="display:flex;gap:8px;margin-bottom:13px">'+
    '<button class="btn '+svTopicCls+'" onclick="window._safetyView=\\'topics\\';pgSafety()">Topics</button>'+
    '<button class="btn '+svReportCls+'" onclick="window._safetyView=\\'report\\';pgSafety()">Compliance Report</button>'+
    '</div>'
  if(window._safetyView==='report'){
    // Full compliance grid: employees vs topics
    const{data:allProfiles}=await sb.from('profiles').select('id,full_name,role,companies(name)').eq('is_active',true).order('full_name')
    const profiles=allProfiles||[]
    const ackMap={} // ackMap[profile_id+topic_id] = ack record
    ;(allAcks||[]).forEach(a=>{ackMap[a.profile_id+'_'+a.topic_id]=a})
    const assignMap={}
    ;(allAssigns||[]).forEach(a=>{assignMap[a.profile_id+'_'+a.topic_id]=a})
    html+='<div class="card" style="padding:0;overflow:hidden;overflow-x:auto"><table class="tbl"><thead><tr>'
    html+='<th style="min-width:150px;position:sticky;left:0;background:#131c2e;z-index:1">Employee</th>'
    html+='<th>Role</th>'
    ;(topics||[]).forEach(t=>{
      html+='<th style="min-width:120px;font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.title+'">'+t.title.substring(0,20)+(t.title.length>20?'…':'')+'</th>'
    })
    html+='</tr></thead><tbody>'
    profiles.forEach(p=>{
      const assignedTopics=(allAssigns||[]).filter(a=>a.profile_id===p.id)
      if(!assignedTopics.length) return // skip unassigned employees
      html+='<tr onclick="viewEmployeeModal(\\"'+p.id+'\\")" style="cursor:pointer">'
      html+='<td style="position:sticky;left:0;background:#0c1220;font-weight:500">'+p.full_name+'<div style="font-size:9px;color:#414e63">'+(p.companies?.name||'Internal')+'</div></td>'
      html+='<td>'+roleBadge(p.role)+'</td>'
      ;(topics||[]).forEach(t=>{
        const ack=ackMap[p.id+'_'+t.id]
        const assigned=assignMap[p.id+'_'+t.id]
        if(ack){
          html+='<td title="Completed '+fdt(ack.acknowledged_at)+'"><span class="badge bg-green" style="font-size:9px">✓ '+fd(ack.acknowledged_at)+'</span></td>'
        }else if(assigned){
          const overdue=assigned.due_date&&new Date(assigned.due_date)<new Date()
          html+='<td><span class="badge '+(overdue?'bg-red':'bg-amber')+'" style="font-size:9px">'+(overdue?'Overdue':'Pending')+'</span></td>'
        }else{
          html+='<td><span style="font-size:10px;color:#1a2540">—</span></td>'
        }
      })
      html+='</tr>'
    })
    html+='</tbody></table></div>'
  } else {
    // Topics list view
    html+=(topics||[]).map(t=>safetyTopicCard(t,allAcks||[],allAssigns||[])).join('')||empty('🛡','No safety topics yet')
  }
  pa.innerHTML=html
}


function safetyTopicCard(t, allAcks, allAssigns){
  const tAcks=allAcks.filter(a=>a.topic_id===t.id)
  const tAssigns=allAssigns.filter(a=>a.topic_id===t.id)
  const tPending=tAssigns.filter(a=>!tAcks.find(ak=>ak.profile_id===a.profile_id))
  const safeTitle=t.title.replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  return '<div class="card" style="margin-bottom:10px">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px">'+
    '<div><div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700">'+t.title+'</div>'+
    '<div style="font-size:11px;color:#414e63;margin-top:2px">'+t.category+' · Week of '+fd(t.week_of)+' · By '+(t.created_by||'—')+'</div></div>'+
    '<div style="display:flex;gap:6px">'+
    '<button class="btn btn-sm" onclick="viewSafetyAcks(this.dataset.id)" data-id="'+t.id+'">View Acks</button>'+
    '<button class="btn btn-sm btn-p" onclick="assignSafetyModal(this.dataset.id,this.dataset.title)" data-id="'+t.id+'" data-title="'+safeTitle+'">Assign</button>'+
    '</div></div>'+
    '<div style="font-size:12px;color:#8a96ab;line-height:1.6;margin-bottom:9px">'+t.content.substring(0,200)+(t.content.length>200?'…':'')+'</div>'+
    '<div style="display:flex;gap:12px;font-size:11px">'+
    '<span style="color:#16a34a">✓ '+tAcks.length+' completed</span>'+
    '<span style="color:#414e63">/ '+tAssigns.length+' assigned</span>'+
    (tPending.length?'<span style="color:#dc2626">⚠ '+tPending.length+' pending</span>':'')+
    '</div></div>'
}
async function exportSafetyCSV(){
  const[{data:topics},{data:acks},{data:assigns}]=await Promise.all([
    sb.from('safety_topics').select('*').order('week_of',{ascending:false}),
    sb.from('safety_acks').select('*,profiles:profile_id(full_name,role,companies(name))'),
    sb.from('safety_assignments').select('*,profiles:profile_id(full_name,role)')
  ])
  const ackMap={}
  ;(acks||[]).forEach(a=>{ackMap[a.profile_id+'_'+a.topic_id]=a})
  const rows=[['Topic','Category','Week Of','Employee','Role','Assigned Date','Due Date','Status','Completed At']]
  ;(assigns||[]).forEach(a=>{
    const topic=(topics||[]).find(t=>t.id===a.topic_id)
    const ack=ackMap[a.profile_id+'_'+a.topic_id]
    rows.push([
      topic?.title||'',topic?.category||'',fd(topic?.week_of),
      a.profiles?.full_name||'',a.profiles?.role||'',
      fd(a.assigned_at),fd(a.due_date),
      ack?'Completed':'Pending',
      ack?fdt(ack.acknowledged_at):''
    ])
  })
  const csv=rows.map(r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='Safety-Training-Report-'+new Date().toISOString().split('T')[0]+'.csv';a.click();toast('Report exported')
}

async function assignSafetyModal(topicId,topicTitle){
  const[{data:profiles},{data:already}]=await Promise.all([
    sb.from('profiles').select('id,full_name,role,companies(name)').eq('is_active',true).order('full_name'),
    sb.from('safety_assignments').select('assigned_to').eq('topic_id',topicId)
  ])
  const assigned=new Set((already||[]).map(a=>a.profile_id))
  modal('Assign — '+topicTitle,\`
  <div style="font-size:11px;color:#414e63;margin-bottom:10px">Select who must review this safety topic. Already assigned are pre-checked.</div>
  <div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="sa-due"></div>
  <div style="max-height:300px;overflow-y:auto;border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:6px">
    <div style="padding:4px 6px;margin-bottom:5px"><label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:11px;color:#8a96ab"><input type="checkbox" id="sa-all" onchange="document.querySelectorAll('.sa-cb').forEach(cb=>cb.checked=this.checked)"> Select All</label></div>
    \${(profiles||[]).map(p=>\`<label style="display:flex;align-items:center;gap:8px;padding:6px 7px;cursor:pointer;border-radius:5px;transition:.15s" onmouseover="this.style.background='#131c2e'" onmouseout="this.style.background=''">
      <input type="checkbox" class="sa-cb" value="\${p.id}" data-name="\${p.full_name}" \${assigned.has(p.id)?'checked':''}>
      <div class="av" style="width:22px;height:22px;font-size:8px;flex-shrink:0;\${Object.entries(avS(p.full_name)).map(([k,val])=>k+':'+val).join(';')}">\${ini(p.full_name)}</div>
      <div style="flex:1"><div style="font-size:12px">\${p.full_name}</div><div style="font-size:10px;color:#414e63">\${p.role} · \${p.companies?.name||'Internal'}</div></div>
    </label>\`).join('')}
  </div>\`,
  async()=>{
    const selected=[...document.querySelectorAll('.sa-cb:checked')]
    const due=v('sa-due')||null
    let added=0
    for(const cb of selected){
      if(assigned.has(cb.value))continue // skip already assigned
      await sb.from('safety_assignments').insert({id:uuid(),topic_id:topicId,profile_id:cb.value,assigned_name:cb.dataset.name,due_date:due,assigned_at:new Date().toISOString()})
      added++
    }
    closeModal();toast(\`Assigned to \${selected.length} person(s)\${added<selected.length?' ('+(selected.length-added)+' already assigned)':''}\`);pgSafety()
  })
}
async function viewSafetyAcks(topicId){
  const[{data:acks},{data:assignments}]=await Promise.all([
    sb.from('safety_acks').select('*').eq('topic_id',topicId).order('acknowledged_at',{ascending:false}),
    sb.from('safety_assignments').select('*').eq('topic_id',topicId)
  ])
  const ackedIds=new Set((acks||[]).map(a=>a.user_name))
  const pending=(assignments||[]).filter(a=>!ackedIds.has(a.assigned_name))
  modal('Acknowledgements',\`
  <div class="two" style="margin-bottom:12px">
    <div style="background:rgba(22,163,74,.08);border-radius:7px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:300;color:#16a34a">\${(acks||[]).length}</div><div style="font-size:10px;color:#414e63">Acknowledged</div></div>
    <div style="background:rgba(217,119,6,.08);border-radius:7px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:300;color:#d97706">\${pending.length}</div><div style="font-size:10px;color:#414e63">Pending</div></div>
  </div>
  \${(acks||[]).length?\`<div class="sec-hdr">Acknowledged</div>\${(acks||[]).map(a=>\`<div class="safety-ack-row"><span class="badge bg-green" style="flex-shrink:0">✓</span><div style="flex:1"><div style="font-size:12px;font-weight:500">\${a.user_name}</div><div style="font-size:10px;color:#414e63">\${fdt(a.acknowledged_at)}</div></div></div>\`).join('')}\`:''}
  \${pending.length?\`<div class="sec-hdr" style="margin-top:10px">Pending Review</div>\${pending.map(a=>\`<div class="safety-ack-row"><span class="badge bg-amber" style="flex-shrink:0">⏳</span><div style="flex:1"><div style="font-size:12px;font-weight:500">\${a.assigned_name}</div><div style="font-size:10px;color:#414e63">Assigned \${fd(a.assigned_at)}\${a.due_date?' · Due '+fd(a.due_date):''}</div></div></div>\`).join('')}\`:''}\`,
  ()=>closeModal(),'Close',false)
  document.getElementById('modal-footer').innerHTML='<button class="btn" onclick="closeModal()">Close</button>'
}

// ══════════════════════════════════════════
// FINANCIALS PAGE
// ══════════════════════════════════════════
async function pgFinancials(){
  const[{data:jobs},{data:ci},{data:parts}]=await Promise.all([
    sb.from('jobs').select('*').eq('archived',false).order('name'),
    sb.from('checkins').select('job_id,hours_logged').not('hours_logged','is',null),
    sb.from('job_parts').select('*').in('status',['signed_out','installed','staged'])
  ])
  const hrsByJob={};(ci||[]).forEach(c=>{hrsByJob[c.job_id]=(hrsByJob[c.job_id]||0)+(c.hours_logged||0)})
  const matByJob={} // Material cost from parts catalog not available without join
  let totC=0,totCost=0,totP=0
  const rows=(jobs||[]).map(j=>{
    const hrs=hrsByJob[j.id]||0
    const labor=hrs*(j.labor_rate||0)
    const mat=matByJob[j.id]||0
    const cost=labor+mat
    const cv=j.contract_value||0
    const profit=cv-cost
    const margin=cv>0?profit/cv*100:null
    totC+=cv;totCost+=cost;totP+=profit
    return{...j,hrs,labor,mat,cost,profit,margin}
  })
  document.getElementById('page-area').innerHTML=\`
  <div class="stats">
    <div class="stat"><div class="stat-label">Total Contract</div><div class="stat-value" style="font-size:20px">\${fm(totC)}</div></div>
    <div class="stat"><div class="stat-label">Total Cost</div><div class="stat-value" style="font-size:20px">\${fm(totCost)}</div></div>
    <div class="stat"><div class="stat-label">Gross Profit</div><div class="stat-value" style="font-size:20px;color:\${totP>=0?'#16a34a':'#dc2626'}">\${fm(totP)}</div></div>
    <div class="stat"><div class="stat-label">Avg Margin</div><div class="stat-value" style="font-size:20px;color:\${totC>0&&totP/totC>=.2?'#16a34a':totP/totC>=.1?'#d97706':'#dc2626'}">\${totC>0?((totP/totC)*100).toFixed(1)+'%':'—'}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  <table class="tbl"><thead><tr><th>Job</th><th>Stage</th><th>Contract</th><th>Labor Hrs</th><th>Labor Cost</th><th>Material</th><th>Total Cost</th><th>Profit</th><th>Margin</th></tr></thead><tbody>
  \${rows.map(j=>\`<tr onclick="openJob('\${j.id}')"><td style="font-weight:500">\${j.name}</td><td>\${stageBadge(j.phase)}</td><td>\${fm(j.contract_value)}</td><td style="font-family:'DM Mono',monospace;font-size:11px">\${fh(j.hrs)}</td><td>\${fm(j.labor)}</td><td>\${fm(j.mat)}</td><td>\${fm(j.cost)}</td><td style="color:\${j.profit>=0?'#16a34a':'#dc2626'};font-weight:500">\${fm(j.profit)}</td><td><span class="badge \${j.margin>=20?'bg-green':j.margin>=10?'bg-amber':'bg-red'}">\${j.margin!=null?j.margin.toFixed(1)+'%':'—'}</span></td></tr>\`).join('')}
  </tbody></table>
  </div>\`
}

// ══════════════════════════════════════════
// REPORTS PAGE
// ══════════════════════════════════════════
async function pgReports(){
  document.getElementById('page-area').innerHTML=\`
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:16px">
    \${[
      ['⏱','Labor & Hours','GPS check-in logs with times','labor'],
      ['📦','Parts Report','All parts staged & checked out','parts'],
      ['📋','Jobs Export','All jobs with all dates (Excel)','jobs'],
      ['💰','Financial Summary','P&L per job (Excel)','fin'],
      ['📍','GPS Log','All check-ins with coordinates','gps_csv'],
      ['📊','Inventory Report','Stock levels and low-stock','inv_csv'],
      ['📅','Daily Reports','All daily reports','daily_csv'],
      ['🔍','Scan Events','Complete scan audit trail','scan_csv'],
      ['🛡','Safety Report','Acknowledgement status','safety_csv']
    ].map(([ico,ttl,sub,t])=>\`<div style="background:#0c1220;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px;cursor:pointer;transition:.15s" onmouseover="this.style.borderColor='rgba(255,255,255,.15)'" onmouseout="this.style.borderColor='rgba(255,255,255,.06)'" onclick="exportReport('\${t}')">
      <div style="font-size:26px;margin-bottom:8px">\${ico}</div>
      <div style="font-size:13px;font-weight:500;margin-bottom:3px">\${ttl}</div>
      <div style="font-size:11px;color:#414e63">\${sub}</div>
    </div>\`).join('')}
  </div>\`
}
async function exportReport(type){
  toast('Preparing export…','info')
  if(type==='jobs'){
    const{data}=await sb.from('jobs').select('*').order('created_at',{ascending:false})
    const rows=(data||[]).map(j=>({'Job Name':j.name,'Address':j.address||'','GC Company':j.gc_company||'','GC Contact':j.gc_contact||'','GC Phone':j.gc_phone||'','Stage':STAGE_LABELS[j.phase]||j.phase,'% Complete':j.pct_complete||0,'Due Date':j.due_date||'','Expected On Site':j.expected_onsite_date||'','Next Visit':j.next_visit_date||'','Closeout':j.date_closeout||'','Completion':j.completion_date||'','Contract Value':j.contract_value||'','Labor Rate':j.labor_rate||'','GC Company2':j.gc_company||''}))
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Jobs');XLSX.writeFile(wb,'Jobs-'+new Date().toISOString().split('T')[0]+'.xlsx');return toast('Jobs exported')
  }
  if(type==='fin'){
    const{data:jobs}=await sb.from('jobs').select('*').order('name')
    const{data:ci}=await sb.from('checkins').select('job_id,hours_logged').not('hours_logged','is',null)
    const hrsByJob={};(ci||[]).forEach(c=>{hrsByJob[c.job_id]=(hrsByJob[c.job_id]||0)+(c.hours_logged||0)})
    const rows=(jobs||[]).map(j=>{const hrs=hrsByJob[j.id]||0;const cost=hrs*(j.labor_rate||0);return{'Job':j.name,'Stage':j.phase,'Contract':j.contract_value||0,'Labor Hrs':hrs.toFixed(1),'Labor Cost':cost.toFixed(2),'Gross Profit':((j.contract_value||0)-cost).toFixed(2),'Margin %':j.contract_value>0?(((j.contract_value-cost)/j.contract_value)*100).toFixed(1)+'%':'—'}})
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Financials');XLSX.writeFile(wb,'Financials-'+new Date().toISOString().split('T')[0]+'.xlsx');return toast('Financials exported')
  }
  // CSV exports
  let csv='',fn=type+'.csv'
  if(type==='labor'){const{data}=await sb.from('checkins').select('*').order('checkin_at',{ascending:false});csv='Worker,Role,Company,Job,Date,In,Out,Hours,Distance(ft)\\n'+(data||[]).map(c=>\`"\${c.worker_name||''}","\${c.workerRole||''}","\${c.company_name||''}","\${c.job_name||''}","\${c.checkin_at?.split('T')[0]||''}","\${ft(c.checkin_at)}","\${c.checkout_at?ft(c.checkout_at):''}",\${c.hours_logged||0},\${c.checkin_dist_ft||''}\`).join('\\n');fn='Labor-Report.csv'}
  else if(type==='parts'){const{data}=await sb.from('job_parts').select('*,jobs(name)').order('created_at',{ascending:false});csv='Part Name,Barcode,Job,Status,Qty,Staged By,Staged At,Checked Out By,Checked Out At\\n'+(data||[]).map(p=>\`"\${p.part_name}","\${p.part_id}","\${p.jobs?.name||''}","\${p.status}",\${p.assigned_qty},"\${p.staged_by||''}","\${p.staged_at||''}","\${p.checked_out_by||''}","\${p.checked_out_at||''}"\`).join('\\n');fn='Parts-Report.csv'}
  else if(type==='gps_csv'){const{data}=await sb.from('checkins').select('*').order('checkin_at',{ascending:false});csv='Worker,Job ID,Date,In,Out,Hours,Lat,Lng,Dist(ft)\\n'+(data||[]).map(c=>\`"\${c.worker_name||''}","\${c.job_id}","\${c.checkin_at?.split('T')[0]}","\${ft(c.checkin_at)}","\${c.checkout_at?ft(c.checkout_at):''}",\${c.hours_logged||0},\${c.checkin_lat||''},\${c.checkin_lng||''},\${c.checkin_dist_ft||''}\`).join('\\n');fn='GPS-Log.csv'}
  else if(type==='inv_csv'){const{data}=await sb.from('inventory').select('*').order('name');csv='ID,Name,Qty,Min Qty,Status\\n'+(data||[]).map(i=>\`"\${i.id}","\${i.name}",\${i.qty},\${i.min_qty||0},"\${i.qty<=(i.min_qty||0)&&i.min_qty>0?'LOW STOCK':'OK'}"\`).join('\\n');fn='Inventory-Report.csv'}
  else if(type==='daily_csv'){const{data}=await sb.from('daily_reports').select('*').order('report_date',{ascending:false});csv='Date,Job,Crew,Hours,Weather,Work Performed,Issues,Submitted By\\n'+(data||[]).map(r=>\`"\${r.report_date}","\${r.jobs?.name||''}",\${r.crew_count},\${r.hours_worked||0},"\${r.weather||''}","\${(r.work_performed||'').replace(/"/g,'""')}","\${(r.issues||'').replace(/"/g,'""')}","\${r.submitted_by||''}"\`).join('\\n');fn='Daily-Reports.csv'}
  else if(type==='scan_csv'){const{data}=await sb.from('scan_events').select('*').order('scanned_at',{ascending:false});csv='Action,Part Name,Barcode,Qty,Job,Scanned By,Date/Time\\n'+(data||[]).map(e=>\`"\${e.action}","\${e.part_name}","\${e.part_id}",\${e.qty},"\${e.job_id}","\${e.scanned_by||'?'}","\${fdt(e.scanned_at)}"\`).join('\\n');fn='Scan-Events.csv'}
  else if(type==='safety_csv'){const{data:topics}=await sb.from('safety_topics').select('*').order('week_of',{ascending:false});const{data:acks}=await sb.from('safety_acks').select('*');const{data:assigns}=await sb.from('safety_assignments').select('*');csv='Topic,Week Of,Person,Assigned Date,Acknowledged,Ack Date\\n'+(assigns||[]).map(a=>{const ack=(acks||[]).find(x=>x.topic_id===a.topic_id&&x.user_name===a.assigned_name);const topic=(topics||[]).find(t=>t.id===a.topic_id);return\`"\${topic?.title||''}","\${fd(topic?.week_of)}","\${a.assigned_name}","\${fd(a.assigned_at)}","\${ack?'YES':'NO'}","\${ack?fdt(ack.acknowledged_at):''}"\`}).join('\\n');fn='Safety-Report.csv'}
  if(csv){const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=fn;a.click();toast('Downloading…')}
}

// ══════════════════════════════════════════
// DOCUMENTS VAULT PAGE
// ══════════════════════════════════════════
async function pgDocuments(){
  document.getElementById('topbar-actions').innerHTML='<label class="btn btn-p btn-sm" style="cursor:pointer">+ Upload Document<input type="file" style="display:none" multiple onchange="uploadGlobalDoc(this.files)"></label>'
  const{data:docs}=await sb.from('job_documents').select('*,jobs(name)').order('created_at',{ascending:false})
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:12px"><input class="fi" placeholder="Search documents…" style="max-width:300px" oninput="filterDocs(this.value)"></div>
  <div class="card" style="padding:0;overflow:hidden" id="docs-table">
  \${(docs||[]).length?\`<table class="tbl"><thead><tr><th>Name</th><th>Job</th><th>Category</th><th>Uploaded By</th><th>Date</th><th></th></tr></thead><tbody>\${(docs||[]).map(d=>\`<tr><td><div style="display:flex;align-items:center;gap:7px"><span style="font-size:16px">\${d.file_name?.match(/\\.pdf$/i)?'📄':d.file_name?.match(/\\.(png|jpg|jpeg)$/i)?'🖼':d.file_name?.match(/\\.(xls|xlsx)$/i)?'📊':'📎'}</span><div style="font-weight:500">\${d.name}</div></div></td><td style="font-size:11px">\${d.jobs?.name||'—'}</td><td><span class="badge bg-gray">\${d.category||'general'}</span></td><td style="font-size:11px;color:#8a96ab">\${d.uploaded_by||'—'}</td><td style="font-size:11px;color:#8a96ab">\${fd(d.created_at)}</td><td><a href="\${d.url}" target="_blank" class="btn btn-sm">View</a></td></tr>\`).join('')}</tbody></table>\`:empty('📁','No documents uploaded')}
  </div>\`
  window._docsAll=docs||[]
}
function filterDocs(q){const el=document.getElementById('docs-table');if(!el||!window._docsAll)return;const f=(window._docsAll||[]).filter(d=>!q||d.name.toLowerCase().includes(q.toLowerCase())||(d.jobs?.name||'').toLowerCase().includes(q.toLowerCase()));el.innerHTML=renderDocsTableHTML(f)}
function renderDocsTableHTML(docs){return docs.length?\`<table class="tbl"><thead><tr><th>Name</th><th>Job</th><th>Category</th><th>By</th><th>Date</th><th></th></tr></thead><tbody>\${docs.map(d=>\`<tr><td style="font-weight:500">\${d.name}</td><td>\${d.jobs?.name||'—'}</td><td>\${d.category||'—'}</td><td style="font-size:11px;color:#8a96ab">\${d.uploaded_by||'—'}</td><td style="font-size:11px">\${fd(d.created_at)}</td><td><a href="\${d.url}" target="_blank" class="btn btn-sm">View</a></td></tr>\`).join('')}</tbody></table>\`:empty('📁','No documents found')}
async function uploadGlobalDoc(files){
  modal('Upload Document',\`<div class="fg"><label class="fl">Job (optional)</label><select class="fs" id="ud-job"><option value="">— No specific job —</option>\${allJobs.map(j=>\`<option value="\${j.id}">\${j.name}</option>\`).join('')}</select></div><div class="fg"><label class="fl">Category</label><select class="fs" id="ud-cat"><option value="general">General</option><option value="contract">Contract</option><option value="permit">Permit</option><option value="submittal">Submittal</option><option value="rfi">RFI</option><option value="plans">Plans</option><option value="insurance">Insurance</option><option value="lien_waiver">Lien Waiver</option></select></div>\`,
  async()=>{
    const jobId=v('ud-job')||null;const cat=v('ud-cat')
    for(const f of files){
      const path=\`documents/\${Date.now()}_\${f.name}\`
      const{error}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true})
      if(!error){const{data:{publicUrl}}=sb.storage.from('fieldtrack-plans').getPublicUrl(path);await sb.from('job_documents').insert({id:uuid(),job_id:jobId,name:f.name,file_name:f.name,category:cat,storage_path:path,url:publicUrl,uploaded_by:ME?.full_name,created_at:new Date().toISOString()})}
    }
    closeModal();toast('Uploaded');pgDocuments()
  })
}

// ══════════════════════════════════════════
// USERS PAGE
// ══════════════════════════════════════════
async function pgUsers(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-sm" onclick="exportEmployeesCSV()">⬆ Export</button>'+
    '<button class="btn btn-p btn-sm" onclick="addUserModal()">+ Add Employee</button>'
  const[{data:users},{data:companies}]=await Promise.all([
    sb.from('profiles').select('*,companies(name)').order('full_name'),
    sb.from('companies').select('id,name').eq('is_active',true).order('name')
  ])
  const all=users||[]
  const roles=[...new Set(all.map(u=>u.role).filter(Boolean))].sort()
  const pa=document.getElementById('page-area')
  pa.innerHTML=
    '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+
    '<input class="fi" id="emp-search" placeholder="Search name or email…" style="max-width:220px" oninput="filterEmployees()">'+
    '<select class="fs" id="emp-role" style="width:150px" onchange="filterEmployees()"><option value="">All Roles</option>'+roles.map(r=>'<option value="'+r+'">'+r.replace(/_/g,' ')+'</option>').join('')+'</select>'+
    '<select class="fs" id="emp-co" style="width:160px" onchange="filterEmployees()"><option value="">All Companies</option>'+
    (companies||[]).map(co=>'<option value="'+co.id+'">'+co.name+'</option>').join('')+
    '<option value="internal">Internal</option></select>'+
    '<select class="fs" id="emp-status" style="width:120px" onchange="filterEmployees()"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>'+
    '</div>'+
    '<div id="emp-table"></div>'+
    '<div style="margin-top:11px;font-size:11px;color:#414e63" id="emp-count"></div>'
  window._empAll=all
  window._empCos=companies||[]
  filterEmployees()
}

function filterEmployees(){
  const q=(document.getElementById('emp-search')?.value||'').toLowerCase()
  const role=document.getElementById('emp-role')?.value||''
  const co=document.getElementById('emp-co')?.value||''
  const status=document.getElementById('emp-status')?.value||''
  const all=window._empAll||[]
  const rows=all.filter(u=>{
    if(q&&!u.full_name.toLowerCase().includes(q)&&!(u.email||'').toLowerCase().includes(q))return false
    if(role&&u.role!==role)return false
    if(co==='internal'&&u.company_id)return false
    if(co&&co!=='internal'&&u.company_id!==co)return false
    if(status==='active'&&!u.is_active)return false
    if(status==='inactive'&&u.is_active)return false
    return true
  })
  const el=document.getElementById('emp-table')
  const cnt=document.getElementById('emp-count')
  if(cnt)cnt.textContent=rows.length+' employee'+(rows.length!==1?'s':'')
  if(!rows.length){if(el)el.innerHTML=empty('👥','No employees match filters');return}
  let html='<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>'
  html+='<th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Company</th><th>Emergency Contact</th><th>Status</th><th></th>'
  html+='</tr></thead><tbody>'
  for(const u of rows){
    const avCss=Object.entries(avS(u.full_name)).map(([k,val])=>k+':'+val).join(';')
    html+='<tr>'
    html+='<td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="width:26px;height:26px;font-size:9px;'+avCss+'">'+ini(u.full_name)+'</div><div><div style="font-weight:500">'+u.full_name+'</div>'+(u.hire_date?'<div style="font-size:9px;color:#414e63">Hired '+fd(u.hire_date)+'</div>':'')+'</div></div></td>'
    html+='<td style="font-size:11px;color:#8a96ab">'+(u.email||'—')+'</td>'
    html+='<td style="font-size:11px;color:#8a96ab">'+(u.phone||'—')+'</td>'
    html+='<td>'+roleBadge(u.role)+'</td>'
    html+='<td style="font-size:11px">'+(u.companies?.name||'Internal')+'</td>'
    html+='<td style="font-size:10px;color:#8a96ab">'+(u.emergency_contact||'—')+'<br>'+(u.emergency_phone?'<span style="color:#414e63">'+u.emergency_phone+'</span>':'')+'</td>'
    html+='<td><span class="badge '+(u.is_active?'bg-green':'bg-gray')+'">'+(u.is_active?'Active':'Inactive')+'</span></td>'
    html+='<td style="display:flex;gap:4px"><button class="btn btn-sm" data-id="'+u.id+'" onclick="viewEmployeeModal(this.dataset.id)">View</button><button class="btn btn-sm" data-id="'+u.id+'" data-role="'+u.role+'" data-active="'+u.is_active+'" data-name="'+u.full_name.replace(/"/g,'&quot;')+'" onclick="editUserModal(this.dataset.id,this.dataset.role,this.dataset.active,this.dataset.name)">Edit</button></td>'
    html+='</tr>'
  }
  html+='</tbody></table></div>'
  if(el)el.innerHTML=html
}

async function exportEmployeesCSV(){
  const all=window._empAll||[]
  const rows=[['Name','Email','Phone','Role','Company','Hire Date','Emergency Contact','Emergency Phone','Status']]
  all.forEach(u=>rows.push([u.full_name,u.email||'',u.phone||'',u.role,u.companies?.name||'Internal',u.hire_date||'',u.emergency_contact||'',u.emergency_phone||'',u.is_active?'Active':'Inactive']))
  const csv=rows.map(r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='Employees-'+new Date().toISOString().split('T')[0]+'.csv';a.click();toast('Exported')
}

async function viewEmployeeModal(id){
  const{data:u}=await sb.from('profiles').select('*,companies(name)').eq('id',id).single()
  if(!u)return
  // Get safety training history
  const[{data:acks},{data:assigns}]=await Promise.all([
    sb.from('safety_acks').select('*,safety_topics(title,week_of,category)').eq('profile_id',id).order('acknowledged_at',{ascending:false}),
    sb.from('safety_assignments').select('*,safety_topics(title,week_of)').eq('profile_id',id).order('assigned_at',{ascending:false})
  ])
  const ackedIds=new Set((acks||[]).map(a=>a.topic_id))
  const pending=(assigns||[]).filter(a=>!ackedIds.has(a.topic_id))
  const avCss=Object.entries(avS(u.full_name)).map(([k,val])=>k+':'+val).join(';')
  let html=
    '<div style="display:flex;align-items:center;gap:13px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.07)">'+
    '<div class="av" style="width:52px;height:52px;font-size:18px;flex-shrink:0;'+avCss+'">'+ini(u.full_name)+'</div>'+
    '<div><div style="font-family:Syne,sans-serif;font-size:16px;font-weight:700">'+u.full_name+'</div>'+
    '<div style="margin-top:3px">'+roleBadge(u.role)+'</div>'+
    '<div style="font-size:11px;color:#414e63;margin-top:3px">'+(u.companies?.name||'Internal')+(u.hire_date?' · Hired '+fd(u.hire_date):'')+'</div></div></div>'+
    '<div class="two" style="margin-bottom:13px">'+
    '<div><div class="fl">EMAIL</div><div style="font-size:13px">'+(u.email||'—')+'</div></div>'+
    '<div><div class="fl">PHONE</div><div style="font-size:13px">'+(u.phone||'—')+'</div></div>'+
    '</div>'+
    '<div class="two" style="margin-bottom:13px">'+
    '<div><div class="fl">EMERGENCY CONTACT</div><div style="font-size:13px">'+(u.emergency_contact||'—')+'</div></div>'+
    '<div><div class="fl">EMERGENCY PHONE</div><div style="font-size:13px">'+(u.emergency_phone||'—')+'</div></div>'+
    '</div>'+
    '<div class="sec-hdr" style="margin-bottom:10px">Safety Training — '+
    '<span style="color:#16a34a">'+(acks||[]).length+' completed</span> · '+
    '<span style="color:'+(pending.length?'#dc2626':'#414e63')+'">'+pending.length+' pending</span></div>'
  if(pending.length){
    html+='<div style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.15);border-radius:7px;padding:9px 12px;margin-bottom:10px">'
    html+='<div style="font-size:10px;color:#dc2626;font-weight:600;margin-bottom:6px">PENDING — NOT YET COMPLETED</div>'
    html+=pending.map(a=>'<div style="font-size:12px;color:#f87171;padding:3px 0">⏳ '+a.safety_topics?.title+(a.due_date?' · Due '+fd(a.due_date):'')+'</div>').join('')
    html+='</div>'
  }
  if((acks||[]).length){
    html+='<div style="background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.15);border-radius:7px;padding:9px 12px">'
    html+='<div style="font-size:10px;color:#16a34a;font-weight:600;margin-bottom:6px">COMPLETED</div>'
    html+=(acks||[]).map(a=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span style="font-size:12px">✓ '+a.safety_topics?.title+'</span><span style="font-size:10px;color:#414e63">'+fdt(a.acknowledged_at)+'</span></div>').join('')
    html+='</div>'
  }
  if(!(acks||[]).length&&!pending.length) html+='<div style="font-size:12px;color:#414e63">No safety training assigned yet</div>'
  modal(u.full_name, html, ()=>closeModal(), 'Close', false)
  const editBtn=document.createElement('button')
  editBtn.className='btn btn-p btn-sm'
  editBtn.textContent='Edit'
  editBtn.onclick=()=>{closeModal();editUserModal(id,u.role,u.is_active,u.full_name)}
  const closeBtn=document.createElement('button')
  closeBtn.className='btn'
  closeBtn.textContent='Close'
  closeBtn.onclick=closeModal
  const ft=document.getElementById('modal-footer')
  ft.innerHTML=''
  ft.appendChild(closeBtn)
  ft.appendChild(editBtn)
}

function addUserModal(){
  const coOpts=(window._empCos||[]).map(co=>'<option value="'+co.id+'">'+co.name+'</option>').join('')
  const html=
    '<div class="two"><div class="fg"><label class="fl">Full Name *</label><input class="fi" id="au-nm"></div>'+
    '<div class="fg"><label class="fl">Email *</label><input class="fi" id="au-em" type="email" placeholder="They will get a password setup email"></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Phone</label><input class="fi" id="au-ph"></div>'+
    '<div class="fg"><label class="fl">Role *</label><select class="fs" id="au-rl">'+
    '<option value="sub_worker">Field Worker</option><option value="sub_lead">Lead</option>'+
    '<option value="technician">Technician</option><option value="stager">Stager</option>'+
    '<option value="foreman">Foreman</option><option value="pm">Project Manager</option>'+
    '<option value="admin">Admin</option></select></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Company</label><select class="fs" id="au-co">'+
    '<option value="">Internal</option>'+coOpts+'</select></div>'+
    '<div class="fg"><label class="fl">Hire Date</label><input class="fi" type="date" id="au-hire"></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Emergency Contact</label><input class="fi" id="au-ec"></div>'+
    '<div class="fg"><label class="fl">Emergency Phone</label><input class="fi" id="au-ep"></div></div>'+
    '<div id="au-status" style="display:none;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:7px;padding:9px 12px;font-size:12px;color:#16a34a;margin-top:4px"></div>'
  modal('Add Employee', html, async()=>{
    const nm=v('au-nm').trim(),em=v('au-em').trim()
    if(!nm||!em){toast('Name and email required','error');return}
    const btn=document.getElementById('modal-ok')
    btn.disabled=true;btn.textContent='Adding…'
    try{
      // Try server route first (creates auth account + profile + sends password email)
      const{data:{session}}=await sb.auth.getSession()
      const res=await fetch('/api/invite-user',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+(session?.access_token||'')},
        body:JSON.stringify({email:em,full_name:nm,role:v('au-rl'),phone:v('au-ph'),company_id:v('au-co')||null,hire_date:v('au-hire')||null,emergency_contact:v('au-ec'),emergency_phone:v('au-ep')})
      })
      const result=await res.json()
      if(res.ok&&result.success){
        closeModal()
        toast('Employee added! Password setup email sent to '+em)
        pgUsers()
        return
      }
      // If service key not set, fall back to profile-only (no auth account)
      console.warn('Invite route result:',result)
      if(result.error?.includes('SUPABASE_SERVICE_KEY')||result.error?.includes('service')){
        // Fallback: create auth user via signUp then insert profile
        const tempPw=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2).toUpperCase()+'!9'
        const{data:signUpData,error:signUpErr}=await sb.auth.signUp({email:em,password:tempPw,options:{data:{full_name:nm,role:v('au-rl')}}})
        const authId=signUpData?.user?.id
        if(signUpErr&&!authId){toast(signUpErr.message,'error');btn.disabled=false;btn.textContent='Save';return}
        // Wait a moment then insert profile
        await new Promise(r=>setTimeout(r,500))
        const{error:profErr}=await sb.from('profiles').upsert({id:authId,full_name:nm,email:em,phone:v('au-ph'),role:v('au-rl'),company_id:v('au-co')||null,hire_date:v('au-hire')||null,emergency_contact:v('au-ec'),emergency_phone:v('au-ep'),is_active:true,created_at:new Date().toISOString()},{onConflict:'id'})
        if(profErr){toast(profErr.message,'error');btn.disabled=false;btn.textContent='Save';return}
        closeModal()
        toast('Employee added. They will get a confirmation email to set their password.','info')
        pgUsers()
        return
      }
      throw new Error(result.error||'Failed to create employee')
    }catch(e){
      toast(e.message,'error')
      btn.disabled=false;btn.textContent='Save'
    }
  })
}

function editUserModal(id,role,active,name){
  const coOpts=(window._empCos||[]).map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('')
  const html=
    '<div class="two"><div class="fg"><label class="fl">Full Name</label><input class="fi" id="eu-nm" value="'+name+'"></div>'+
    '<div class="fg"><label class="fl">Phone</label><input class="fi" id="eu-ph"></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Role</label><select class="fs" id="eu-rl">'+
    '<option value="sub_worker">Field Worker</option><option value="sub_lead">Lead</option>'+
    '<option value="technician">Technician</option><option value="stager">Stager</option>'+
    '<option value="foreman">Foreman</option><option value="pm">Project Manager</option>'+
    '<option value="admin">Admin</option></select></div>'+
    '<div class="fg"><label class="fl">Company</label><select class="fs" id="eu-co"><option value="">Internal</option>'+coOpts+'</select></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Hire Date</label><input class="fi" type="date" id="eu-hire"></div>'+
    '<div class="fg"><label class="fl">Status</label><select class="fs" id="eu-act"><option value="true">Active</option><option value="false">Inactive</option></select></div></div>'+
    '<div class="two"><div class="fg"><label class="fl">Emergency Contact</label><input class="fi" id="eu-ec"></div>'+
    '<div class="fg"><label class="fl">Emergency Phone</label><input class="fi" id="eu-ep"></div></div>'
  modal('Edit Employee — '+name, html, async()=>{
    const u={full_name:v('eu-nm'),phone:v('eu-ph'),role:v('eu-rl'),company_id:v('eu-co')||null,hire_date:v('eu-hire')||null,emergency_contact:v('eu-ec'),emergency_phone:v('eu-ep'),is_active:v('eu-act')==='true'}
    const{error}=await sb.from('profiles').update(u).eq('id',id)
    if(error)toast(error.message,'error');else{closeModal();toast('Updated');pgUsers()}
  })
  // Populate fields from DB
  sb.from('profiles').select('*').eq('id',id).single().then(({data:p})=>{
    if(!p)return
    setTimeout(()=>{
      try{
        document.getElementById('eu-ph').value=p.phone||''
        document.getElementById('eu-rl').value=p.role||'sub_worker'
        document.getElementById('eu-co').value=p.company_id||''
        document.getElementById('eu-hire').value=p.hire_date||''
        document.getElementById('eu-act').value=String(p.is_active)
        document.getElementById('eu-ec').value=p.emergency_contact||''
        document.getElementById('eu-ep').value=p.emergency_phone||''
      }catch(e){}
    },80)
  })
  loadJobPermits()
}


// ══════════════════════════════════════════
// JOB MAP PAGE
// ══════════════════════════════════════════
// ── JOB MAP ───────────────────────────────────────────────────────
// Colors: brighter for active, gray for complete, 🔥 for urgent PM visit
const MAP_COLORS={
  not_started:  '#94a3b8',  // slate gray
  parts_ordered:'#f97316',  // orange
  parts_staged: '#eab308',  // yellow
  in_progress:  '#3b82f6',  // bright blue
  pre_test:     '#f59e0b',  // amber
  pre_tested:   '#06b6d4',  // cyan
  ready_for_final:'#a855f7',// purple
  complete:     '#4b5563',  // dark gray (completed)
  pm_needed:    '#22c55e',  // green — PM visit due
  urgent_pm:    '🔥'        // special fire marker
}
const MAP_LEGEND_ITEMS=[
  {key:'not_started',  color:'#94a3b8', label:'Not Started'},
  {key:'parts_ordered',color:'#f97316', label:'Parts Ordered'},
  {key:'parts_staged', color:'#eab308', label:'Parts Staged'},
  {key:'in_progress',  color:'#3b82f6', label:'In Progress'},
  {key:'pre_test',     color:'#f59e0b', label:'Ready for Pre-test'},
  {key:'pre_tested',   color:'#06b6d4', label:'Pre-Tested'},
  {key:'ready_for_final','color':'#a855f7',label:'Ready for Final'},
  {key:'complete',     color:'#4b5563', label:'Completed'},
  {key:'pm_needed',    color:'#22c55e', label:'PM Visit Due'},
  {key:'urgent_pm',    color:'🔥',       label:'Urgent PM Visit'}
]

function getMapColor(j){
  if(j.urgent_pm_visit) return {color:'🔥',isUrgent:true}
  if(j.pm_visit_due)    return {color:'#22c55e',isUrgent:false}
  return {color:MAP_COLORS[j.phase]||'#94a3b8',isUrgent:false}
}

async function pgJobMap(){
  document.getElementById('page-title').textContent='Job Map'
  document.getElementById('topbar-actions').innerHTML=''

  const[{data:jobs},{data:companies}]=await Promise.all([
    sb.from('jobs').select('*').eq('archived',false),
    sb.from('companies').select('id,name')
  ])
  window._mapJobs=jobs||[]
  const coMap={}; (companies||[]).forEach(co=>coMap[co.id]=co.name)

  // Enrich jobs with pm_visit_due flag
  const today=new Date().toISOString().split('T')[0]
  ;(window._mapJobs||[]).forEach(j=>{
    j.pm_visit_due = j.next_pm_visit && j.next_pm_visit <= today && j.phase!=='complete'
  })

  // Build filter option lists
  const pms=[...new Set((jobs||[]).map(j=>j.project_manager).filter(Boolean))].sort()
  const gcs=[...new Set((jobs||[]).map(j=>j.gc_company).filter(Boolean))].sort()
  const assignees=[...new Set((jobs||[]).map(j=>j.company_id).filter(Boolean))]

  document.getElementById('page-area').innerHTML=
    '<div style="display:grid;grid-template-columns:1fr 300px;gap:0;height:calc(100vh - 90px)">'+
    // MAP AREA
    '<div style="position:relative;border-radius:10px 0 0 10px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">'+
    '<div id="map-container" style="width:100%;height:100%;background:#0c1220;display:flex;align-items:center;justify-content:center">'+
    '<div style="text-align:center;color:#414e63"><div style="font-size:32px;margin-bottom:8px">🗺</div><div style="font-size:13px;color:#8a96ab">Loading map…</div></div>'+
    '</div>'+
    '</div>'+
    // SIDEBAR
    '<div style="background:#0c1220;border:1px solid rgba(255,255,255,.08);border-left:none;border-radius:0 10px 10px 0;display:flex;flex-direction:column;overflow:hidden">'+
    // LEGEND (always visible at top)
    '<div id="map-legend" style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0"></div>'+
    // FILTERS
    '<div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0">'+
    '<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Filters</div>'+
    '<select class="fs" id="map-filter-stage" style="width:100%;margin-bottom:6px;padding:5px 8px;font-size:11px" onchange="filterMapPins()">'+
    '<option value="">All Stages</option>'+
    STAGES.map(s=>'<option value="'+s+'">'+STAGE_LABELS[s]+'</option>').join('')+
    '<option value="pm_needed">PM Visit Due</option>'+
    '<option value="urgent_pm">Urgent PM Visit 🔥</option>'+
    '<option value="overdue">Overdue Due Date</option>'+
    '</select>'+
    '<select class="fs" id="map-filter-pm" style="width:100%;margin-bottom:6px;padding:5px 8px;font-size:11px" onchange="filterMapPins()">'+
    '<option value="">All Project Managers</option>'+pms.map(p=>'<option value="'+p+'">'+p+'</option>').join('')+
    '</select>'+
    '<select class="fs" id="map-filter-gc" style="width:100%;margin-bottom:6px;padding:5px 8px;font-size:11px" onchange="filterMapPins()">'+
    '<option value="">All GC Companies</option>'+gcs.map(g=>'<option value="'+g+'">'+g+'</option>').join('')+
    '</select>'+
    '<select class="fs" id="map-filter-due" style="width:100%;margin-bottom:6px;padding:5px 8px;font-size:11px" onchange="filterMapPins()">'+
    '<option value="">Any Due Date</option>'+
    '<option value="today">Due Today</option>'+
    '<option value="week">Due This Week</option>'+
    '<option value="month">Due This Month</option>'+
    '<option value="overdue">Overdue</option>'+
    '</select>'+
    '<button class="btn btn-sm" style="width:100%;justify-content:center" onclick="clearMapFilters()">Clear Filters</button>'+
    '</div>'+
    // JOB LIST
    '<div style="flex:1;overflow-y:auto;padding:10px 14px">'+
    '<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Jobs</div>'+
    '<div id="map-job-list"></div>'+
    '</div>'+
    '</div>'+
    '</div>'

  // Load Leaflet map
  if(!document.getElementById('leaflet-css')){
    const link=document.createElement('link');link.id='leaflet-css';link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(link)
    const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=()=>initMap(jobs||[]);document.head.appendChild(script)
  } else {
    initMap(jobs||[])
  }
}

function clearMapFilters(){
  ['map-filter-stage','map-filter-pm','map-filter-gc','map-filter-due'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value=''
  })
  filterMapPins()
}

function initMap(jobs){
  const container=document.getElementById('map-container')
  if(!container||!window.L)return
  container.innerHTML='<div id="leaflet-map" style="width:100%;height:100%"></div>'
  const map=window.L.map('leaflet-map',{zoomControl:true}).setView([33.4484,-112.0740],10)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map)
  window._leafletMap=map
  window._mapMarkers=[]
  renderMapLegend()
  addMapPins(jobs,map)
  renderMapJobList(jobs)
}

function renderMapLegend(){
  const el=document.getElementById('map-legend');if(!el)return
  el.innerHTML=
    '<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Legend</div>'+
    MAP_LEGEND_ITEMS.map(item=>{
      const dot = item.color==='🔥'
        ? '<span style="font-size:14px;line-height:1">🔥</span>'
        : '<div style="width:11px;height:11px;border-radius:50%;background:'+item.color+';flex-shrink:0;box-shadow:0 0 4px '+item.color+'88"></div>'
      return '<div style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer" data-key="'+item.key+'" onclick="quickFilterByLegend(this.dataset.key)" title="Filter by this status">'+dot+'<span style="font-size:11px;color:#e8edf5">'+item.label+'</span></div>'
    }).join('')
}

function quickFilterByLegend(key){
  const sel=document.getElementById('map-filter-stage');if(!sel)return
  sel.value=key==='pm_needed'?'pm_needed':key==='urgent_pm'?'urgent_pm':key
  filterMapPins()
  // Highlight the selected legend item
  document.querySelectorAll('#map-legend [onclick]').forEach(el=>el.style.background='')
}

function makeMapPin(j){
  const {color,isUrgent}=getMapColor(j)
  if(isUrgent){
    return window.L.divIcon({
      html:'<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.7));cursor:pointer">🔥</div>',
      className:'',iconSize:[22,22],iconAnchor:[11,22]
    })
  }
  const isComplete=j.phase==='complete'
  const size=isComplete?12:16
  const pulse=j.pm_visit_due&&!isUrgent?'animation:mapPulse 1.5s infinite;':'';
  return window.L.divIcon({
    html:'<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+color+';border:2px solid rgba(255,255,255,'+(isComplete?.4:.9)+');box-shadow:0 2px 8px '+color+'99;'+pulse+'cursor:pointer"></div>',
    className:'',iconSize:[size,size],iconAnchor:[size/2,size/2]
  })
}

// Add pulse animation for PM-due jobs
if(!document.getElementById('map-pulse-css')){
  const s=document.createElement('style');s.id='map-pulse-css'
  s.textContent='@keyframes mapPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}50%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}'
  document.head.appendChild(s)
}

function addMapPins(jobs,map){
  if(!window.L)return
  ;(window._mapMarkers||[]).forEach(m=>m.remove())
  window._mapMarkers=[]
  const withGPS=jobs.filter(j=>j.gps_lat&&j.gps_lng)
  withGPS.forEach(j=>{
    const{color,isUrgent}=getMapColor(j)
    const icon=makeMapPin(j)
    const marker=window.L.marker([j.gps_lat,j.gps_lng],{icon}).addTo(map)
    const colorLabel=isUrgent?'🔥 URGENT PM VISIT':j.pm_visit_due?'⚡ PM Visit Overdue':''
    const daysUntilDue=j.due_date?Math.round((new Date(j.due_date)-new Date())/86400000):null
    const dueColor=daysUntilDue!=null&&daysUntilDue<0?'#dc2626':daysUntilDue!=null&&daysUntilDue<=7?'#d97706':'#666'
    marker.bindPopup(
      '<div style="font-family:DM Sans,sans-serif;min-width:220px">'+
      (colorLabel?'<div style="font-size:11px;font-weight:700;color:'+(isUrgent?'#ef4444':'#22c55e')+';margin-bottom:6px">'+colorLabel+'</div>':'')+
      '<div style="font-weight:700;font-size:14px;margin-bottom:3px">'+j.name+'</div>'+
      '<div style="font-size:11px;color:#666;margin-bottom:6px">'+( j.address||'')+'</div>'+
      '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">'+
      '<span style="background:'+color+( isUrgent?'':'')+';color:'+(j.phase==='complete'?'#9ca3af':'#fff')+';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">'+( STAGE_LABELS[j.phase]||j.phase)+'</span>'+
      '</div>'+
      (j.project_manager?'<div style="font-size:11px;margin-bottom:2px"><strong>PM:</strong> '+j.project_manager+'</div>':'')+
      (j.gc_company?'<div style="font-size:11px;margin-bottom:2px"><strong>GC:</strong> '+j.gc_company+'</div>':'')+
      (j.due_date?'<div style="font-size:11px;color:'+dueColor+'"><strong>Due:</strong> '+fd(j.due_date)+(daysUntilDue!=null?' ('+( daysUntilDue<0?Math.abs(daysUntilDue)+'d overdue':daysUntilDue+'d away')+')':'')+'</div>':'')+
      (j.next_pm_visit?'<div style="font-size:11px;color:'+(j.pm_visit_due?'#22c55e':'#666')+'"><strong>PM Visit:</strong> '+fd(j.next_pm_visit)+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:6px">'+
      '<a href="javascript:void(0)" data-jid="'+j.id+'" onclick="openJob(this.dataset.jid)" style="color:#3b82f6;font-size:11px;font-weight:600">Open Job →</a>'+
      (isUrgent?'':' <a href="javascript:void(0)" data-jid="'+j.id+'" onclick="setUrgentPM(this.dataset.jid,true)" style="color:#ef4444;font-size:11px">🔥 Mark Urgent</a>')+
      '</div>'+
      '</div>'
    )
    window._mapMarkers.push(marker)
  })
  if(withGPS.length>0){
    const bounds=window.L.latLngBounds(withGPS.map(j=>[j.gps_lat,j.gps_lng]))
    map.fitBounds(bounds,{padding:[30,30]})
  }
}

function renderMapJobList(jobs){
  const el=document.getElementById('map-job-list');if(!el)return
  if(!jobs.length){el.innerHTML='<div style="font-size:12px;color:#414e63">No jobs match filters</div>';return}
  el.innerHTML=jobs.map(j=>{
    const{color,isUrgent}=getMapColor(j)
    const dot=isUrgent?'🔥':'<div style="width:9px;height:9px;border-radius:50%;background:'+color+';flex-shrink:0;box-shadow:0 0 4px '+color+'66"></div>'
    const daysUntilDue=j.due_date?Math.round((new Date(j.due_date)-new Date())/86400000):null
    const dueText=daysUntilDue!=null?(daysUntilDue<0?'<span style="color:#dc2626;font-size:9px">'+Math.abs(daysUntilDue)+'d overdue</span>':daysUntilDue===0?'<span style="color:#d97706;font-size:9px">Due today</span>':daysUntilDue<=7?'<span style="color:#d97706;font-size:9px">'+daysUntilDue+'d</span>':''):''
    return '<div style="display:flex;align-items:flex-start;gap:7px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer" data-jid="'+j.id+'" onclick="mapFlyTo(this.dataset.jid)">'
      '<div style="margin-top:3px;font-size:12px">'+dot+'</div>'+
      '<div style="flex:1;min-width:0">'+
      '<div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+j.name+'</div>'+
      '<div style="font-size:10px;color:#414e63;margin-top:1px">'+( j.project_manager||'')+(j.gc_company?' · '+j.gc_company:'')+' '+dueText+'</div>'+
      '</div>'+
      '</div>'
  }).join('')
}

function mapFlyTo(jobId){
  const j=(window._mapJobs||[]).find(x=>x.id===jobId);if(!j||!j.gps_lat)return
  if(window._leafletMap)window._leafletMap.flyTo([j.gps_lat,j.gps_lng],16)
}

function filterMapPins(){
  const stage=document.getElementById('map-filter-stage')?.value||''
  const pm=document.getElementById('map-filter-pm')?.value||''
  const gc=document.getElementById('map-filter-gc')?.value||''
  const due=document.getElementById('map-filter-due')?.value||''
  const today=new Date();today.setHours(0,0,0,0)
  const filtered=(window._mapJobs||[]).filter(j=>{
    if(pm&&j.project_manager!==pm)return false
    if(gc&&j.gc_company!==gc)return false
    if(stage==='pm_needed'&&!j.pm_visit_due)return false
    if(stage==='urgent_pm'&&!j.urgent_pm_visit)return false
    if(stage==='overdue'){const d=j.due_date?new Date(j.due_date):null;if(!d||d>=today||j.phase==='complete')return false}
    else if(stage&&stage!=='pm_needed'&&stage!=='urgent_pm'&&stage!=='overdue'&&j.phase!==stage)return false
    if(due){
      const d=j.due_date?new Date(j.due_date):null
      if(!d)return false
      if(due==='overdue'&&d>=today)return false
      if(due==='today'){const t=new Date(today);t.setDate(t.getDate()+1);if(d<today||d>=t)return false}
      if(due==='week'){const w=new Date(today);w.setDate(w.getDate()+7);if(d<today||d>w)return false}
      if(due==='month'){const m=new Date(today);m.setDate(m.getDate()+30);if(d<today||d>m)return false}
    }
    return true
  })
  if(window._leafletMap)addMapPins(filtered,window._leafletMap)
  renderMapJobList(filtered)
}

async function setUrgentPM(jobId, urgent){
  const{error}=await sb.from('jobs').update({urgent_pm_visit:urgent,updated_at:new Date().toISOString()}).eq('id',jobId)
  if(error){toast(error.message,'error');return}
  // Update local data
  const j=(window._mapJobs||[]).find(x=>x.id===jobId)
  if(j)j.urgent_pm_visit=urgent
  if(window._leafletMap)addMapPins(window._mapJobs||[],window._leafletMap)
  renderMapJobList(window._mapJobs||[])
  toast(urgent?'🔥 Urgent PM visit flagged':'Urgent flag removed')
}

// ══════════════════════════════════════════
// SUB WORK ASSIGNMENT TAB (per job)
// ══════════════════════════════════════════
async function renderSubAssignTab(el){
  const[{data:companies},{data:existing}]=await Promise.all([
    sb.from('companies').select('*').eq('is_active',true).order('name'),
    sb.from('job_sub_assignments').select('*').eq('job_id',currentJobId).order('created_at')
  ])
  el.innerHTML=\`
  <div class="sec-hdr">Subcontractor Work Assignments <button class="btn btn-p btn-sm" onclick="addSubAssignModal()">+ Assign Sub</button></div>
  \${(existing||[]).map(a=>\`<div style="background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div><div style="font-weight:600;font-size:13px">\${a.company_name||a.company_id||'—'}</div><div style="font-size:11px;color:#414e63;margin-top:2px">\${a.scope_of_work||'All work'}</div></div>
      <span class="badge \${a.status==='complete'?'bg-green':a.status==='in_progress'?'bg-blue':'bg-amber'}">\${a.status||'assigned'}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:9px">
      <div><div style="font-size:10px;color:#414e63">CONTRACT VALUE</div><div style="font-size:13px;font-weight:500">\${a.contract_value?fm(a.contract_value):'Not set'}</div></div>
      <div><div style="font-size:10px;color:#414e63">START</div><div style="font-size:13px">\${fd(a.start_date)}</div></div>
      <div><div style="font-size:10px;color:#414e63">DUE</div><div style="font-size:13px;color:\${isOD(a.due_date,a.status)?'#dc2626':'#e8edf5'}">\${fd(a.due_date)}</div></div>
    </div>
    \${a.notes?\`<div style="font-size:12px;color:#8a96ab;margin-bottom:8px">\${a.notes}</div>\`:''}
    <div style="display:flex;gap:7px">
      <button class="btn btn-sm btn-g" onclick="updateSubAssign('\${a.id}','in_progress')">In Progress</button>
      <button class="btn btn-sm" onclick="updateSubAssign('\${a.id}','complete')">✓ Complete</button>
      <button class="btn btn-sm btn-ghost" style="color:#dc2626" onclick="deleteSubAssign('\${a.id}')">Remove</button>
    </div>
  </div>\`).join('')||'<div style="font-size:12px;color:#414e63;padding:10px 0">No sub assignments yet</div>'}\`
}
async function addSubAssignModal(){
  const{data:companies}=await sb.from('companies').select('id,name').eq('is_active',true).order('name')
  modal('Assign Subcontractor',\`
  <div class="fg"><label class="fl">Subcontractor *</label><select class="fs" id="sa-co"><option value="">— Select —</option>\${(companies||[]).map(c=>\`<option value="\${c.id}">\${c.name}</option>\`).join('')}</select></div>
  <div class="fg"><label class="fl">Scope of Work *</label><textarea class="ft" id="sa-scope" placeholder="Describe the portion of work assigned to this sub…"></textarea></div>
  <div class="two"><div class="fg"><label class="fl">Contract Value</label><input class="fi" type="number" id="sa-cv" step="0.01"></div><div class="fg"><label class="fl">Status</label><select class="fs" id="sa-status"><option value="assigned">Assigned</option><option value="in_progress">In Progress</option><option value="complete">Complete</option></select></div></div>
  <div class="two"><div class="fg"><label class="fl">Start Date</label><input class="fi" type="date" id="sa-start"></div><div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="sa-due"></div></div>
  <div class="fg"><label class="fl">Notes</label><textarea class="ft" id="sa-notes" style="min-height:55px"></textarea></div>\`,
  async()=>{
    const coId=v('sa-co');if(!coId){toast('Select a sub','error');return}
    const scope=v('sa-scope').trim();if(!scope){toast('Scope required','error');return}
    const{error}=await sb.from('job_sub_assignments').insert({id:uuid(),job_id:currentJobId,company_id:coId,scope_of_work:scope,contract_value:parseFloat(v('sa-cv'))||null,status:v('sa-status'),start_date:v('sa-start')||null,due_date:v('sa-due')||null,notes:v('sa-notes'),created_by:ME?.full_name,created_at:new Date().toISOString()})
    if(error)toast(error.message,'error');else{closeModal();toast('Sub assigned');renderSubAssignTab(document.getElementById('jt-subs'))}
  })
}
async function updateSubAssign(id,status){await sb.from('job_sub_assignments').update({status}).eq('id',id);toast('Updated');renderSubAssignTab(document.getElementById('jt-subs'))}
async function deleteSubAssign(id){if(!confirm('Remove this assignment?'))return;await sb.from('job_sub_assignments').delete().eq('id',id);renderSubAssignTab(document.getElementById('jt-subs'))}

// ══════════════════════════════════════════
// PLAN MARKUP (enhanced — used for job walks AND job asbuilts)
// markupType: 'walk' | 'job'
// ══════════════════════════════════════════
let _markupPlanId=null,_markupReturnFn=null

function openPlanMarkup(planId,planUrl,fileName,returnFn){
  _markupPlanId=planId;_markupReturnFn=returnFn
  document.getElementById('page-title').textContent='Plan Markup — '+fileName
  document.getElementById('topbar-actions').innerHTML=\`
    <button class="btn btn-sm" onclick="if(_markupReturnFn)_markupReturnFn()">← Back</button>
    <button class="btn btn-sm btn-p" onclick="saveMarkupData()">💾 Save</button>
    <button class="btn btn-sm btn-g" onclick="downloadMarkupPNG()">⬇ Download PNG</button>\`

  document.getElementById('page-area').innerHTML=\`
  <div style="display:grid;grid-template-columns:1fr 260px;gap:13px;height:calc(100vh - 130px)">
    <div style="display:flex;flex-direction:column;gap:9px">
      <!-- TOOLBAR -->
      <div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span style="font-size:10px;color:#414e63;font-weight:600">MODE</span>
        <button class="mt-btn active" id="mmt-dot" onclick="setMarkupMode('dot',this)">● Dot</button>
        <button class="mt-btn" id="mmt-text" onclick="setMarkupMode('text',this)">T Text</button>
        <button class="mt-btn" id="mmt-del" onclick="setMarkupMode('delete',this)">🗑 Delete</button>
        <div style="width:1px;height:20px;background:rgba(255,255,255,.1);margin:0 4px"></div>
        <span style="font-size:10px;color:#414e63;font-weight:600">COLOR</span>
        <div id="color-swatches" style="display:flex;gap:5px">
          \${['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#0d9488','#ec4899','#f97316','#ffffff','#000000'].map((clr,i)=>\`<div onclick="setMarkupColor('\${clr}',this)" style="width:18px;height:18px;border-radius:50%;background:\${clr};cursor:pointer;border:2px solid \${i===0?'#fff':'transparent'};flex-shrink:0" data-color="\${clr}"></div>\`).join('')}
        </div>
        <div style="width:1px;height:20px;background:rgba(255,255,255,.1);margin:0 4px"></div>
        <span style="font-size:10px;color:#414e63;font-weight:600">SIZE</span>
        <select class="fi" id="dot-size" style="width:60px;padding:3px 6px;font-size:11px">
          <option value="6">XS</option><option value="9">S</option><option value="13" selected>M</option><option value="18">L</option><option value="24">XL</option>
        </select>
        <button class="mt-btn" onclick="clearAllMarkup()" style="margin-left:auto;color:#dc2626">🗑 Clear All</button>
      </div>
      <!-- CANVAS -->
      <div style="flex:1;overflow:auto;background:#1a2540;border-radius:9px;border:1px solid rgba(255,255,255,.07);cursor:crosshair;position:relative" id="canvas-scroll-wrap">
        <canvas id="markup-canvas" style="display:block;max-width:100%"></canvas>
        <div id="canvas-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#414e63;font-size:13px">Loading plan…</div>
      </div>
      <div style="font-size:10px;color:#414e63">Tip: Click to place dot/text • Click existing element in Delete mode to remove • Save often</div>
    </div>
    <!-- SIDEBAR -->
    <div style="overflow-y:auto;display:flex;flex-direction:column;gap:10px">
      <div class="card">
        <div class="card-title">Legend <button class="btn btn-sm btn-p" onclick="addLegendEntry()" style="font-size:10px;padding:3px 8px">+</button></div>
        <div id="legend-entries"></div>
        <div style="font-size:10px;color:#414e63;margin-top:6px">Add entries to explain what your colored dots mean</div>
      </div>
      <div class="card">
        <div class="card-title">Text Boxes</div>
        <div id="textbox-entries"></div>
      </div>
      <div class="card">
        <div class="card-title">Dots (\${0})</div>
        <div id="dot-count-display" style="font-size:11px;color:#414e63">0 dots placed</div>
      </div>
    </div>
  </div>\`

  loadMarkupData(planId,planUrl)
}

let _mMode='dot',_mColor='#dc2626',_mCanvas=null,_mCtx=null,_mImg=null,_mData={dots:[],textboxes:[],legend:[]}

function setMarkupMode(m,btn){
  _mMode=m
  document.querySelectorAll('.mt-btn').forEach(b=>b.classList.remove('active'))
  if(btn)btn.classList.add('active')
  const canvas=document.getElementById('markup-canvas')
  if(canvas)canvas.style.cursor=m==='delete'?'crosshair':m==='text'?'text':'crosshair'
}
function setMarkupColor(c,el){
  _mColor=c
  document.querySelectorAll('#color-swatches div').forEach(d=>d.style.border='2px solid transparent')
  if(el)el.style.border='2px solid #fff'
}

async function loadMarkupData(planId,planUrl){
  const{data:plan}=await sb.from('job_walk_plans').select('markup_json').eq('id',planId).single()
  _mData=plan?.markup_json||{dots:[],textboxes:[],legend:[]}
  // Load image
  const canvas=document.getElementById('markup-canvas')
  const ctx=canvas.getContext('2d')
  _mCanvas=canvas;_mCtx=ctx
  const img=new Image();img.crossOrigin='anonymous'
  img.onload=()=>{
    canvas.width=img.naturalWidth||1200;canvas.height=img.naturalHeight||800
    canvas.style.width='100%'
    _mImg=img
    document.getElementById('canvas-loading').style.display='none'
    redrawMarkup()
    renderLegendEntries();renderTextboxEntries();updateDotCount()
    // Attach click handler
    canvas.onclick=handleMarkupClick
  }
  img.onerror=()=>{
    canvas.width=1200;canvas.height=800;canvas.style.width='100%'
    ctx.fillStyle='#1a2540';ctx.fillRect(0,0,1200,800)
    ctx.fillStyle='#414e63';ctx.font='16px DM Sans,sans-serif';ctx.textAlign='center'
    ctx.fillText('PDF/image preview not available',600,400)
    ctx.fillText('Markup will still be saved. Use Download to view with annotations.',600,430)
    _mImg=null
    document.getElementById('canvas-loading').style.display='none'
    redrawMarkup();canvas.onclick=handleMarkupClick
  }
  img.src=planUrl
}

function handleMarkupClick(e){
  const canvas=document.getElementById('markup-canvas');if(!canvas)return
  const rect=canvas.getBoundingClientRect()
  const sx=canvas.width/rect.width,sy=canvas.height/rect.height
  const cx=(e.clientX-rect.left)*sx,cy=(e.clientY-rect.top)*sy
  if(_mMode==='dot'){
    const sz=parseInt(document.getElementById('dot-size')?.value||13)
    const id=uuid()
    _mData.dots.push({id,x:cx,y:cy,color:_mColor,size:sz,label:''})
    redrawMarkup();updateDotCount();beep()
  } else if(_mMode==='text'){
    const txt=prompt('Enter text to place on plan:');if(!txt)return
    _mData.textboxes.push({id:uuid(),x:cx,y:cy,text:txt,color:_mColor,fontSize:14})
    redrawMarkup();renderTextboxEntries()
  } else if(_mMode==='delete'){
    const hit=findMarkupHit(cx,cy)
    if(hit){
      if(hit.type==='dot')_mData.dots=_mData.dots.filter(d=>d.id!==hit.id)
      else _mData.textboxes=_mData.textboxes.filter(t=>t.id!==hit.id)
      redrawMarkup();renderLegendEntries();renderTextboxEntries();updateDotCount()
      toast('Removed','info')
    }
  }
}
function findMarkupHit(cx,cy){
  for(const d of _mData.dots){if(Math.sqrt((cx-d.x)**2+(cy-d.y)**2)<=d.size+5)return{...d,type:'dot'}}
  for(const t of _mData.textboxes){if(cx>=t.x-5&&cx<=t.x+200&&cy>=t.y-t.fontSize-2&&cy<=t.y+5)return{...t,type:'text'}}
  return null
}
function redrawMarkup(){
  if(!_mCtx||!_mCanvas)return
  _mCtx.clearRect(0,0,_mCanvas.width,_mCanvas.height)
  if(_mImg)_mCtx.drawImage(_mImg,0,0)
  else{_mCtx.fillStyle='#1a2540';_mCtx.fillRect(0,0,_mCanvas.width,_mCanvas.height)}
  // Draw dots
  for(const d of _mData.dots){
    _mCtx.beginPath();_mCtx.arc(d.x,d.y,d.size/2,0,Math.PI*2)
    _mCtx.fillStyle=d.color;_mCtx.fill()
    _mCtx.strokeStyle='rgba(255,255,255,.75)';_mCtx.lineWidth=1.5;_mCtx.stroke()
    if(d.label){_mCtx.fillStyle=d.color;_mCtx.font='bold 11px DM Sans,sans-serif';_mCtx.fillText(d.label,d.x+d.size/2+4,d.y+4)}
  }
  // Draw textboxes
  for(const t of _mData.textboxes){
    _mCtx.font=\`\${t.fontSize}px DM Sans,sans-serif\`
    const w=_mCtx.measureText(t.text).width
    _mCtx.fillStyle='rgba(0,0,0,.65)';_mCtx.fillRect(t.x-3,t.y-t.fontSize,w+6,t.fontSize+6)
    _mCtx.fillStyle=t.color;_mCtx.fillText(t.text,t.x,t.y)
  }
}
function updateDotCount(){const el=document.getElementById('dot-count-display');if(el)el.textContent=(_mData.dots||[]).length+' dots placed'}
function renderLegendEntries(){
  const el=document.getElementById('legend-entries');if(!el)return
  const colorCounts={}
  ;(_mData.dots||[]).forEach(d=>{colorCounts[d.color]=(colorCounts[d.color]||0)+1})
  el.innerHTML=(_mData.legend||[]).map((l,i)=>\`<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px"><div style="width:14px;height:14px;border-radius:50%;background:\${l.color};flex-shrink:0;border:1.5px solid rgba(255,255,255,.3)"></div><div style="font-size:10px;color:#414e63;flex-shrink:0">\${colorCounts[l.color]||0}×</div><input style="flex:1;background:#131c2e;border:1px solid rgba(255,255,255,.1);border-radius:5px;color:#e8edf5;font-size:11px;padding:3px 7px;font-family:inherit" value="\${l.label||''}" placeholder="What this color means…" oninput="_mData.legend[\${i}].label=this.value"><button onclick="_mData.legend.splice(\${i},1);renderLegendEntries()" style="background:none;border:none;cursor:pointer;color:#414e63;font-size:16px;flex-shrink:0">×</button></div>\`).join('')||'<div style="font-size:11px;color:#414e63">No legend entries — click + to add</div>'
}
function addLegendEntry(){_mData.legend.push({id:uuid(),color:_mColor,label:''});renderLegendEntries()}
function renderTextboxEntries(){
  const el=document.getElementById('textbox-entries');if(!el)return
  el.innerHTML=(_mData.textboxes||[]).map((t,i)=>\`<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="width:8px;height:8px;border-radius:50%;background:\${t.color};flex-shrink:0"></div><div style="font-size:11px;flex:1;color:#8a96ab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${t.text}</div><button onclick="_mData.textboxes.splice(\${i},1);renderTextboxEntries();redrawMarkup()" style="background:none;border:none;cursor:pointer;color:#414e63;font-size:14px">×</button></div>\`).join('')||'<div style="font-size:11px;color:#414e63">No text boxes</div>'
}
function clearAllMarkup(){if(!confirm('Clear all dots and text boxes?'))return;_mData.dots=[];_mData.textboxes=[];redrawMarkup();renderLegendEntries();renderTextboxEntries();updateDotCount();toast('Cleared','warn')}
async function saveMarkupData(){
  if(!_markupPlanId)return
  const{error}=await sb.from('job_walk_plans').update({markup_json:_mData}).eq('id',_markupPlanId)
  if(error)toast(error.message,'error');else toast('Markup saved')
}
function downloadMarkupPNG(){
  const canvas=document.getElementById('markup-canvas');if(!canvas)return
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='plan-markup-'+new Date().toISOString().split('T')[0]+'.png';a.click();toast('Downloading PNG…')
}

// Upload plans to job (as-builts)
async function uploadJobAsbuilt(files){
  for(const f of files){
    const path=\`jobs/\${currentJobId}/asbuilts/\${Date.now()}_\${f.name}\`
    const{error}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true})
    if(!error){
      const{data:{publicUrl}}=sb.storage.from('fieldtrack-plans').getPublicUrl(path)
      await sb.from('job_walk_plans').insert({id:uuid(),job_walk_id:null,job_id:currentJobId,file_name:f.name,storage_path:path,url:publicUrl,markup_json:{dots:[],textboxes:[],legend:[]},created_at:new Date().toISOString()})
    }
  }
  toast('Plan uploaded OK');loadJT('jt-asbuilts')
}

async function renderAsbuiltsTab(el){
  const{data:plans}=await sb.from('job_walk_plans').select('*').eq('job_id',currentJobId).is('job_walk_id',null).order('created_at',{ascending:false})
  el.innerHTML=\`
  <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
    <label class="btn btn-p btn-sm" style="cursor:pointer">+ Upload Plan / As-built<input type="file" style="display:none" multiple accept=".pdf,.png,.jpg,.jpeg,.dwg" onchange="uploadJobAsbuilt(this.files)"></label>
    <span style="font-size:11px;color:#414e63">Upload plans, then click Markup to annotate with colored dots, text, and legend</span>
  </div>
  \${(plans||[]).length?plans.map(p=>\`<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:7px">
    <div style="font-size:22px">\${p.file_name?.match(/\\.pdf$/i)?'📄':'🖼'}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${p.file_name}</div>
    <div style="font-size:10px;color:#414e63;margin-top:1px">\${fd(p.created_at)} · \${(p.markup_json?.dots||[]).length} dots · \${(p.markup_json?.textboxes||[]).length} text boxes</div></div>
    <button class="btn btn-sm btn-p" onclick="openPlanMarkup('\${p.id}','\${p.url}','\${p.file_name}',()=>loadJT('jt-asbuilts'))">✏ Markup</button>
    <a href="\${p.url}" target="_blank" class="btn btn-sm">View</a>
    <button class="btn btn-sm btn-ghost" style="color:#dc2626" onclick="deleteJobPlan('\${p.id}','\${p.storage_path||''}')">Del</button>
  </div>\`).join(''):empty('📐','No plans uploaded yet — upload PDF or image files to begin markup')}\` 
}
async function deleteJobPlan(planId,storagePath){
  if(!confirm('Delete this plan?'))return
  if(storagePath)await sb.storage.from('fieldtrack-plans').remove([storagePath]).catch(()=>{})
  await sb.from('job_walk_plans').delete().eq('id',planId)
  toast('Deleted');loadJT('jt-asbuilts')
}


// ══════════════════════════════════════════
// PM VISIT TRACKING
// ══════════════════════════════════════════
async function renderPmVisitsTab(el){
  const{data:visits}=await sb.from('pm_visits').select('*').eq('job_id',currentJobId).order('visit_date',{ascending:false})
  const j=currentJob
  const nextVisitColor=j.next_pm_visit&&daysAway(j.next_pm_visit)<=0?'#dc2626':j.next_pm_visit&&daysAway(j.next_pm_visit)<=7?'#d97706':'#e8edf5'
  const nextVisitText=j.next_pm_visit?(daysAway(j.next_pm_visit)===0?'Today':daysAway(j.next_pm_visit)<0?Math.abs(daysAway(j.next_pm_visit))+'d overdue':daysAway(j.next_pm_visit)+'d away'):''
  let visitsHtml=''
  for(const vis of (visits||[])){
    const outColor=vis.outcome==='approved'?'bg-green':vis.outcome==='issues_found'?'bg-amber':'bg-gray'
    visitsHtml+='<div style="padding:10px 12px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:7px">'
    visitsHtml+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">'
    visitsHtml+='<div><div style="font-weight:500;font-size:13px">PM Visit — '+fd(vis.visit_date)+'</div>'
    visitsHtml+='<div style="font-size:11px;color:#414e63;margin-top:1px">'+(vis.pm_name||'')+'</div></div>'
    visitsHtml+='<span class="badge '+outColor+'">'+(vis.outcome||'visited')+'</span></div>'
    if(vis.observations)visitsHtml+='<div style="font-size:12px;color:#8a96ab;margin-bottom:6px">'+vis.observations+'</div>'
    if(vis.issues)visitsHtml+='<div style="font-size:12px;color:#d97706;margin-bottom:6px">'+vis.issues+'</div>'
    if(vis.next_visit_date)visitsHtml+='<div style="font-size:11px;color:#414e63">Next visit: '+fd(vis.next_visit_date)+'</div>'
    visitsHtml+='</div>'
  }
  el.innerHTML=
    '<div style="margin-bottom:13px;display:flex;gap:9px;align-items:flex-start">'+
    '<div style="flex:1;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 14px">'+
    '<div style="font-size:10px;color:#414e63;margin-bottom:3px">NEXT PM VISIT DUE</div>'+
    '<div style="font-size:18px;font-weight:300;color:'+nextVisitColor+'">'+(j.next_pm_visit?fd(j.next_pm_visit):'Not scheduled')+'</div>'+
    (nextVisitText?'<div style="font-size:11px;color:#414e63;margin-top:2px">'+nextVisitText+'</div>':'')+
    '</div>'+
    '<div style="flex:1;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 14px">'+
    '<div style="font-size:10px;color:#414e63;margin-bottom:3px">PM ASSIGNED</div>'+
    '<div style="font-size:14px;font-weight:500">'+(j.project_manager||'Not assigned')+'</div>'+
    '<div style="font-size:11px;color:#414e63;margin-top:2px">'+(j.pm_visit_schedule||'No schedule set')+'</div>'+
    '</div>'+
    '<button class="btn btn-p btn-sm" onclick="logPmVisitModal()">+ Log Visit</button>'+
    '</div>'+
    '<div class="sec-hdr">Visit History</div>'+
    (visitsHtml||empty('📋','No PM visits logged yet'))
}

async function logPmVisitModal(){
  const pvHtml=
    '<div class="two"><div class="fg"><label class="fl">Visit Date *</label><input class="fi" type="date" id="pmv-date" value="'+new Date().toISOString().split('T')[0]+'"></div>'+
    '<div class="fg"><label class="fl">PM Name</label><input class="fi" id="pmv-pm" value="'+(currentJob?.project_manager||ME?.full_name||'')+'"></div></div>'+
    '<div class="fg"><label class="fl">Observations</label><textarea class="ft" id="pmv-obs" placeholder="What was observed on site…"></textarea></div>'+
    '<div class="fg"><label class="fl">Issues Found</label><textarea class="ft" id="pmv-iss" placeholder="Any problems or items requiring attention…"></textarea></div>'+
    '<div class="two"><div class="fg"><label class="fl">Outcome</label>'+
    '<select class="fs" id="pmv-out"><option value="visited">Visited</option><option value="approved">Approved</option>'+
    '<option value="issues_found">Issues Found</option><option value="reinspection_needed">Reinspection Needed</option></select></div>'+
    '<div class="fg"><label class="fl">Next Visit Date</label><input class="fi" type="date" id="pmv-next"></div></div>'
  modal('Log PM Visit', pvHtml,
    async()=>{
      const{error}=await sb.from('pm_visits').insert({id:uuid(),job_id:currentJobId,visit_date:v('pmv-date'),pm_name:v('pmv-pm'),observations:v('pmv-obs'),issues:v('pmv-iss'),outcome:v('pmv-out'),next_visit_date:v('pmv-next')||null,created_at:new Date().toISOString()})
      if(error){toast(error.message,'error');return}
      if(v('pmv-next'))await sb.from('jobs').update({next_pm_visit:v('pmv-next'),updated_at:new Date().toISOString()}).eq('id',currentJobId)
      closeModal();toast('Visit logged');loadJT('jt-pmvisits')
    }
  )
}

</script>
</body>
</html>
<script>
// ══════════════════════════════════════════
// NOTIFICATIONS PAGE + BADGE
// ══════════════════════════════════════════
async function loadNotifBadge(){
  try{
    const{count}=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('read',false)
    const el=document.getElementById('notif-badge')
    if(el){el.textContent=count||0;el.style.display=(count||0)>0?'block':'none'}
  }catch(e){}
}

async function pgNotifications(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-sm btn-ghost" onclick="markAllNotifsRead()">Mark all read</button>'
  const{data:notifs}=await sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(100)
  const el=document.getElementById('page-area')
  if(!(notifs||[]).length){el.innerHTML=empty('🔔','No notifications');return}
  const groups={parts_variance:[],safety:[],general:[]}
  ;(notifs||[]).forEach(n=>{
    if(n.type==='parts_variance')groups.parts_variance.push(n)
    else if(n.type?.includes('safety'))groups.safety.push(n)
    else groups.general.push(n)
  })
  let html=''
  const renderGroup=(title,icon,items)=>{
    if(!items.length)return''
    return '<div class="card" style="margin-bottom:13px"><div class="card-title">'+icon+' '+title+' ('+items.length+')</div>'+
      items.map(n=>'<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:flex-start;opacity:'+(n.read?.7:1)+'">'+'<div style="flex-shrink:0;margin-top:2px"><div style="width:8px;height:8px;border-radius:50%;background:'+(n.read?'#414e63':'#dc2626')+'"></div></div>'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:'+(n.read?400:600)+'">'+n.title+'</div>'+
        '<div style="font-size:12px;color:#8a96ab;margin-top:3px">'+n.message+'</div>'+
        '<div style="font-size:10px;color:#414e63;margin-top:4px">'+fdt(n.created_at)+'</div>'+
        (n.meta?.job_id?'<button class="btn btn-sm" style="margin-top:6px" onclick="openJob(\\''+n.meta.job_id+'\\')">View Job →</button>':'')+
        '</div>'+
        (!n.read?'<button class="btn btn-sm btn-ghost" onclick="markNotifRead(\\''+n.id+'\\')" style="flex-shrink:0">✓</button>':'')+
        '</div>').join('')+
      '</div>'
  }
  html+=renderGroup('Parts Variance','⚠',groups.parts_variance)
  html+=renderGroup('Safety','🛡',groups.safety)
  html+=renderGroup('General','🔔',groups.general)
  el.innerHTML=html||empty('🔔','No notifications')
  // Mark all as read after viewing
  await sb.from('notifications').update({read:true}).eq('read',false)
  loadNotifBadge()
}

async function markNotifRead(id){
  await sb.from('notifications').update({read:true}).eq('id',id)
  pgNotifications()
}
async function markAllNotifsRead(){
  await sb.from('notifications').update({read:true}).eq('read',false)
  toast('All marked read')
  pgNotifications()
}

// Load badge on boot (called from DOMContentLoaded in main script)
setTimeout(loadNotifBadge, 2000)
setInterval(loadNotifBadge, 60000)
</script>
<script>
// ══════════════════════════════════════════
// DISPATCH BOARD
// ══════════════════════════════════════════
let _dispatchDate = new Date().toISOString().split('T')[0]
let _dispatchData = { jobs:[], employees:[], companies:[], assignments:[] }
let _dragJob = null

// ══════════════════════════════════════════
// ICS CALENDAR EXPORT
// ══════════════════════════════════════════
function fmtICSDate(dateStr, timeStr){
  // Returns YYYYMMDDTHHMMSS format
  const d = new Date(dateStr + (timeStr ? 'T' + timeStr : 'T00:00:00'))
  const pad = n => String(n).padStart(2,'0')
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00'
}

function buildICSEvent(a, empName){
  const uid = a.id + '@fieldaxishq'
  const jobName = a.jobs?.name || 'Job Assignment'
  const jobAddr = a.jobs?.address || ''
  const dateStr = a.dispatch_date
  const startDt = fmtICSDate(dateStr, a.start_time)
  const endDt   = a.end_time ? fmtICSDate(dateStr, a.end_time) : fmtICSDate(dateStr, (a.start_time ? a.start_time.split(':')[0]+':00' : '08:00'))
  const now     = fmtICSDate(new Date().toISOString().split('T')[0], new Date().toTimeString().slice(0,5))
  const notes   = a.notes ? '\\nNotes: ' + a.notes : ''
  const pm      = a.jobs?.project_manager ? '\\nPM: ' + a.jobs.project_manager : ''

  return [
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + now,
    'DTSTART:' + startDt,
    'DTEND:' + endDt,
    'SUMMARY:' + jobName + (empName ? ' — ' + empName : ''),
    jobAddr ? 'LOCATION:' + jobAddr.replace(/,/g, '\\,') : '',
    'DESCRIPTION:Job: ' + jobName + pm + notes + '\\nStatus: ' + (a.status||'scheduled'),
    'STATUS:CONFIRMED',
    'END:VEVENT'
  ].filter(Boolean).join('\\r\\n')
}

function buildICSFile(events, calName){
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FieldAxisHQ//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + calName,
    ...events,
    'END:VCALENDAR'
  ].join('\\r\\n')
}

function downloadICS(content, filename){
  const blob = new Blob([content], {type:'text/calendar;charset=utf-8'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
  toast('Calendar file downloaded — open it to add to Outlook, Google, or Apple Calendar')
}

async function exportDayICS(){
  const{data:assignments}=await sb.from('dispatch_assignments')
    .select('*,jobs(name,address,project_manager),profiles:profile_id(full_name,email)')
    .eq('dispatch_date',_dispatchDate)
  if(!(assignments||[]).length){toast('No assignments on this date','warn');return}
  const events = assignments.map(a=>buildICSEvent(a, a.profiles?.full_name))
  const ics = buildICSFile(events, 'FieldAxisHQ — '+_dispatchDate)
  downloadICS(ics, 'Schedule-'+_dispatchDate+'.ics')
}

async function exportEmployeeICS(profileId, profileName){
  // Get all future assignments for this employee
  const today = new Date().toISOString().split('T')[0]
  const{data:assignments}=await sb.from('dispatch_assignments')
    .select('*,jobs(name,address,project_manager)')
    .eq('profile_id', profileId)
    .gte('dispatch_date', today)
    .order('dispatch_date')
  if(!(assignments||[]).length){toast('No upcoming assignments for '+profileName,'warn');return}
  const events = assignments.map(a=>buildICSEvent(a, profileName))
  const ics = buildICSFile(events, 'Schedule — '+profileName)
  downloadICS(ics, 'Schedule-'+profileName.replace(/\\s+/g,'-')+'.ics')
  toast('Exported '+assignments.length+' assignment'+(assignments.length!==1?'s':'')+' for '+profileName)
}

async function exportSingleAssignmentICS(assignmentId){
  const{data:a}=await sb.from('dispatch_assignments')
    .select('*,jobs(name,address,project_manager),profiles:profile_id(full_name,email)')
    .eq('id',assignmentId).single()
  if(!a){toast('Assignment not found','error');return}
  const ics = buildICSFile([buildICSEvent(a, a.profiles?.full_name)], a.jobs?.name||'Assignment')
  downloadICS(ics, 'Assignment-'+a.dispatch_date+'.ics')
}

async function pgDispatch(){
  document.getElementById('topbar-actions').innerHTML =
    '<button class="btn btn-sm" onclick="dispatchPrevDay()">← Prev</button>'+
    '<input type="date" class="fi" id="dispatch-date" value="'+_dispatchDate+'" style="width:150px;padding:5px 10px" onchange="_dispatchDate=this.value;loadDispatchData()">'+
    '<button class="btn btn-sm" onclick="dispatchNextDay()">Next →</button>'+
    '<button class="btn btn-p btn-sm" onclick="loadDispatchData()">↻ Refresh</button>'+
    '<button class="btn btn-sm btn-g" onclick="exportDayICS()">📅 Export Day to Calendar</button>'

  document.getElementById('page-area').innerHTML =
    '<div style="display:grid;grid-template-columns:280px 1fr;gap:0;height:calc(100vh - 100px);overflow:hidden">' +
    '<div id="dispatch-left" style="border-right:1px solid rgba(255,255,255,.07);overflow-y:auto;background:#060a10"></div>' +
    '<div id="dispatch-right" style="overflow-y:auto;padding:14px"></div>' +
    '</div>'

  await loadDispatchData()
}

function dispatchPrevDay(){
  const d=new Date(_dispatchDate);d.setDate(d.getDate()-1)
  _dispatchDate=d.toISOString().split('T')[0]
  document.getElementById('dispatch-date').value=_dispatchDate
  loadDispatchData()
}
function dispatchNextDay(){
  const d=new Date(_dispatchDate);d.setDate(d.getDate()+1)
  _dispatchDate=d.toISOString().split('T')[0]
  document.getElementById('dispatch-date').value=_dispatchDate
  loadDispatchData()
}

async function loadDispatchData(){
  const left=document.getElementById('dispatch-left')
  const right=document.getElementById('dispatch-right')
  if(!left||!right) return
  left.innerHTML='<div class="loading"><div class="spin"></div></div>'
  right.innerHTML='<div class="loading"><div class="spin"></div></div>'

  const[{data:jobs},{data:employees},{data:companies},{data:assignments}]=await Promise.all([
    sb.from('jobs').select('id,name,address,phase,gc_company,project_manager,due_date').eq('archived',false).neq('phase','complete').order('name'),
    sb.from('profiles').select('id,full_name,role,phone,company_id,companies(name)').eq('is_active',true).order('full_name'),
    sb.from('companies').select('id,name,trade').eq('is_active',true).order('name'),
    sb.from('dispatch_assignments').select('*,jobs(name,address),profiles:profile_id(full_name,role),companies:company_id(name)').eq('dispatch_date',_dispatchDate)
  ])

  _dispatchData={jobs:jobs||[],employees:employees||[],companies:companies||[],assignments:assignments||[]}

  // Figure out who/what is already assigned today
  const assignedProfileIds=new Set((assignments||[]).filter(a=>a.profile_id).map(a=>a.profile_id))
  const assignedCompanyIds=new Set((assignments||[]).filter(a=>a.company_id&&!a.profile_id).map(a=>a.company_id))
  const assignedJobIds=new Set((assignments||[]).map(a=>a.job_id))

  renderDispatchLeft(left, employees||[], companies||[], assignedProfileIds, assignedCompanyIds)
  renderDispatchRight(right, employees||[], companies||[], assignments||[], jobs||[], assignedJobIds)
}

function renderDispatchLeft(el, employees, companies, assignedProfileIds, assignedCompanyIds){
  const unassignedEmp=employees.filter(e=>!assignedProfileIds.has(e.id))
  const unassignedCos=companies.filter(co=>!assignedCompanyIds.has(co.id))

  // Group employees by company
  const internal=unassignedEmp.filter(e=>!e.company_id)
  const byCo={}
  unassignedEmp.filter(e=>e.company_id).forEach(e=>{
    if(!byCo[e.company_id])byCo[e.company_id]={name:e.companies?.name||'?',workers:[]}
    byCo[e.company_id].workers.push(e)
  })

  let html='<div style="padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.07)">'
  html+='<div style="font-size:11px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+_dispatchDate+'</div>'
  html+='<div style="font-size:10px;color:#414e63">'+(unassignedEmp.length)+' available · drag to assign</div>'
  html+='</div>'

  // Unassigned jobs pool at top
  const unassignedJobs=_dispatchData.jobs.filter(j=>!new Set(_dispatchData.assignments.map(a=>a.job_id)).has(j.id))
  if(unassignedJobs.length){
    html+='<div style="padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.07)">'
    html+='<div style="font-size:10px;font-weight:600;color:#d97706;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">📋 Unscheduled Jobs ('+unassignedJobs.length+')</div>'
    html+=unassignedJobs.map(j=>
      '<div class="dispatch-job-chip" draggable="true" data-job-id="'+j.id+'" data-job-name="'+j.name.replace(/"/g,'&quot;')+'" data-job-addr="'+(j.address||'').replace(/"/g,'&quot;')+'" onmousedown="startJobDrag(event,this)" '+
      'style="background:#131c2e;border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:8px 10px;margin-bottom:5px;cursor:grab;user-select:none;transition:.15s" '+
      'onmouseenter="this.style.borderColor=\\'rgba(37,99,235,.5)\\'" onmouseleave="this.style.borderColor=\\'rgba(255,255,255,.08)\\'">' +
      '<div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+j.name+'</div>'+
      '<div style="font-size:10px;color:#414e63;margin-top:2px">'+stageBadge(j.phase)+'</div>'+
      '</div>'
    ).join('')
    html+='</div>'
  }

  // Internal employees
  if(internal.length){
    html+='<div style="padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.07)">'
    html+='<div style="font-size:10px;font-weight:600;color:#60a5fa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">👷 Internal Team ('+internal.length+')</div>'
    html+=internal.map(e=>dispatchPersonChip(e)).join('')
    html+='</div>'
  }

  // Sub company groups
  Object.values(byCo).forEach(group=>{
    html+='<div style="padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.07)">'
    html+='<div style="font-size:10px;font-weight:600;color:#a78bfa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">🏢 '+group.name+' ('+group.workers.length+')</div>'
    html+=group.workers.map(e=>dispatchPersonChip(e)).join('')
    html+='</div>'
  })

  if(!unassignedEmp.length&&!unassignedJobs.length){
    html+='<div style="padding:20px 13px;text-align:center;color:#414e63;font-size:12px">Everyone assigned for today ✓</div>'
  }

  el.innerHTML=html
}

function dispatchPersonChip(e){
  const avCss=Object.entries(avS(e.full_name)).map(([k,v])=>k+':'+v).join(';')
  return '<div class="dispatch-person-chip" data-profile-id="'+e.id+'" data-profile-name="'+e.full_name.replace(/"/g,'&quot;')+'" '+
    'style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:7px;margin-bottom:5px;cursor:default">'+
    '<div class="av" style="width:26px;height:26px;font-size:9px;flex-shrink:0;'+avCss+'">'+ini(e.full_name)+'</div>'+
    '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e.full_name+'</div>'+
    '<div style="font-size:10px;color:#414e63">'+e.role+(e.phone?' · '+e.phone:'')+'</div></div>'+
    '</div>'
}

function renderDispatchRight(el, employees, companies, assignments, jobs, assignedJobIds){
  const dateLabel=new Date(_dispatchDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})
  let html='<div style="font-family:\\'Syne\\',sans-serif;font-size:16px;font-weight:700;margin-bottom:14px">'+dateLabel+'</div>'

  // Time slots header
  const hours=['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm']

  // Rows: each employee who is assigned OR all employees (show full board)
  const allEmp=employees
  if(!allEmp.length){
    el.innerHTML=html+'<div style="color:#414e63;font-size:13px">No employees to show. Add employees in the Users section.</div>'
    return
  }

  html+='<div style="overflow-x:auto">'
  html+='<table style="width:100%;border-collapse:collapse;min-width:900px">'
  // Header row with times
  html+='<thead><tr>'
  html+='<th style="text-align:left;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.07);font-size:11px;color:#414e63;min-width:180px;position:sticky;left:0;background:#060a10;z-index:2">Employee</th>'
  html+='<th style="text-align:left;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.07);font-size:10px;color:#414e63;min-width:400px">Schedule — drag a job from the left panel to assign</th>'
  html+='</tr></thead><tbody>'

  for(const emp of allEmp){
    const empAssignments=assignments.filter(a=>a.profile_id===emp.id)
    const avCss=Object.entries(avS(emp.full_name)).map(([k,v])=>k+':'+v).join(';')
    html+='<tr style="border-bottom:1px solid rgba(255,255,255,.04)">'
    // Employee cell
    html+='<td style="padding:10px 12px;vertical-align:top;position:sticky;left:0;background:#060a10;z-index:1">'
    html+='<div style="display:flex;align-items:center;gap:8px">'
    html+='<div class="av" style="width:28px;height:28px;font-size:10px;flex-shrink:0;'+avCss+'">'+ini(emp.full_name)+'</div>'
    html+='<div><div style="font-size:12px;font-weight:500">'+emp.full_name+'</div>'
    html+='<div style="font-size:10px;color:#414e63">'+emp.role+'</div>'
    html+='<button data-eid="'+emp.id+'" data-ename="'+emp.full_name.replace(/"/g,'&quot;')+'" onclick="exportEmployeeICS(this.dataset.eid,this.dataset.ename)" style="background:none;border:none;padding:2px 0;cursor:pointer;font-size:10px;color:#414e63;text-decoration:underline;margin-top:3px">📅 Export</button>'
    html+='</div></div>'
    html+='</td>'
    // Schedule cell — drop zone + assigned jobs
    html+='<td class="dispatch-drop-zone" data-profile-id="'+emp.id+'" data-profile-name="'+emp.full_name.replace(/"/g,'&quot;')+'" '+
      'ondragover="event.preventDefault();this.style.background=\\'rgba(37,99,235,.08)\\'" '+
      'ondragleave="this.style.background=\\'\\'" '+
      'ondrop="handleDispatchDrop(event,this)" '+
      'style="padding:8px 10px;vertical-align:top;min-height:60px;transition:.15s">'
    if(empAssignments.length){
      html+=empAssignments.map(a=>dispatchAssignmentCard(a,assignments)).join('')
    } else {
      html+='<div class="dispatch-empty-zone" style="border:1.5px dashed rgba(255,255,255,.07);border-radius:7px;padding:10px;text-align:center;color:#1a2540;font-size:11px;min-height:44px;display:flex;align-items:center;justify-content:center">Drop job here</div>'
    }
    html+='</td></tr>'
  }

  html+='</tbody></table></div>'
  el.innerHTML=html
}


function buildCrewLine(a, allAssignments){
  if(!allAssignments||!allAssignments.length) return ''
  const crew=(allAssignments||[]).filter(x=>x.job_id===a.job_id&&x.dispatch_date===a.dispatch_date&&x.id!==a.id&&x.profile_id)
  if(!crew.length) return ''
  return '<div style="display:flex;align-items:center;gap:4px;margin-top:5px;flex-wrap:wrap">'+
    '<span style="font-size:9px;color:#414e63">With:</span>'+
    crew.map(x=>{
      const avCss=Object.entries(avS(x.profiles?.full_name||'?')).map(([k,v])=>k+':'+v).join(';')
      return '<div class="av" style="width:18px;height:18px;font-size:7px;'+avCss+'" title="'+(x.profiles?.full_name||'?')+'">'+ini(x.profiles?.full_name||'?')+'</div>'
    }).join('')+
    (crew.length>0?'<span style="font-size:9px;color:#8a96ab">'+crew.map(x=>x.profiles?.full_name||'?').join(', ')+'</span>':'')+
    '</div>'
}

function dispatchAssignmentCard(a, allAssignments){
  const statusColors={scheduled:'rgba(37,99,235,.12)',in_progress:'rgba(22,163,74,.12)',complete:'rgba(22,163,74,.08)',cancelled:'rgba(220,38,38,.08)'}
  const statusBorder={scheduled:'rgba(37,99,235,.25)',in_progress:'rgba(22,163,74,.3)',complete:'rgba(22,163,74,.2)',cancelled:'rgba(220,38,38,.2)'}
  const bg=statusColors[a.status]||statusColors.scheduled
  const border=statusBorder[a.status]||statusBorder.scheduled
  return '<div style="background:'+bg+';border:1px solid '+border+';border-radius:7px;padding:8px 10px;margin-bottom:5px;position:relative">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(a.jobs?.name||'Job')+'</div>'+
    (a.jobs?.address?'<div style="font-size:10px;color:#414e63;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.jobs.address+'</div>':'')+
    '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">'+
    '<span style="font-size:10px;color:#414e63">'+a.dispatch_date+'</span>'+
    (a.start_time?' <span style="font-size:10px;color:#60a5fa">⏱ '+fmtDispatchTime(a.start_time)+(a.end_time?' – '+fmtDispatchTime(a.end_time):'')+'</span>':'')+'  '+
    '<span class="badge bg-gray" style="font-size:9px">'+a.status+'</span>'+
    '</div>'+
    (a.notes?'<div style="font-size:10px;color:#8a96ab;margin-top:3px">'+a.notes+'</div>':'')+
    buildCrewLine(a, allAssignments)+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:4px;margin-left:8px;flex-shrink:0">'+
    '<button onclick="editDispatchAssignment(\\''+a.id+'\\')" style="background:rgba(255,255,255,.08);border:none;border-radius:4px;padding:3px 7px;cursor:pointer;color:#8a96ab;font-size:10px">✏</button>'+
    '<button onclick="exportSingleAssignmentICS(\\''+a.id+'\\')" style="background:rgba(22,163,74,.1);border:none;border-radius:4px;padding:3px 7px;cursor:pointer;color:#16a34a;font-size:10px">📅</button>'+
    '<button onclick="removeDispatchAssignment(\\''+a.id+'\\')" style="background:rgba(220,38,38,.1);border:none;border-radius:4px;padding:3px 7px;cursor:pointer;color:#dc2626;font-size:10px">✕</button>'+
    '</div></div></div>'
}

function fmtDispatchTime(t){
  if(!t)return''
  const[h,m]=t.split(':').map(Number)
  const ampm=h>=12?'pm':'am'
  const h12=h%12||12
  return h12+(m?':'+String(m).padStart(2,'0'):'')+ampm
}

// ── DRAG & DROP ────────────────────────────────────────────────
let _dragData=null

function startJobDrag(e, el){
  _dragData={job_id:el.dataset.jobId, job_name:el.dataset.jobName}
  el.style.opacity='.5'
  el.style.transform='scale(.97)'
  // Make droppable with native drag
  el.setAttribute('draggable','true')
  el.addEventListener('dragend',()=>{el.style.opacity='';el.style.transform='';_dragData=null},{once:true})
}

function handleDispatchDrop(event, dropZone){
  event.preventDefault()
  dropZone.style.background=''
  if(!_dragData?.job_id){
    // Try native drag data
    const jobId=event.dataTransfer.getData('job_id')
    const jobName=event.dataTransfer.getData('job_name')
    if(jobId) _dragData={job_id:jobId, job_name:jobName}
    else return
  }
  const profileId=dropZone.dataset.profileId
  const profileName=dropZone.dataset.profileName
  openAssignModal(_dragData.job_id, _dragData.job_name, profileId, profileName)
  _dragData=null
}

// Also handle dragstart on job chips for native HTML5 drag
document.addEventListener('dragstart', e=>{
  const chip=e.target.closest('.dispatch-job-chip')
  if(chip){
    _dragData={job_id:chip.dataset.jobId, job_name:chip.dataset.jobName}
    e.dataTransfer.setData('job_id', chip.dataset.jobId)
    e.dataTransfer.setData('job_name', chip.dataset.jobName)
    e.dataTransfer.effectAllowed='move'
  }
})

function openAssignModal(jobId, jobName, profileId, profileName){
  const now=new Date()
  const hh=String(now.getHours()).padStart(2,'0')
  const mm=String(Math.round(now.getMinutes()/15)*15%60).padStart(2,'0')
  const defStart=hh+':'+mm
  const defEnd=String((now.getHours()+4)%24).padStart(2,'0')+':00'

  const html=
    '<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:7px;padding:10px 12px;margin-bottom:13px">'+
    '<div style="font-size:11px;color:#414e63">ASSIGNING</div>'+
    '<div style="font-size:14px;font-weight:600;margin-top:2px">'+jobName+'</div>'+
    '<div style="font-size:12px;color:#8a96ab;margin-top:2px">→ '+profileName+'</div>'+
    '</div>'+
    '<div class="fg"><label class="fl">Scheduled Date</label><input class="fi" type="date" id="da-date" value="'+_dispatchDate+'"></div>'+
    '<div class="two">'+
    '<div class="fg"><label class="fl">Start Time</label><input class="fi" type="time" id="da-start" value="'+defStart+'"></div>'+
    '<div class="fg"><label class="fl">Projected End</label><input class="fi" type="time" id="da-end" value="'+defEnd+'"></div>'+
    '</div>'+
    '<div class="fg"><label class="fl">Notes</label><input class="fi" id="da-notes" placeholder="Special instructions, access codes…"></div>'+
    '<div class="fg"><label class="fl">Status</label><select class="fs" id="da-status">'+
    '<option value="scheduled">Scheduled</option>'+
    '<option value="in_progress">In Progress</option>'+
    '<option value="complete">Complete</option>'+
    '<option value="cancelled">Cancelled</option>'+
    '</select></div>'

  modal('Assign to Schedule', html, async()=>{
    const assignDate=document.getElementById('da-date')?.value||_dispatchDate
    const{error}=await sb.from('dispatch_assignments').insert({
      id:uuid(), job_id:jobId, profile_id:profileId,
      dispatch_date:assignDate,
      start_time:v('da-start')||null,
      end_time:v('da-end')||null,
      notes:v('da-notes'),
      status:v('da-status'),
      created_by:ME?.full_name,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    if(error){toast(error.message,'error');return}
    closeModal()
    toast(profileName+' assigned to '+jobName)
    await loadDispatchData()
  }, 'Assign')
}

async function editDispatchAssignment(id){
  // Load the assignment plus all crew on the same job/date
  const{data:a}=await sb.from('dispatch_assignments')
    .select('*,jobs(name,address),profiles:profile_id(full_name)')
    .eq('id',id).single()
  if(!a)return

  // Get all other crew assigned to this same job on this same date
  const{data:crew}=await sb.from('dispatch_assignments')
    .select('id,profile_id,profiles:profile_id(full_name),start_time,end_time')
    .eq('job_id',a.job_id).eq('dispatch_date',a.dispatch_date)
    .neq('id',id)

  const crewHtml=(crew&&crew.length)
    ?'<div class="fg"><div class="fl">Also Assigned to This Job</div>'+
      '<div style="background:#131c2e;border-radius:7px;padding:9px 11px">'+
      (crew||[]).map(x=>{
        const avCss=Object.entries(avS(x.profiles?.full_name||'?')).map(([k,v])=>k+':'+v).join(';')
        return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'+
          '<div class="av" style="width:22px;height:22px;font-size:8px;flex-shrink:0;'+avCss+'">'+ini(x.profiles?.full_name||'?')+'</div>'+
          '<span style="font-size:12px;flex:1">'+(x.profiles?.full_name||'?')+'</span>'+
          (x.start_time?'<span style="font-size:10px;color:#60a5fa">'+fmtDispatchTime(x.start_time)+(x.end_time?'–'+fmtDispatchTime(x.end_time):'')+'</span>':'')+
          '</div>'
      }).join('')+'</div></div>'
    :'<div style="font-size:11px;color:#414e63;margin-bottom:10px">No other crew assigned to this job on this date</div>'

  const html=
    '<div style="background:#131c2e;border-radius:7px;padding:9px 12px;margin-bottom:13px">'+
    '<div style="font-size:13px;font-weight:600">'+(a.jobs?.name||'Job')+'</div>'+
    '<div style="font-size:11px;color:#414e63;margin-top:2px">'+(a.jobs?.address||'')+'</div>'+
    '<div style="font-size:11px;color:#8a96ab;margin-top:3px">Assigned to: '+(a.profiles?.full_name||'?')+'</div>'+
    '</div>'+
    crewHtml+
    '<div class="fg"><label class="fl">Scheduled Date</label><input class="fi" type="date" id="ea-date" value="'+(a.dispatch_date||_dispatchDate)+'"></div>'+
    '<div class="two">'+
    '<div class="fg"><label class="fl">Start Time</label><input class="fi" type="time" id="ea-start" value="'+(a.start_time||'')+'"></div>'+
    '<div class="fg"><label class="fl">Projected End</label><input class="fi" type="time" id="ea-end" value="'+(a.end_time||'')+'"></div>'+
    '</div>'+
    '<div class="fg"><label class="fl">Notes</label><input class="fi" id="ea-notes" value="'+(a.notes||'').replace(/"/g,'&quot;')+'"></div>'+
    '<div class="fg"><label class="fl">Status</label><select class="fs" id="ea-status">'+
    '<option value="scheduled"'+(a.status==='scheduled'?' selected':'')+'>Scheduled</option>'+
    '<option value="in_progress"'+(a.status==='in_progress'?' selected':'')+'>In Progress</option>'+
    '<option value="complete"'+(a.status==='complete'?' selected':'')+'>Complete</option>'+
    '<option value="cancelled"'+(a.status==='cancelled'?' selected':'')+'>Cancelled</option>'+
    '</select></div>'+
    '<div class="fg"><label class="fl">Apply date/time change to</label>'+
    '<select class="fs" id="ea-scope">'+
    '<option value="this">This employee only</option>'+
    '<option value="all">All crew on this job & date</option>'+
    '</select></div>'

  modal('Edit Assignment', html, async()=>{
    const scope=v('ea-scope')
    const update={
      dispatch_date:v('ea-date')||_dispatchDate,
      start_time:v('ea-start')||null,
      end_time:v('ea-end')||null,
      notes:v('ea-notes'),
      status:v('ea-status'),
      updated_at:new Date().toISOString()
    }
    if(scope==='all'){
      // Update all crew on this job/date
      const{error}=await sb.from('dispatch_assignments').update(update)
        .eq('job_id',a.job_id).eq('dispatch_date',a.dispatch_date)
      if(error){toast(error.message,'error');return}
      toast('Updated all crew on this job')
    } else {
      const{error}=await sb.from('dispatch_assignments').update(update).eq('id',id)
      if(error){toast(error.message,'error');return}
      toast('Assignment updated')
    }
    closeModal();await loadDispatchData()
  }, 'Save')
}

async function removeDispatchAssignment(id){
  if(!confirm('Remove this assignment?'))return
  await sb.from('dispatch_assignments').delete().eq('id',id)
  toast('Removed','warn');await loadDispatchData()
}

// ── MOBILE SIDEBAR ────────────────────────────────────────────
function toggleSidebar(){
  const sb=document.getElementById('sidebar')
  const ov=document.getElementById('mobile-overlay')
  const isOpen=sb.classList.contains('open')
  if(isOpen){closeSidebar()}
  else{sb.classList.add('open');ov.classList.add('open');document.body.style.overflow='hidden'}
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('mobile-overlay').classList.remove('open')
  document.body.style.overflow=''
}
// Close sidebar when a nav item is tapped on mobile
document.querySelectorAll && document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click',()=>{ if(window.innerWidth<=768) closeSidebar() })
  })
})
</script>
`
const HTML_WORKER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>FieldAxisHQ — Field Worker</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#060a10;--bg2:#0c1220;--bg3:#131c2e;--bg4:#1a2540;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.12);--text:#e8edf5;--text2:#8a96ab;--text3:#414e63;--accent:#2563eb;--green:#16a34a;--gbg:rgba(22,163,74,.12);--gb:rgba(22,163,74,.22);--amber:#d97706;--abg:rgba(217,119,6,.12);--ab:rgba(217,119,6,.22);--red:#dc2626;--rbg:rgba(220,38,38,.12);--rb:rgba(220,38,38,.22);--r:12px;--rs:8px}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);overscroll-behavior:none}
body{display:flex;flex-direction:column}
::-webkit-scrollbar{display:none}

/* APP HEADER */
.hdr{display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 14px 10px;border-bottom:1px solid var(--border);background:var(--bg2);flex-shrink:0}
.hdr-logo{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,#e8edf5,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hdr-sub{font-size:10px;color:var(--text3);margin-top:1px}
.hdr-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.icon-btn{width:32px;height:32px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}

/* GPS STATUS BAR */
.gps-bar{padding:7px 14px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:11px;flex-shrink:0}
.gps-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:500}
.gps-on{background:var(--gbg);color:var(--green);border:1px solid var(--gb)}
.gps-off{background:var(--bg4);color:var(--text3);border:1px solid var(--border2)}
.pulse{width:6px;height:6px;border-radius:50%;background:currentColor;animation:pulse 1.4s infinite;display:inline-block}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}

/* BOTTOM NAV */
.bot-nav{display:flex;border-top:1px solid var(--border);background:var(--bg2);flex-shrink:0;padding-bottom:max(8px,env(safe-area-inset-bottom))}
.bnav-item{flex:1;padding:9px 4px 6px;text-align:center;cursor:pointer;color:var(--text3);transition:.15s}
.bnav-item.active{color:var(--accent)}
.bnav-icon{font-size:20px;margin-bottom:2px}
.bnav-lbl{font-size:9px;font-weight:500}

/* SCREENS */
.screens{flex:1;overflow:hidden;position:relative}
.sc{display:none;position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px max(80px,env(safe-area-inset-bottom))}
.sc.active{display:block}

/* BUTTONS */
.btn{width:100%;padding:13px;border-radius:var(--rs);font-size:14px;font-weight:600;cursor:pointer;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-family:'DM Sans',sans-serif;transition:.15s;display:flex;align-items:center;justify-content:center;gap:7px}
.btn:active{opacity:.75}.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-p{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn-g{background:var(--gbg);color:var(--green);border-color:var(--gb)}
.btn-r{background:var(--rbg);color:var(--red);border-color:var(--rb)}
.btn-a{background:var(--abg);color:var(--amber);border-color:var(--ab)}
.btn-sm{padding:8px 14px;font-size:13px;width:auto}
.row{display:flex;gap:9px}

/* FORMS */
.fg{margin-bottom:13px}
.fl{font-size:10px;font-weight:500;color:var(--text3);margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.06em}
.fi,.fs,.ft{width:100%;padding:10px 12px;font-size:15px;border:1px solid var(--border2);border-radius:var(--rs);background:var(--bg2);color:var(--text);font-family:'DM Sans',sans-serif}
.fi:focus,.fs:focus,.ft:focus{outline:none;border-color:var(--accent)}
.ft{resize:vertical;min-height:70px;line-height:1.5}
.fi::placeholder{color:var(--text3)}

/* CARDS */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:12px}
.card-ttl{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:11px}

/* JOB CARD */
.job-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:13px 14px;margin-bottom:10px;cursor:pointer;transition:.15s}
.job-card:active{opacity:.8;background:var(--bg3)}
.job-card.open{border-color:var(--accent);background:rgba(37,99,235,.04)}
.jc-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:3px}
.jc-addr{font-size:11px;color:var(--text3);margin-bottom:7px}
.jc-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500}
.b-green{background:var(--gbg);color:var(--green)}.b-amber{background:var(--abg);color:var(--amber)}
.b-blue{background:rgba(37,99,235,.12);color:#60a5fa}.b-red{background:var(--rbg);color:var(--red)}
.b-gray{background:var(--bg4);color:var(--text2)}.b-teal{background:rgba(13,148,136,.12);color:#2dd4bf}

/* GPS INDICATOR */
.gps-block{border-radius:var(--r);padding:13px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px}
.gps-on-block{background:var(--gbg);border:1px solid var(--gb)}
.gps-off-block{background:var(--bg3);border:1px solid var(--border2)}

/* CHECK-IN CARD */
.ci-card{border-radius:var(--r);padding:14px 16px;text-align:center;margin-bottom:13px}
.ci-active{background:var(--gbg);border:1.5px solid var(--gb)}
.ci-inactive{background:var(--bg2);border:1px solid var(--border2)}
.ci-status{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:3px}
.ci-meta{font-size:12px;color:var(--text2)}
.ci-timer{font-size:28px;font-weight:300;color:var(--green);font-family:'DM Sans',monospace;margin:8px 0}

/* PARTS LIST */
.part-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.part-row:last-child{border-bottom:none}
.pr-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:4px}
.pr-info{flex:1;min-width:0}
.pr-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-bc{font-size:10px;color:var(--text3);margin-top:1px}
.pr-act select{font-size:11px;padding:3px 8px;border-radius:var(--rs);border:1px solid var(--border2);background:var(--bg3);color:var(--text);cursor:pointer}

/* CHECKLIST */
.chk-item{display:flex;align-items:flex-start;gap:11px;padding:11px 0;border-bottom:1px solid var(--border)}
.chk-item:last-child{border-bottom:none}
.chk-box{width:22px;height:22px;border-radius:6px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:.15s}
.chk-box.ck{background:var(--green);border-color:var(--green)}.chk-box.ck::after{content:'✓';color:#fff;font-size:12px;font-weight:700}
.chk-lbl{font-size:14px;color:var(--text);line-height:1.4}.chk-lbl.done{text-decoration:line-through;color:var(--text3)}

/* PHOTO GRID */
.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
.photo-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;aspect-ratio:4/3;cursor:pointer}
.photo-thumb{width:100%;height:100%;object-fit:cover;display:block}
.photo-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--text3)}

/* MISC */
.sec-hdr{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px}
.pbar{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden}
.pb{height:100%;border-radius:3px;background:var(--accent);transition:width .4s}
.pb.g{background:var(--green)}
.empty{text-align:center;padding:28px 14px;color:var(--text3);font-size:13px}
.av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-family:'Syne',sans-serif}
.spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.toast-wrap{position:fixed;bottom:max(90px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:9999;pointer-events:none}
.toast-el{background:var(--bg2);border:1px solid var(--border2);border-radius:99px;padding:9px 18px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:7px;box-shadow:0 6px 24px rgba(0,0,0,.7);animation:fadeUp .2s ease}
@keyframes fadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
.inset-top{padding-top:max(0px,env(safe-area-inset-top))}
.upload-zone{border:1.5px dashed var(--border2);border-radius:var(--r);padding:18px;text-align:center;cursor:pointer}
.upload-zone:hover{border-color:var(--accent)}
.upload-zone input{display:none}
</style>
</head>
<body>

<!-- HEADER -->
<div class="hdr">
  <div>
    <div class="hdr-logo">FieldAxisHQ</div>
    <div class="hdr-sub">Field Worker Portal</div>
  </div>
  <div class="hdr-right">
    <div class="icon-btn" id="notif-btn" onclick="showScreen('notif')">🔔<span id="notif-dot" style="display:none;position:absolute;top:0;right:0;width:8px;height:8px;border-radius:50%;background:var(--red)"></span></div>
    <div id="user-av" class="av" style="width:32px;height:32px;font-size:12px;cursor:pointer" onclick="confirmSignOut()"></div>
  </div>
</div>

<!-- GPS BAR -->
<div class="gps-bar">
  <div class="gps-pill gps-off" id="gps-pill"><span class="pulse"></span><span id="gps-status-txt">Locating…</span></div>
  <span id="gps-coords-txt" style="color:var(--text3);font-size:9px;font-family:'DM Mono',monospace"></span>
  <span id="checkin-indicator" style="margin-left:auto;font-size:11px;color:var(--green);display:none">✓ Checked in</span>
</div>

<!-- SCREENS -->
<div class="screens">

<!-- ── JOBS SCREEN ── -->
<div id="sc-jobs" class="sc active">
  <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:13px">My Assigned Jobs</div>
  <div id="jobs-list"><div class="empty">Loading…</div></div>
</div>

<!-- ── JOB DETAIL SCREEN ── -->
<div id="sc-jobdetail" class="sc">
  <button class="btn" style="margin-bottom:12px" onclick="showScreen('jobs')">← Back to Jobs</button>
  <div id="jd-content"></div>
</div>

<!-- ── SCAN SCREEN (quick parts lookup) ── -->
<div id="sc-scan" class="sc">
  <div class="sec-hdr">Quick Part Lookup</div>
  <div class="fg"><label class="fl">Barcode</label><input class="fi" id="wk-bc" placeholder="Scan or type barcode…" oninput="wkLookup(this.value)"></div>
  <div id="wk-resolve" style="margin-bottom:8px"></div>
  <div class="fg"><label class="fl">My Current Job</label><select class="fs" id="wk-job" onchange="wkLoadJobParts()"><option value="">— Select job —</option></select></div>
  <div id="wk-parts-list"></div>
</div>

<!-- ── NOTIFICATIONS ── -->
<div id="sc-notif" class="sc">
  <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:13px">Notifications</div>
  <div id="wk-notif-list"><div class="empty">No notifications</div></div>
</div>

<!-- ── PROFILE ── -->
<div id="sc-profile" class="sc">
  <div class="card" style="text-align:center;padding:22px">
    <div id="pf-av" class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto 12px"></div>
    <div id="pf-name" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700"></div>
    <div id="pf-role" style="font-size:12px;color:var(--text3);margin-top:3px"></div>
    <div id="pf-company" style="font-size:12px;color:var(--text3);margin-top:2px"></div>
  </div>
  <div class="card">
    <div class="card-ttl">Change Password</div>
    <div class="fg"><label class="fl">Current Password</label><input class="fi" type="password" id="cp-cur" placeholder="Current password"></div>
    <div class="fg"><label class="fl">New Password</label><input class="fi" type="password" id="cp-new" placeholder="New password (min 6)"></div>
    <button class="btn btn-p" onclick="changePassword()">Update Password</button>
  </div>
  <button class="btn btn-r" style="margin-top:5px" onclick="confirmSignOut()">Sign Out</button>
</div>

</div><!-- end screens -->

<!-- BOTTOM NAV -->
<!-- SAFETY SCREEN -->
<div class="sc" id="sc-safety" style="padding:14px;overflow-y:auto;flex:1">
  <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:13px">🛡 Safety Training</div>
  <div id="safety-pending" style="margin-bottom:16px"></div>
  <div id="safety-completed"></div>
</div>

<div class="bot-nav">
  <div class="bnav-item active" id="bnav-jobs" onclick="showScreen('jobs')"><div class="bnav-icon">🏗</div><div class="bnav-lbl">Jobs</div></div>
  <div class="bnav-item" id="bnav-scan" onclick="showScreen('scan')"><div class="bnav-icon">🔍</div><div class="bnav-lbl">Parts</div></div>
  <div class="bnav-item" id="bnav-safety" onclick="showScreen('safety')" style="position:relative"><div class="bnav-icon">🛡</div><div class="bnav-lbl">Safety</div><div id="safety-badge" style="display:none;position:absolute;top:4px;right:8px;background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:99px">!</div></div>
  <div class="bnav-item" id="bnav-notif" onclick="showScreen('notif')"><div class="bnav-icon">🔔</div><div class="bnav-lbl">Alerts</div></div>
  <div class="bnav-item" id="bnav-profile" onclick="showScreen('profile')"><div class="bnav-icon">👤</div><div class="bnav-lbl">Me</div></div>
</div>

<div class="toast-wrap" id="toast-wrap"></div>

<script src="fax-shared.js"></script>
<script>
// ════════════════════════════════════════
// FieldAxisHQ  Worker Portal
// ════════════════════════════════════════
const sb = getSb()
let MY = null
let gpsPos = null
let gpsWatchId = null
let myJobs = []
let currentJobId = null
let currentJob = null
let checkinTimer = null
let checkinStart = null

// ── BOOT ─────────────────────────────────
window.addEventListener('load', async () => {
  const session = await requireAuth(sb); if (!session) return
  // Try to get profile, handle 406/404 gracefully
  let profile = null
  try {
    const { data, error } = await sb.from('profiles').select('*,companies(name)').eq('id', session.user.id).maybeSingle()
    if (!error) profile = data
  } catch(e) { console.warn('Profile fetch failed:', e.message) }
  // If no profile exists, create one automatically
  if (!profile) {
    const newProfile = { id: session.user.id, full_name: session.user.email.split('@')[0], email: session.user.email, role: 'sub_worker', is_active: true }
    try { await sb.from('profiles').insert(newProfile) } catch(e) {}
    profile = newProfile
  }
  MY = profile
  const name = MY.full_name || session.user.email
  const av = document.getElementById('user-av')
  av.textContent = initials(name); av.style.cssText += ';' + avStyle(name)
  const pfav = document.getElementById('pf-av')
  pfav.textContent = initials(name); pfav.style.cssText += ';' + avStyle(name)
  document.getElementById('pf-name').textContent = name
  document.getElementById('pf-role').textContent = profile?.role || ''
  document.getElementById('pf-company').textContent = profile?.companies?.name || 'Internal'
  startGPS()
  await loadJobs()
  await checkActiveCheckins()
  loadNotifBadge()
  loadSafetyBadge()
})

// ── GPS ──────────────────────────────────
function startGPS() {
  if (!navigator.geolocation) { updateGpsPill(false, 'GPS not available'); return }
  gpsWatchId = navigator.geolocation.watchPosition(pos => {
    gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }
    updateGpsPill(true, '±' + gpsPos.acc + 'm')
    document.getElementById('gps-coords-txt').textContent = gpsPos.lat.toFixed(5) + ', ' + gpsPos.lng.toFixed(5)
  }, err => {
    updateGpsPill(false, 'GPS unavailable')
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })
}
function updateGpsPill(on, txt) {
  const pill = document.getElementById('gps-pill')
  pill.className = 'gps-pill ' + (on ? 'gps-on' : 'gps-off')
  document.getElementById('gps-status-txt').textContent = txt
}

// ── NAVIGATION ────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.sc').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'))
  document.getElementById('sc-' + id)?.classList.add('active')
  document.getElementById('bnav-' + id)?.classList.add('active')
  if (id === 'notif') loadNotifs()
  if (id === 'scan') loadJobsIntoWkSelect()
  if (id === 'safety') loadSafetyTopics()
}

// ── JOBS ──────────────────────────────────
let myDispatchMap = {}  // job_id -> dispatch assignment for today

async function loadJobs() {
  try {
    const today = new Date().toISOString().split('T')[0]
    // Get job IDs assigned to this worker (from job_workers)
    const { data: assignments, error: aErr } = await sb.from('job_workers').select('job_id').eq('worker_id', MY.id).eq('is_active', true)
    if (aErr) throw aErr
    const jobIds = (assignments || []).map(a => a.job_id).filter(Boolean)

    // Also get dispatch assignments for this worker (today + next 7 days)
    const { data: dispatched } = await sb.from('dispatch_assignments')
      .select('*,jobs(id,name,address,phase,due_date,gc_company,gc_contact,gc_phone,super_name,super_phone,scope,install_notes,project_manager,gps_lat,gps_lng,gps_radius_ft)')
      .eq('profile_id', MY.id)
      .gte('dispatch_date', today)
      .order('dispatch_date').order('start_time')
    // Build dispatch map by job_id (keep earliest upcoming)
    myDispatchMap = {}
    ;(dispatched || []).forEach(d => { if(d.jobs&&!myDispatchMap[d.job_id]) myDispatchMap[d.job_id] = d })

    // Merge: all job_worker jobs + dispatch jobs
    const dispatchJobIds = (dispatched||[]).map(d=>d.job_id).filter(Boolean)
    const allJobIds = [...new Set([...jobIds, ...dispatchJobIds])]

    let allMyJobs = []
    if (allJobIds.length) {
      const { data: jobData, error: jErr } = await sb.from('jobs').select('*').in('id', allJobIds)
      if (jErr) throw jErr
      allMyJobs = jobData || []
    }
    myJobs = allMyJobs.filter(j => !j.archived && j.phase !== 'complete')
    if (!myJobs.length) { document.getElementById('jobs-list').innerHTML = '<div class="empty">No jobs assigned to you yet.</div>'; return }

    // Check active check-ins
    const { data: cis } = await sb.from('checkins').select('job_id').eq('worker_id', MY.id).is('checkout_at', null)
    const activeJobIds = new Set((cis || []).map(c => c.job_id))

    // Sort: dispatched today first, then by name
    myJobs.sort((a,b) => {
      const da = myDispatchMap[a.id], db = myDispatchMap[b.id]
      if(da && !db) return -1; if(!da && db) return 1
      if(da && db) return da.dispatch_date.localeCompare(db.dispatch_date) || (da.start_time||'').localeCompare(db.start_time||'')
      return a.name.localeCompare(b.name)
    })

    document.getElementById('jobs-list').innerHTML = myJobs.map(j => {
      const isIn = activeJobIds.has(j.id)
      const disp = myDispatchMap[j.id]
      const dispBadge = disp
        ? '<div style="background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);border-radius:5px;padding:3px 8px;font-size:10px;color:#60a5fa;margin-bottom:7px;display:flex;align-items:center;gap:5px">'
          + '📅 '+disp.dispatch_date+(disp.start_time?' · '+fmtDispatchTime(disp.start_time):'')+(disp.end_time?' – '+fmtDispatchTime(disp.end_time):'')+'</div>'
        : ''
      return \`<div class="job-card \${isIn ? 'open' : ''}" onclick="openJobDetail('\${j.id}')">
        \${isIn ? '<div class="gps-pill gps-on" style="margin-bottom:7px;font-size:10px"><span class="pulse"></span> Checked In</div>' : ''}
        \${dispBadge}
        <div class="jc-name">\${j.name}</div>
        <div class="jc-addr">\${j.address || ''}</div>
        <div class="jc-meta">
          <span class="badge \${phaseColor(j.phase)}">\${j.phase.replace(/_/g,' ')}</span>
          \${j.due_date ? \`<span style="font-size:10px;color:var(--text3)">\${isOverdue(j.due_date,j.phase)?'⚠ ':''}Due \${fmtDate(j.due_date)}</span>\` : ''}
          \${j.gc_company ? \`<span style="font-size:10px;color:var(--text3)">\${j.gc_company}</span>\` : ''}
        </div>
      </div>\`
    }).join('')
  } catch(e) { document.getElementById('jobs-list').innerHTML = '<div class="empty">Failed to load jobs</div>' }
}

function fmtDispatchTime(t){
  if(!t) return ''
  const [h,m] = t.split(':').map(Number)
  const ap = h>=12?'pm':'am', h12 = h%12||12
  return h12+(m?':'+String(m).padStart(2,'0'):'')+ap
}
function phaseColor(p) {
  const m = { not_started:'b-gray', pre_construction:'b-blue', rough_in:'b-amber', trim_out:'b-teal', inspection:'b-blue', closeout:'b-green', complete:'b-green' }
  return m[p] || 'b-gray'
}

// ── JOB DETAIL ────────────────────────────
async function openJobDetail(jobId) {
  currentJobId = jobId
  currentJob = myJobs.find(j => j.id === jobId)
  showScreen('jobdetail')
  document.getElementById('jd-content').innerHTML = '<div class="empty">Loading…</div>'
  await renderJobDetail()
}

async function renderJobDetail() {
  const j = currentJob; if (!j) return
  // Check if checked in
  const { data: cis } = await sb.from('checkins').select('*').eq('job_id', j.id).eq('worker_id', MY.id).is('checkout_at', null)
  const activeCI = cis?.[0]
  // Load parts, checklist, photos
  const [partsR, checkR, photosR, inspsR] = await Promise.all([
    sb.from('job_parts').select('*').eq('job_id', j.id).order('created_at'),
    sb.from('job_checklist_items').select('*').eq('job_id', j.id).order('sort_order'),
    sb.from('job_photos').select('*').eq('job_id', j.id).order('created_at', { ascending: false }).limit(6),
    sb.from('pm_inspections').select('*').eq('job_id', j.id).order('visited_at', { ascending: false }).limit(1)
  ])
  const parts = partsR.data || []
  const items = checkR.data || []
  const photos = photosR.data || []
  const lastInsp = inspsR.data?.[0]
  const doneItems = items.filter(i => i.is_checked).length
  const total = items.length

  let timerHtml = ''
  if (activeCI) {
    const elapsedMs = Date.now() - new Date(activeCI.checkin_at).getTime()
    const hrs = Math.floor(elapsedMs / 3600000), mins = Math.floor((elapsedMs % 3600000) / 60000)
    timerHtml = \`<div class="ci-timer">\${hrs}h \${String(mins).padStart(2,'0')}m</div>\`
  }

  // Get dispatch info for this job
  const disp = myDispatchMap[j.id]
  // Get crew on same dispatch
  let crewHtml = ''
  if(disp){
    const { data: crew } = await sb.from('dispatch_assignments')
      .select('profiles:profile_id(full_name,phone,role)')
      .eq('job_id', j.id).eq('dispatch_date', disp.dispatch_date)
      .neq('profile_id', MY.id)
    if(crew&&crew.length){
      crewHtml = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">'
        +'<div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Your Crew Today</div>'
        +crew.map(x=>'<div style="display:flex;align-items:center;gap:9px;padding:5px 0;border-bottom:1px solid var(--border)">'
          +'<div style="width:32px;height:32px;border-radius:50%;background:#1a2e50;color:#60a5fa;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">'
          +(x.profiles?.full_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)+'</div>'
          +'<div><div style="font-size:13px;font-weight:500">'+(x.profiles?.full_name||'?')+'</div>'
          +(x.profiles?.phone?'<div style="font-size:11px;color:var(--text3)"><a href="tel:'+x.profiles.phone+'" style="color:var(--accent)">'+x.profiles.phone+'</a></div>':'')
          +'</div></div>').join('')
        +'</div>'
    }
  }

  document.getElementById('jd-content').innerHTML = \`
  <!-- DISPATCH SCHEDULE CARD (shown if dispatched) -->
  \${disp ? \`<div style="background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);border-radius:var(--r);padding:13px 14px;margin-bottom:12px">
    <div style="font-size:10px;font-weight:600;color:#60a5fa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">📅 Your Schedule</div>
    <div style="font-size:16px;font-weight:600;color:#e8edf5">\${disp.dispatch_date}</div>
    \${disp.start_time ? \`<div style="font-size:13px;color:#60a5fa;margin-top:3px">⏱ \${fmtDispatchTime(disp.start_time)}\${disp.end_time?' – '+fmtDispatchTime(disp.end_time):''}</div>\` : ''}
    \${disp.notes ? \`<div style="font-size:12px;color:var(--text2);margin-top:6px;padding:7px 9px;background:rgba(0,0,0,.2);border-radius:5px">📝 \${disp.notes}</div>\` : ''}
    <div style="font-size:11px;color:var(--text3);margin-top:5px">Status: \${disp.status||'scheduled'}</div>
  </div>\` : ''}

  <!-- JOB HEADER -->
  <div class="card">
    <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:4px">\${j.name}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">\${j.address||''}</div>
    \${j.address ? \`<a href="https://maps.google.com/?q=\${encodeURIComponent(j.address)}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--accent);margin-bottom:10px">🗺 Open in Maps</a>\` : ''}
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px">
      <span class="badge \${phaseColor(j.phase)}">\${j.phase.replace(/_/g,' ')}</span>
      \${j.due_date?\`<span style="font-size:11px;color:var(--text3)">Due \${fmtDate(j.due_date)}</span>\`:''}
    </div>
    \${j.project_manager ? \`<div style="font-size:12px;color:var(--text2);margin-bottom:4px">👷 PM: <strong>\${j.project_manager}</strong></div>\` : ''}
    \${j.gc_company ? \`<div style="font-size:12px;color:var(--text2);margin-bottom:2px">🏢 GC: \${j.gc_company}</div>\` : ''}
    \${j.gc_contact ? \`<div style="font-size:11px;color:var(--text3)">GC Contact: \${j.gc_contact}\${j.gc_phone?\` · <a href="tel:\${j.gc_phone}" style="color:var(--accent)">\${j.gc_phone}</a>\`:''}</div>\` : ''}
    \${j.super_name ? \`<div style="font-size:11px;color:var(--text3);margin-top:2px">Super: \${j.super_name}\${j.super_phone?\` · <a href="tel:\${j.super_phone}" style="color:var(--accent)">\${j.super_phone}</a>\`:''}</div>\` : ''}
    \${j.scope ? \`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text2);line-height:1.6"><div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Scope of Work</div>\${j.scope}</div>\` : ''}
    \${j.install_notes ? \`<div style="margin-top:8px;background:var(--abg);border:1px solid var(--ab);border-radius:var(--rs);padding:9px 11px;font-size:12px;color:var(--amber);line-height:1.6">📋 Install Notes: \${j.install_notes}</div>\` : ''}
    \${lastInsp?.rejected_at ? \`<div style="margin-top:8px;background:var(--rbg);border:1px solid var(--rb);border-radius:var(--rs);padding:9px 11px;font-size:12px;color:var(--red)">⚠ PM Rejected: \${lastInsp.rejection_reason||'See PM notes'}</div>\` : ''}
    \${crewHtml}
  </div>

  <!-- GPS CHECK-IN / OUT -->
  <div class="ci-card \${activeCI?'ci-active':'ci-inactive'}">
    <div class="ci-status" style="color:\${activeCI?'var(--green)':'var(--text2)'}">\${activeCI?'✓ Checked In':'Not Checked In'}</div>
    \${timerHtml}
    <div class="ci-meta">\${activeCI?'Since '+fmtTime(activeCI.checkin_at)+' · '+Math.round(activeCI.checkin_dist_ft||0)+'ft from site':'Check in to start logging hours'}</div>
  </div>
  \${activeCI
    ? \`<button class="btn btn-r" id="ci-btn" onclick="doCheckout()">Check Out</button>\`
    : \`<button class="btn btn-g" id="ci-btn" onclick="doCheckin('\${j.id}')">📍 GPS Check In</button>\`
  }

  <!-- PARTS -->
  <div class="sec-hdr">Parts on This Job (\${parts.length})</div>
  <div class="card">
    \${parts.length ? parts.map(p => \`<div class="part-row">
      <div class="pr-dot" style="background:\${p.status==='installed'?'var(--green)':p.status==='signed_out'?'#60a5fa':p.over?'var(--red)':'var(--amber)'}"></div>
      <div class="pr-info"><div class="pr-name">\${p.part_name}</div><div class="pr-bc">\${p.part_id} · qty \${p.assigned_qty}</div></div>
      <div class="pr-act"><select onchange="updateMyPartStatus('\${p.id}',this.value)" \${!activeCI?'disabled':''}>
        <option value="staged" \${p.status==='staged'?'selected':''}>Staged</option>
        <option value="signed_out" \${p.status==='signed_out'?'selected':''}>Signed Out</option>
        <option value="partial_install" \${p.status==='partial_install'?'selected':''}>Partial</option>
        <option value="installed" \${p.status==='installed'?'selected':''}>Installed</option>
      </select></div>
    </div>\`).join('') : '<div style="font-size:12px;color:var(--text3)">No parts on this job yet</div>'}
  </div>

  <!-- CHECKLIST -->
  \${items.length ? \`
  <div class="sec-hdr">Checklist (\${doneItems}/\${total})</div>
  <div style="margin-bottom:8px"><div class="pbar"><div class="pb \${doneItems===total&&total>0?'g':''}" style="width:\${total?Math.round(doneItems/total*100):0}%"></div></div></div>
  <div class="card">
    \${items.map(item => \`<div class="chk-item">
      <div class="chk-box \${item.is_checked?'ck':''}" onclick="toggleCheck('\${item.id}',\${!item.is_checked})"></div>
      <div class="chk-lbl \${item.is_checked?'done':''}">\${item.item_text}\${item.section?\`<div style="font-size:10px;color:var(--accent);margin-top:1px">§ \${item.section}</div>\`:''}</div>
    </div>\`).join('')}
  </div>\` : ''}

  <!-- PHOTOS -->
  <div class="sec-hdr">Photos</div>
  <label class="upload-zone">
    <input type="file" multiple accept="image/*" capture="environment" onchange="uploadJobPhotos(this.files)">
    <div style="font-size:22px;color:var(--text3)">📷</div>
    <div style="font-size:12px;color:var(--text3);margin-top:5px">Take or upload photo</div>
  </label>
  \${photos.length ? \`<div class="photo-grid">\${photos.map(p=>\`<div class="photo-card" onclick="window.open('\${p.url}','_blank')"><img class="photo-thumb" src="\${p.url}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div class="photo-ph" style="display:none">🖼</div></div>\`).join('')}</div>\` : ''}

  <!-- DAILY LOG / NOTES -->
  <div class="sec-hdr">Field Notes</div>
  <div class="card">
    <div class="fg"><label class="fl">Log Type</label><select class="fs" id="wk-log-type" style="margin-bottom:8px"><option value="note">Note</option><option value="issue">Issue</option><option value="progress">Progress Update</option></select></div>
    <textarea class="ft" id="wk-log-txt" placeholder="Enter field notes, issues, or progress updates…"></textarea>
    <button class="btn btn-p" style="margin-top:9px" onclick="addFieldNote()">Submit Note</button>
  </div>

  <!-- CONTACT -->
  \${j.gc_contact || j.super_name ? \`
  <div class="sec-hdr">Site Contacts</div>
  <div class="card">
    \${j.gc_contact?\`<div style="padding:7px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;font-weight:500">\${j.gc_contact}</div><div style="font-size:11px;color:var(--text3)">GC Contact\${j.gc_phone?' · <a href="tel:'+j.gc_phone+'" style="color:var(--accent);text-decoration:none">'+j.gc_phone+'</a>':''}</div></div>\`:''}
    \${j.super_name?\`<div style="padding:7px 0"><div style="font-size:12px;font-weight:500">\${j.super_name}</div><div style="font-size:11px;color:var(--text3)">Superintendent\${j.super_phone?' · <a href="tel:'+j.super_phone+'" style="color:var(--accent);text-decoration:none">'+j.super_phone+'</a>':''}</div></div>\`:''}
  </div>\` : ''}
  \`
}

// ── GPS CHECK-IN ──────────────────────────
async function doCheckin(jobId) {
  const btn = document.getElementById('ci-btn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Checking location…'
  if (!gpsPos) {
    toast('GPS not ready — wait for location fix', 'warn')
    btn.disabled = false; btn.innerHTML = '📍 GPS Check In'; return
  }
  try {
    const { data: { session } } = await sb.auth.getSession()
    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
      body: JSON.stringify({ job_id: jobId, checkin_lat: gpsPos.lat, checkin_lng: gpsPos.lng, action: 'checkin' })
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.blocked) toast('Too far from site — ' + data.dist_ft + 'ft away (need within ' + (currentJob?.gps_radius_ft||250) + 'ft)', 'error')
      else toast(data.error || 'Check-in failed', 'error')
      btn.disabled = false; btn.innerHTML = '📍 GPS Check In'; return
    }
    toast('Checked in ✓', 'success')
    document.getElementById('checkin-indicator').style.display = 'block'
    await loadJobs(); await renderJobDetail()
  } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.innerHTML = '📍 GPS Check In' }
}

async function doCheckout() {
  const btn = document.getElementById('ci-btn'); btn.disabled = true; btn.textContent = 'Checking out…'
  try {
    const { data: { session } } = await sb.auth.getSession()
    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
      body: JSON.stringify({ job_id: currentJobId, checkin_lat: gpsPos?.lat, checkin_lng: gpsPos?.lng, action: 'checkout' })
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error, 'error'); btn.disabled = false; btn.textContent = 'Check Out'; return }
    toast('Checked out — ' + fmtHours(data.hours || 0) + ' logged', 'success')
    document.getElementById('checkin-indicator').style.display = 'none'
    await loadJobs(); await renderJobDetail()
  } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Check Out' }
}

async function checkActiveCheckins() {
  if (!MY?.id) return
  const { data } = await sb.from('checkins').select('id').eq('worker_id', MY.id).is('checkout_at', null)
  if ((data||[]).length) { const el = document.getElementById('checkin-indicator'); if(el) el.style.display = 'block' }
}

// ── SAFETY TRAINING ──────────────────────
async function loadSafetyTopics(){
  if(!MY?.id) return
  const[{data:assigns},{data:acks}]=await Promise.all([
    sb.from('safety_assignments').select('*,safety_topics(id,title,content,category,week_of)').eq('profile_id',MY.id).order('assigned_at',{ascending:false}),
    sb.from('safety_acks').select('topic_id,acknowledged_at').eq('profile_id',MY.id)
  ])
  const ackedIds=new Set((acks||[]).map(a=>a.topic_id))
  const pending=(assigns||[]).filter(a=>a.safety_topics&&!ackedIds.has(a.topic_id))
  const completed=(assigns||[]).filter(a=>a.safety_topics&&ackedIds.has(a.topic_id))
  // Update badge
  const badge=document.getElementById('safety-badge')
  if(badge){badge.style.display=pending.length?'block':'none'}
  // Render pending
  const pendEl=document.getElementById('safety-pending')
  if(pendEl){
    if(pending.length){
      pendEl.innerHTML='<div style="font-size:11px;font-weight:600;color:#dc2626;margin-bottom:8px;text-transform:uppercase;letter-spacing:.07em">'+pending.length+' Required — Action Needed</div>'+
        pending.map(a=>{
          const t=a.safety_topics
          return '<div style="background:#0c1220;border:1px solid rgba(220,38,38,.25);border-radius:10px;padding:14px;margin-bottom:9px">'+
            '<div style="font-weight:600;font-size:14px;margin-bottom:4px">'+t.title+'</div>'+
            '<div style="font-size:11px;color:#414e63;margin-bottom:9px">'+t.category+' · Week of '+fmtDate(t.week_of)+(a.due_date?' · Due '+fmtDate(a.due_date):'')+'</div>'+
            '<div style="font-size:13px;color:#8a96ab;line-height:1.6;margin-bottom:12px;background:#131c2e;padding:11px;border-radius:7px;white-space:pre-wrap">'+t.content+'</div>'+
            '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:8px;padding:12px">'+
            '<input type="checkbox" id="ack-'+t.id+'" style="width:18px;height:18px;margin-top:1px;accent-color:#16a34a;flex-shrink:0">'+
            '<div><div style="font-size:13px;font-weight:600;color:#16a34a">I have read and understand this safety topic</div>'+
            '<div style="font-size:11px;color:#8a96ab;margin-top:2px">Check this box to confirm you have reviewed the above content</div></div></label>'+
            '<button class="btn btn-p" style="width:100%;justify-content:center;margin-top:9px" data-tid="'+t.id+'" data-aid="'+a.id+'" onclick="acknowledgeSafety(this.dataset.tid,this.dataset.aid)">Submit Acknowledgement</button>'+
            '</div>'
        }).join('')
    } else {
      pendEl.innerHTML='<div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">✅</div><div style="font-weight:600;color:#16a34a">All safety training complete!</div></div>'
    }
  }
  // Render completed
  const compEl=document.getElementById('safety-completed')
  if(compEl&&completed.length){
    const ackByTopic={}
    ;(acks||[]).forEach(a=>{ackByTopic[a.topic_id]=a})
    compEl.innerHTML='<div style="font-size:11px;font-weight:600;color:#414e63;margin-bottom:8px;text-transform:uppercase;letter-spacing:.07em">Completed ('+completed.length+')</div>'+
      completed.map(a=>{
        const t=a.safety_topics
        const ack=ackByTopic[t.id]
        return '<div style="background:#0c1220;border:1px solid rgba(22,163,74,.15);border-radius:10px;padding:12px;margin-bottom:7px;display:flex;align-items:center;gap:11px">'+
          '<div style="font-size:22px;flex-shrink:0">✅</div>'+
          '<div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">'+t.title+'</div>'+
          '<div style="font-size:11px;color:#414e63;margin-top:2px">'+t.category+' · Completed '+fmtDateTime(ack?.acknowledged_at)+'</div></div>'+
          '</div>'
      }).join('')
  }
}

async function acknowledgeSafety(topicId, assignmentId){
  const cb=document.getElementById('ack-'+topicId)
  if(!cb?.checked){toast('Please check the box to confirm you have read the content','warn');return}
  const btn=event.target
  btn.disabled=true;btn.textContent='Saving…'
  try{
    // Insert ack record
    const{error}=await sb.from('safety_acks').insert({id:uuid(),topic_id:topicId,profile_id:MY.id,user_name:MY.full_name,acknowledged_at:new Date().toISOString()})
    if(error){toast(error.message,'error');btn.disabled=false;btn.textContent='Submit Acknowledgement';return}
    toast('Safety topic acknowledged ✓','success')
    // Reload the screen
    await loadSafetyTopics()
  }catch(e){toast(e.message,'error');btn.disabled=false;btn.textContent='Submit Acknowledgement'}
}

// ── PART STATUS UPDATE ────────────────────
async function updateMyPartStatus(partId, status) {
  try {
    await sb.from('job_parts').update({ status, updated_at: new Date().toISOString() }).eq('id', partId)
    toast('Status updated', 'success')
  } catch(e) { toast(e.message, 'error') }
}

// ── CHECKLIST ─────────────────────────────
async function toggleCheck(id, chk) {
  const { data: { session } } = await sb.auth.getSession()
  await sb.from('job_checklist_items').update({ is_checked: chk, checked_by: chk ? session?.user?.id : null, checked_at: chk ? new Date().toISOString() : null }).eq('id', id)
  toast(chk ? 'Checked ✓' : 'Unchecked', 'success')
  await renderJobDetail()
}

// ── PHOTOS ────────────────────────────────
// Upload directly to Cloudinary (server signs the request — no API keys in browser)
async function uploadToCloudinary(file, folder) {
  const { data: { session } } = await sb.auth.getSession()
  const sigR = await fetch('/api/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
    body: JSON.stringify({ folder })
  })
  const sig = await sigR.json()
  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', sig.api_key)
  fd.append('timestamp', sig.timestamp)
  fd.append('signature', sig.signature)
  fd.append('folder', sig.folder)
  if (sig.upload_preset) fd.append('upload_preset', sig.upload_preset)
  const r = await fetch(\`https://api.cloudinary.com/v1_1/\${sig.cloud_name}/auto/upload\`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Cloudinary upload failed')
  const d = await r.json()
  return { url: d.secure_url, public_id: d.public_id }
}

async function uploadJobPhotos(files) {
  for (const f of files) {
    try {
      const { url, public_id } = await uploadToCloudinary(f, \`fieldaxishq/jobs/\${currentJobId}/photos\`)
      const { data: { session } } = await sb.auth.getSession()
      await fetch('/api/jobs/' + currentJobId + '/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
        body: JSON.stringify({ url, public_id, type: 'progress', photo_lat: gpsPos?.lat, photo_lng: gpsPos?.lng })
      })
    } catch(e) { toast('Upload failed', 'error') }
  }
  toast('Photo uploaded', 'success')
  await renderJobDetail()
}

// ── FIELD NOTES ───────────────────────────
async function addFieldNote() {
  const content = document.getElementById('wk-log-txt').value.trim()
  if (!content) { toast('Write a note first', 'warn'); return }
  const type = document.getElementById('wk-log-type').value
  try {
    const { data: { session } } = await sb.auth.getSession()
    await fetch('/api/jobs/' + currentJobId + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
      body: JSON.stringify({ content, type })
    })
    document.getElementById('wk-log-txt').value = ''
    toast('Note added ✓', 'success')
  } catch(e) { toast(e.message, 'error') }
}

// ── SCAN / PARTS LOOKUP ───────────────────
async function loadJobsIntoWkSelect() {
  const el = document.getElementById('wk-job')
  el.innerHTML = '<option value="">— Select job —</option>' + myJobs.map(j => \`<option value="\${j.id}">\${j.name}</option>\`).join('')
}
async function wkLoadJobParts() {
  const jobId = document.getElementById('wk-job').value
  if (!jobId) { document.getElementById('wk-parts-list').innerHTML = ''; return }
  const { data } = await sb.from('job_parts').select('*').eq('job_id', jobId)
  document.getElementById('wk-parts-list').innerHTML = (data||[]).length
    ? (data||[]).map(p => \`<div class="part-row"><div class="pr-dot" style="background:\${p.status==='installed'?'var(--green)':p.status==='signed_out'?'#60a5fa':'var(--amber)'}"></div><div class="pr-info"><div class="pr-name">\${p.part_name}</div><div class="pr-bc">\${p.part_id} · qty \${p.assigned_qty}</div></div><span class="badge \${p.status==='installed'?'b-green':p.status==='signed_out'?'b-blue':'b-amber'}">\${p.status.replace(/_/g,' ')}</span></div>\`).join('')
    : '<div style="font-size:12px;color:var(--text3)">No parts</div>'
}
let wkBcDeb = null
async function wkLookup(val) {
  clearTimeout(wkBcDeb)
  if (!val || val.length < 3) { document.getElementById('wk-resolve').innerHTML = ''; return }
  wkBcDeb = setTimeout(async () => {
    const { data } = await sb.from('catalog').select('*').or(\`barcode.eq.\${val},name.ilike.%\${val}%\`).limit(4)
    document.getElementById('wk-resolve').innerHTML = (data||[]).map(c => \`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:9px 11px;margin-bottom:5px"><div style="font-size:13px;font-weight:500">\${c.name}</div><div style="font-size:10px;color:var(--text3)">\${c.barcode}\${c.part_number?' · '+c.part_number:''}</div></div>\`).join('') || '<div style="font-size:12px;color:var(--text3)">No match in catalog</div>'
  }, 250)
}

// ── NOTIFICATIONS ─────────────────────────
async function loadNotifs() {
  try {
    const { data } = await sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(30)
    const el = document.getElementById('notif-list')
    if (!el) return
    const notifs = data||[]
    el.innerHTML = notifs.length ? notifs.map(n =>
      \`<div style="padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:9px;align-items:flex-start;\${n.read?'opacity:.55':''}">
        <div style="font-size:18px;flex-shrink:0">\${n.type==='alert'?'⚠':n.type==='checkin'?'📍':'🔔'}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:\${n.read?400:600}">\${n.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">\${n.message||''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">\${fmtDate(n.created_at)}</div></div>
      </div>\`).join('') : '<div class="empty">No notifications</div>'
    // Mark all as read
    if (notifs.filter(n=>!n.read).length) await sb.from('notifications').update({read:true}).eq('read',false)
  } catch(e) { console.error('notifs:', e) }
}
async function loadSafetyBadge(){
  if(!MY?.id) return
  try{
    const[{data:assigns},{data:acks}]=await Promise.all([
      sb.from('safety_assignments').select('topic_id').eq('profile_id',MY.id),
      sb.from('safety_acks').select('topic_id').eq('profile_id',MY.id)
    ])
    const ackedIds=new Set((acks||[]).map(a=>a.topic_id))
    const pending=(assigns||[]).filter(a=>!ackedIds.has(a.topic_id)).length
    const badge=document.getElementById('safety-badge')
    if(badge){badge.style.display=pending?'block':'none';badge.textContent=pending}
  }catch(e){}
}
async function loadNotifBadge() {
  try {
    const { count } = await sb.from('notifications').select('id',{count:'exact',head:true}).eq('read',false)
    const el = document.getElementById('notif-badge')
    if (el) { el.textContent = count||0; el.style.display = (count||0)>0 ? 'flex' : 'none' }
  } catch(e) {}
}

// ── PROFILE / SETTINGS ────────────────────
async function changePassword() {
  const cur = document.getElementById('cp-cur').value
  const nw = document.getElementById('cp-new').value
  if (!cur || !nw) { toast('Both fields required', 'warn'); return }
  if (nw.length < 6) { toast('Min 6 characters', 'warn'); return }
  try {
    const { data: { session } } = await sb.auth.getSession()
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
      body: JSON.stringify({ current: cur, newpw: nw })
    })
    const d = await res.json()
    if (!res.ok) { toast(d.error, 'error'); return }
    toast('Password updated ✓', 'success')
    document.getElementById('cp-cur').value = ''; document.getElementById('cp-new').value = ''
  } catch(e) { toast(e.message, 'error') }
}

function confirmSignOut() {
  if (confirm('Sign out?')) signOut(sb)
}

// ── TOAST ─────────────────────────────────
function toast(msg, type = 'success') {
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)', warn: 'var(--amber)' }
  const icons = { success: '✓', error: '✗', info: 'ℹ', warn: '⚠' }
  const wrap = document.getElementById('toast-wrap')
  const el = document.createElement('div')
  el.className = 'toast-el'
  el.innerHTML = \`<span style="color:\${colors[type]}">\${icons[type]}</span>\${msg}\`
  wrap.appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s' }, 2800)
  setTimeout(() => el.remove(), 3100)
}
</script>
</body>
</html>
`
const HTML_FAXJS  = `// FieldAxisHQ — Shared Utilities
const SUPABASE_URL = 'https://htkvgfmbcoozmkiairvt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_1U37N6iZ8Is4mF_aR9kThg_DS7wExWO'
function getSb() { return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) }
async function requireAuth(sb) { const{data:{session}}=await sb.auth.getSession(); if(!session){window.location.href='index.html';return null} return session }
function signOut(sb) { sb.auth.signOut(); window.location.href='index.html' }
function toast(msg,type='success'){const colors={success:'#16a34a',error:'#dc2626',info:'#2563eb',warn:'#d97706'};const icons={success:'✓',error:'✗',info:'ℹ',warn:'⚠'};const t=document.createElement('div');t.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9999;background:#0c1220;border-radius:99px;padding:10px 20px;border-left:3px solid '+colors[type]+';box-shadow:0 6px 24px rgba(0,0,0,.8);display:flex;align-items:center;gap:8px;font-family:DM Sans,sans-serif;font-size:13px;color:#e8edf5;white-space:nowrap;pointer-events:none';t.innerHTML='<span style="color:'+colors[type]+'">'+icons[type]+'</span>'+msg;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s'},3000);setTimeout(()=>t.remove(),3300)}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}}
function fmtTime(d){if(!d)return'—';try{return new Date(d).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}catch{return d}}
function fmtDateTime(d){return fmtDate(d)+' '+fmtTime(d)}
function fmtHours(h){if(!h)return'0h';const hr=Math.floor(h),m=Math.round((h-hr)*60);return m>0?hr+'h '+m+'m':hr+'h'}
function fmtCurrency(n,dec=0){if(n==null)return'—';return'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec})}
function fmtPct(n){return n!=null?n.toFixed(1)+'%':'—'}
function isOverdue(due,status){return due&&!['complete','cancelled'].includes(status)&&new Date(due)<new Date()}
const AV_COLORS=[['#1a2e50','#60a5fa'],['#0f2a1f','#4ade80'],['#2d1a08','#fb923c'],['#1e1040','#a78bfa'],['#0a2535','#38bdf8'],['#2e0f0f','#f87171'],['#0f2820','#6ee7b7'],['#28240a','#fcd34d']]
function avStyle(name){const i=(name||'').charCodeAt(0)%AV_COLORS.length;const[bg,c]=AV_COLORS[i];return'background:'+bg+';color:'+c}
function initials(n){return(n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
function dlCSV(content,filename){const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(content);a.download=filename;a.click()}
function toCSV(rows){return rows.map(r=>r.map(c=>'"'+(String(c||'').replace(/"/g,'""'))+'"').join(',')).join('\\n')}
async function geocodeAddr(addr){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(addr)+'&format=json&limit=1&countrycodes=us',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();if(!j.length)return null;return{lat:parseFloat(j[0].lat),lng:parseFloat(j[0].lon)}}catch{return null}}
async function addrSuggest(q){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)+'&format=json&limit=5&countrycodes=us',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();return j.map(x=>({label:x.display_name,lat:parseFloat(x.lat),lng:parseFloat(x.lon)}))}catch{return[]}}
`
// ────────────────────────────────────────────────────────────────────
const SB_ANON      = process.env.SUPABASE_KEY || '';
const SB_SERVICE   = process.env.SUPABASE_SERVICE_KEY || '';
const CL_CLOUD     = process.env.CLOUDINARY_CLOUD || '';
const CL_KEY       = process.env.CLOUDINARY_KEY || '';
const CL_SECRET    = process.env.CLOUDINARY_SECRET || '';
const CL_PRESET    = process.env.CLOUDINARY_PRESET || '';

// ── SUPABASE ──────────────────────────────────────────────────────────────────
function sbReq(method, table, body, params, svc) {
  return new Promise((resolve, reject) => {
    if (!SB_URL) return reject(new Error('SUPABASE_URL not set'));
    const key = (svc && SB_SERVICE) ? SB_SERVICE : SB_ANON;
    let qs = '';
    if (params) qs = '?' + Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
    const u = new URL(SB_URL + '/rest/v1/' + table + qs);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { const p = d ? JSON.parse(d) : null; if (res.statusCode >= 400) reject(new Error(p?.message || p?.error || 'DB error ' + res.statusCode)); else resolve(p); }
        catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function sbFetch(method, endpoint, body, key) {
  const k = key || SB_ANON;
  const opts = {
    method,
    headers: {
      'apikey': k,
      'Authorization': 'Bearer ' + k,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  return new Promise((resolve) => {
    const urlObj = new URL(SB_URL + endpoint);
    const reqFn = urlObj.protocol === 'https:' ? https.request : http.request;
    const req = reqFn({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method, headers: opts.headers }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
async function dbGet(t, p)     { return await sbReq('GET',    t, null,  p)    || []; }
async function dbInsert(t, b)  { return await sbReq('POST',   t, b,     null,  true); }
async function dbUpdate(t, b, p){ return await sbReq('PATCH', t, b,     p,     true); }
async function dbDelete(t, p)  { return await sbReq('DELETE', t, null,  p,     true); }
async function dbUpsert(t, b) {
  if (!SB_URL) return null;
  const key = SB_SERVICE || SB_ANON;
  const u = new URL(SB_URL);
  const opts = { hostname: u.hostname, path: '/rest/v1/' + t, method: 'POST',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }};
  return new Promise((res, rej) => {
    const req = https.request(opts, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(d ? JSON.parse(d) : null); } catch(e) { res(d); }}); });
    req.on('error', rej); req.write(JSON.stringify(b)); req.end();
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function nowISO()     { return new Date().toISOString(); }
function nowDisplay() { return new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }
function uid()        { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)}); }
function cloudinarySign(params) { return crypto.createHash('sha1').update(Object.keys(params).sort().map(k => k + '=' + params[k]).join('&') + CL_SECRET).digest('hex'); }

async function auditLog(type, jobId, partId, partName, username, extra) {
  try { await dbInsert('audit_log', { id: uid(), type, job_id: jobId, part_id: partId, part_name: partName, username, extra: extra || '', created_at: nowISO() }); } catch(e) {}
}
async function addNotif(type, title, message, meta) {
  try { await dbInsert('notifications', { id: uid(), type, title, message, meta: JSON.stringify(meta || {}), read: false, created_at: nowISO() }); } catch(e) {}
}
async function autoAddToManifest(jobId, partId, partName, qty, stagedBy) {
  try {
    const ex = await dbGet('job_manifest', { job_id: 'eq.' + jobId, part_id: 'eq.' + partId, select: 'id' });
    if (!ex[0]) await dbInsert('job_manifest', { id: uid(), job_id: jobId, part_id: partId, part_name: partName, expected_qty: qty, notes: '', added_by: stagedBy, added_at: nowDisplay() });
  } catch(e) {}
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function hashPwd(p)   { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.pbkdf2Sync(p, s, 100000, 64, 'sha512').toString('hex'); }
function verifyPwd(p, stored) { const [s, h] = stored.split(':'); return crypto.pbkdf2Sync(p, s, 100000, 64, 'sha512').toString('hex') === h; }
// Token cache: avoid hitting Supabase auth on every single request
const _tokenCache = new Map();
async function getUser(req) {
  const t = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!t) return null;
  // Check cache (tokens valid 5 min in cache)
  const cached = _tokenCache.get(t);
  if (cached && cached.exp > Date.now()) return cached.user;
  try {
    // Decode Supabase JWT payload (middle part) without verifying sig
    // Supabase JWTs are signed with the project secret - we trust them if they parse correctly
    const parts = t.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const userId = payload.sub;
    if (!userId) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null; // expired
    // Load profile from DB
    const rows = await dbGet('profiles', { id: 'eq.' + userId, select: '*' });
    const profile = rows[0];
    if (!profile) return null;
    const user = { id: userId, name: profile.full_name || payload.email || '', email: payload.email || profile.email || '', role: profile.role || 'sub_worker', company_id: profile.company_id || null, is_active: profile.is_active !== false };
    _tokenCache.set(t, { user, exp: Date.now() + 5 * 60 * 1000 });
    return user;
  } catch(e) { return null; }
}
function safeUser(u) { return u; }
function requireAuth(res, u)  { if (!u) { json(res, 401, { error: 'Not authenticated' }); return false; } return true; }
function requireRole(res, u, ...roles) { if (!requireAuth(res, u)) return false; if (!roles.includes(u.role)) { json(res, 403, { error: 'Permission denied' }); return false; } return true; }

// ── HTTP ──────────────────────────────────────────────────────────────────────
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', ...CORS }); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b)); } catch(e) { r({}); }}); }); }
function serveFile(res, fp, ct) { try { const d = fs.readFileSync(fp); res.writeHead(200, { 'Content-Type': ct }); res.end(d); } catch(e) { res.writeHead(404); res.end('Not found'); } }

// ── SETUP DB ──────────────────────────────────────────────────────────────────
async function setupDB() {
  try {
    const users = await dbGet('users', { select: 'id', limit: '1' });
    if (!users || users.length === 0) {
      await dbInsert('users', { id: uid(), username: 'admin', password_hash: hashPwd('admin123'), name: 'Administrator', role: 'admin', active: true, created_at: nowISO() });
      console.log('Default admin created: username=admin  password=admin123  ← CHANGE THIS');
    }
  } catch(e) { console.log('DB setup note:', e.message); }
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;
  const method = req.method;

  if (method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  // Static files — embedded in server (always current), filesystem fallback
  if (method === 'GET' && !p.startsWith('/api/')) {
    const h = {'Content-Type': 'text/html', ...CORS}
    const j = {'Content-Type': 'application/javascript', ...CORS}
    if (p === '/' || p === '/index.html')   { res.writeHead(200, h); return res.end(HTML_INDEX) }
    if (p === '/admin.html')                { res.writeHead(200, h); return res.end(HTML_ADMIN) }
    if (p === '/worker.html')               { res.writeHead(200, h); return res.end(HTML_WORKER) }
    if (p === '/fax-shared.js')             { res.writeHead(200, j); return res.end(HTML_FAXJS) }
    // Filesystem fallback for other assets
    const cleanPath = p.replace(/^\//, '')
    const ctMap = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.svg':'image/svg+xml'}
    const ct = ctMap[path.extname(cleanPath)] || 'text/html'
    const attempts = [
      path.join(__dirname, 'public', cleanPath),
      path.join(__dirname, cleanPath),
      path.join('/opt/render/project/src/public', cleanPath),
      path.join('/opt/render/project/src', cleanPath)
    ]
    for (const fp of attempts) {
      try { const d = fs.readFileSync(fp); res.writeHead(200, {'Content-Type': ct, ...CORS}); return res.end(d) } catch(e) {}
    }
    res.writeHead(200, h); return res.end(HTML_INDEX)
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (p === '/api/login' && method === 'POST') {
    const { username, password } = await readBody(req);
    try {
      const rows = await dbGet('users', { username: 'eq.' + username, active: 'eq.true', select: '*' });
      const user = rows[0];
      if (!user || !verifyPwd(password, user.password_hash)) return json(res, 401, { error: 'Invalid username or password' });
      return json(res, 200, { token: makeToken(user.id), user: safeUser(user) });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/me' && method === 'GET') {
    const u = await getUser(req); if (!u) return json(res, 401, { error: 'Not authenticated' });
    return json(res, 200, safeUser(u));
  }
  if (p === '/api/change-password' && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { current, newpw } = await readBody(req);
    if (!verifyPwd(current, u.password_hash)) return json(res, 400, { error: 'Current password wrong' });
    if (!newpw || newpw.length < 6) return json(res, 400, { error: 'New password must be 6+ chars' });
    await dbUpdate('users', { password_hash: hashPwd(newpw) }, { id: 'eq.' + u.id });
    return json(res, 200, { ok: true });
  }

  // ── CLOUDINARY UPLOAD SIGN ─────────────────────────────────────────────────
  if (p === '/api/upload-sign' && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    if (!CL_CLOUD || !CL_KEY || !CL_SECRET) return json(res, 500, { error: 'Cloudinary not configured. Set CLOUDINARY_CLOUD, CLOUDINARY_KEY, CLOUDINARY_SECRET env vars.' });
    const { folder } = await readBody(req);
    const timestamp = Math.round(Date.now() / 1000);
    // Only include upload_preset in signature if one is set (unsigned preset flow)
    const params = { folder: folder || 'fieldaxishq', timestamp };
    if (CL_PRESET) params.upload_preset = CL_PRESET;
    return json(res, 200, { signature: cloudinarySign(params), timestamp, api_key: CL_KEY, cloud_name: CL_CLOUD, upload_preset: CL_PRESET || null, folder: folder || 'fieldaxishq' });
  }

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (p === '/api/users' && method === 'GET') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin')) return;
    try { return json(res, 200, (await dbGet('users', { select: '*', order: 'created_at.asc' })).map(safeUser)); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/users' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin')) return;
    const { username, password, name, role, company_id, phone, email, is_lead, avatar_url } = await readBody(req);
    if (!username || !password || !name || !role) return json(res, 400, { error: 'username, password, name, role required' });
    const validRoles = ['admin', 'pm', 'foreman', 'stager', 'signout', 'requestor', 'technician', 'sub_lead', 'sub_worker'];
    if (!validRoles.includes(role)) return json(res, 400, { error: 'Invalid role' });
    try {
      const rows = await dbInsert('users', { id: uid(), username, password_hash: hashPwd(password), name, role, company_id: company_id || null, phone: phone || '', email: email || '', is_lead: !!is_lead, avatar_url: avatar_url || null, active: true, created_at: nowISO() });
      return json(res, 201, safeUser(rows[0]));
    } catch(e) { return json(res, 400, { error: e.message.includes('unique') ? 'Username already taken' : e.message }); }
  }
  const uM = p.match(/^\/api\/users\/([^/]+)$/);
  if (uM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin')) return;
    const b = await readBody(req); const upd = {};
    ['name','role','active','phone','email','is_lead','company_id','avatar_url'].forEach(k => { if (b[k] !== undefined) upd[k] = b[k]; });
    if (b.password && b.password.length >= 6) upd.password_hash = hashPwd(b.password);
    try { return json(res, 200, safeUser((await dbUpdate('users', upd, { id: 'eq.' + uM[1] }))[0])); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (uM && method === 'DELETE') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin')) return;
    if (uM[1] === u.id) return json(res, 400, { error: "Can't delete yourself" });
    try { await dbDelete('users', { id: 'eq.' + uM[1] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── COMPANIES ─────────────────────────────────────────────────────────────
  if (p === '/api/companies' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('companies', { is_active: 'eq.true', select: '*', order: 'name.asc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/companies' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm')) return;
    const b = await readBody(req);
    if (!b.name) return json(res, 400, { error: 'name required' });
    try { return json(res, 201, (await dbInsert('companies', { id: uid(), ...b, is_active: true, created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const coM = p.match(/^\/api\/companies\/([^/]+)$/);
  if (coM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm')) return;
    try { return json(res, 200, (await dbUpdate('companies', await readBody(req), { id: 'eq.' + coM[1] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── JOBS ─────────────────────────────────────────────────────────────────
  if (p === '/api/jobs' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const showArch = parsed.query.archived === 'true';
      const params = { select: '*', order: 'created_at.desc' };
      if (!showArch) params['archived'] = 'eq.false';
      // Subs: filter to assigned jobs only
      if (['sub_lead','sub_worker'].includes(u.role)) {
        const assignments = await dbGet('job_workers', { worker_id: 'eq.' + u.id, is_active: 'eq.true', select: 'job_id' });
        const jobIds = assignments.map(a => a.job_id);
        if (!jobIds.length) return json(res, 200, []);
        params['id'] = 'in.(' + jobIds.join(',') + ')';
      }
      return json(res, 200, await dbGet('jobs', params));
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/jobs' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const b = await readBody(req);
    if (!b.name) return json(res, 400, { error: 'Job name required' });
    try {
      const job = {
        id: uid(), name: b.name, description: b.description || '', address: b.address || '',
        gps_lat: b.gps_lat || null, gps_lng: b.gps_lng || null, gps_radius_ft: b.gps_radius_ft || 750,
        gc_company: b.gc_company || '', gc_contact: b.gc_contact || '', gc_phone: b.gc_phone || '', gc_email: b.gc_email || '',
        super_name: b.super_name || '', super_phone: b.super_phone || '', super_email: b.super_email || '',
        scope: b.scope || '', notes: b.notes || '', install_notes: b.install_notes || '',
        job_walk_by: b.job_walk_by || '', job_walk_date: b.job_walk_date || null, job_walk_notes: b.job_walk_notes || '',
        phase: 'not_started', pct_complete: 0, archived: false,
        company_id: b.company_id || null, pm_review_required: b.pm_review_required !== false, pm_review_type: b.pm_review_type || 'final_only',
        budget: b.budget || null, contract_value: b.contract_value || null, labor_budget: b.labor_budget || null, material_budget: b.material_budget || null, labor_rate: b.labor_rate || null,
        site_contact_name: b.site_contact_name || '', site_contact_phone: b.site_contact_phone || '',
        date_contract: b.date_contract || null, date_permit: b.date_permit || null, date_start: b.date_start || null, due_date: b.due_date || null,
        date_roughin: b.date_roughin || null, date_trimout: b.date_trimout || null, date_inspection: b.date_inspection || null,
        date_next_visit: b.date_next_visit || null, date_closeout: b.date_closeout || null, date_co: b.date_co || null,
        completion_date: b.completion_date || null,
        created_by: u.name, created_at: nowISO(), updated_at: nowISO()
      };
      const rows = await dbInsert('jobs', job);
      await auditLog('job_created', job.id, null, job.name, u.name, '');
      return json(res, 201, rows[0]);
    } catch(e) { return json(res, 400, { error: e.message }); }
  }
  // Job CSV import
  if (p === '/api/jobs/import' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const { jobs: jobList } = await readBody(req);
    if (!Array.isArray(jobList)) return json(res, 400, { error: 'jobs array required' });
    const results = { created: [], skipped: [], errors: [] };
    for (const b of jobList) {
      if (!b.name) { results.errors.push('Missing name'); continue; }
      try {
        await dbInsert('jobs', { id: uid(), name: b.name, description: b.description || '', address: b.address || '', phase: 'not_started', pct_complete: 0, archived: false, created_by: u.name, created_at: nowISO(), updated_at: nowISO(), due_date: b.due_date || null, date_start: b.date_start || null });
        results.created.push(b.name);
      } catch(e) { results.errors.push(b.name + ': ' + e.message); }
    }
    return json(res, 200, results);
  }
  const jM = p.match(/^\/api\/jobs\/([^/]+)$/);
  if (jM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const rows = await dbGet('jobs', { id: 'eq.' + jM[1], select: '*' });
      if (!rows[0]) return json(res, 404, { error: 'Not found' });
      return json(res, 200, rows[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (jM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager', 'technician')) return;
    const b = await readBody(req);
    const allowed = ['name','description','address','gps_lat','gps_lng','gps_radius_ft','gc_company','gc_contact','gc_phone','gc_email','super_name','super_phone','super_email','scope','notes','install_notes','job_walk_by','job_walk_date','job_walk_notes','phase','pct_complete','archived','budget','contract_value','labor_budget','material_budget','labor_rate','site_contact_name','site_contact_phone','company_id','pm_review_required','pm_review_type','date_contract','date_permit','date_start','due_date','date_roughin','date_trimout','date_inspection','date_next_visit','date_closeout','date_co','completion_date','project_manager','pm_visit_schedule','next_pm_visit','expected_onsite_date','next_visit_date'];
    const upd = { updated_at: nowISO() };
    allowed.forEach(k => { if (b[k] !== undefined) upd[k] = b[k]; });
    try {
      await auditLog('job_updated', jM[1], null, null, u.name, JSON.stringify(upd).slice(0, 200));
      return json(res, 200, (await dbUpdate('jobs', upd, { id: 'eq.' + jM[1] }))[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── JOB WORKERS (sub assignment) ──────────────────────────────────────────
  const jwM = p.match(/^\/api\/jobs\/([^/]+)\/workers$/);
  if (jwM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_workers', { job_id: 'eq.' + jwM[1], is_active: 'eq.true', select: '*' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (jwM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    const { worker_id } = await readBody(req);
    try { return json(res, 201, (await dbUpsert('job_workers', { id: uid(), job_id: jwM[1], worker_id, is_active: true, added_by: u.name, added_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const jwIM = p.match(/^\/api\/jobs\/([^/]+)\/workers\/([^/]+)$/);
  if (jwIM && method === 'DELETE') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    try { await dbUpdate('job_workers', { is_active: false }, { job_id: 'eq.' + jwIM[1], worker_id: 'eq.' + jwIM[2] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── CHECK-INS (GPS) ───────────────────────────────────────────────────────
  if (p === '/api/checkins' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const today = parsed.query.today ? new Date().toISOString().split('T')[0] : null;
    try {
      const params = { select: '*', order: 'checkin_at.desc' };
      if (today) params['checkin_at'] = 'gte.' + today + 'T00:00:00';
      if (parsed.query.job_id) params['job_id'] = 'eq.' + parsed.query.job_id;
      if (['sub_lead','sub_worker'].includes(u.role)) params['worker_id'] = 'eq.' + u.id;
      return json(res, 200, await dbGet('checkins', params));
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/checkins' && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { job_id, checkin_lat, checkin_lng, action } = await readBody(req);
    try {
      if (action === 'checkout') {
        const recs = await dbGet('checkins', { job_id: 'eq.' + job_id, worker_id: 'eq.' + u.id, select: '*' });
        const active = recs.find(r => !r.checkout_at);
        if (!active) return json(res, 400, { error: 'Not checked in' });
        const hrs = Math.round((Date.now() - new Date(active.checkin_at)) / 36000) / 100;
        await dbUpdate('checkins', { checkout_at: nowISO(), checkout_lat: checkin_lat, checkout_lng: checkin_lng, hours_logged: hrs, status: 'checked_out' }, { id: 'eq.' + active.id });
        await auditLog('checkout', job_id, null, null, u.name, hrs + 'h');
        return json(res, 200, { ok: true, hours: hrs });
      }
      // Check-in: validate GPS distance
      const job = (await dbGet('jobs', { id: 'eq.' + job_id, select: 'gps_lat,gps_lng,gps_radius_ft' }))[0];
      let dist = null;
      if (job?.gps_lat && checkin_lat) {
        const R = 20902231;
        const dLat = (job.gps_lat - checkin_lat) * Math.PI / 180;
        const dLng = (job.gps_lng - checkin_lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(checkin_lat*Math.PI/180)*Math.cos(job.gps_lat*Math.PI/180)*Math.sin(dLng/2)**2;
        dist = Math.round(R * 2 * Math.asin(Math.sqrt(a)));
        const radius = job.gps_radius_ft || 750;
        if (dist > radius) {
          await auditLog('gps_blocked', job_id, null, null, u.name, dist + 'ft from site');
          return json(res, 400, { error: 'Too far from site (' + dist + 'ft). Must be within ' + radius + 'ft.', dist_ft: dist, blocked: true });
        }
      }
      const existing = await dbGet('checkins', { job_id: 'eq.' + job_id, worker_id: 'eq.' + u.id, select: 'id' });
      const alreadyIn = (existing || []).find(r => !r.checkout_at);
      if (alreadyIn) return json(res, 400, { error: 'Already checked in' });
      const rec = await dbInsert('checkins', { id: uid(), job_id, worker_id: u.id, company_id: u.company_id || null, checkin_lat, checkin_lng, checkin_dist_ft: dist, status: 'checked_in', checkin_at: nowISO() });
      await auditLog('checkin', job_id, null, null, u.name, (dist || '?') + 'ft');
      return json(res, 201, rec[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── JOB PARTS (warehouse staging) ─────────────────────────────────────────
  const jpM = p.match(/^\/api\/jobs\/([^/]+)\/parts$/);
  if (jpM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_parts', { job_id: 'eq.' + jpM[1], select: '*', order: 'created_at.asc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (jpM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const { part_id, part_name, qty, action } = await readBody(req);
    if (!part_id) return json(res, 400, { error: 'part_id required' });
    const jobId = jpM[1];
    try {
      const existing = await dbGet('job_parts', { job_id: 'eq.' + jobId, part_id: 'eq.' + part_id, select: '*' });
      let row;
      if (existing[0]) {
        const cur = existing[0];
        const aq = (cur.assigned_qty || 0) + (qty || 1);
        const over = action === 'out' && aq > (cur.assigned_qty || 0);
        row = (await dbUpdate('job_parts', { assigned_qty: aq, over, status: action === 'out' ? 'signed_out' : 'staged', updated_at: nowISO(), ...(action==='out'?{taken_qty:(cur.taken_qty||0)+(qty||1),signed_out_by:u.name,signed_out_at:nowDisplay()}:{staged_by:u.name,staged_at:nowDisplay()}) }, { id: 'eq.' + cur.id }))[0];
      } else {
        row = (await dbInsert('job_parts', { id: uid(), job_id: jobId, part_id, part_name: part_name || part_id, status: action === 'out' ? 'signed_out' : 'staged', assigned_qty: qty || 1, taken_qty: action === 'out' ? qty || 1 : 0, installed_qty: 0, over: false, staged_by: u.name, staged_at: nowDisplay(), ...(action==='out'?{signed_out_by:u.name,signed_out_at:nowDisplay()}:{}), created_at: nowISO() }))[0];
        await autoAddToManifest(jobId, part_id, part_name || part_id, qty || 1, u.name);
      }
      // Deduct from inventory
      const inv = await dbGet('inventory', { id: 'eq.' + part_id, select: 'qty,min_qty,name' });
      if (inv[0]) {
        const newQty = Math.max(0, (inv[0].qty || 0) - (qty || 1));
        await dbUpdate('inventory', { qty: newQty, updated_at: nowISO() }, { id: 'eq.' + part_id });
        if (inv[0].min_qty > 0 && newQty <= inv[0].min_qty) await addNotif('low_stock', 'Low stock: ' + inv[0].name, inv[0].name + ' is at ' + newQty + ' (min: ' + inv[0].min_qty + ')', { part_id });
      }
      await auditLog(action === 'out' ? 'signed_out' : 'staged', jobId, part_id, part_name, u.name, 'qty:' + (qty || 1));
      return json(res, 201, row);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const jpIM = p.match(/^\/api\/jobs\/([^/]+)\/parts\/([^/]+)$/);
  if (jpIM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager', 'signout', 'technician')) return;
    const b = await readBody(req);
    try {
      const upd = { ...b, updated_at: nowISO() };
      if (b.status === 'installed' || b.status === 'partial_install') { upd.installed_by = u.name; upd.installed_at = nowDisplay(); }
      return json(res, 200, (await dbUpdate('job_parts', upd, { id: 'eq.' + jpIM[2] }))[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── JOB MANIFEST ──────────────────────────────────────────────────────────
  const mfM = p.match(/^\/api\/jobs\/([^/]+)\/manifest$/);
  if (mfM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_manifest', { job_id: 'eq.' + mfM[1], select: '*' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (mfM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const b = await readBody(req);
    try { return json(res, 201, (await dbInsert('job_manifest', { id: uid(), job_id: mfM[1], ...b, added_by: u.name, added_at: nowDisplay() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const mfIM = p.match(/^\/api\/jobs\/([^/]+)\/manifest\/([^/]+)$/);
  if (mfIM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    try { return json(res, 200, (await dbUpdate('job_manifest', await readBody(req), { id: 'eq.' + mfIM[2] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (mfIM && method === 'DELETE') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    try { await dbDelete('job_manifest', { id: 'eq.' + mfIM[2] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────
  const attM = p.match(/^\/api\/jobs\/([^/]+)\/attendance$/);
  if (attM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_attendance', { job_id: 'eq.' + attM[1], select: '*', order: 'sign_in_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (attM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { action } = await readBody(req);
    try {
      if (action === 'signin') {
        const existing = await dbGet('job_attendance', { job_id: 'eq.' + attM[1], user_id: 'eq.' + u.id, sign_out_at: 'is.null', select: 'id' });
        if (existing[0]) return json(res, 400, { error: 'Already signed in to this job' });
        return json(res, 201, (await dbInsert('job_attendance', { id: uid(), job_id: attM[1], user_id: u.id, user_name: u.name, user_role: u.role, sign_in_at: nowISO(), created_at: nowISO() }))[0]);
      } else if (action === 'signout') {
        const recs = await dbGet('job_attendance', { job_id: 'eq.' + attM[1], user_id: 'eq.' + u.id, sign_out_at: 'is.null', select: '*', order: 'sign_in_at.desc' });
        if (!recs[0]) return json(res, 400, { error: 'Not signed in to this job' });
        const hrs = Math.round((Date.now() - new Date(recs[0].sign_in_at)) / 36000) / 100;
        await dbUpdate('job_attendance', { sign_out_at: nowISO(), hours: hrs }, { id: 'eq.' + recs[0].id });
        return json(res, 200, { ok: true, hours: hrs });
      }
      return json(res, 400, { error: 'action must be signin or signout' });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/attendance/status' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_attendance', { user_id: 'eq.' + u.id, sign_out_at: 'is.null', select: '*' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/attendance/report' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const all = await dbGet('job_attendance', { select: '*', order: 'sign_in_at.desc' });
      const byTech = {}, byJob = {};
      all.forEach(r => {
        const hrs = r.hours || 0;
        if (!byTech[r.user_name]) byTech[r.user_name] = { name: r.user_name, role: r.user_role, total_hours: 0, jobs: {} };
        byTech[r.user_name].total_hours = Math.round((byTech[r.user_name].total_hours + hrs) * 100) / 100;
        if (!byTech[r.user_name].jobs[r.job_id]) byTech[r.user_name].jobs[r.job_id] = 0;
        byTech[r.user_name].jobs[r.job_id] += hrs;
        if (!byJob[r.job_id]) byJob[r.job_id] = { job_id: r.job_id, total_hours: 0, techs: {} };
        byJob[r.job_id].total_hours = Math.round((byJob[r.job_id].total_hours + hrs) * 100) / 100;
        byJob[r.job_id].techs[r.user_name] = (byJob[r.job_id].techs[r.user_name] || 0) + hrs;
      });
      return json(res, 200, { by_tech: Object.values(byTech), by_job: Object.values(byJob), raw: all });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── PHOTOS ─────────────────────────────────────────────────────────────────
  const phM = p.match(/^\/api\/jobs\/([^/]+)\/photos$/);
  if (phM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_photos', { job_id: 'eq.' + phM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (phM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { url: photoUrl, public_id, caption, type, photo_lat, photo_lng, dist_from_site_ft } = await readBody(req);
    if (!photoUrl) return json(res, 400, { error: 'url required' });
    try {
      const r = (await dbInsert('job_photos', { id: uid(), job_id: phM[1], url: photoUrl, public_id: public_id || '', caption: caption || '', type: type || 'photo', photo_lat: photo_lat || null, photo_lng: photo_lng || null, dist_from_site_ft: dist_from_site_ft || null, uploaded_by: u.name, created_at: nowISO() }))[0];
      await auditLog('photo_uploaded', phM[1], null, null, u.name, caption || '');
      return json(res, 201, r);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const phIM = p.match(/^\/api\/jobs\/([^/]+)\/photos\/([^/]+)$/);
  if (phIM && method === 'DELETE') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { await dbDelete('job_photos', { id: 'eq.' + phIM[2] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── PLANS ──────────────────────────────────────────────────────────────────
  const plM = p.match(/^\/api\/jobs\/([^/]+)\/plans$/);
  if (plM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_plans', { job_id: 'eq.' + plM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (plM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { url: planUrl, public_id, name, thumb_url, plan_type } = await readBody(req);
    if (!planUrl) return json(res, 400, { error: 'url required' });
    try { return json(res, 201, (await dbInsert('job_plans', { id: uid(), job_id: plM[1], name: name || 'Plan', url: planUrl, public_id: public_id || '', thumb_url: thumb_url || '', plan_type: plan_type || 'plans', notes: '', uploaded_by: u.name, created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const plIM = p.match(/^\/api\/jobs\/([^/]+)\/plans\/([^/]+)$/);
  if (plIM && method === 'PUT') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, (await dbUpdate('job_plans', await readBody(req), { id: 'eq.' + plIM[2] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (plIM && method === 'DELETE') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { await dbDelete('job_plans', { id: 'eq.' + plIM[2] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── CHECKLISTS ─────────────────────────────────────────────────────────────
  const chM = p.match(/^\/api\/jobs\/([^/]+)\/checklist$/);
  if (chM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('job_checklist_items', { job_id: 'eq.' + chM[1], select: '*', order: 'sort_order.asc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (chM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const b = await readBody(req);
    try { return json(res, 201, (await dbInsert('job_checklist_items', { id: uid(), job_id: chM[1], ...b, created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const chIM = p.match(/^\/api\/jobs\/([^/]+)\/checklist\/([^/]+)$/);
  if (chIM && method === 'PUT') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const b = await readBody(req);
    if (b.is_checked !== undefined) { b.checked_by = b.is_checked ? u.name : null; b.checked_at = b.is_checked ? nowISO() : null; }
    try { return json(res, 200, (await dbUpdate('job_checklist_items', b, { id: 'eq.' + chIM[2] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (chIM && method === 'DELETE') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { await dbDelete('job_checklist_items', { id: 'eq.' + chIM[2] }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── PM INSPECTIONS ─────────────────────────────────────────────────────────
  const insM = p.match(/^\/api\/jobs\/([^/]+)\/inspections$/);
  if (insM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('pm_inspections', { job_id: 'eq.' + insM[1], select: '*', order: 'visited_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (insM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    const b = await readBody(req);
    try {
      const r = (await dbInsert('pm_inspections', { id: uid(), job_id: insM[1], pm_id: u.id, pm_name: u.name, ...b, visited_at: nowISO(), created_at: nowISO() }))[0];
      await auditLog('pm_inspection_created', insM[1], null, null, u.name, b.visit_type || '');
      return json(res, 201, r);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const insIM = p.match(/^\/api\/jobs\/([^/]+)\/inspections\/([^/]+)\/(approve|reject)$/);
  if (insIM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    const { reason } = await readBody(req);
    const isApprove = insIM[3] === 'approve';
    try {
      await dbUpdate('pm_inspections', isApprove ? { approved_at: nowISO() } : { rejected_at: nowISO(), rejection_reason: reason || '' }, { id: 'eq.' + insIM[2] });
      if (isApprove) await dbUpdate('jobs', { status: 'complete', completion_date: nowISO().split('T')[0], phase: 'closeout', pct_complete: 100, updated_at: nowISO() }, { id: 'eq.' + insIM[1] });
      await auditLog('pm_signoff', insIM[1], null, null, u.name, insIM[3]);
      return json(res, 200, { ok: true });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── CHANGE ORDERS ─────────────────────────────────────────────────────────
  const coIM = p.match(/^\/api\/jobs\/([^/]+)\/change-orders$/);
  if (coIM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('change_orders', { job_id: 'eq.' + coIM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (coIM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    const b = await readBody(req);
    const { count } = await dbGet('change_orders', { job_id: 'eq.' + coIM[1], select: 'id' }).then(r => ({ count: r.length }));
    try { return json(res, 201, (await dbInsert('change_orders', { id: uid(), job_id: coIM[1], co_number: 'CO-' + String(count + 1).padStart(3, '0'), ...b, created_by: u.name, created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const coSignM = p.match(/^\/api\/change-orders\/([^/]+)\/sign$/);
  if (coSignM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { side } = await readBody(req);
    const upd = side === 'pm' ? { pm_signed_by: u.name, pm_signed_at: nowISO() } : { sub_signed_by: u.name, sub_signed_at: nowISO(), status: 'signed' };
    try { return json(res, 200, (await dbUpdate('change_orders', upd, { id: 'eq.' + coSignM[1] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── DAILY LOGS ─────────────────────────────────────────────────────────────
  const dlM = p.match(/^\/api\/jobs\/([^/]+)\/logs$/);
  if (dlM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('daily_logs', { job_id: 'eq.' + dlM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (dlM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { content, type } = await readBody(req);
    if (!content) return json(res, 400, { error: 'Content required' });
    try { return json(res, 201, (await dbInsert('daily_logs', { id: uid(), job_id: dlM[1], type: type || 'note', content, author: u.name, created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── GC ALERTS ──────────────────────────────────────────────────────────────
  const gcM = p.match(/^\/api\/jobs\/([^/]+)\/alerts$/);
  if (gcM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('gc_alerts', { job_id: 'eq.' + gcM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (gcM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { title, description, priority } = await readBody(req);
    if (!title) return json(res, 400, { error: 'Title required' });
    try {
      await addNotif('gc_alert', 'GC Alert: ' + title, 'Job ' + gcM[1] + ' by ' + u.name, { job_id: gcM[1] });
      return json(res, 201, (await dbInsert('gc_alerts', { id: uid(), job_id: gcM[1], title, description: description || '', priority: priority || 'normal', status: 'open', created_by: u.name, created_at: nowISO() }))[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const gcIM = p.match(/^\/api\/jobs\/([^/]+)\/alerts\/([^/]+)$/);
  if (gcIM && method === 'PUT') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, (await dbUpdate('gc_alerts', await readBody(req), { id: 'eq.' + gcIM[2] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── PART REQUESTS ──────────────────────────────────────────────────────────
  const prM = p.match(/^\/api\/jobs\/([^/]+)\/requests$/);
  if (prM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('part_requests', { job_id: 'eq.' + prM[1], select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (prM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { part_id, part_name, qty, reason } = await readBody(req);
    try {
      await addNotif('part_request', 'Part Request', u.name + ' requested ' + part_name + ' for job ' + prM[1], { job_id: prM[1] });
      return json(res, 201, (await dbInsert('part_requests', { id: uid(), job_id: prM[1], part_id: part_id || '', part_name: part_name || '', qty: qty || 1, reason: reason || '', status: 'pending', created_by: u.name, created_at: nowISO() }))[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const prIM = p.match(/^\/api\/jobs\/([^/]+)\/requests\/([^/]+)$/);
  if (prIM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const b = await readBody(req);
    if (b.status === 'approved') { b.approved_by = u.name; b.approved_at = nowDisplay(); }
    try { return json(res, 200, (await dbUpdate('part_requests', b, { id: 'eq.' + prIM[2] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── CATALOG ───────────────────────────────────────────────────────────────
  if (p === '/api/catalog' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('catalog', { select: '*', order: 'name.asc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/catalog' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const { barcode, name, part_number, category, description, alt_barcodes, unit_cost } = await readBody(req);
    if (!barcode || !name) return json(res, 400, { error: 'barcode and name required' });
    try { return json(res, 201, (await dbUpsert('catalog', { barcode, name, part_number: part_number || '', category: category || '', description: description || '', alt_barcodes: alt_barcodes || [], unit_cost: parseFloat(unit_cost) || 0 }))[0] || { barcode, name }); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/catalog/lookup' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const bc = parsed.query.barcode;
    if (!bc) return json(res, 400, { error: 'barcode required' });
    try {
      // Try primary barcode, then alt_barcodes array contains
      let rows = await dbGet('catalog', { barcode: 'eq.' + bc, select: '*' });
      if (!rows[0]) rows = await dbGet('catalog', { alt_barcodes: 'cs.{' + bc + '}', select: '*' });
      return json(res, 200, rows[0] || null);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const catM = p.match(/^\/api\/catalog\/([^/]+)$/);
  if (catM && method === 'DELETE') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin')) return;
    try { await dbDelete('catalog', { barcode: 'eq.' + decodeURIComponent(catM[1]) }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── INVENTORY ─────────────────────────────────────────────────────────────
  if (p === '/api/inventory' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('inventory', { select: '*', order: 'name.asc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/inventory' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const { id, name, description, qty, min_qty } = await readBody(req);
    if (!id) return json(res, 400, { error: 'id required' });
    try {
      const existing = await dbGet('inventory', { id: 'eq.' + id, select: 'qty,min_qty' });
      const currentQty = existing[0]?.qty || 0;
      const item = { id, name: name || id, description: description || '', qty: Math.max(0, currentQty + (qty || 0)), min_qty: min_qty || existing[0]?.min_qty || 0, updated_at: nowISO() };
      const rows = await dbUpsert('inventory', item);
      if (item.min_qty > 0 && item.qty <= item.min_qty) await addNotif('low_stock', 'Low stock: ' + name, name + ' is at ' + item.qty + ' (min: ' + item.min_qty + ')', { part_id: id });
      return json(res, 200, rows?.[0] || item);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const invM = p.match(/^\/api\/inventory\/([^/]+)$/);
  if (invM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    try { return json(res, 200, (await dbUpdate('inventory', { ...await readBody(req), updated_at: nowISO() }, { id: 'eq.' + decodeURIComponent(invM[1]) }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── ORDERS ────────────────────────────────────────────────────────────────
  if (p === '/api/orders' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const params = { select: '*', order: 'created_at.desc' };
      if (u.role === 'requestor') params['created_by'] = 'eq.' + u.name;
      return json(res, 200, await dbGet('orders', params));
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/orders' && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const { job_id, notes, items } = await readBody(req);
    if (!job_id || !items?.length) return json(res, 400, { error: 'job_id and items required' });
    try {
      const order = { id: uid(), job_id, notes: notes || '', items: JSON.stringify(items), status: 'pending', created_by: u.name, created_at: nowISO() };
      await addNotif('new_order', 'New Order', u.name + ' requested ' + items.length + ' part type(s) for job ' + job_id, { job_id });
      return json(res, 201, (await dbInsert('orders', order))[0]);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const ordM = p.match(/^\/api\/orders\/([^/]+)\/(approve|reject|stage)$/);
  if (ordM && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    const order = (await dbGet('orders', { id: 'eq.' + ordM[1], select: '*' }))[0];
    if (!order) return json(res, 404, { error: 'Not found' });
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    try {
      if (ordM[2] === 'approve') {
        await dbUpdate('orders', { status: 'approved', approved_by: u.name, approved_at: nowISO() }, { id: 'eq.' + ordM[1] });
      } else if (ordM[2] === 'reject') {
        const { note } = await readBody(req);
        await dbUpdate('orders', { status: 'rejected', rejected_by: u.name, rejected_at: nowISO(), rejection_note: note || '' }, { id: 'eq.' + ordM[1] });
      } else if (ordM[2] === 'stage') {
        for (const item of items) {
          const cat = await dbGet('catalog', { barcode: 'eq.' + item.partId, select: 'name' });
          const nm = item.name || cat[0]?.name || item.partId;
          const existing = await dbGet('job_parts', { job_id: 'eq.' + order.job_id, part_id: 'eq.' + item.partId, select: 'id' });
          if (!existing[0]) {
            await dbInsert('job_parts', { id: uid(), job_id: order.job_id, part_id: item.partId, part_name: nm, status: 'staged', assigned_qty: item.qty || 1, taken_qty: 0, installed_qty: 0, over: false, staged_by: u.name, staged_at: nowDisplay(), created_at: nowISO() });
            await autoAddToManifest(order.job_id, item.partId, nm, item.qty || 1, u.name);
            const inv = await dbGet('inventory', { id: 'eq.' + item.partId, select: 'qty' });
            if (inv[0]) await dbUpdate('inventory', { qty: Math.max(0, (inv[0].qty || 0) - (item.qty || 1)), updated_at: nowISO() }, { id: 'eq.' + item.partId });
            await auditLog('staged', order.job_id, item.partId, nm, u.name, 'order:' + ordM[1]);
          }
        }
        await dbUpdate('orders', { status: 'staged', staged_by: u.name, staged_at: nowISO() }, { id: 'eq.' + ordM[1] });
      }
      return json(res, 200, { ok: true });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── SCHEDULE ──────────────────────────────────────────────────────────────
  if (p === '/api/schedule' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const rows = await dbGet('jobs', { archived: 'eq.false', select: 'id,name,address,phase,due_date,date_start,date_roughin,date_trimout,date_inspection,date_next_visit,date_closeout,date_co,date_contract,date_permit' });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming = [];
      const dateFields = [{ key: 'date_next_visit', label: 'Next Visit' }, { key: 'due_date', label: 'Due Date' }, { key: 'date_start', label: 'On-Site Start' }, { key: 'date_roughin', label: 'Rough-in Complete' }, { key: 'date_trimout', label: 'Trim-out Complete' }, { key: 'date_inspection', label: 'Inspection' }, { key: 'date_closeout', label: 'Closeout' }];
      rows.forEach(job => {
        dateFields.forEach(df => {
          if (!job[df.key]) return;
          const d = new Date(job[df.key]); if (isNaN(d.getTime())) return;
          upcoming.push({ job_id: job.id, job_name: job.name, address: job.address || '', phase: job.phase, date_type: df.label, date: job[df.key], days_away: Math.round((d - today) / 864e5) });
        });
      });
      upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
      return json(res, 200, upcoming);
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  if (p === '/api/notifications' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('notifications', { select: '*', order: 'created_at.desc', limit: '100' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/notifications/read-all' && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { await dbUpdate('notifications', { read: true }, { read: 'eq.false' }); return json(res, 200, { ok: true }); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── FINANCIALS ────────────────────────────────────────────────────────────
  const finM = p.match(/^\/api\/jobs\/([^/]+)\/financials$/);
  if (finM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const job = (await dbGet('jobs', { id: 'eq.' + finM[1], select: '*' }))[0];
      if (!job) return json(res, 404, { error: 'Not found' });
      const parts = await dbGet('job_parts', { job_id: 'eq.' + finM[1], select: '*' });
      let materialCost = 0;
      for (const part of parts) {
        const cat = await dbGet('catalog', { barcode: 'eq.' + part.part_id, select: 'unit_cost' }).catch(() => []);
        materialCost += (parseFloat(cat[0]?.unit_cost) || 0) * (part.assigned_qty || 1);
      }
      const att = await dbGet('job_attendance', { job_id: 'eq.' + finM[1], sign_out_at: 'not.is.null', select: 'hours' }).catch(() => []);
      const checkins = await dbGet('checkins', { job_id: 'eq.' + finM[1], select: 'hours_logged' }).catch(() => []);
      const totalHours = att.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0) + checkins.reduce((s, c) => s + (parseFloat(c.hours_logged) || 0), 0);
      const laborRate = parseFloat(job.labor_rate || 0);
      const laborCost = Math.round(totalHours * laborRate * 100) / 100;
      const contractValue = parseFloat(job.contract_value || 0);
      const totalCost = Math.round((materialCost + laborCost) * 100) / 100;
      const grossProfit = Math.round((contractValue - totalCost) * 100) / 100;
      return json(res, 200, { contract_value: contractValue, labor_budget: parseFloat(job.labor_budget || 0), material_budget: parseFloat(job.material_budget || 0), labor_rate: laborRate, total_hours: Math.round(totalHours * 100) / 100, labor_cost: laborCost, material_cost: Math.round(materialCost * 100) / 100, total_cost: totalCost, gross_profit: grossProfit, profit_margin: contractValue > 0 ? Math.round(grossProfit / contractValue * 10000) / 100 : null });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (finM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    const b = await readBody(req);
    const upd = { updated_at: nowISO() };
    ['contract_value','labor_budget','material_budget','labor_rate'].forEach(k => { if (b[k] !== undefined) upd[k] = parseFloat(b[k]) || 0; });
    try { return json(res, 200, (await dbUpdate('jobs', upd, { id: 'eq.' + finM[1] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/financials/overview' && method === 'GET') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    try {
      const jobs2 = await dbGet('jobs', { archived: 'eq.false', select: 'id,name,contract_value,labor_budget,material_budget,labor_rate,phase,pct_complete' });
      const parts = await dbGet('job_parts', { select: 'job_id,part_id,assigned_qty' });
      const catRows = await dbGet('catalog', { select: 'barcode,unit_cost' });
      const catCosts = {}; catRows.forEach(c => catCosts[c.barcode] = parseFloat(c.unit_cost || 0));
      const att = await dbGet('job_attendance', { sign_out_at: 'not.is.null', select: 'job_id,hours' }).catch(() => []);
      const ciAll = await dbGet('checkins', { select: 'job_id,hours_logged' }).catch(() => []);
      const attByJob = {};
      att.forEach(a => { if (!attByJob[a.job_id]) attByJob[a.job_id] = 0; attByJob[a.job_id] += parseFloat(a.hours || 0); });
      ciAll.forEach(c => { if (!attByJob[c.job_id]) attByJob[c.job_id] = 0; attByJob[c.job_id] += parseFloat(c.hours_logged || 0); });
      const summary = jobs2.map(job => {
        const mc = parts.filter(pt => pt.job_id === job.id).reduce((s, pt) => s + (catCosts[pt.part_id] || 0) * (pt.assigned_qty || 1), 0);
        const hrs = attByJob[job.id] || 0;
        const lc = hrs * (parseFloat(job.labor_rate) || 0);
        const cv = parseFloat(job.contract_value || 0);
        const tc = mc + lc;
        return { job_id: job.id, job_name: job.name, phase: job.phase, pct_complete: job.pct_complete, contract_value: Math.round(cv * 100) / 100, material_cost: Math.round(mc * 100) / 100, labor_cost: Math.round(lc * 100) / 100, total_cost: Math.round(tc * 100) / 100, gross_profit: Math.round((cv - tc) * 100) / 100, profit_margin: cv > 0 ? Math.round((cv - tc) / cv * 10000) / 100 : null, total_hours: Math.round(hrs * 100) / 100, labor_budget: parseFloat(job.labor_budget || 0), material_budget: parseFloat(job.material_budget || 0) };
      });
      const totals = summary.reduce((a, j) => ({ contract: a.contract + j.contract_value, cost: a.cost + j.total_cost, profit: a.profit + j.gross_profit }), { contract: 0, cost: 0, profit: 0 });
      return json(res, 200, { jobs: summary, totals });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── PURCHASE ORDER ────────────────────────────────────────────────────────
  const poM = p.match(/^\/api\/jobs\/([^/]+)\/po$/);
  if (poM && method === 'GET') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman', 'stager')) return;
    try {
      const job = (await dbGet('jobs', { id: 'eq.' + poM[1], select: '*' }))[0];
      if (!job) return json(res, 404, { error: 'Not found' });
      const parts = await dbGet('job_parts', { job_id: 'eq.' + poM[1], select: '*' });
      const lineItems = [];
      for (const part of parts) {
        const cat = await dbGet('catalog', { barcode: 'eq.' + part.part_id, select: 'name,part_number,unit_cost,description' }).catch(() => []);
        const uc = parseFloat(cat[0]?.unit_cost || 0);
        lineItems.push({ part_id: part.part_id, part_number: cat[0]?.part_number || '', description: cat[0]?.description || part.part_name, name: part.part_name, qty: part.assigned_qty || 1, unit_cost: uc, line_total: Math.round(uc * (part.assigned_qty || 1) * 100) / 100, status: part.status });
      }
      return json(res, 200, { po_number: 'PO-' + poM[1].slice(-6) + '-' + Date.now().toString().slice(-5), job_id: job.id, job_name: job.name, address: job.address, gc_company: job.gc_company, generated_by: u.name, generated_at: nowDisplay(), line_items: lineItems, total: Math.round(lineItems.reduce((s, i) => s + i.line_total, 0) * 100) / 100 });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── REPORTS ───────────────────────────────────────────────────────────────
  if (p === '/api/report' && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const fj = parsed.query.job || '';
    try {
      const jobParams = { archived: 'eq.false', select: 'id,name,phase,pct_complete' };
      if (fj) jobParams['id'] = 'like.*' + fj + '*';
      const jobs = await dbGet('jobs', jobParams);
      const partParams = { select: '*' };
      if (fj) partParams['job_id'] = 'eq.' + fj;
      const parts = await dbGet('job_parts', partParams);
      const staged = [], signedOut = [], installed = [], overages = [];
      parts.forEach(pt => { if (pt.over) overages.push(pt); else if (pt.status === 'installed' || pt.status === 'partial_install') installed.push(pt); else if (pt.status === 'signed_out') signedOut.push(pt); else staged.push(pt); });
      const lowStock = (await dbGet('inventory', { select: '*' })).filter(i => i.min_qty > 0 && i.qty <= i.min_qty);
      return json(res, 200, { jobs: jobs.length, staged, signedOut, installed, overages, lowStock });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  if (p === '/api/log' && method === 'GET') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm')) return;
    try { return json(res, 200, await dbGet('audit_log', { select: '*', order: 'created_at.desc', limit: '500' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── LIEN WAIVERS ──────────────────────────────────────────────────────────
  const lwM = p.match(/^\/api\/jobs\/([^/]+)\/lien-waivers$/);
  if (lwM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try { return json(res, 200, await dbGet('lien_waivers', { job_id: 'eq.' + lwM[1], select: '*' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (lwM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    const b = await readBody(req);
    try { return json(res, 201, (await dbInsert('lien_waivers', { id: uid(), job_id: lwM[1], uploaded_by: u.name, created_at: nowISO(), ...b }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── INVOICES ──────────────────────────────────────────────────────────────
  if (p === '/api/invoices' && method === 'GET') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    try { return json(res, 200, await dbGet('invoices', { select: '*', order: 'created_at.desc' })); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  if (p === '/api/invoices' && method === 'POST') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm', 'foreman')) return;
    try { return json(res, 201, (await dbInsert('invoices', { id: uid(), ...await readBody(req), created_at: nowISO() }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }
  const invIM = p.match(/^\/api\/invoices\/([^/]+)$/);
  if (invIM && method === 'PUT') {
    const u = await getUser(req); if (!requireRole(res, u, 'admin', 'pm')) return;
    try { return json(res, 200, (await dbUpdate('invoices', await readBody(req), { id: 'eq.' + invIM[1] }))[0]); } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // ── INVITE / CREATE USER ─────────────────────────────────────
  if (p === '/api/invite-user' && method === 'POST') {
    const u = await requireAuth(req, res); if (!u) return;
    const body = await readBody(req);
    const { email, full_name, role, phone, company_id, hire_date, emergency_contact, emergency_phone } = body;
    if (!email || !full_name) return json(res, 400, { error: 'email and full_name required' });

    // Use service role key to create the auth user
    const serviceKey = SB_SERVICE || SB_ANON;
    const inviteRes = await sbFetch('POST', '/auth/v1/admin/users', {
      email,
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1',
      email_confirm: true,
      user_metadata: { full_name, role: role || 'sub_worker' }
    }, serviceKey);

    if (inviteRes.error && !inviteRes.id) {
      // User might already exist in auth - just create profile
      console.log('Auth user creation note:', inviteRes.error?.message || inviteRes.msg);
    }

    const authUserId = inviteRes.id;
    if (!authUserId) return json(res, 400, { error: inviteRes.error?.message || 'Could not create auth user. Add SUPABASE_SERVICE_KEY to Render environment variables.' });

    // Create profile
    const profileRes = await sbFetch('POST', '/rest/v1/profiles', {
      id: authUserId,
      full_name,
      email,
      phone: phone || '',
      role: role || 'sub_worker',
      company_id: company_id || null,
      hire_date: hire_date || null,
      emergency_contact: emergency_contact || '',
      emergency_phone: emergency_phone || '',
      is_active: true,
      created_at: new Date().toISOString()
    });

    // Send password reset email so they can set their own password
    await sbFetch('POST', '/auth/v1/admin/users/' + authUserId + '/send-email', {
      type: 'recovery'
    }, serviceKey);

    return json(res, 200, { success: true, user_id: authUserId, message: 'Employee created. Password reset email sent to ' + email });
  }

    json(res, 404, { error: 'Not found: ' + p });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       FieldAxisHQ  v1.0  starting      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('Port:', PORT);
  if (!SB_URL) console.log('⚠  SUPABASE_URL not set — set env vars before use');
  await setupDB();
  console.log('Ready.\n');
});
