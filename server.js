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
  if (role === 'admin' && !['admin','pm','estimator','foreman','stager','signout','requestor','technician'].includes(userRole)) {
    errEl.textContent = 'You do not have admin access. Use Field Worker login.'; errEl.style.display='block'; btn.disabled=false; btn.textContent='Sign In'; return
  }
  window.location.href = ['admin','pm','estimator','foreman','stager','signout','requestor','technician'].includes(userRole) ? 'admin.html' : 'worker.html'
}
// Auto-redirect if already logged in (unless ?signout=1 in URL)
if (!window.location.search.includes('signout')) {
  sb.auth.getSession().then(({data:{session}}) => {
    if (!session) return
    sb.from('profiles').select('role').eq('id',session.user.id).single().then(({data:p}) => {
      const r = p?.role||'sub_worker'
      window.location.href = ['admin','pm','estimator','foreman','stager','signout','requestor','technician'].includes(r) ? 'admin.html' : 'worker.html'
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js"></script>
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
.markup-@keyframes urgentPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
canvas-wrap{position:relative;display:inline-block;width:100%;overflow:auto;background:#1a2540;border-radius:8px;border:1px solid rgba(255,255,255,.08)}
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

/* ── MOBILE RESPONSIVE ─────────────────────────────────────────────── */
@media (max-width: 768px) {
  body { overflow: auto; }
  #sidebar {
    position: fixed; left: -220px; top: 0; bottom: 0; z-index: 500;
    width: 220px; transition: left .25s cubic-bezier(.4,0,.2,1);
    box-shadow: 4px 0 24px rgba(0,0,0,.7);
  }
  #sidebar.open { left: 0; }
  #sidebar-overlay {
    display: none; position: fixed; inset: 0; z-index: 499;
    background: rgba(0,0,0,.6); backdrop-filter: blur(2px);
  }
  #sidebar-overlay.show { display: block; }
  #main { width: 100vw; }
  .topbar { padding: 0 12px; gap: 8px; }
  .topbar-title { font-size: 13px; }
  .tb-right { gap: 5px; }
  #hamburger {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 7px; cursor: pointer;
    background: #131c2e; border: 1px solid rgba(255,255,255,.1);
    flex-shrink: 0; color: #e8edf5; font-size: 16px;
  }
  #page-area { padding: 12px; }
  /* Stats grid */
  .stats, [style*="grid-template-columns:repeat(4"] {
    grid-template-columns: 1fr 1fr !important;
  }
  /* Two-col grids → single col */
  .two, .three, .four,
  [style*="grid-template-columns:1fr 1fr"],
  [style*="grid-template-columns:1fr 260px"],
  [style*="grid-template-columns:1fr 1fr 280px"],
  [style*="grid-template-columns:1fr 280px"] {
    grid-template-columns: 1fr !important;
  }
  /* Tables — make them scroll */
  .tbl { font-size: 11px; }
  .tbl th, .tbl td { padding: 7px 8px; }
  /* Cards */
  .card { padding: 12px; }
  /* Modal — full screen */
  .modal-box {
    max-width: 100% !important; width: 100% !important;
    max-height: 100vh !important; border-radius: 0 !important;
    position: fixed; inset: 0; margin: 0;
  }
  .modal-bg { align-items: flex-end; }
  .modal-box { border-radius: 16px 16px 0 0 !important; max-height: 92vh !important; }
  /* Topbar actions — wrap */
  .tb-right { flex-wrap: wrap; max-width: calc(100vw - 100px); overflow: hidden; }
  .tb-right .btn { font-size: 10px; padding: 4px 8px; }
  /* Tab bar — scroll */
  .tab-bar { -webkit-overflow-scrolling: touch; }
  .tab { padding: 9px 11px; font-size: 11px; }
  /* Form inputs — bigger touch targets */
  .fi, .fs, .ft { font-size: 16px !important; padding: 10px 12px; }
  .btn { padding: 9px 14px; font-size: 12px; }
  .btn-sm { padding: 7px 11px; font-size: 11px; }
  /* Job detail header */
  [style*="font-size:18px;font-weight:700"] { font-size: 15px !important; }
  /* Dashboard */
  [style*="grid-template-columns:1fr 1fr;gap:13px"] { grid-template-columns: 1fr !important; }
  /* Stat value */
  .stat-value { font-size: 20px; }
  /* Photo grid */
  .photo-grid { grid-template-columns: repeat(2,1fr); }
  /* Markup toolbar */
  .markup-toolbar { gap: 4px; padding: 7px; }
  .mt-btn { padding: 6px 8px; font-size: 10px; }
  /* Scrollable table wrapper */
  .tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
@media (max-width: 400px) {
  .stats, [style*="grid-template-columns:repeat(4"] {
    grid-template-columns: 1fr !important;
  }
  .topbar-title { font-size: 11px; }
}
</style>
</head>
<body>
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
    <div class="nav-item" onclick="P('tasks',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 8l2 2 4-4"/></svg>Tasks<span id="tasks-badge" style="display:none;margin-left:auto;background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;line-height:1.4"></span></div>
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
    <div class="nav-item" onclick="P('fax_bids',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2h10v12H3z"/><path d="M5 5h6M5 8h6M5 11h3"/><circle cx="12" cy="12" r="3" fill="#131c2e" stroke="currentColor"/><path d="M12 11v2M12 13h.01"/></svg>FieldAxisHQ Quote<span class="nb" id="nb-fax-bids" style="display:none">!</span></div>
    <div class="nav-item" onclick="P('fax_bid_invoices',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3M11 11l1 1 2-2"/></svg>FAX Invoices</div>
    <div class="nav-item" onclick="P('fax_bid_templates',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M4 7h8M4 10h5"/></svg>Quote Templates</div>
    <div class="nav-item" onclick="P('fax_bid_reports',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13l3-4 3 2 3-5 3 2"/><circle cx="5" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="11" cy="6" r="1.2" fill="currentColor" stroke="none"/></svg>Quote Reports</div>
    <div class="nav-item" onclick="P('financials',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12l3-4 3 2 3-5 3 3"/></svg>Financials</div>
    <div class="nav-item" onclick="P('reports',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13V8m4 5V5m4 8V2"/></svg>Reports</div>
    <div class="nav-section">CRM</div>
    <div class="nav-item" onclick="P('crm_accounts',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>Accounts</div>
    <div class="nav-item" onclick="P('crm_contacts',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4a3 3 0 11-6 0 3 3 0 016 0zM4 14s-1-1-1-3a5 5 0 0110 0c0 2-1 3-1 3"/></svg>Contacts</div>
    <div class="nav-item" onclick="P('crm_pipeline',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h3v8H2zm4.5-2h3v12h-3zM11 6h3v6h-3z"/></svg>Pipeline</div>
    <div class="nav-item" onclick="P('crm_inspections',this)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10v10H3z"/><path d="M6 8l2 2 4-4"/></svg>Inspections</div>
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

<div id="sidebar-overlay" onclick="toggleSidebar()"></div>
<div id="main">
  <div class="topbar"><div id="hamburger" onclick="toggleSidebar()" style="display:none">☰</div>
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
  // Delay badge load slightly to ensure ME is set
  setTimeout(function(){if(typeof ME!=='undefined'&&ME)loadMyTasksBadge()},500)
  // Mobile: show hamburger on small screens
  initMobileLayout()
})

// ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
function initMobileLayout(){
  if(window.innerWidth<=768){
    var hb=document.getElementById('hamburger')
    if(hb)hb.style.display='flex'
    // Auto-close sidebar on nav click on mobile
    document.querySelectorAll('.nav-item').forEach(function(el){
      el.addEventListener('click',function(){
        if(window.innerWidth<=768)closeSidebar()
      })
    })
  }
  window.addEventListener('resize',function(){
    var hb=document.getElementById('hamburger')
    if(!hb)return
    if(window.innerWidth<=768){hb.style.display='flex'}
    else{hb.style.display='none';closeSidebar()}
  })
}
function toggleSidebar(){
  var sb=document.getElementById('sidebar')
  var ov=document.getElementById('sidebar-overlay')
  if(!sb)return
  if(sb.classList.contains('open')){closeSidebar()}
  else{sb.classList.add('open');if(ov)ov.classList.add('show')}
}
function closeSidebar(){
  var sb=document.getElementById('sidebar')
  var ov=document.getElementById('sidebar-overlay')
  if(sb)sb.classList.remove('open')
  if(ov)ov.classList.remove('show')
}

async function deleteJobConfirm(){
  if(!currentJob){toast('No job open','error');return}
  var jobName=currentJob.name||'this job'
  // First confirmation
  if(!confirm('PERMANENTLY DELETE "'+jobName+'"? All parts, reports, walks and tasks will be deleted. This CANNOT be undone.'))return
  // Second confirmation
  var typed=prompt('Type the job name to confirm deletion: '+jobName)
  if(!typed||typed.trim()!==jobName.trim()){
    toast('Job name did not match — deletion cancelled','warn')
    return
  }
  toast('Deleting job...','warn')
  try{
    // Delete all related records first
    await sb.from('job_parts').delete().eq('job_id',currentJob.id)
    await sb.from('job_tasks').delete().eq('job_id',currentJob.id)
    await sb.from('daily_reports').delete().eq('job_id',currentJob.id)
    await sb.from('job_walks').delete().eq('job_id',currentJob.id)
    await sb.from('job_walk_plans').delete().eq('job_id',currentJob.id)
    await sb.from('checkins').delete().eq('job_id',currentJob.id)
    await sb.from('scan_events').delete().eq('job_id',currentJob.id)
    await sb.from('job_documents').delete().eq('job_id',currentJob.id)
    // Delete the job itself
    var res=await sb.from('jobs').delete().eq('id',currentJob.id)
    if(res.error)throw new Error(res.error.message)
    currentJob=null
    currentJobId=null
    toast('Job "'+jobName+'" permanently deleted','warn')
    P('jobs',document.querySelector('.nav-item[onclick*=jobs]'))
  }catch(e){
    toast('Delete failed: '+e.message,'error')
  }
}
function doSignOut(){sb.auth.signOut().then(function(){location.href='index.html?signout=1'})}

// ── NAVIGATION ────────────────────────────────────────────────
const PAGE_TITLES={tasks:'Tasks',crm_accounts:'CRM — Accounts',crm_contacts:'CRM — Contacts',crm_pipeline:'CRM — Pipeline',crm_inspections:'CRM — Inspections',dashboard:'Dashboard',notifications:'Notifications',fax_bids:'FieldAxisHQ Quotes',fax_bid_invoices:'FieldAxisHQ Invoices',fax_bid_templates:'FieldAxisHQ Quote Templates',fax_bid_reports:'FieldAxisHQ Quote Reports',dispatch:'Dispatch Board',jobs:'All Jobs',newjob:'New Job',schedule:'Schedule & Milestones',daily:'Daily Reports',jobwalks:'Job Walks',punch:'Punch List',scan:'Scan Parts',catalog:'Parts Catalog',inventory:'Stock / Inventory',orders:'Orders',gps:'GPS Tracking',hours:'Labor Hours',companies:'Sub Companies',safety:'Safety Topics',financials:'Financials',reports:'Reports & Exports',documents:'Document Vault',users:'Users',jobdetail:'Job Detail'}
function P(page,navEl){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'))
  if(navEl)navEl.classList.add('active')
  document.getElementById('page-title').textContent=PAGE_TITLES[page]||page
  document.getElementById('topbar-actions').innerHTML=''
  const a=document.getElementById('page-area')
  a.innerHTML='<div class="loading"><div class="spin"></div> Loading…</div>'
  const map={dashboard:pgDash,jobs:pgJobs,tasks:pgTasks,crm_accounts:pgCrmAccounts,crm_contacts:pgCrmContacts,crm_pipeline:pgCrmPipeline,crm_inspections:pgCrmInspections,fax_bids:pgFaxBids,fax_bid_invoices:pgFaxInvoices,fax_bid_templates:pgFaxBidTemplates,fax_bid_reports:pgFaxBidReports,newjob:pgNewJob,schedule:pgSchedule,dispatch:pgDispatch,daily:pgDaily,jobwalks:pgJobWalks,punch:pgPunch,scan:pgScan,catalog:pgCatalog,inventory:pgInventory,orders:pgOrders,gps:pgGPS,hours:pgHours,companies:pgCompanies,safety:pgSafety,financials:pgFinancials,reports:pgReports,documents:pgDocuments,users:pgUsers,notifications:pgNotifications}
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

const STAGES=['not_started','make_safe','prewire','roughed_in','trimmed','ready_for_pretest','ready_for_final','complete']
const STAGE_LABELS={not_started:'Not Started',make_safe:'Make Safe',prewire:'Pre-Wire',roughed_in:'Roughed In',trimmed:'Trimmed Out',ready_for_pretest:'Ready for Pre-test',ready_for_final:'Ready for Final',complete:'Complete'}
const STAGE_COLORS={not_started:'bg-gray',make_safe:'bg-red',prewire:'bg-orange',roughed_in:'bg-blue',trimmed:'bg-teal',ready_for_pretest:'bg-amber',ready_for_final:'bg-purple',complete:'bg-green'}
// Parts statuses displayed on job cards
const PARTS_STATUS_LABELS={ordered:'Ordered',staged:'Staged',delivered:'Delivered to Site',partial:'Partial',none:'None'}
// Permit statuses
const PERMIT_STATUS_LABELS={not_required:'Not Required',pending:'Pending',submitted:'Submitted',approved:'Approved',rejected:'Rejected',expired:'Expired'}
const PERMIT_STATUS_COLORS={not_required:'bg-gray',pending:'bg-amber',submitted:'bg-blue',approved:'bg-green',rejected:'bg-red',expired:'bg-red'}
function stageBadge(p){return\`<span class="badge \${STAGE_COLORS[p]||'bg-gray'}">\${STAGE_LABELS[p]||p||'—'}</span>\`}
function roleBadge(r){const m={admin:'bg-purple',pm:'bg-blue',estimator:'bg-blue',stager:'bg-amber',foreman:'bg-teal',technician:'bg-green',sub_lead:'bg-amber',sub_worker:'bg-gray'};return\`<span class="badge \${m[r]||'bg-gray'}">\${r||'—'}</span>\`}
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
  if(jobsError) throw new Error('Jobs query failed: '+jobsError.message+' (code:'+jobsError.code+')')
  try { await loadJobsWithPartsStatus() } catch(lpe){ console.warn('loadJobsWithPartsStatus:',lpe) }
  const {data:ci} = await sb.from('checkins').select('id,job_id,worker_id,checkin_at,checkout_at').is('checkout_at',null).order('checkin_at',{ascending:false}).limit(20)
  // Load my tasks for dashboard widget
  const myTasksRes = (ME&&ME.id) ? await sb.from('job_tasks').select('*').eq('assigned_to',ME.id).in('status',['open','in_progress']).order('created_at',{ascending:false}) : {data:[]}
  const myTasks = myTasksRes.data||[]
  window._myOpenTasks = myTasks
  const {data:parts} = await sb.from('job_parts').select('id,job_id,status,assigned_qty,ordered_qty,taken_qty,installed_qty')
  const {data:orders} = await sb.from('orders').select('id,status,job_id').order('created_at',{ascending:false})
  const {data:low} = await sb.from('inventory').select('id,name,qty,min_qty').gt('min_qty',0)
  const {data:safety} = await sb.from('safety_topics').select('id,title,week_of').order('created_at',{ascending:false}).limit(5)
  // Load worker names for check-ins separately (avoid join issues)
  let ciWithNames = ci||[]
  if(ciWithNames.length){
    const workerIds=[...new Set(ciWithNames.map(c=>c.worker_id).filter(Boolean))]
    const jobIds=[...new Set(ciWithNames.map(c=>c.job_id).filter(Boolean))]
    const [{data:wProfiles},{data:ciJobs}]=await Promise.all([
      sb.from('profiles').select('id,full_name').in('id',workerIds),
      sb.from('jobs').select('id,name').in('id',jobIds)
    ])
    const wMap={}; (wProfiles||[]).forEach(p=>wMap[p.id]=p.full_name)
    const jMap={}; (ciJobs||[]).forEach(j=>jMap[j.id]=j.name)
    ciWithNames=ciWithNames.map(c=>({...c,workerName:wMap[c.worker_id]||'?',jobName:jMap[c.job_id]||''}))
  }
  allJobs=jobs||[]
  const active=allJobs.filter(j=>j.phase!=='complete'&&!j.archived)
  const activeJobIds=new Set(active.map(j=>j.id))
  const allParts=(parts||[]).filter(p=>activeJobIds.has(p.job_id))
  const orderedParts=allParts.filter(p=>p.status==='ordered')
  const staged=allParts.filter(p=>p.status==='staged')
  const out=allParts.filter(p=>p.status==='signed_out')
  const installed=allParts.filter(p=>p.status==='installed'||p.status==='partial_install')
  const activeOrders=(orders||[]).filter(o=>activeJobIds.has(o.job_id)||!o.job_id)
  const pendingOrders=activeOrders.filter(o=>o.status==='pending').length
  const orderedOrders=activeOrders.filter(o=>o.status==='ordered').length
  const stagedOrders=(orders||[]).filter(o=>o.status==='staged').length
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
  <div class="stats" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat" style="cursor:pointer" onclick="P('jobs',null)"><div class="stat-label">Active Jobs</div><div class="stat-value">\${active.length}</div><div style="font-size:10px;color:\${active.filter(j=>isOD(j.due_date,j.phase)).length>0?'#dc2626':'#414e63'};margin-top:2px">\${active.filter(j=>isOD(j.due_date,j.phase)).length} overdue</div></div>
    <div class="stat" style="cursor:pointer" onclick="P('orders',null)"><div class="stat-label">Orders</div><div class="stat-value" style="color:#d97706">\${pendingOrders+orderedOrders}</div><div style="font-size:10px;color:#414e63;margin-top:2px">\${pendingOrders} pending · \${orderedOrders} ordered · \${stagedOrders} staged</div></div>
    <div class="stat"><div class="stat-label">Parts Pipeline</div><div class="stat-value" style="color:#a855f7">\${out.length}</div><div style="font-size:10px;color:#414e63;margin-top:2px">\${staged.length} staged · \${out.length} checked out · \${installed.length} installed</div></div>
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
      \${buildMyTasksDashWidget(myTasks)}
      <div class="card">
        <div class="card-title">🔔 Safety Pending</div>
        \${(safety||[]).length?(safety||[]).map(s=>\`<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px"><div style="font-weight:500">\${s.safety_topics?.title||'Topic'}</div><div style="color:#414e63;margin-top:1px">\${s.assigned_name} · Week of \${fd(s.safety_topics?.week_of)}</div></div>\`).join(''):'<div style="font-size:12px;color:#414e63">No pending safety reviews ✓</div>'}
        <button class="btn btn-sm" style="margin-top:8px;width:100%;justify-content:center" onclick="P('safety',null)">Manage Safety →</button>
      </div>
    </div>
  </div>\`
  } catch(e) {
    console.error('Dashboard error:',e)
    document.getElementById('page-area').innerHTML='<div style="padding:20px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:10px"><div style="color:#dc2626;font-weight:600;margin-bottom:8px">⚠ Dashboard failed to load</div><div style="font-size:12px;color:#f87171;font-family:monospace;background:rgba(0,0,0,.3);padding:10px;border-radius:6px;word-break:break-all">'+e.message+'</div><div style="font-size:11px;color:#8a96ab;margin-top:8px">Check browser console (F12) for full details. This is usually a database connection or missing table issue.</div><button class="btn btn-sm" onclick="pgDash()" style="margin-top:10px">Retry</button></div>'
  }
}
// ══════════════════════════════════════════
// ALL JOBS
// ══════════════════════════════════════════
async function pgJobs(){
  document.getElementById('topbar-actions').innerHTML=\`
    <button class="btn btn-sm btn-ghost" onclick="downloadJobTemplate()">📋 Template</button>
    <label class="btn btn-sm" style="cursor:pointer">⬆ Import Excel<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importJobsExcel(this)"></label>
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

// ── JOB STATUS HELPERS ────────────────────────────────────────
// Returns parts status badge for a job based on cached job_parts data
// We store a snapshot on the job object itself for fast table rendering
function jobPartsStatus(j){
  // Use pre-computed snapshot if available (set by loadJobsWithParts)
  const s=j._parts_status||'none'
  const colors={ordered:'bg-blue',staged:'bg-amber',delivered:'bg-green',partial:'bg-orange',none:'bg-gray'}
  const labels={ordered:'Parts Ordered',staged:'Parts Staged',delivered:'On Site',partial:'Partial',none:'No Parts'}
  return{status:s,badge:'<span class="badge '+(colors[s]||'bg-gray')+'">'+(labels[s]||s)+'</span>'}
}

// Load jobs and enrich with parts status snapshot
async function loadJobsWithPartsStatus(){
  const{data:jobs}=await sb.from('jobs').select('*').eq('archived',false).order('created_at',{ascending:false})
  const{data:parts}=await sb.from('job_parts').select('job_id,status')
  allJobs=jobs||[]
  // Build parts map per job
  const partsMap={}
  ;(parts||[]).forEach(p=>{
    if(!partsMap[p.job_id])partsMap[p.job_id]=[]
    partsMap[p.job_id].push(p.status)
  })
  // Determine overall parts status per job
  allJobs.forEach(j=>{
    const ps=partsMap[j.id]||[]
    if(!ps.length){j._parts_status='none';return}
    const hasDelivered=ps.some(s=>s==='signed_out'||s==='installed'||s==='partial_install')
    const allStaged=ps.every(s=>['staged','signed_out','installed','partial_install'].includes(s))
    const anyOrdered=ps.some(s=>s==='ordered')
    const anyStaged=ps.some(s=>s==='staged')
    if(hasDelivered) j._parts_status='delivered'
    else if(allStaged) j._parts_status='staged'
    else if(anyStaged) j._parts_status='partial'
    else if(anyOrdered) j._parts_status='ordered'
    else j._parts_status='none'
  })
}
function renderJobsTable(q){
  const rows=allJobs.filter(j=>!q||j.name.toLowerCase().includes(q.toLowerCase())||(j.address||'').toLowerCase().includes(q.toLowerCase()))
  document.getElementById('page-area').innerHTML=\`
  <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
    <input class="fi" placeholder="Search jobs…" style="max-width:280px" oninput="renderJobsTable(this.value)" value="\${q}">
    <select class="fs" style="width:180px" onchange="filterJobsByStage(this.value)">
      <option value="">All Stages</option>
      \${STAGES.map(s=>\`<option value="\${s}">\${STAGE_LABELS[s]}</option>\`).join('')}
    </select>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
  \${rows.length?\`<table class="tbl"><thead><tr>
    <th>Job</th>
    <th>Job Status</th>
    <th>Parts Status</th>
    <th>Permit</th>
    <th>PM</th>
    <th>Due Date</th>
    <th>Progress</th>
    <th></th>
  </tr></thead><tbody>
  \${rows.map(j=>{
    const ps=jobPartsStatus(j)
    const permit=j.permit_status||'not_required'
    return \`<tr onclick="openJob('\${j.id}')" style="cursor:pointer">
      <td><div style="font-weight:500">\${j.name}</div><div style="font-size:10px;color:#414e63">\${j.address||''}</div></td>
      <td>\${stageBadge(j.phase)}</td>
      <td>\${ps.badge}</td>
      <td><span class="badge \${PERMIT_STATUS_COLORS[permit]||'bg-gray'}">\${PERMIT_STATUS_LABELS[permit]||permit}</span></td>
      <td style="font-size:12px">\${j.project_manager||'—'}</td>
      <td style="font-size:11px;color:\${isOD(j.due_date,j.phase)?'#dc2626':'#8a96ab'}">\${j.due_date?fd(j.due_date):'—'}</td>
      <td><div style="display:flex;align-items:center;gap:5px"><div class="pbar"><div class="pb" style="width:\${j.pct_complete||0}%"></div></div><span style="font-size:10px">\${j.pct_complete||0}%</span></div></td>
      <td><button class="btn btn-sm" onclick="event.stopPropagation();openJob('\${j.id}')">Open</button></td>
    </tr>\`
  }).join('')}
  </tbody></table>\`
  :empty('🏗','No jobs found')}
  </div>\`
}

function filterJobsByStage(stage){
  const rows=stage?allJobs.filter(j=>j.phase===stage):allJobs
  const a=document.getElementById('page-area')
  a.querySelector('table tbody').innerHTML=rows.map(j=>\`<tr onclick="openJob('\${j.id}')"><td><div style="font-weight:500">\${j.name}</div></td><td>\${j.gc_company||'—'}</td><td>\${stageBadge(j.phase)}</td><td style="font-size:11px">\${fd(j.due_date)}</td><td style="font-size:11px">\${fd(j.next_visit_date)}</td><td>\${j.contract_value?fm(j.contract_value):'—'}</td><td><div class="pbar" style="width:60px"><div class="pb g" style="width:\${j.pct_complete||0}%"></div></div></td></tr>\`).join('')
}
async function importJobsExcel(input){
  const file=input.files[0];if(!file)return
  input.value=''
  try{
    const data=await file.arrayBuffer()
    const wb=XLSX.read(data,{type:'array'})
    const ws=wb.Sheets[wb.SheetNames[0]]
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''})
    if(!rows.length){toast('No data found in file','error');return}
    // Preview modal
    const validRows=rows.filter(r=>r['Job Name']||r['name']||r['job_name'])
    if(!validRows.length){
      modal('Import Error','<div style="color:#dc2626">No rows with a Job Name found.<br><br>Make sure your spreadsheet has a column called <strong>Job Name</strong>.</div>',null,'',true)
      return
    }
    const validStages=['not_started','make_safe','prewire','roughed_in','trimmed','ready_for_pretest','ready_for_final','complete']
    const stageMap={'not started':'not_started','make safe':'make_safe','prewire':'prewire','roughed in':'roughed_in','rough in':'roughed_in','trimmed':'trimmed','trim':'trimmed','ready for pretest':'ready_for_pretest','ready for final':'ready_for_final','complete':'complete','completed':'complete','done':'complete'}
    // Build preview table
    var h='<div style="font-size:12px;color:#8a96ab;margin-bottom:12px">Found <strong style="color:#e8edf5">'+validRows.length+' jobs</strong> ready to import. Review below then click Import.</div>'
    h+='<div style="max-height:320px;overflow-y:auto;margin-bottom:12px">'
    h+='<table class="tbl" style="font-size:11px"><thead><tr><th>#</th><th>Job Name</th><th>Address</th><th>Stage</th><th>Due Date</th><th>Contract Value</th><th>Status</th></tr></thead><tbody>'
    validRows.forEach(function(r,i){
      var name=r['Job Name']||r['name']||r['job_name']||''
      var addr=r['Address']||r['address']||''
      var rawStage=String(r['Stage']||r['stage']||r['Phase']||r['phase']||'not_started').trim().toLowerCase()
      var stage=validStages.includes(rawStage)?rawStage:(stageMap[rawStage]||'not_started')
      var stageOk=validStages.includes(rawStage)||stageMap[rawStage]
      var due=r['Due Date']||r['due_date']||r['due']||''
      var val=r['Contract Value']||r['contract_value']||r['value']||''
      var warn=!name?'<span style="color:#dc2626">Missing name</span>':''
      h+='<tr>'
      h+='<td style="color:#414e63">'+(i+1)+'</td>'
      h+='<td style="font-weight:500">'+(name||'<span style="color:#dc2626">—</span>')+'</td>'
      h+='<td style="color:#8a96ab">'+(addr||'—')+'</td>'
      h+='<td>'+(stage)+'</td>'
      h+='<td>'+(due||'—')+'</td>'
      h+='<td>'+(val?'$'+parseFloat(val).toLocaleString():'—')+'</td>'
      h+='<td>'+(warn||'<span style="color:#16a34a">✓</span>')+'</td>'
      h+='</tr>'
    })
    h+='</tbody></table></div>'
    var skipBad=validRows.filter(r=>!(r['Job Name']||r['name']||r['job_name'])).length
    if(skipBad)h+='<div style="font-size:11px;color:#d97706;margin-bottom:8px">⚠ '+skipBad+' rows will be skipped (missing Job Name)</div>'
    modal('Import '+validRows.length+' Jobs', h, async function(){
      var created=0,errors=[]
      for(var i=0;i<validRows.length;i++){
        var r=validRows[i]
        var name=r['Job Name']||r['name']||r['job_name']||''
        if(!name)continue
        var rawStage=String(r['Stage']||r['stage']||r['Phase']||r['phase']||'not_started').trim().toLowerCase()
        var stage=validStages.includes(rawStage)?rawStage:(stageMap[rawStage]||'not_started')
        var dueRaw=r['Due Date']||r['due_date']||r['due']||''
        var dueDate=null
        if(dueRaw){try{var d=new Date(dueRaw);if(!isNaN(d))dueDate=d.toISOString().split('T')[0]}catch(e){}}
        var job={
          id:uuid(),name:name,
          address:r['Address']||r['address']||'',
          city:r['City']||r['city']||'',
          state:r['State']||r['state']||'',
          zip:r['Zip']||r['zip']||'',
          gc_company:r['GC Company']||r['gc_company']||'',
          gc_contact:r['GC Contact']||r['gc_contact']||'',
          gc_phone:r['GC Phone']||r['gc_phone']||'',
          gc_email:r['GC Email']||r['gc_email']||'',
          phase:stage,
          due_date:dueDate,
          contract_value:parseFloat(r['Contract Value']||r['contract_value']||r['value'])||null,
          description:r['Description']||r['description']||r['Notes']||r['notes']||'',
          trade:r['Trade']||r['trade']||'',
          archived:false,pct_complete:0,
          created_by:ME?.full_name||'',
          created_at:new Date().toISOString(),updated_at:new Date().toISOString()
        }
        var res=await sb.from('jobs').insert(job)
        if(res.error)errors.push(name+': '+res.error.message)
        else created++
      }
      closeModal()
      if(errors.length){
        var errHtml='<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:#16a34a">✓ '+created+' jobs imported</div>'
        errHtml+='<div style="font-size:12px;color:#dc2626;margin-bottom:6px">'+errors.length+' errors:</div>'
        errHtml+=errors.map(function(e){return'<div style="font-size:11px;color:#f87171;margin-bottom:3px">• '+e+'</div>'}).join('')
        modal('Import Complete',errHtml,null,'',true)
      }else{
        toast('✓ Imported '+created+' jobs successfully','success')
      }
      pgJobs()
    },'Import All')
  }catch(e){
    toast('Failed to read file: '+e.message,'error')
  }
}

function downloadJobTemplate(){
  var headers=[['Job Name','Address','City','State','Zip','GC Company','GC Contact','GC Phone','GC Email','Stage','Due Date','Contract Value','Trade','Description','Notes']]
  var example=[['Fire Alarm Install - 123 Main','123 Main St','Phoenix','AZ','85001','ABC Construction','John Smith','555-1234','john@abc.com','not_started','2025-12-01','85000','Fire Alarm','New construction FA install','']]
  var ws=XLSX.utils.aoa_to_sheet(headers.concat(example))
  // Column widths
  ws['!cols']=[{wch:30},{wch:25},{wch:15},{wch:8},{wch:8},{wch:20},{wch:18},{wch:14},{wch:22},{wch:18},{wch:12},{wch:15},{wch:14},{wch:30},{wch:20}]
  var wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Jobs')
  // Add a stages reference sheet
  var stagesData=[['Valid Stage Values'],['not_started'],['make_safe'],['prewire'],['roughed_in'],['trimmed'],['ready_for_pretest'],['ready_for_final'],['complete']]
  var ws2=XLSX.utils.aoa_to_sheet(stagesData)
  XLSX.utils.book_append_sheet(wb,ws2,'Stage Reference')
  XLSX.writeFile(wb,'FieldAxisHQ-Job-Import-Template.xlsx')
  toast('Template downloaded')
}

async function exportJobsExcel(){
  const{data:jobs}=await sb.from('jobs').select('*').order('created_at',{ascending:false})
  const rows=(jobs||[]).map(j=>({'Job Name':j.name,'Address':j.address||'','City':j.city||'','State':j.state||'','Zip':j.zip||'','GC Company':j.gc_company||'','GC Contact':j.gc_contact||'','GC Phone':j.gc_phone||'','GC Email':j.gc_email||'','Stage':j.phase,'Due Date':j.due_date||'','Next Visit':j.next_visit_date||'','Expected On Site':j.expected_onsite_date||'','Contract Value':j.contract_value||'','Trade':j.trade||'','Description':j.description||'','% Complete':j.pct_complete||0,'Completion Date':j.completion_date||''}))
  const ws=XLSX.utils.json_to_sheet(rows)
  ws['!cols']=[{wch:30},{wch:25},{wch:15},{wch:8},{wch:8},{wch:20},{wch:18},{wch:14},{wch:22},{wch:18},{wch:12},{wch:12},{wch:16},{wch:15},{wch:14},{wch:30},{wch:10},{wch:14}]
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
  document.getElementById('topbar-actions').innerHTML=\`<button class="btn btn-sm" onclick="P('jobs',null)">← Jobs</button> <button class="btn btn-sm" id="urgent-btn" style="background:rgba(220,38,38,.15);color:#dc2626;border-color:rgba(220,38,38,.3)" onclick="toggleUrgent()">🔥 Flag Urgent</button>\${['admin'].includes(ME?.role)?\` <button class="btn btn-sm" style="color:#dc2626;border-color:rgba(220,38,38,.3)" onclick="deleteJobConfirm()">🗑 Delete Job</button>\`:''}\`
  const{data:job}=await sb.from('jobs').select('*').eq('id',id).single()
  currentJob=job
  // Update urgent button state
  var ub=document.getElementById('urgent-btn')
  if(ub){
    if(job&&job.is_urgent){ub.textContent='🔥 Urgent';ub.style.background='rgba(220,38,38,.35)';ub.style.fontWeight='600'}
    else{ub.textContent='🔥 Flag Urgent';ub.style.background='rgba(220,38,38,.1)';ub.style.fontWeight='400'}
  }
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
      \${stageBadge(j.phase)}
      <select class="fs" style="width:180px;padding:5px 9px;font-size:12px" onchange="updateJobStage(this.value)">\${STAGES.map(s=>\`<option value="\${s}" \${j.phase===s?'selected':''}>\${STAGE_LABELS[s]}</option>\`).join('')}</select>
      <input type="number" class="fi" style="width:70px;padding:5px 8px;font-size:12px" value="\${j.pct_complete||0}" min="0" max="100" title="% Complete" onchange="updateJobPct(this.value)">%
      \${j.due_date?\`<span style="font-size:11px;color:\${isOD(j.due_date,j.phase)?'#dc2626':'#8a96ab'}">Due \${fd(j.due_date)}</span>\`:''}
    \${j.is_urgent?'<div style="display:flex;align-items:center;gap:10px;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);border-radius:8px;padding:9px 13px;margin-top:8px"><span style="font-size:20px">🔥</span><div style="flex:1"><div style="font-size:13px;font-weight:600;color:#dc2626">URGENT</div><div style="font-size:12px;color:#8a96ab;margin-top:2px">'+( j.urgent_note||'')+'</div><div style="font-size:11px;color:#414e63;margin-top:2px">Assigned: '+(j.urgent_assigned_name||'—')+'</div></div><button class="btn btn-sm btn-g" onclick="resolveUrgent()">✓ Resolve</button><button class="btn btn-sm" style="color:#dc2626" onclick="toggleUrgent()">Remove</button></div>':''}
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
    <div class="tab" onclick="JT(this,'jt-drawings')">Drawings</div>
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
  else if(id==='jt-drawings') await renderDrawingsTab(el)
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
    <div class="two"><div class="fg"><label class="fl">PM Visit Schedule</label><select class="fs" id="ed-pmschedule"><option value="none">No visits</option><option value="pre_start">14 days before start</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="milestone">Milestones only</option></select></div><div class="fg"><label class="fl">Next PM Visit Due</label><input class="fi" type="date" id="ed-pmvisit" value="\${j.next_pm_visit||''}"></div></div>
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
  <div class="sec-hdr" style="margin-top:14px">Permit Status</div>
  <div class="two" style="margin-bottom:4px">
    <div class="fg"><label class="fl">Permit Status</label>
      <select class="fs" id="ed-permit-status">
        <option value="not_required" \\\${(j.permit_status||'not_required')==='not_required'?'selected':''}>Not Required</option>
        <option value="pending" \\\${j.permit_status==='pending'?'selected':''}>Pending</option>
        <option value="submitted" \\\${j.permit_status==='submitted'?'selected':''}>Submitted</option>
        <option value="approved" \\\${j.permit_status==='approved'?'selected':''}>Approved</option>
        <option value="rejected" \\\${j.permit_status==='rejected'?'selected':''}>Rejected</option>
        <option value="expired" \\\${j.permit_status==='expired'?'selected':''}>Expired</option>
      </select>
    </div>
    <div class="fg"><label class="fl">Permit Number</label>
      <input class="fi" id="ed-permit-number" placeholder="e.g. E-2024-001" value="\\\${j.permit_number||''}">
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:4px">
    <button class="btn btn-p" onclick="saveInfoTab()">Save Changes</button>
    <button class="btn btn-a" onclick="archiveJob()">Archive Job</button>
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
async function saveInfoTab(){
  const u={name:v('ed-name'),address:v('ed-addr'),gps_lat:fN('ed-lat'),gps_lng:fN('ed-lng'),gps_radius_ft:parseInt(v('ed-rad'))||250,gc_company:v('ed-gc'),gc_contact:v('ed-gcc'),gc_phone:v('ed-gcp'),super_name:v('ed-sup'),super_phone:v('ed-supp'),project_manager:v('ed-pm'),pm_visit_schedule:v('ed-pmschedule')||'none',next_pm_visit:v('ed-pmvisit')||null,permit_status:v('ed-permit-status')||'not_required',permit_number:v('ed-permit-number')||null,date_start:v('ed-start')||null,due_date:v('ed-due')||null,expected_onsite_date:v('ed-eos')||null,next_visit_date:v('ed-nvd')||null,date_roughin:v('ed-dr')||null,date_trimout:v('ed-dt')||null,date_inspection:v('ed-di')||null,date_closeout:v('ed-dco')||null,completion_date:v('ed-comp')||null,contract_value:fN('ed-cv'),labor_rate:fN('ed-lr'),labor_budget:fN('ed-lb'),material_budget:fN('ed-mb'),updated_at:new Date().toISOString()}
  const{error}=await sb.from('jobs').update(u).eq('id',currentJobId)
  if(error){toast(error.message,'error');return}
  currentJob={...currentJob,...u};document.getElementById('page-title').textContent=u.name;toast('Saved')
}
async function archiveJob(){if(!confirm('Archive this job?'))return;await sb.from('jobs').update({archived:true}).eq('id',currentJobId);toast('Archived');P('jobs',null)}
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
  if(!parts||!parts.length) return empty('📦','No parts on this job yet')
  var isAdmin=['admin','pm','estimator'].indexOf((typeof ME!=='undefined'?ME.role:'')||'')>=0
  const totalOrdered=parts.reduce((s,p)=>s+(p.ordered_qty||p.assigned_qty||0),0)
  const totalTaken=parts.reduce((s,p)=>s+(p.taken_qty||0),0)
  const totalInstalled=parts.reduce((s,p)=>s+(p.installed_qty||0),0)
  const totalStaged=parts.filter(p=>['staged','signed_out','partial_install','installed'].includes(p.status)).reduce((s,p)=>s+(p.assigned_qty||0),0)
  const stagedComplete=parts.every(p=>['staged','signed_out','partial_install','installed'].includes(p.status))
  const over=parts.filter(p=>(p.installed_qty||0)>(p.ordered_qty||p.assigned_qty||0))
  const under=parts.filter(p=>p.status==='installed'&&(p.installed_qty||0)<(p.ordered_qty||p.assigned_qty||0))
  let html='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">'
  ;[{l:'Ordered',v:totalOrdered,cl:'#60a5fa'},{l:'Staged',v:totalStaged,cl:'#eab308'},{l:'Checked Out',v:totalTaken,cl:'#a855f7'},{l:'Installed',v:totalInstalled,cl:'#16a34a'}].forEach(s=>{html+='<div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:9px 12px;text-align:center"><div style="font-size:18px;font-weight:700;color:'+s.cl+'">'+s.v+'</div><div style="font-size:10px;color:#414e63;margin-top:2px">'+s.l+'</div></div>'})
  html+='</div><div style="margin-bottom:10px;padding:8px 12px;border-radius:7px;font-size:12px;background:'+(stagedComplete?'rgba(22,163,74,.08)':'rgba(217,119,6,.08)')+';border:1px solid '+(stagedComplete?'rgba(22,163,74,.2)':'rgba(217,119,6,.2)')+'">'+( stagedComplete?'✅ All parts staged':'⚠ '+parts.filter(p=>!['staged','signed_out','partial_install','installed'].includes(p.status)).length+' not yet staged')+'</div>'
  if(over.length)html+='<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:7px;padding:9px 12px;margin-bottom:9px;font-size:12px;color:#dc2626">⚠ Over-issued: '+over.map(p=>p.part_name).join(', ')+'</div>'
  if(under.length)html+='<div style="background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.2);border-radius:7px;padding:9px 12px;margin-bottom:9px;font-size:12px;color:#d97706">⚠ Under-installed: '+under.map(p=>p.part_name).join(', ')+'</div>'
  html+='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Part</th><th>Ordered</th><th>Staged</th><th>Taken</th><th>Installed</th><th>Status</th><th>Staged By</th><th></th></tr></thead><tbody>'
  parts.forEach(p=>{
    const ord=p.ordered_qty||p.assigned_qty||0,stg=p.assigned_qty||0,tak=p.taken_qty||0,ins=p.installed_qty||0
    const pct=stg>0?Math.round(ins/stg*100):0
    const bc=p.status==='staged'?'bg-amber':p.status==='signed_out'?'bg-purple':p.status==='installed'?'bg-green':p.status==='partial_install'?'bg-teal':'bg-gray'
    html+='<tr><td><div style="font-weight:500">'+p.part_name+'</div><div style="font-size:9px;color:#414e63">'+p.part_id+'</div></td><td>'+ord+'</td><td style="color:'+(stg>0?'#eab308':'#414e63')+'">'+stg+'</td><td style="color:'+(tak>0?'#a855f7':'#414e63')+'">'+tak+'</td><td><div style="display:flex;align-items:center;gap:5px"><div class="pbar" style="width:36px"><div class="pb g" style="width:'+Math.min(100,pct)+'%"></div></div><span style="font-size:11px">'+ins+'</span></div></td><td><span class="badge '+bc+'">'+p.status.replace(/_/g,' ')+'</span></td><td style="font-size:11px;color:#8a96ab">'+(p.staged_by||'—')+'</td></tr>'
  })
  html+='</tbody></table></div>'
  return html
}

// PARTS TAB (per job view)
// renderPartsTab moved to parts_features.js

// DAILY REPORTS TAB (per job)
async function renderJobDailyTab(el){
  const{data:reports}=await sb.from('daily_reports').select('*').eq('job_id',currentJobId).order('report_date',{ascending:false})
  const rows=reports||[]
  let html='<div style="margin-bottom:12px"><button class="btn btn-p btn-sm" data-jid="'+currentJobId+'" onclick="newDailyModal(this.dataset.jid)">+ New Daily Report</button></div>'
  if(!rows.length){el.innerHTML=html+empty('📋','No daily reports for this job');return}
  html+='<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>'
  html+='<th>Date</th><th>Submitted By</th><th>Crew</th><th>Hours</th><th>Weather</th><th>Issues</th><th></th>'
  html+='</tr></thead><tbody>'
  for(const r of rows){
    const hasIssues=r.issues&&r.issues.trim()
    html+='<tr data-rid="'+r.id+'" onclick="viewDailyReport(this.dataset.rid)" style="cursor:pointer">'
    html+='<td style="font-weight:500;white-space:nowrap">'+fd(r.report_date)+'</td>'
    html+='<td style="font-size:12px">'+(r.submitted_by||'—')+'</td>'
    html+='<td>'+r.crew_count+'</td>'
    html+='<td>'+fh(r.hours_worked)+'</td>'
    html+='<td style="font-size:11px;color:#8a96ab">'+(r.weather||'—')+(r.temp_high?' '+r.temp_high+'°':'')+'</td>'
    html+='<td>'+(hasIssues?'<span class="badge bg-red">Yes</span>':'<span style="font-size:11px;color:#414e63">—</span>')+'</td>'
    html+='<td style="display:flex;gap:4px" onclick="event.stopPropagation()">'
    html+='<button class="btn btn-sm" data-rid="'+r.id+'" onclick="dlDailyReportById(this.dataset.rid)">⬇</button>'
    html+='<button class="btn btn-sm" data-rid="'+r.id+'" onclick="emailDrById(this.dataset.rid)">📧</button>'
    html+='</td></tr>'
  }
  html+='</tbody></table></div>'
  el.innerHTML=html
}
function dlDailyReport(r){
  const jobName=_drJobs&&_drJobs[r.job_id]?_drJobs[r.job_id]:currentJob?.name||r.job_id||'Unknown'
  const content=\`DAILY REPORT\\n\${'='.repeat(40)}\\nJob: \${jobName}\\nDate: \${fd(r.report_date)}\\nSubmitted By: \${r.submitted_by||'—'}\\nCrew Count: \${r.crew_count}\\nHours Worked: \${fh(r.hours_worked)}\\nWeather: \${r.weather} \${r.temp_high?r.temp_high+'°/'+r.temp_low+'°':''}\\n\\nWORK PERFORMED:\\n\${r.work_performed||'—'}\\n\\nMATERIALS USED:\\n\${r.materials_used||'—'}\\n\\nEQUIPMENT USED:\\n\${r.equipment_used||'—'}\\n\\nISSUES:\\n\${r.issues||'None'}\\n\\nVISITORS:\\n\${r.visitors||'None'}\`
  const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(content);a.download='Daily-Report-'+r.report_date+'.txt';a.click()
}
async function emailDrById(id){
  const{data:r}=await sb.from('daily_reports').select('*').eq('id',id).single()
  if(r)emailReport(r)
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
  \${(plans||[]).length?(plans||[]).map(p=>\`<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div>📄</div><div style="flex:1"><div style="font-size:12px;font-weight:500">\${p.file_name}</div></div><button class="btn btn-sm" onclick="openPlanMarkup('\${p.id}','\${p.url}','\${p.file_name}',()=>openJobWalk('\${walk.id}'))">✏ Markup</button><a href="\${p.url}" target="_blank" class="btn btn-sm">View</a></div>\`).join(''):'<div style="font-size:12px;color:#414e63;margin-bottom:8px">No plans uploaded</div>'}
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
  el.innerHTML=\`<label class="upload-zone" style="margin-bottom:12px"><input type="file" multiple accept="image/*" onchange="uploadPhotos(this.files)"><div style="font-size:22px;color:#414e63">📷</div><div style="font-size:12px;color:#414e63;margin-top:5px">Click to upload photos (before/after/progress)</div></label>
  <div class="photo-grid">\${(photos||[]).map(p=>\`<div class="photo-card" onclick="window.open('\${p.url}','_blank')"><img class="photo-thumb" src="\${p.url}" loading="lazy" onerror="this.style.display='none'"><div style="padding:5px 7px;font-size:10px;color:#414e63">\${p.type||'photo'} · \${p.uploaded_by||''}</div></div>\`).join('')}</div>\`
}
async function uploadPhotos(files){for(const f of files){const path=\`jobs/\${currentJobId}/photos/\${Date.now()}_\${f.name}\`;const{error}=await sb.storage.from('fieldtrack-photos').upload(path,f,{upsert:true});if(!error){const{data:{publicUrl}}=sb.storage.from('fieldtrack-photos').getPublicUrl(path);await sb.from('job_photos').insert({id:uuid(),job_id:currentJobId,url:publicUrl,type:'progress',uploaded_by:ME?.full_name,created_at:new Date().toISOString()})}};toast('Uploaded');loadJT('jt-photos')}

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
      <div class="two"><div class="fg"><label class="fl">Job ID / Number</label><input class="fi" id="nj-jobid" placeholder="e.g. 2025-001"></div><div class="fg"><label class="fl">Trade</label><input class="fi" id="nj-trade" value="Fire Alarm" placeholder="Fire Alarm, Suppression..."></div></div>
      <div class="fg" style="position:relative"><label class="fl">Project Address *</label><input class="fi" id="nj-addr" placeholder="Start typing…" autocomplete="off" oninput="addrAC(this.value,'nj-addr-dd')"><div id="nj-addr-dd" class="addr-dd"></div>
      <div id="nj-gps-ok" style="display:none;font-size:10px;color:#16a34a;margin-top:4px">✓ GPS: <span id="nj-coords"></span></div><input type="hidden" id="nj-lat"><input type="hidden" id="nj-lng"></div>
      <div class="three"><div class="fg"><label class="fl">Radius</label><select class="fs" id="nj-rad"><option value="100">100ft</option><option value="250" selected>250ft</option><option value="500">500ft</option><option value="750">750ft</option><option value="1000">1000ft</option></select></div>
      <div class="fg"><label class="fl">Start</label><input class="fi" type="date" id="nj-start"></div>
      <div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="nj-due"></div></div>
      <div class="three"><div class="fg"><label class="fl">Expected On Site</label><input class="fi" type="date" id="nj-eos"></div>
      <div class="fg"><label class="fl">Next Visit</label><input class="fi" type="date" id="nj-nvd"></div>
      <div class="fg"><label class="fl">Closeout Date</label><input class="fi" type="date" id="nj-dco"></div></div>
      <div class="three"><div class="fg"><label class="fl">Original Contract $</label><input class="fi" type="number" id="nj-cv"></div>
      <div class="fg"><label class="fl">Labor Budget</label><input class="fi" type="number" id="nj-lb"></div>
      <div class="fg"><label class="fl">Labor Rate/hr</label><input class="fi" type="number" id="nj-lr"></div></div>
      <div class="fg"><label class="fl">GC Company</label><input class="fi" id="nj-gc"></div>
      <div class="two"><div class="fg"><label class="fl">GC Contact</label><input class="fi" id="nj-gcc"></div><div class="fg"><label class="fl">GC Phone</label><input class="fi" id="nj-gcp"></div></div>
      <div class="two"><div class="fg"><label class="fl">Superintendent</label><input class="fi" id="nj-sup"></div><div class="fg"><label class="fl">Super Phone</label><input class="fi" id="nj-supp"></div></div>
      <div class="fg"><label class="fl">Project Manager (Internal)</label><select class="fs" id="nj-pm"><option value="">— Assign PM —</option></select></div>
      <div class="fg"><label class="fl">Estimator</label><select class="fs" id="nj-estimator"><option value="">— Assign Estimator —</option></select></div>
      <div class="fg"><label class="fl">PM Visit Schedule</label><select class="fs" id="nj-pmschedule"><option value="none">No scheduled visits</option><option value="pre_start">14 days before start</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="milestone">At milestones only</option></select></div>
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
      <div class="two"><div class="fg"><label class="fl">Inspection</label><input class="fi" type="date" id="nj-di"></div><div class="fg"><label class="fl">Contract Date</label><input class="fi" type="date" id="nj-dc"></div></div>
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
  var opts='<option value="">— Unassigned —</option>'+users.map(p=>'<option value="'+p.full_name+'">'+p.full_name+(p.role?' ('+p.role+')':'')+'</option>').join('')
  sel.innerHTML=opts
  // Also populate estimator dropdown
  var estSel=document.getElementById('nj-estimator')
  if(estSel)estSel.innerHTML='<option value="">— Unassigned —</option>'+users.filter(function(p){return['admin','pm','estimator'].includes(p.role)}).map(p=>'<option value="'+p.full_name+'">'+p.full_name+'</option>').join('')
}
async function loadNjWorkers(){const coId=v('nj-co');const wrap=document.getElementById('nj-workers');if(!wrap)return;if(!coId){wrap.innerHTML='<div style="font-size:11px;color:#414e63">Select a company first</div>';return};const{data}=await sb.from('profiles').select('id,full_name,is_lead').eq('company_id',coId).eq('is_active',true);wrap.innerHTML=(data||[]).map(w=>\`<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px"><input type="checkbox" id="w-\${w.id}" value="\${w.id}" \${w.is_lead?'checked':''}><label for="w-\${w.id}" style="font-size:12px;color:#8a96ab">\${w.full_name}\${w.is_lead?' (Lead)':''}</label></div>\`).join('')||'<div style="font-size:11px;color:#414e63">No workers</div>'}
async function submitNewJob(){
  const name=v('nj-name').trim();if(!name){toast('Job name required','error');return}
  const btn=document.getElementById('nj-btn');btn.disabled=true;btn.textContent='Creating…'
  let lat=parseFloat(v('nj-lat'))||null,lng=parseFloat(v('nj-lng'))||null
  if(!lat&&v('nj-addr')){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(v('nj-addr'))+'&format=json&limit=1',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();if(j[0]){lat=parseFloat(j[0].lat);lng=parseFloat(j[0].lon)}}catch{}}
  const job={id:uuid(),name,address:v('nj-addr'),gps_lat:lat,gps_lng:lng,gps_radius_ft:parseInt(v('nj-rad'))||250,date_start:v('nj-start')||null,due_date:v('nj-due')||null,expected_onsite_date:v('nj-eos')||null,next_visit_date:v('nj-nvd')||null,date_closeout:v('nj-dco')||null,job_number:v('nj-jobid')||null,estimator:v('nj-estimator')||null,original_contract_value:fN('nj-cv'),contract_value:fN('nj-cv'),labor_budget:fN('nj-lb'),labor_rate:fN('nj-lr'),trade:v('nj-trade')||null,gc_company:v('nj-gc'),gc_contact:v('nj-gcc'),gc_phone:v('nj-gcp'),super_name:v('nj-sup'),super_phone:v('nj-supp'),scope:v('nj-scope'),install_notes:v('nj-notes'),company_id:v('nj-co')||null,pm_review_type:v('nj-pmr'),project_manager:v('nj-pm')||null,pm_visit_schedule:v('nj-pmschedule')||'none',next_pm_visit:v('nj-pmvisit')||null,date_roughin:v('nj-dr')||null,date_trimout:v('nj-dt')||null,date_inspection:v('nj-di')||null,date_contract:v('nj-dc')||null,phase:'not_started',pct_complete:0,archived:false,created_by:ME?.full_name,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
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
  const rows=(_drAll||[]).filter(r=>{
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
    const jobName=(_drJobs||{})[r.job_id]||r.job_id||'—'
    const hasIssues=r.issues&&r.issues.trim()
    html+='<tr data-rid="'+r.id+'" onclick="viewDailyReport(this.dataset.rid)" style="cursor:pointer">'
    html+='<td style="font-weight:500;white-space:nowrap">'+fd(r.report_date)+'</td>'
    html+='<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+jobName+'</td>'
    html+='<td style="font-size:12px">'+(r.submitted_by||'—')+'</td>'
    html+='<td>'+r.crew_count+'</td>'
    html+='<td>'+fh(r.hours_worked)+'</td>'
    html+='<td style="font-size:11px;color:#8a96ab">'+(r.weather||'—')+(r.temp_high?' '+r.temp_high+'°':'')+'</td>'
    html+='<td>'+(hasIssues?'<span class="badge bg-red">Yes</span>':'<span style="font-size:11px;color:#414e63">—</span>')+'</td>'
    html+='<td style="display:flex;gap:4px" onclick="event.stopPropagation()">'
    html+='<button class="btn btn-sm" data-rid="'+r.id+'" onclick="dlDailyReportById(this.dataset.rid)">⬇</button>'
    html+='<button class="btn btn-sm" data-rid="'+r.id+'" onclick="emailDrById(this.dataset.rid)">📧</button>'
    html+='</td></tr>'
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
  document.getElementById('page-area').innerHTML=\`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div>
      <div class="card">
        <div class="fg"><label class="fl">Job *</label><select class="fs" id="sc-job" onchange="_scanJobId=this.value;loadJobPartsPanel()"><option value="">— Select job —</option>\${allJobs.map(j=>\`<option value="\${j.id}">\${j.name}</option>\`).join('')}</select></div>
        <div class="mode-toggle" style="margin-bottom:12px">
          <button class="active" id="mt-stage" onclick="setScanMode('stage',this)">📥 Stage In</button>
          <button id="mt-out" onclick="setScanMode('out',this)">📤 Check Out</button>
          <button id="mt-return" onclick="setScanMode('return',this)">↩ Return</button>
        </div>
        <div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:8px;padding:10px 13px;margin-bottom:12px;font-size:12px;color:#8a96ab">
          📡 <strong style="color:#60a5fa">Barcode Scanner Ready</strong> — connect your Bluetooth or USB scanner and scan directly into the field below. The scanner acts like a keyboard and auto-submits on scan.
        </div>
        <div style="margin-bottom:10px;display:flex;gap:8px">
          <button class="btn btn-sm" onclick="focusScanInput()" style="flex:1">🎯 Focus Scanner Input</button>
          <button class="btn btn-sm" onclick="testBeep()">🔊 Test Beep</button>
        </div>
        <div class="fg">
          <label class="fl">Barcode / Part # <span style="color:#414e63">— scanner auto-submits, or type + Enter</span></label>
          <input class="fi" id="sc-bc" placeholder="Ready for scanner — click Focus button or click here…" autocomplete="off" autofocus style="font-size:15px;letter-spacing:.5px" oninput="liveResolveBC(this.value)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addToBatch(null,null);this.value='';document.getElementById('sc-resolve').style.display='none';document.getElementById('sc-qty-row').style.display='none';this.focus()}">
        </div>
        <div id="sc-resolve" style="display:none;margin-bottom:9px"></div>
        <div id="sc-qty-row" style="display:none;margin-bottom:9px">
          <label class="fl">Quantity</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-sm" onclick="adjManualQty(-1)">−</button>
            <input class="fi" type="number" id="sc-qty" value="1" min="1" style="width:70px;text-align:center">
            <button class="btn btn-sm" onclick="adjManualQty(1)">+</button>
            <button class="btn btn-p btn-sm" onclick="addToBatch(null,null);document.getElementById('sc-bc').value='';document.getElementById('sc-resolve').style.display='none'">Add to Batch</button>
          </div>
        </div>
        <!-- BATCH LIST -->
        <div id="batch-list" style="display:none">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:500;font-size:13px" id="batch-title">Staging Batch</span>
            <span style="background:#e8edf5;color:#060a10;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px" id="batch-cnt">0</span>
          </div>
          <div id="batch-items"></div>
          <div style="display:flex;gap:7px;margin-top:9px">
            <button class="btn btn-p btn-sm" id="commit-btn" onclick="commitBatch()" style="flex:2">Commit Batch to Job</button>
            <button class="btn btn-r btn-sm" onclick="clearBatch()">Clear</button>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Parts on Job <button class="btn btn-sm btn-ghost" onclick="loadJobPartsPanel()">↻</button></div>
        <div id="job-parts-panel"><div style="font-size:12px;color:#414e63">Select a job to see its parts</div></div>
      </div>
      <div class="card">
        <div class="card-title">Recent Scan Events</div>
        <div id="scan-events-panel"></div>
      </div>
    </div>
  </div>\`
  loadScanEvents()
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
function liveResolveBC(val){
  clearTimeout(_bcDeb);const el=document.getElementById('sc-resolve');const qr=document.getElementById('sc-qty-row');if(!el)return
  if(!val||val.length<2){el.style.display='none';qr.style.display='none';_resolvedPart=null;return}
  _bcDeb=setTimeout(()=>{
    const match=allCatalog.filter(c=>c.barcode.toLowerCase()===val.toLowerCase()||c.barcode.toLowerCase().includes(val.toLowerCase())||(c.part_number||'').toLowerCase().includes(val.toLowerCase())||(c.name||'').toLowerCase().includes(val.toLowerCase())).slice(0,5)
    if(!match.length){el.innerHTML=\`<div style="font-size:11px;color:#414e63;padding:6px 9px;background:#131c2e;border-radius:6px">Not in catalog — will add as new part</div>\`;el.style.display='block';_resolvedPart={barcode:val,name:val,part_number:'',description:''};qr.style.display='block';return}
    el.innerHTML=match.map(c=>\`<div style="padding:9px 11px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:7px;cursor:pointer;margin-bottom:4px" onclick="selectCatalogPart('\${c.barcode}','\${(c.name||'').replace(/'/g,"\\\\'")}')"><div style="font-size:13px;font-weight:500">\${c.name}</div><div style="font-size:10px;color:#414e63">\${c.barcode} \${c.part_number?' · #'+c.part_number:''} \${c.description?' · '+c.description.substring(0,40):''}</div></div>\`).join('')
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
function addToBatch(bc, name){
  const barcode=bc||v('sc-bc').trim();if(!barcode)return
  const qty=parseInt(v('sc-qty'))||1
  const part=_resolvedPart||allCatalog.find(c=>c.barcode===barcode)||{barcode,name:name||barcode,part_number:'',description:''}
  const ex=_batch.find(b=>b.barcode===barcode)
  if(ex){ex.qty+=qty}else{_batch.push({barcode,name:part.name,part_number:part.part_number||'',description:part.description||'',qty})}
  beep()
  renderBatch()
  // Ask to add another
  toast(\`Added: \${part.name} (x\${qty})\`)
  document.getElementById('sc-qty').value=1
  _resolvedPart=null
}
function renderBatch(){
  const bl=document.getElementById('batch-list');if(!bl)return
  if(!_batch.length){bl.style.display='none';return}
  bl.style.display='block'
  document.getElementById('batch-cnt').textContent=_batch.reduce((s,b)=>s+b.qty,0)
  document.getElementById('batch-items').innerHTML=_batch.map((b,i)=>\`<div class="batch-item">
    <div class="bi-info"><div class="bi-name">\${b.name}</div><div class="bi-bc">\${b.barcode}\${b.part_number?' · #'+b.part_number:''}</div></div>
    <div class="qty-ctrl"><button onclick="adjBatch(\${i},-1)">−</button><span>\${b.qty}</span><button onclick="adjBatch(\${i},1)">+</button></div>
    <button style="background:none;border:none;cursor:pointer;color:#414e63;font-size:16px;padding:2px 5px" onclick="rmBatch(\${i})">×</button>
  </div>\`).join('')
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
      // Check if part already on job
      const{data:existing}=await sb.from('job_parts').select('*').eq('job_id',jobId).eq('part_id',item.barcode).single()
      if(existing){
        // Update existing
        const update={assigned_qty:existing.assigned_qty+item.qty,status:statusMap[_scanMode],updated_at:now}
        if(_scanMode==='stage'){update.staged_by=ME?.full_name;update.staged_at=now}
        if(_scanMode==='out'){update.checked_out_by=ME?.full_name;update.checked_out_at=now;update.taken_qty=(existing.taken_qty||0)+item.qty}
        await sb.from('job_parts').update(update).eq('id',existing.id)
      } else {
        const row={id:uuid(),job_id:jobId,part_id:item.barcode,part_name:item.name,status:statusMap[_scanMode],assigned_qty:item.qty,taken_qty:_scanMode==='out'?item.qty:0,staged_by:_scanMode==='stage'?ME?.full_name:null,staged_at:_scanMode==='stage'?now:null,checked_out_by:_scanMode==='out'?ME?.full_name:null,checked_out_at:_scanMode==='out'?now:null,notes:item.description||'',created_at:now,updated_at:now}
        await sb.from('job_parts').insert(row)
      }
      // Log scan event
      await sb.from('scan_events').insert({id:uuid(),job_id:jobId,part_id:item.barcode,part_name:item.name,action:_scanMode==='stage'?'stage_in':_scanMode==='out'?'check_out':'return',qty:item.qty,scanned_by:ME?.full_name||'?',scanned_at:now,device_info:navigator.userAgent.slice(0,60)})
      // Deduct from inventory on stage or checkout
      if(_scanMode!=='return'){const{data:inv}=await sb.from('inventory').select('qty').eq('id',item.barcode).single();if(inv)await sb.from('inventory').update({qty:Math.max(0,inv.qty-item.qty),updated_at:now}).eq('id',item.barcode)}
    }
    const action=_scanMode==='stage'?'Staged':_scanMode==='out'?'Checked out':'Returned'
    toast(\`\${action} \${_batch.length} part type(s) ✓\`)
    clearBatch();loadJobPartsPanel();loadScanEvents()
  }catch(e){toast(e.message,'error')}
  btn.disabled=false;btn.textContent='Commit Batch to Job'
}
async function loadJobPartsPanel(){
  const jobId=document.getElementById('sc-job')?.value;const el=document.getElementById('job-parts-panel');if(!el)return
  if(!jobId){el.innerHTML='<div style="font-size:12px;color:#414e63">Select a job</div>';return}
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',jobId).order('created_at',{ascending:false})
    var isAdm=['admin','pm','estimator'].indexOf((typeof ME!=='undefined'?ME.role:'')||'')>=0
  el.innerHTML=(parts||[]).length?'<table class="tbl"><thead><tr><th>Part</th><th>Qty</th><th>Status</th><th>By</th>'+(isAdm?'<th></th>':'')+'</tr></thead><tbody>'+((parts||[]).map(function(p){return'<tr><td style="font-weight:500;font-size:12px">'+p.part_name+'</td>'+'<td>'+p.assigned_qty+'</td>'+'<td><span class="badge '+(p.status==='staged'?'bg-amber':p.status==='signed_out'?'bg-blue':'bg-green')+'">'+p.status.replace(/_/g,' ')+'</span></td>'+'<td style="font-size:10px;color:#8a96ab">'+(p.staged_by||p.checked_out_by||'—')+'</td>'+(isAdm?'<td><button class="btn btn-sm" style="font-size:10px;padding:2px 6px" data-pid="'+p.id+'" data-pname="'+p.part_name+'" data-status="'+p.status+'" onclick="editScanPartStatus(this)">Status</button></td>':'')+'</tr>'}).join(''))+'</tbody></table>':'<div style="font-size:12px;color:#414e63">No parts on this job yet</div>'
}
async function loadScanEvents(){
  const el=document.getElementById('scan-events-panel');if(!el)return
  const{data:events}=await sb.from('scan_events').select('*').order('scanned_at',{ascending:false}).limit(15)
  el.innerHTML=(events||[]).length?events.map(e=>\`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span class="badge \${e.action==='stage_in'?'bg-amber':e.action==='check_out'?'bg-blue':'bg-green'}" style="flex-shrink:0">\${e.action.replace('_',' ')}</span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${e.part_name} ×\${e.qty}</div><div style="font-size:10px;color:#414e63">\${e.scanned_by||'?'} · \${fdt(e.scanned_at)}</div></div></div>\`).join(''):'<div style="font-size:12px;color:#414e63">No recent scans</div>'
}

// CAMERA SCANNING
async function toggleCam(){
  if(_camRunning){stopCam();return}
  const wrap=document.getElementById('cam-wrap');if(!wrap)return
  wrap.style.display='block'
  document.getElementById('cam-toggle-btn').textContent='⏹ Stop Camera'
  try{
    await Quagga.init({inputStream:{name:'Live',type:'LiveStream',target:document.getElementById('cam-viewport'),constraints:{facingMode:'environment'}},decoder:{readers:['code_128_reader','ean_reader','ean_8_reader','upc_reader','upc_e_reader','code_39_reader','itf_reader']},locate:true},err=>{if(err){toast('Camera error: '+err,'error');stopCam();return};Quagga.start();_camRunning=true;document.getElementById('cam-status').textContent='Ready — point at barcode'})
    let lastCode='',lastTime=0
    Quagga.onDetected(data=>{
      const code=data.codeResult.code;const now=Date.now()
      if(code===lastCode&&now-lastTime<2000)return
      lastCode=code;lastTime=now
      document.getElementById('sc-bc').value=code
      liveResolveBC(code)
      const match=allCatalog.find(c=>c.barcode===code)
      if(match){addToBatch(code,match.name);document.getElementById('sc-bc').value='';document.getElementById('sc-resolve').style.display='none'}
      else{beep();document.getElementById('cam-status').textContent='Found: '+code+' — not in catalog, set qty and add'}
    })
  }catch(e){toast('Camera failed: '+e.message,'error');stopCam()}
}
function focusScanInput(){
  var el=document.getElementById('sc-bc')
  if(el){el.focus();el.select();toast('Scanner input focused — scan away','info')}
}
function stopCam(){if(!_camRunning)return;try{Quagga.stop()}catch{};_camRunning=false;const w=document.getElementById('cam-wrap');if(w)w.style.display='none';const b=document.getElementById('cam-toggle-btn');if(b)b.textContent='📷 Start Camera'}

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
  <div class="two"><div class="fg"><label class="fl">Part Number</label><input class="fi" id="ca-pn" placeholder="Manufacturer #"></div><div class="fg"><label class="fl">Category</label><input class="fi" id="ca-cat" value="FA-Parts" placeholder="FA-Parts, Electrical…"></div></div>
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
async function pgOrders(filterJobId){
  const[{data:orders},{data:jobs}]=await Promise.all([
    sb.from('orders').select('*,jobs(name)').order('created_at',{ascending:false}),
    sb.from('jobs').select('id,name').eq('archived',false).order('name')
  ])
  window._ordFilterJobId=filterJobId||null
  const{data:cat}=await sb.from('catalog').select('*').order('name')
  allCatalog=cat||[]
  window._allOrders=orders||[]
  window._allOrderJobs=jobs||[]
  window._ordItems=[]

  const pending=(orders||[]).filter(o=>o.status==='pending').length
  const ordered=(orders||[]).filter(o=>o.status==='ordered').length
  const staged=(orders||[]).filter(o=>o.status==='staged').length

  document.getElementById('page-area').innerHTML=
    '<div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">'+
    '<div class="stat"><div class="stat-label">Total</div><div class="stat-value">'+(orders||[]).length+'</div></div>'+
    '<div class="stat"><div class="stat-label">Pending</div><div class="stat-value" style="color:#d97706">'+pending+'</div></div>'+
    '<div class="stat"><div class="stat-label">Ordered</div><div class="stat-value" style="color:#60a5fa">'+ordered+'</div></div>'+
    '<div class="stat"><div class="stat-label">Staged</div><div class="stat-value" style="color:#16a34a">'+staged+'</div></div>'+
    '</div>'+
    // Filter bar
    '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">'+
    '<select class="fs" id="ord-filter-job" style="max-width:260px" onchange="window._ordFilterJobId=this.value;renderOrdersList(window._allOrders,window._allOrderJobs)">'+
    '<option value="">All Jobs</option>'+
    (jobs||[]).map(j=>'<option value="'+j.id+'"'+(filterJobId===j.id?' selected':'')+'>'+j.name+'</option>').join('')+
    '</select>'+
    '<span style="font-size:11px;color:#414e63" id="ord-filter-count"></span>'+
    '</div>'+
    // New order form
    '<div class="card" style="margin-bottom:14px">'+
    '<div class="card-title">New Order Request</div>'+
    '<div class="two"><div class="fg"><label class="fl">Job *</label>'+
    '<select class="fs" id="ord-job"><option value="">— Select —</option>'+
    (jobs||[]).map(j=>'<option value="'+j.id+'"'+(filterJobId===j.id?' selected':'')+'>'+j.name+'</option>').join('')+
    '</select></div>'+
    '<div class="fg"><label class="fl">Notes / PO #</label><input class="fi" id="ord-notes"></div></div>'+
    '<div id="ord-items-display" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px"></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px">'+
    '<input class="fi" id="ord-bc" placeholder="Barcode or part name" style="flex:1" oninput="liveResolveBC(this.value)">'+
    '<input class="fi" id="ord-qty" type="number" value="1" min="1" style="width:65px">'+
    '<button class="btn btn-p btn-sm" onclick="addOrdItem()">Add</button>'+
    '</div>'+
    '<button class="btn btn-p btn-full" onclick="submitOrder()">Submit Order</button>'+
    '</div>'+
    '<div id="orders-list"></div>'

  renderOrdersList(orders||[], jobs||[])
}

function renderOrdersList(orders, jobs){
  const el=document.getElementById('orders-list');if(!el)return
  const jobMap={}; (jobs||window._allOrderJobs||[]).forEach(j=>jobMap[j.id]=j.name)
  // Apply job filter
  const filterJob=window._ordFilterJobId||document.getElementById('ord-filter-job')?.value||''
  const filtered=filterJob?(orders||[]).filter(o=>o.job_id===filterJob):(orders||[])
  const cnt=document.getElementById('ord-filter-count')
  if(cnt)cnt.textContent=filtered.length+' order'+(filtered.length!==1?'s':'')+( filterJob?' for this job':'')
  if(!filtered.length){el.innerHTML=empty('📦',filterJob?'No orders for this job yet':'No orders yet');return}
  el.innerHTML=filtered.map(o=>{
    const items=typeof o.items==='string'?JSON.parse(o.items||'[]'):(o.items||[])
    const totalQty=items.reduce((s,i)=>s+(i.qty||0),0)
    const sc={pending:'bg-amber',ordered:'bg-blue',staged:'bg-green',cancelled:'bg-gray'}[o.status]||'bg-gray'
    const jobName=o.jobs?.name||jobMap[o.job_id]||o.job_id||'—'
    let html='<div class="card" style="margin-bottom:9px">'
    html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
    html+='<div><div style="font-weight:600;font-size:14px">'+jobName+'</div>'
    html+='<div style="font-size:11px;color:#414e63;margin-top:2px">'+(o.notes||'No notes')+' · By '+(o.created_by||'—')+' · '+fd(o.created_at)+'</div>'
    html+=(o.staged_at?'<div style="font-size:10px;color:#16a34a">Staged by '+(o.staged_by||'?')+' on '+fdt(o.staged_at)+'</div>':'')
    html+='</div><span class="badge '+sc+'">'+o.status+'</span></div>'
    html+='<div style="background:#0c1220;border-radius:7px;overflow:hidden;margin-bottom:9px">'
    html+=items.map(i=>'<div style="display:flex;align-items:center;gap:10px;padding:7px 11px;border-bottom:1px solid rgba(255,255,255,.04)"><div style="flex:1"><div style="font-size:12px;font-weight:500">'+i.name+'</div><div style="font-size:10px;color:#414e63">'+i.barcode+'</div></div><div style="font-size:12px;font-weight:600">×'+i.qty+'</div></div>').join('')
    html+='<div style="padding:7px 11px;font-size:11px;color:#414e63">'+items.length+' type(s) · '+totalQty+' units</div></div>'
    html+='<div style="display:flex;gap:7px;flex-wrap:wrap">'
    if(o.status==='pending'||o.status==='ordered'){
      html+='<button class="btn btn-sm" data-oid="'+o.id+'" onclick="editOrderModal(this.dataset.oid)">✏ Edit Order</button>'
    }
    if(o.status==='pending') html+='<button class="btn btn-p btn-sm" data-oid="'+o.id+'" data-ns="ordered" onclick="updateOrderStatus(this.dataset.oid,this.dataset.ns)">Mark Ordered</button>'
    if(o.status==='ordered') html+='<button class="btn btn-p btn-sm" data-oid="'+o.id+'" data-jid="'+o.job_id+'" onclick="stageOrderToJob(this.dataset.oid,this.dataset.jid)">📥 Stage to Job</button>'
    if(o.status!=='staged'&&o.status!=='cancelled') html+='<button class="btn btn-sm" data-oid="'+o.id+'" data-ns="cancelled" onclick="updateOrderStatus(this.dataset.oid,this.dataset.ns)">Cancel</button>'
    html+='</div></div>'
    return html
  }).join('')
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
  try{const{data:assigns}=await sb.from('safety_assignments').select('topic_id,profile_id')
    const{data:acks}=await sb.from('safety_acks').select('topic_id,profile_id')
    const ackedSet=new Set((acks||[]).map(a=>a.profile_id+'_'+a.topic_id))
    const count=(assigns||[]).filter(a=>!ackedSet.has(a.profile_id+'_'+a.topic_id)).length;const b=document.getElementById('nb-safety');if(b){b.textContent=count||0;b.style.display=count>0?'inline-block':'none'}}catch{}
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
    '<option value="foreman">Foreman</option><option value="estimator">Estimator</option><option value="pm">Project Manager</option>'+
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
    '<option value="foreman">Foreman</option><option value="estimator">Estimator</option><option value="pm">Project Manager</option>'+
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
}


// ══════════════════════════════════════════
// JOB MAP PAGE
// ══════════════════════════════════════════
async function pgJobMap(){
  document.getElementById('page-title').textContent='Job Map'
  document.getElementById('topbar-actions').innerHTML=\`
    <select class="fs" id="map-filter-pm" style="width:160px;padding:5px 8px;font-size:12px" onchange="filterMapPins()"><option value="">All PMs</option></select>
    <select class="fs" id="map-filter-gc" style="width:160px;padding:5px 8px;font-size:12px" onchange="filterMapPins()"><option value="">All GC Companies</option></select>
    <select class="fs" id="map-filter-stage" style="width:160px;padding:5px 8px;font-size:12px" onchange="filterMapPins()"><option value="">All Stages</option>\${STAGES.map(s=>\`<option value="\${s}">\${STAGE_LABELS[s]}</option>\`).join('')}</select>
    <select class="fs" id="map-filter-sub" style="width:160px;padding:5px 8px;font-size:12px" onchange="filterMapPins()"><option value="">All Subs</option></select>\`

  const{data:jobs}=await sb.from('jobs').select('*').eq('archived',false)
  window._mapJobs=jobs||[]

  // Populate filter dropdowns
  const pms=[...new Set((jobs||[]).map(j=>j.project_manager).filter(Boolean))]
  const gcs=[...new Set((jobs||[]).map(j=>j.gc_company).filter(Boolean))]
  const subs=[...new Set((jobs||[]).map(j=>j.company_id).filter(Boolean))]
  const{data:companies}=await sb.from('companies').select('id,name')
  const coMap={}; (companies||[]).forEach(c=>coMap[c.id]=c.name)
  document.getElementById('map-filter-pm').innerHTML='<option value="">All PMs</option>'+pms.map(p=>\`<option value="\${p}">\${p}</option>\`).join('')
  document.getElementById('map-filter-gc').innerHTML='<option value="">All GC Companies</option>'+gcs.map(g=>\`<option value="\${g}">\${g}</option>\`).join('')
  document.getElementById('map-filter-sub').innerHTML='<option value="">All Subs</option>'+subs.map(s=>\`<option value="\${s}">\${coMap[s]||s}</option>\`).join('')

  document.getElementById('page-area').innerHTML=\`
  <div style="display:grid;grid-template-columns:1fr 280px;gap:13px;height:calc(100vh - 120px)">
    <div style="position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">
      <div id="map-container" style="width:100%;height:100%;background:#0c1220;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;color:#414e63">
          <div style="font-size:32px;margin-bottom:8px">🗺</div>
          <div style="font-size:13px;font-weight:500;color:#8a96ab">Interactive Map</div>
          <div style="font-size:11px;margin-top:4px">Loading OpenStreetMap…</div>
        </div>
      </div>
      <div id="map-legend" style="position:absolute;bottom:12px;left:12px;background:rgba(6,10,16,.92);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;font-size:11px"></div>
    </div>
    <div style="overflow-y:auto">
      <div class="card" style="margin-bottom:10px"><div class="card-title">Jobs on Map</div><div id="map-job-list"></div></div>
    </div>
  </div>\`

  // Load Leaflet map
  if(!document.getElementById('leaflet-css')){
    const link=document.createElement('link');link.id='leaflet-css';link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(link)
    const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=()=>initMap(jobs||[]);document.head.appendChild(script)
  } else {
    initMap(jobs||[])
  }
}

function initMap(jobs){
  const container=document.getElementById('map-container')
  if(!container||!window.L)return
  container.innerHTML='<div id="leaflet-map" style="width:100%;height:100%"></div>'
  const map=window.L.map('leaflet-map').setView([33.4484,-112.0740],10)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map)
  window._leafletMap=map
  window._mapMarkers=[]
  addMapPins(jobs,map)
  renderMapJobList(jobs)
}

const MAP_COLORS={not_started:'#64748b',make_safe:'#ef4444',prewire:'#f97316',roughed_in:'#3b82f6',trimmed:'#06b6d4',ready_for_pretest:'#eab308',ready_for_final:'#a855f7',complete:'#16a34a'}

function addMapPins(jobs,map){
  if(!window.L)return
  // Clear existing
  ;(window._mapMarkers||[]).forEach(m=>m.remove())
  window._mapMarkers=[]
  const withGPS=jobs.filter(j=>j.gps_lat&&j.gps_lng)
  withGPS.forEach(j=>{
    const color=MAP_COLORS[j.phase]||'#8a96ab'
    const iconHtml=j.is_urgent
      ?\`<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));animation:urgentPulse 1.2s ease-in-out infinite">🔥</div>\`
      :\`<div style="width:14px;height:14px;border-radius:50%;background:\${color};border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>\`
    const iconSize=j.is_urgent?[28,28]:[14,14]
    const iconAnchor=j.is_urgent?[14,14]:[7,7]
    const icon=window.L.divIcon({html:iconHtml,className:'',iconSize:iconSize,iconAnchor:iconAnchor})
    const marker=window.L.marker([j.gps_lat,j.gps_lng],{icon}).addTo(map)
    marker.bindPopup(\`<div style="font-family:'DM Sans',sans-serif;min-width:200px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">\${j.name}</div><div style="font-size:11px;color:#666;margin-bottom:5px">\${j.address||''}</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px"><span style="background:\${color}22;color:\${color};padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600">\${STAGE_LABELS[j.phase]||j.phase}</span></div>\${j.project_manager?\`<div style="font-size:11px"><strong>PM:</strong> \${j.project_manager}</div>\`:''}\${j.gc_company?\`<div style="font-size:11px"><strong>GC:</strong> \${j.gc_company}</div>\`:''}\${j.due_date?\`<div style="font-size:11px"><strong>Due:</strong> \${fd(j.due_date)}</div>\`:''}\${j.is_urgent?\`<div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:5px">🔥 URGENT: \${j.urgent_note||''}</div>\`:''}<div style="margin-top:7px"><a href="javascript:openJob('\${j.id}')" style="color:#2563eb;font-size:11px;font-weight:600">Open Job →</a></div></div>\`)
    window._mapMarkers.push(marker)
  })
  // Fit bounds
  if(withGPS.length>0){const bounds=window.L.latLngBounds(withGPS.map(j=>[j.gps_lat,j.gps_lng]));map.fitBounds(bounds,{padding:[30,30]})}
  // Legend
  const el=document.getElementById('map-legend')
  if(el)el.innerHTML=Object.entries(MAP_COLORS).map(([stage,color])=>\`<div style="display:flex;align-items:center;gap:6px;padding:2px 0"><div style="width:10px;height:10px;border-radius:50%;background:\${color}"></div><span style="color:#e8edf5">\${STAGE_LABELS[stage]}</span></div>\`).join('')+'<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.1);color:#414e63">'+withGPS.length+' of '+(window._mapJobs||jobs).length+' jobs have GPS</div>'
}

function renderMapJobList(jobs){
  const el=document.getElementById('map-job-list');if(!el)return
  el.innerHTML=jobs.map(j=>\`<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer" onclick="mapFlyTo('\${j.id}')">
    <div style="display:flex;align-items:center;gap:7px"><div style="width:8px;height:8px;border-radius:50%;background:\${MAP_COLORS[j.phase]||'#8a96ab'};flex-shrink:0"></div><div style="font-size:12px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${j.name}</div></div>
    <div style="font-size:10px;color:#414e63;margin-top:1px;padding-left:15px">\${j.project_manager?j.project_manager+' · ':''} \${j.gc_company||''}</div>
  </div>\`).join('')||'<div style="font-size:12px;color:#414e63">No jobs match filters</div>'
}

function mapFlyTo(jobId){
  const j=(window._mapJobs||[]).find(x=>x.id===jobId);if(!j||!j.gps_lat)return
  if(window._leafletMap)window._leafletMap.flyTo([j.gps_lat,j.gps_lng],16)
}

function filterMapPins(){
  const pm=document.getElementById('map-filter-pm')?.value||''
  const gc=document.getElementById('map-filter-gc')?.value||''
  const stage=document.getElementById('map-filter-stage')?.value||''
  const sub=document.getElementById('map-filter-sub')?.value||''
  const filtered=(window._mapJobs||[]).filter(j=>
    (!pm||j.project_manager===pm)&&
    (!gc||j.gc_company===gc)&&
    (!stage||j.phase===stage)&&
    (!sub||j.company_id===sub)
  )
  if(window._leafletMap)addMapPins(filtered,window._leafletMap)
  renderMapJobList(filtered)
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
        <button class="mt-btn" id="mmt-line" onclick="setMarkupMode('line',this)">/ Line</button>
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
        <span style="font-size:10px;color:#414e63;margin-left:8px;font-weight:600">LINE W</span>
        <select class="fi" id="line-width" style="width:60px;padding:3px 6px;font-size:11px"><option value="1">1px</option><option value="2" selected>2px</option><option value="4">4px</option><option value="6">6px</option><option value="10">10px</option></select>
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
      <div class="card"><div class="card-title">Lines</div><div id="line-entries" style="font-size:11px;color:#414e63">No lines drawn</div></div>
      <div class="card">
        <div class="card-title">Dots (\${0})</div>
        <div id="dot-count-display" style="font-size:11px;color:#414e63">0 dots placed</div>
      </div>
    </div>
  </div>\`

  loadMarkupData(planId,planUrl)
}

let _mMode='dot',_mColor='#dc2626',_mCanvas=null,_mCtx=null,_mImg=null,_mData={dots:[],textboxes:[],lines:[],legend:[]},_mLineStart=null

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
  _mData=plan?.markup_json||{dots:[],textboxes:[],lines:[],legend:[]};if(!_mData.lines)_mData.lines=[]
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
    renderLegendEntries();renderTextboxEntries();renderLineEntries();updateDotCount()
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
    _mData.dots.push({id:uuid(),x:cx,y:cy,color:_mColor,size:sz,label:''})
    redrawMarkup();updateDotCount();beep()
  } else if(_mMode==='text'){
    const txt=prompt('Enter text to place on plan:');if(!txt)return
    _mData.textboxes.push({id:uuid(),x:cx,y:cy,text:txt,color:_mColor,fontSize:14})
    redrawMarkup();renderTextboxEntries()
  } else if(_mMode==='line'){
    if(!_mLineStart){
      _mLineStart={x:cx,y:cy}
      _mCtx.beginPath();_mCtx.arc(cx,cy,4,0,Math.PI*2);_mCtx.fillStyle=_mColor;_mCtx.fill()
      toast('Line started — click to set end point','info')
    } else {
      const lw=parseInt(document.getElementById('line-width')?.value||2)
      _mData.lines=_mData.lines||[]
      _mData.lines.push({id:uuid(),x1:_mLineStart.x,y1:_mLineStart.y,x2:cx,y2:cy,color:_mColor,width:lw})
      _mLineStart=null
      redrawMarkup();renderLineEntries()
    }
  } else if(_mMode==='delete'){
    const hit=findMarkupHit(cx,cy)
    if(hit){
      if(hit.type==='dot')_mData.dots=_mData.dots.filter(d=>d.id!==hit.id)
      else if(hit.type==='line')_mData.lines=(_mData.lines||[]).filter(l=>l.id!==hit.id)
      else _mData.textboxes=_mData.textboxes.filter(t=>t.id!==hit.id)
      redrawMarkup();renderLegendEntries();renderTextboxEntries();renderLineEntries();updateDotCount()
      toast('Removed','info')
    }
  }
}
function findMarkupHit(cx,cy){
  for(const d of _mData.dots){if(Math.sqrt((cx-d.x)**2+(cy-d.y)**2)<=d.size+5)return{...d,type:'dot'}}
  for(const t of _mData.textboxes){if(cx>=t.x-5&&cx<=t.x+200&&cy>=t.y-t.fontSize-2&&cy<=t.y+5)return{...t,type:'text'}}
  for(const l of (_mData.lines||[])){
    const dx=l.x2-l.x1,dy=l.y2-l.y1,len2=dx*dx+dy*dy
    const t=len2>0?Math.max(0,Math.min(1,((cx-l.x1)*dx+(cy-l.y1)*dy)/len2)):0
    const px=l.x1+t*dx,py=l.y1+t*dy
    if(Math.sqrt((cx-px)**2+(cy-py)**2)<=8)return{...l,type:'line'}
  }
  return null
}
function redrawMarkup(){
  if(!_mCtx||!_mCanvas)return
  _mCtx.clearRect(0,0,_mCanvas.width,_mCanvas.height)
  if(_mImg)_mCtx.drawImage(_mImg,0,0)
  else{_mCtx.fillStyle='#1a2540';_mCtx.fillRect(0,0,_mCanvas.width,_mCanvas.height)}
  // Draw lines first (behind dots/text)
  for(const l of (_mData.lines||[])){
    _mCtx.beginPath();_mCtx.moveTo(l.x1,l.y1);_mCtx.lineTo(l.x2,l.y2)
    _mCtx.strokeStyle=l.color;_mCtx.lineWidth=l.width||2;_mCtx.lineCap='round';_mCtx.stroke()
    _mCtx.beginPath();_mCtx.arc(l.x1,l.y1,3,0,Math.PI*2);_mCtx.fillStyle=l.color;_mCtx.fill()
    _mCtx.beginPath();_mCtx.arc(l.x2,l.y2,3,0,Math.PI*2);_mCtx.fillStyle=l.color;_mCtx.fill()
  }
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
function renderLineEntries(){
  var el=document.getElementById('line-entries');if(!el)return
  var lines=_mData.lines||[]
  if(!lines.length){el.textContent='No lines drawn';return}
  var h=''
  lines.forEach(function(l,i){
    h+='<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<div style="width:20px;height:3px;background:'+l.color+';border-radius:2px;flex-shrink:0"></div>'
    h+='<div style="font-size:11px;flex:1;color:#8a96ab">'+(i+1)+'. ('+Math.round(Math.sqrt(Math.pow(l.x2-l.x1,2)+Math.pow(l.y2-l.y1,2)))+'px)</div>'
    h+='<button onclick="_mData.lines.splice('+i+',1);renderLineEntries();redrawMarkup()" style="background:none;border:none;cursor:pointer;color:#414e63;font-size:14px">x</button></div>'
  })
  el.innerHTML=h
}
function clearAllMarkup(){if(!confirm('Clear all dots, lines and text boxes?'))return;_mData.dots=[];_mData.textboxes=[];_mData.lines=[];_mLineStart=null;redrawMarkup();renderLegendEntries();renderTextboxEntries();renderLineEntries();updateDotCount();toast('Cleared','warn')}
async function saveMarkupData(){
  if(!_markupPlanId)return
  const{error}=await sb.from('job_walk_plans').update({markup_json:_mData}).eq('id',_markupPlanId)
  if(error)toast(error.message,'error');else toast('Markup saved')
}
function downloadMarkupPNG(){
  const canvas=document.getElementById('markup-canvas');if(!canvas)return
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='plan-markup-'+new Date().toISOString().split('T')[0]+'.png';a.click();toast('Downloading PNG…')
}

// DRAWINGS TAB (per job)
async function renderDrawingsTab(el){
  var res=await sb.from('job_walk_plans').select('*').eq('job_id',currentJobId).is('job_walk_id',null).order('created_at',{ascending:false})
  var ps=res.data||[]
  var h='<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
  h+='<label class="btn btn-p btn-sm" style="cursor:pointer">+ Upload Drawing / Plan'
  h+='<input type="file" style="display:none" multiple accept=".pdf,.png,.jpg,.jpeg" onchange="uploadJobDrawing(this.files)"></label>'
  h+='<span style="font-size:11px;color:#414e63">Upload plans or prints — click Markup to annotate with dots, lines and text</span>'
  h+='</div>'
  if(ps.length){
    ps.forEach(function(p){
      var icon=(p.file_name||'').match(/\.pdf$/i)?'PDF':'IMG'
      var dc=(p.markup_json&&p.markup_json.dots||[]).length
      var lc=(p.markup_json&&p.markup_json.lines||[]).length||0
      var tc=(p.markup_json&&p.markup_json.textboxes||[]).length
      h+='<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:7px">'
      h+='<div style="font-size:11px;font-weight:600;color:#8a96ab;background:#0c1220;border-radius:4px;padding:3px 6px">'+icon+'</div>'
      h+='<div style="flex:1;min-width:0"><div style="font-weight:500;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(p.file_name||'Drawing')+'</div>'
      h+='<div style="font-size:10px;color:#414e63;margin-top:1px">'+fd(p.created_at)+' · '+dc+' dots · '+lc+' lines · '+tc+' text</div></div>'
      h+='<button class="btn btn-sm btn-p" data-pid="'+p.id+'" data-purl="'+p.url+'" data-pname="'+(p.file_name||'Drawing')+'" onclick="openDrawingMarkup(this)">Markup</button>'
      h+='<a href="'+p.url+'" target="_blank" class="btn btn-sm">View</a>'
      h+='<button class="btn btn-sm btn-ghost" style="color:#dc2626" data-pid="'+p.id+'" data-ppath="'+(p.storage_path||'')+'" onclick="delDrawing(this)">Del</button>'
      h+='</div>'
    })
  }else{
    h+='<div style="font-size:12px;color:#414e63;padding:20px;text-align:center">No drawings uploaded yet — upload PDF or image files to begin</div>'
  }
  el.innerHTML=h
}
function openDrawingMarkup(btn){openPlanMarkup(btn.getAttribute('data-pid'),btn.getAttribute('data-purl'),btn.getAttribute('data-pname'),function(){loadJT('jt-drawings')})}
function delDrawing(btn){deleteJobPlan(btn.getAttribute('data-pid'),btn.getAttribute('data-ppath'))}
async function uploadJobDrawing(files){
  for(const f of files){
    const path='jobs/'+currentJobId+'/drawings/'+Date.now()+'_'+f.name
    const{error}=await sb.storage.from('fieldtrack-plans').upload(path,f,{upsert:true})
    if(!error){
      const{data:{publicUrl}}=sb.storage.from('fieldtrack-plans').getPublicUrl(path)
      await sb.from('job_walk_plans').insert({id:uuid(),job_id:currentJobId,job_walk_id:null,file_name:f.name,storage_path:path,url:publicUrl,markup_json:{dots:[],textboxes:[],lines:[],legend:[]},created_at:new Date().toISOString()})
    }
  }
  toast('Drawing uploaded');loadJT('jt-drawings')
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
    '<div style="font-size:11px;color:#414e63;margin-top:2px">'+({none:'No schedule',pre_start:'14 days before start',weekly:'Weekly',biweekly:'Every 2 weeks',monthly:'Monthly',milestone:'Milestones only'}[j.pm_visit_schedule]||j.pm_visit_schedule||'No schedule set')+'</div>'+
    '</div>'+
    '<button class="btn btn-p btn-sm" onclick="logPmVisitModal()">+ Log Visit</button>'+
    '</div>'+
    '<div class="sec-hdr">Visit History</div>'+
    (visitsHtml||empty('📋','No PM visits logged yet'))
}

async function logPmVisitModal(){
  var suggestedDate=new Date().toISOString().split('T')[0]
  if(currentJob&&currentJob.pm_visit_schedule==='pre_start'&&currentJob.date_start){
    var startD=new Date(currentJob.date_start)
    startD.setDate(startD.getDate()-14)
    suggestedDate=startD.toISOString().split('T')[0]
  }
  const pvHtml=
    '<div class="two"><div class="fg"><label class="fl">Visit Date *</label><input class="fi" type="date" id="pmv-date" value="'+suggestedDate+'"></div>'+
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

async function pgDispatch(){
  document.getElementById('topbar-actions').innerHTML =
    '<button class="btn btn-sm" onclick="dispatchPrevDay()">← Prev</button>'+
    '<input type="date" class="fi" id="dispatch-date" value="'+_dispatchDate+'" style="width:150px;padding:5px 10px" onchange="_dispatchDate=this.value;loadDispatchData()">'+
    '<button class="btn btn-sm" onclick="dispatchNextDay()">Next →</button>'+
    '<button class="btn btn-p btn-sm" onclick="loadDispatchData()">↻ Refresh</button>'

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
    sb.from('profiles').select('id,full_name,role,phone,company_id,companies(name)').eq('is_active',true).in('role',['technician','foreman','sub_worker','sub_lead','stager']).order('full_name'),
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
    html+='<div style="font-size:10px;color:#414e63">'+emp.role+'</div></div></div>'
    html+='</td>'
    // Schedule cell — drop zone + assigned jobs
    html+='<td class="dispatch-drop-zone" data-profile-id="'+emp.id+'" data-profile-name="'+emp.full_name.replace(/"/g,'&quot;')+'" '+
      'ondragover="event.preventDefault();this.style.background=\\'rgba(37,99,235,.08)\\'" '+
      'ondragleave="this.style.background=\\'\\'" '+
      'ondrop="handleDispatchDrop(event,this)" '+
      'style="padding:8px 10px;vertical-align:top;min-height:60px;transition:.15s">'
    if(empAssignments.length){
      html+=empAssignments.map(a=>dispatchAssignmentCard(a)).join('')
    } else {
      html+='<div class="dispatch-empty-zone" style="border:1.5px dashed rgba(255,255,255,.07);border-radius:7px;padding:10px;text-align:center;color:#1a2540;font-size:11px;min-height:44px;display:flex;align-items:center;justify-content:center">Drop job here</div>'
    }
    html+='</td></tr>'
  }

  html+='</tbody></table></div>'
  el.innerHTML=html
}

function dispatchAssignmentCard(a){
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
    (a.start_time?'<span style="font-size:10px;color:#60a5fa">⏱ '+fmtDispatchTime(a.start_time)+(a.end_time?' – '+fmtDispatchTime(a.end_time):'')+'</span>':'')+
    '<span class="badge bg-gray" style="font-size:9px">'+a.status+'</span>'+
    '</div>'+
    (a.notes?'<div style="font-size:10px;color:#8a96ab;margin-top:3px">'+a.notes+'</div>':'')+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:4px;margin-left:8px;flex-shrink:0">'+
    '<button onclick="editDispatchAssignment(\\''+a.id+'\\')" style="background:rgba(255,255,255,.08);border:none;border-radius:4px;padding:3px 7px;cursor:pointer;color:#8a96ab;font-size:10px">✏</button>'+
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
    const{error}=await sb.from('dispatch_assignments').insert({
      id:uuid(), job_id:jobId, profile_id:profileId,
      dispatch_date:_dispatchDate,
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
  const{data:a}=await sb.from('dispatch_assignments').select('*,jobs(name)').eq('id',id).single()
  if(!a)return
  const html=
    '<div style="font-size:13px;font-weight:600;margin-bottom:12px">'+a.jobs?.name+'</div>'+
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
    '</select></div>'

  modal('Edit Assignment', html, async()=>{
    const{error}=await sb.from('dispatch_assignments').update({
      start_time:v('ea-start')||null,
      end_time:v('ea-end')||null,
      notes:v('ea-notes'),
      status:v('ea-status'),
      updated_at:new Date().toISOString()
    }).eq('id',id)
    if(error){toast(error.message,'error');return}
    closeModal();toast('Updated');await loadDispatchData()
  }, 'Save')
}

async function removeDispatchAssignment(id){
  if(!confirm('Remove this assignment?'))return
  await sb.from('dispatch_assignments').delete().eq('id',id)
  toast('Removed','warn');await loadDispatchData()
}


// ══════════════════════════════════════════
// AUTO-ADVANCE JOB PHASE BASED ON PARTS
// ══════════════════════════════════════════
async function autoUpdateJobPhase(jobId){
  // Get all parts for this job
  const{data:parts}=await sb.from('job_parts').select('status,assigned_qty,ordered_qty,taken_qty,installed_qty').eq('job_id',jobId)
  const{data:job}=await sb.from('jobs').select('phase').eq('id',jobId).single()
  if(!parts||!parts.length||!job)return

  // Don't auto-advance if job is already in progress or beyond
  const activeStages=['in_progress','pre_test','pre_tested','ready_for_final','complete']
  if(activeStages.includes(job.phase))return

  const total=parts.length
  const ordered=parts.filter(p=>['ordered','staged','signed_out','partial_install','installed'].includes(p.status)).length
  const staged=parts.filter(p=>['staged','signed_out','partial_install','installed'].includes(p.status)).length
  const allOrdered=ordered===total
  const allStaged=staged===total

  let newPhase=null
  if(allStaged&&job.phase==='parts_ordered') newPhase='parts_staged'
  else if(allOrdered&&job.phase==='not_started') newPhase='parts_ordered'

  if(newPhase){
    await sb.from('jobs').update({phase:newPhase,updated_at:new Date().toISOString()}).eq('id',jobId)
    // Update local allJobs cache
    const j=allJobs.find(x=>x.id===jobId);if(j)j.phase=newPhase
    toast('Job status auto-updated to: '+STAGE_LABELS[newPhase])
  }
}
async function updateOrderStatus(orderId, newStatus){
  const{error}=await sb.from('orders').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',orderId)
  if(error){toast(error.message,'error');return}
  toast('Order marked '+newStatus);pgOrders()
}

async function stageOrderToJob(orderId, jobId){
  const{data:order}=await sb.from('orders').select('*').eq('id',orderId).single()
  if(!order){toast('Order not found','error');return}
  const items=typeof order.items==='string'?JSON.parse(order.items||'[]'):(order.items||[])
  const jobName=allJobs.find(j=>j.id===jobId)?.name||jobId
  if(!confirm('Stage to '+jobName+'?'))return
  const now=new Date().toISOString()
  for(const item of items){
    const{data:ex}=await sb.from('job_parts').select('*').eq('job_id',jobId).eq('part_id',item.barcode).maybeSingle()
    if(ex){
      await sb.from('job_parts').update({assigned_qty:ex.assigned_qty+item.qty,ordered_qty:(ex.ordered_qty||0)+item.qty,status:'staged',staged_by:ME?.full_name,staged_at:now,updated_at:now}).eq('id',ex.id)
    } else {
      await sb.from('job_parts').insert({id:uuid(),job_id:jobId,part_id:item.barcode,part_name:item.name,status:'staged',assigned_qty:item.qty,ordered_qty:item.qty,taken_qty:0,installed_qty:0,returned_qty:0,staged_by:ME?.full_name,staged_at:now,notes:item.description||'',created_at:now,updated_at:now})
    }
    const{data:inv}=await sb.from('inventory').select('qty').eq('id',item.barcode).maybeSingle()
    if(inv)await sb.from('inventory').update({qty:Math.max(0,inv.qty-item.qty),updated_at:now}).eq('id',item.barcode)
  }
  await sb.from('orders').update({status:'staged',staged_by:ME?.full_name,staged_at:now}).eq('id',orderId)
  toast('Staged '+items.length+' parts to '+jobName);pgOrders()
}

async function toggleCheckoutUI(){
  const ui=document.getElementById('checkout-ui'),btn=document.getElementById('checkout-toggle-btn')
  if(!ui)return
  const showing=ui.style.display!=='none'
  ui.style.display=showing?'none':'block'
  if(btn)btn.textContent=showing?'📤 Sign Out Parts':'✕ Cancel'
  if(!showing)await loadCheckoutUI()
}
async function loadCheckoutUI(){
  const{data:parts}=await sb.from('job_parts').select('*').eq('job_id',currentJobId).eq('status','staged')
  const{data:techs}=await sb.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')
  const ts=document.getElementById('checkout-tech')
  if(ts)ts.innerHTML='<option value="">— Select —</option>'+(techs||[]).map(t=>'<option value="'+t.full_name+'">'+t.full_name+'</option>').join('')
  const el=document.getElementById('checkout-parts-list')
  if(!el)return
  if(!(parts||[]).length){el.innerHTML='<div style="font-size:12px;color:#414e63">No staged parts on this job</div>';return}
  let html='<div style="background:#131c2e;border-radius:8px;overflow:hidden">'
  parts.forEach(p=>{
    const av=p.assigned_qty-(p.taken_qty||0);if(av<=0)return
    html+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">'+p.part_name+'</div><div style="font-size:10px;color:#414e63">'+av+' available</div></div>'
    html+='<div style="display:flex;align-items:center;gap:6px"><button data-pid="'+p.id+'" data-max="'+av+'" onclick="adjCO(this,-1)" style="width:32px;height:32px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:#0c1220;cursor:pointer;color:#e8edf5;font-size:18px">−</button>'
    html+='<input type="number" class="co-qty fi" data-pid="'+p.id+'" data-max="'+av+'" value="0" min="0" max="'+av+'" style="width:56px;text-align:center;font-size:15px;font-weight:600">'
    html+='<button data-pid="'+p.id+'" data-max="'+av+'" onclick="adjCO(this,1)" style="width:32px;height:32px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:#0c1220;cursor:pointer;color:#16a34a;font-size:18px">+</button></div></div>'
  })
  el.innerHTML=html+'</div>'
}
function adjCO(btn,d){
  const inp=document.querySelector('.co-qty[data-pid="'+btn.dataset.pid+'"]');if(!inp)return
  const v=Math.min(parseInt(btn.dataset.max)||99,Math.max(0,(parseInt(inp.value)||0)+d))
  inp.value=v;inp.style.color=v>0?'#16a34a':'#8a96ab'
}
async function commitCheckout(){
  const tech=document.getElementById('checkout-tech')?.value
  if(!tech){toast('Select a technician','error');return}
  const inputs=document.querySelectorAll('.co-qty')
  const items=[];inputs.forEach(i=>{const q=parseInt(i.value)||0;if(q>0)items.push({pid:i.dataset.pid,qty:q})})
  if(!items.length){toast('Set quantity for at least one part','error');return}
  const now=new Date().toISOString();let count=0
  for(const item of items){
    const{data:p}=await sb.from('job_parts').select('*').eq('id',item.pid).single();if(!p)continue
    const nt=(p.taken_qty||0)+item.qty
    await sb.from('job_parts').update({taken_qty:nt,status:nt>=(p.assigned_qty||0)?'signed_out':'staged',checked_out_by:tech,checked_out_at:now,updated_at:now}).eq('id',item.pid)
    await sb.from('scan_events').insert({id:uuid(),job_id:currentJobId,part_id:p.part_id,part_name:p.part_name,action:'check_out',qty:item.qty,scanned_by:ME?.full_name||'?',scanned_at:now,device_info:'Admin checkout'})
    count+=item.qty
  }
  toast(count+' parts signed out to '+tech)
  document.getElementById('checkout-ui').style.display='none'
  loadJT('jt-parts')
}

// ══════════════════════════════════════════
// ORDERS — ADD ITEMS + SUBMIT
// ══════════════════════════════════════════
function addOrdItem(){
  const bc=(document.getElementById('ord-bc')?.value||'').trim()
  if(!bc){toast('Enter a barcode or part name','error');return}
  const qty=parseInt(document.getElementById('ord-qty')?.value)||1
  const match=allCatalog.find(x=>x.barcode===bc||x.name.toLowerCase()===bc.toLowerCase())
  const part=match||{barcode:bc,name:bc,description:'',part_number:''}
  window._ordItems=window._ordItems||[]
  const ex=window._ordItems.find(i=>i.barcode===part.barcode)
  if(ex){ex.qty+=qty}
  else{window._ordItems.push({barcode:part.barcode,name:part.name,qty,description:part.description||'',part_number:part.part_number||''})}
  document.getElementById('ord-bc').value=''
  document.getElementById('ord-qty').value=1
  // Clear resolve dropdown
  const res=document.getElementById('sc-resolve');if(res)res.style.display='none'
  renderOrdItems()
  document.getElementById('ord-bc').focus()
}

function renderOrdItems(){
  const el=document.getElementById('ord-items-display');if(!el)return
  const items=window._ordItems||[]
  if(!items.length){el.innerHTML='';return}
  el.innerHTML=items.map((i,x)=>
    '<div style="display:inline-flex;align-items:center;gap:6px;background:#131c2e;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:12px;margin:2px">'+
    '<span style="font-weight:500">'+i.name+'</span>'+
    '<span style="color:#414e63">×'+i.qty+'</span>'+
    '<button data-idx="'+x+'" onclick="window._ordItems.splice(parseInt(this.dataset.idx),1);renderOrdItems()" '+
    'style="background:none;border:none;cursor:pointer;color:#414e63;font-size:15px;padding:0 2px;line-height:1">×</button>'+
    '</div>'
  ).join('')
}

async function submitOrder(){
  const jobId=document.getElementById('ord-job')?.value
  if(!jobId){toast('Select a job first','error');return}
  const items=window._ordItems||[]
  if(!items.length){toast('Add at least one part to the order','error');return}
  const notes=document.getElementById('ord-notes')?.value||''
  const orderId=uuid()
  const now=new Date().toISOString()
  const btn=document.getElementById('ord-submit-btn')
  if(btn){btn.disabled=true;btn.textContent='Submitting…'}
  // Save order
  const{error}=await sb.from('orders').insert({
    id:orderId,job_id:jobId,
    items:JSON.stringify(items),
    notes,status:'pending',
    created_by:ME?.full_name,
    created_at:now,updated_at:now
  })
  if(error){toast(error.message,'error');if(btn){btn.disabled=false;btn.textContent='Submit Order'}return}
  // Create job_parts as 'ordered' so they show on job immediately
  for(const item of items){
    const{data:ex}=await sb.from('job_parts').select('*').eq('job_id',jobId).eq('part_id',item.barcode).maybeSingle()
    if(ex){
      await sb.from('job_parts').update({
        assigned_qty:ex.assigned_qty+item.qty,
        ordered_qty:(ex.ordered_qty||0)+item.qty,
        order_id:orderId,updated_at:now
      }).eq('id',ex.id)
    } else {
      await sb.from('job_parts').insert({
        id:uuid(),job_id:jobId,
        part_id:item.barcode,part_name:item.name,
        status:'ordered',
        assigned_qty:item.qty,ordered_qty:item.qty,
        taken_qty:0,installed_qty:0,returned_qty:0,
        order_id:orderId,
        notes:item.description||'',created_at:now,updated_at:now
      })
    }
  }
  window._ordItems=[]
  renderOrdItems()
  toast('Order submitted — '+items.length+' part type(s) added to job as Ordered')
  pgOrders(jobId)
}

// ══════════════════════════════════════════
// PARTS FLOW — STAGE / SIGN OUT / INSTALL
// ══════════════════════════════════════════
// Called from Orders page: marks order as staged and updates job_parts to 'staged'
async function stageOrderToJob(orderId, jobId){
  const{data:order}=await sb.from('orders').select('*').eq('id',orderId).single()
  if(!order){toast('Order not found','error');return}
  const items=typeof order.items==='string'?JSON.parse(order.items||'[]'):(order.items||[])
  const jobName=(window._allOrderJobs||allJobs||[]).find(j=>j.id===jobId)?.name||jobId
  if(!confirm('Mark parts as STAGED for:\\n'+jobName+'\\n\\nThis means parts are physically in the warehouse ready for pickup.'))return
  const now=new Date().toISOString()
  for(const item of items){
    await sb.from('job_parts').update({
      status:'staged',staged_by:ME?.full_name,staged_at:now,updated_at:now
    }).eq('job_id',jobId).eq('part_id',item.barcode)
  }
  await sb.from('orders').update({status:'staged',staged_by:ME?.full_name,staged_at:now,updated_at:now}).eq('id',orderId)
  toast('Parts staged for '+jobName)
  await autoUpdateJobPhase(jobId)
  pgOrders(jobId)
}


// ══════════════════════════════════════════
// AUTO-ADVANCE JOB PHASE BASED ON PARTS
// ══════════════════════════════════════════
async function autoUpdateJobPhase(jobId){
  // Get all parts for this job
  const{data:parts}=await sb.from('job_parts').select('status,assigned_qty,ordered_qty,taken_qty,installed_qty').eq('job_id',jobId)
  const{data:job}=await sb.from('jobs').select('phase').eq('id',jobId).single()
  if(!parts||!parts.length||!job)return

  // Don't auto-advance if job is already in progress or beyond
  const activeStages=['in_progress','pre_test','pre_tested','ready_for_final','complete']
  if(activeStages.includes(job.phase))return

  const total=parts.length
  const ordered=parts.filter(p=>['ordered','staged','signed_out','partial_install','installed'].includes(p.status)).length
  const staged=parts.filter(p=>['staged','signed_out','partial_install','installed'].includes(p.status)).length
  const allOrdered=ordered===total
  const allStaged=staged===total

  let newPhase=null
  if(allStaged&&job.phase==='parts_ordered') newPhase='parts_staged'
  else if(allOrdered&&job.phase==='not_started') newPhase='parts_ordered'

  if(newPhase){
    await sb.from('jobs').update({phase:newPhase,updated_at:new Date().toISOString()}).eq('id',jobId)
    // Update local allJobs cache
    const j=allJobs.find(x=>x.id===jobId);if(j)j.phase=newPhase
    toast('Job status auto-updated to: '+STAGE_LABELS[newPhase])
  }
}
async function updateOrderStatus(orderId, newStatus){
  await sb.from('orders').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',orderId)
  toast('Order updated to '+newStatus)
  pgOrders(window._ordFilterJobId||null)
}

async function editOrderModal(orderId){
  const{data:order}=await sb.from('orders').select('*,jobs(name)').eq('id',orderId).single()
  if(!order){toast('Order not found','error');return}
  const items=typeof order.items==='string'?JSON.parse(order.items||'[]'):(order.items||[])
  const jobName=order.jobs?.name||order.job_id
  window._editOrdItems=JSON.parse(JSON.stringify(items))
  window._editOrdId=orderId
  window._editOrdJobId=order.job_id

  function rebuildList(){
    const el=document.getElementById('eoi-list');if(!el)return
    const its=window._editOrdItems||[]
    if(!its.length){el.innerHTML='<div style="font-size:12px;color:#414e63;padding:8px 0">No parts — add below</div>';return}
    el.innerHTML=its.map((item,idx)=>
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0c1220;border-radius:7px;margin-bottom:5px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">'+item.name+'</div>'
      +'<div style="font-size:10px;color:#414e63">'+item.barcode+'</div></div>'
      +'<div style="display:flex;align-items:center;gap:5px">'
      +'<button data-i="'+idx+'" onclick="adjEO(parseInt(this.dataset.i),-1)" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:#131c2e;cursor:pointer;color:#e8edf5;font-size:16px">−</button>'
      +'<span id="eoi-qty-'+idx+'" style="min-width:32px;text-align:center;font-size:14px;font-weight:600;padding:0 4px">'+item.qty+'</span>'
      +'<button data-i="'+idx+'" onclick="adjEO(parseInt(this.dataset.i),1)" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:#131c2e;cursor:pointer;color:#16a34a;font-size:16px">+</button>'
      +'<button data-i="'+idx+'" onclick="rmEOItem(parseInt(this.dataset.i))" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(220,38,38,.2);background:rgba(220,38,38,.1);cursor:pointer;color:#dc2626;font-size:14px">✕</button>'
      +'</div></div>'
    ).join('')
  }
  window._rebuildEOList=rebuildList

  const notesEsc=(order.notes||'').replace(/"/g,'&quot;')
  const html=\`
    <div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:7px;padding:9px 12px;margin-bottom:13px">
      <div style="font-size:10px;color:#414e63">JOB</div>
      <div style="font-size:14px;font-weight:600">\${jobName}</div>
    </div>
    <div class="fg" style="margin-bottom:8px">
      <label class="fl">Notes / PO #</label>
      <input class="fi" id="eod-notes" value="\${notesEsc}">
    </div>
    <div class="sec-hdr" style="margin-bottom:8px">Parts on this Order</div>
    <div id="eoi-list" style="margin-bottom:12px"></div>
    <div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:10px 12px">
      <div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Add Part to Order</div>
      <div style="display:flex;gap:7px">
        <input class="fi" id="eod-bc" placeholder="Barcode or part name" style="flex:1" oninput="liveResolveBC(this.value)" onkeydown="editOrdBcKey(event)">
        <input class="fi" id="eod-qty" type="number" value="1" min="1" style="width:60px">
        <button class="btn btn-p btn-sm" onclick="addEditOrdItem()">Add</button>
      </div>
      <div id="eod-resolve" style="margin-top:6px"></div>
    </div>\`

  modal('Edit Order', html, async()=>{
    const its=window._editOrdItems||[]
    if(!its.length){toast('Order must have at least one part','error');return}
    const notes=document.getElementById('eod-notes')?.value||''
    const now=new Date().toISOString()
    const{error}=await sb.from('orders').update({items:JSON.stringify(its),notes,updated_at:now}).eq('id',orderId)
    if(error){toast(error.message,'error');return}
    for(const item of its){
      const{data:ex}=await sb.from('job_parts').select('*').eq('job_id',window._editOrdJobId).eq('part_id',item.barcode).maybeSingle()
      if(ex){
        await sb.from('job_parts').update({assigned_qty:item.qty,ordered_qty:item.qty,updated_at:now}).eq('id',ex.id)
      } else {
        await sb.from('job_parts').insert({id:uuid(),job_id:window._editOrdJobId,part_id:item.barcode,part_name:item.name,status:'ordered',assigned_qty:item.qty,ordered_qty:item.qty,taken_qty:0,installed_qty:0,returned_qty:0,order_id:orderId,notes:item.description||'',created_at:now,updated_at:now})
      }
    }
    closeModal();toast('Order updated');pgOrders(window._ordFilterJobId||null)
  },'Save Changes')
  // Build list after modal is shown
  setTimeout(rebuildList,50)
}

function adjEO(idx, delta){
  const items=window._editOrdItems||[]
  if(!items[idx])return
  items[idx].qty=Math.max(1,(items[idx].qty||1)+delta)
  const el=document.getElementById('eoi-qty-'+idx)
  if(el)el.textContent=items[idx].qty
}

function rmEOItem(idx){
  if(!confirm('Remove this part?'))return
  ;(window._editOrdItems||[]).splice(idx,1)
  if(window._rebuildEOList)window._rebuildEOList()
}

function addEditOrdItem(){
  const bc=(document.getElementById('eod-bc')?.value||'').trim()
  if(!bc){toast('Enter a barcode or part name','error');return}
  const qty=parseInt(document.getElementById('eod-qty')?.value)||1
  const match=allCatalog.find(x=>x.barcode===bc||x.name.toLowerCase()===bc.toLowerCase())
  const part=match||{barcode:bc,name:bc,description:''}
  const items=window._editOrdItems||[]
  const ex=items.find(i=>i.barcode===part.barcode)
  if(ex){ex.qty+=qty;toast('Updated qty for '+part.name)}
  else{items.push({barcode:part.barcode,name:part.name,qty,description:part.description||''});toast('Added: '+part.name)}
  window._editOrdItems=items
  document.getElementById('eod-bc').value=''
  document.getElementById('eod-qty').value=1
  const res=document.getElementById('eod-resolve');if(res)res.innerHTML=''
  if(window._rebuildEOList)window._rebuildEOList()
  document.getElementById('eod-bc').focus()
}

function editOrdBcKey(e){if(e.key==='Enter'){e.preventDefault();addEditOrdItem()}}
function addEditOrdItem(){
  const bc=(document.getElementById('eod-bc')?.value||'').trim()
  if(!bc){toast('Enter a barcode or part name','error');return}
  const qty=parseInt(document.getElementById('eod-qty')?.value)||1
  const match=allCatalog.find(x=>x.barcode===bc||x.name.toLowerCase()===bc.toLowerCase())
  const part=match||{barcode:bc,name:bc,description:'',part_number:''}
  const items=window._editOrdItems||[]
  const ex=items.find(i=>i.barcode===part.barcode)
  if(ex){ex.qty+=qty;toast('Qty updated for '+part.name)}
  else{items.push({barcode:part.barcode,name:part.name,qty,description:part.description||''});toast('Added: '+part.name)}
  window._editOrdItems=items
  document.getElementById('eod-bc').value=''
  document.getElementById('eod-qty').value=1
  const res=document.getElementById('eod-resolve');if(res)res.innerHTML=''
  if(window._rebuildEditItems)window._rebuildEditItems()
  document.getElementById('eod-bc').focus()
}



// FieldAxisHQ Bid Engine — Quotes, Invoices, Templates, Reports
// No template literals used — all string concatenation for compatibility

var FAX_TRADES=['Fire Alarm','Low Voltage','Demo','Framing','Drywall','Roofing','Concrete','Electrical','Plumbing','HVAC','Finish Carpentry','Painting','Flooring','Landscaping','Other']
var FAX_DEFAULT_TRADE='Fire Alarm'

var FAX_LOSS=['Price too high','Lost to competitor','Timing / availability','Scope changed','Project cancelled','No response from GC','Other']

function faxBidStatusBadge(s){
  var m={draft:['bg-gray','Draft'],sent:['bg-blue','Sent'],viewed:['bg-purple','Viewed'],awarded:['bg-green','Awarded'],declined:['bg-red','Declined'],no_scope:['bg-gray','No Scope'],paid:['bg-green','Paid'],overdue:['bg-red','Overdue']}
  var x=m[s]||['bg-gray',s||'—']
  return '<span class="badge '+x[0]+'">'+x[1]+'</span>'
}
function faxDeriveStatus(r){
  if(!r||!r.length)return 'draft'
  if(r.some(function(x){return x.status==='no_scope'}))return 'no_scope'
  if(r.some(function(x){return x.status==='awarded'}))return 'awarded'
  if(r.every(function(x){return x.status==='declined'}))return 'declined'
  if(r.some(function(x){return x.status==='viewed'}))return 'viewed'
  if(r.some(function(x){return x.status==='sent'}))return 'sent'
  return 'draft'
}
function faxBidCalc(items,taxRate){
  var sub=(items||[]).reduce(function(s,i){return s+(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0)},0)
  var tax=sub*(parseFloat(taxRate)||0)/100
  return{subtotal:Math.round(sub*100)/100,tax:Math.round(tax*100)/100,total:Math.round((sub+tax)*100)/100}
}

function faxTmplAddLi(){window._faxBidTmplItems.push({id:'li'+Date.now(),description:'',qty:1,rate:0});faxTmplRenderLi()}

function faxNavBids(){var el=document.querySelector('.nav-item[onclick*="fax_bids"]');P("fax_bids",el)}
function faxNavInvoices(){var el=document.querySelector('.nav-item[onclick*="fax_bid_invoices"]');P("fax_bid_invoices",el)}
function faxTmplTabQt(el){faxTmplTab("qt",el)}
function faxTmplTabSb(el){faxTmplTab("sb",el)}
function faxSetRptPeriod(btn){window._faxBidRptPeriod=btn.getAttribute("data-period");pgFaxBidReports()}
function faxOpenBidById(el){var id=el.getAttribute("data-bidid");if(id)faxOpenBid(id)}
function faxOpenInvById(el){var id=el.getAttribute("data-invid");if(id)faxOpenInvoice(id)}
function faxPickBlockById(el){var id=el.getAttribute("data-blockid");if(id)faxPickBlock(id)}
function faxUseTemplateById(el){var id=el.getAttribute("data-tmplid");if(id)faxNewBid(id)}
function faxEditTemplateById(el){var id=el.getAttribute("data-tmplid");if(id)faxEditTemplate(id)}
function faxDelTemplateById(el){var id=el.getAttribute("data-tmplid");if(id)faxDelTemplate(id)}
function faxEditBlkById(el){var id=el.getAttribute("data-blkid");if(id)faxEditScopeBlock(id)}
function faxDelBlkById(el){var id=el.getAttribute("data-blkid");if(id)faxDelScopeBlock(id)}
function faxNewBidFromTmpl(sel){if(sel.value){faxNewBid(sel.value);sel.value=""}}

async function pgFaxBids(){
  var canEdit=['admin','pm','estimator','foreman','stager'].indexOf((typeof ME!=='undefined'?ME.role:window._faxRole)||'')>=0
  document.getElementById('topbar-actions').innerHTML=canEdit?'<button class="btn btn-p btn-sm" onclick="faxNewBid()">+ New Quote</button> <button class="btn btn-a btn-sm" onclick="faxQuickQuote()">📞 Quick Quote</button> <button class="btn btn-sm" onclick="faxUploadPdfQuote()">📄 PDF Quote</button>':''
  try{
    var r1=await sb.from('fax_bids').select('*,fax_bid_recipients(*)').order('created_at',{ascending:false})
    var r2=await sb.from('gcs').select('id,company,name')
    window._faxBidGcs=r2.data||[]
    window._faxBidQuotes=(r1.data||[]).map(function(q){return Object.assign({},q,{status:faxDeriveStatus(q.fax_bid_recipients)})})
    faxRenderBidList()
  }catch(e){document.getElementById('page-area').innerHTML='<div class="empty">'+e.message+'</div>'}
}

function faxRenderBidList(){
  var qs=window._faxBidQuotes||[]
  var sf=(document.getElementById('qf-search')||{}).value||''
  sf=sf.toLowerCase()
  var stf=(document.getElementById('qf-status-f')||{}).value||''
  var tf=(document.getElementById('qf-trade-f')||{}).value||''
  var estf=(document.getElementById('qf-est-f')||{}).value||''
  var sentf=(document.getElementById('qf-sent-f')||{}).value||''
  var list=qs.filter(function(q){
    if(sf){var hay=(q.number+q.project_name+q.project_address+(q.fax_bid_recipients||[]).map(function(r){return r.company+r.name}).join('')).toLowerCase();if(hay.indexOf(sf)<0)return false}
    if(stf&&q.status!==stf)return false
    if(tf&&q.trade!==tf)return false
    if(estf&&q.estimator_id!==estf)return false
    if(sentf==='unsent'&&q.status!=='draft')return false
    if(sentf==='sent'&&q.status==='draft')return false
    return true
  })
  var open=qs.filter(function(q){return['awarded','declined'].indexOf(q.status)<0})
  var awarded=qs.filter(function(q){return q.status==='awarded'})
  var closed=qs.filter(function(q){return['awarded','declined'].indexOf(q.status)>=0})
  var winRate=closed.length?Math.round(awarded.length/closed.length*100):0
  var pipeline=open.reduce(function(s,q){return s+(q.total||0)},0)
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat"><div class="stat-label">Pipeline</div><div class="stat-value" style="font-size:20px">'+fm(pipeline)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Open</div><div class="stat-value">'+open.length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Win Rate</div><div class="stat-value">'+winRate+'%</div></div>'
  h+='<div class="stat"><div class="stat-label">Awarded</div><div class="stat-value" style="color:#16a34a">'+fm(awarded.reduce(function(s,q){return s+(q.total||0)},0))+'</div></div>'
  h+='</div>'
  h+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">'
  h+='<input class="fi" id="qf-search" placeholder="Search quotes..." style="width:200px" oninput="faxRenderBidList()">'
  h+='<select class="fs" id="qf-status-f" style="width:130px" onchange="faxRenderBidList()"><option value="">All status</option>'
  h+=['draft','sent','viewed','awarded','declined','no_scope'].map(function(s){return'<option>'+s+'</option>'}).join('')
  h+='</select>'
  h+='<select class="fs" id="qf-trade-f" style="width:140px" onchange="faxRenderBidList()"><option value="">All trades</option>'
  h+=FAX_TRADES.map(function(t){return'<option>'+t+'</option>'}).join('')
  h+='</select>'
  h+='<select class="fs" id="qf-est-f" style="width:160px" onchange="faxRenderBidList()"><option value="">All estimators</option>'
  ;(window._faxBidUsers||[]).forEach(function(u){h+='<option value="'+u.id+'">'+(u.full_name||u.id)+'</option>'})
  h+='</select>'
  h+='<select class="fs" id="qf-sent-f" style="width:150px" onchange="faxRenderBidList()">'
  h+='<option value="">All quotes</option><option value="unsent">Not sent yet</option><option value="sent">Sent</option></select>'
  h+='<button class="btn btn-ghost btn-sm" onclick="faxExportBidsCsv()">Export CSV</button>'
  var tmpls=window._faxBidTemplates||[]
  if(tmpls.length){h+='<select class="fs" id="qf-from-tmpl" style="width:180px" onchange="faxNewBidFromTmpl(this)"><option value="">From template...</option>'+tmpls.map(function(t){return'<option value="'+t.id+'">'+t.name+'</option>'}).join('')+'</select>'}
  h+='</div>'
  if(list.length){
    h+='<table class="tbl"><thead><tr><th>Number</th><th>Project</th><th>Trade</th><th>Recipients</th><th>Total</th><th>Bid Due</th><th>Status</th></tr></thead><tbody>'
    list.forEach(function(q){
      var recs=q.fax_bid_recipients||[]
      var dueColor=q.bid_due_date&&new Date(q.bid_due_date)<new Date()?'#dc2626':'#8a96ab'
      h+='<tr data-bidid="'+q.id+'" onclick="faxOpenBidById(this)" style="cursor:pointer">';
      h+='<td style="font-weight:500">'+q.number+'</td>'
      h+='<td>'+( q.project_name||'—')+'<div style="font-size:10px;color:#414e63">'+(q.project_address||'')+'</div></td>'
      h+='<td>'+(q.trade||'—')+'</td>'
      h+='<td style="font-size:11px">'+recs.map(function(r){return r.company||r.name}).join(', ')+'</td>'
      h+='<td style="font-weight:500">'+fm(q.total,2)+'</td>'
      h+='<td style="color:'+dueColor+'">'+fd(q.bid_due_date)+'</td>'
      h+='<td>'+faxBidStatusBadge(q.status)+'</td>'
      h+='</tr>'
    })
    h+='</tbody></table>'
  }else{h+=empty('📄','No quotes yet. Create one to get started.')}
  document.getElementById('page-area').innerHTML=h
}

function faxNewBidFromTmpl(sel){if(sel.value){faxNewBid(sel.value);sel.value=''}}

async function faxNewBid(templateId){
  if(!window._faxBidTemplates){var r=await sb.from('fax_bid_templates').select('*');window._faxBidTemplates=r.data||[]}
  if(!window._faxBidGcs){var r=await sb.from('gcs').select('*');window._faxBidGcs=r.data||[]}
  if(!window._faxBidUsers){var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','foreman','stager','estimator']);window._faxBidUsers=r.data||[]}
  var r=await sb.from('fax_bids').select('number').order('created_at',{ascending:false}).limit(1)
  var lastN=parseInt(((r.data||[])[0]||{}).number||'Q-0000')-0||0
  var number='Q-'+String(lastN+1).padStart(4,'0')
  var prefill={line_items:[],tax_rate:0,notes:'',terms:'',trade:'',expiry_date:''}
  if(templateId){
    var tmpl=(window._faxBidTemplates||[]).filter(function(t){return t.id===templateId})[0]
    if(tmpl){prefill={trade:tmpl.trade||'',project_description:tmpl.description||'',line_items:JSON.parse(JSON.stringify(tmpl.line_items||[])),tax_rate:tmpl.tax_rate||0,notes:tmpl.notes||'',terms:tmpl.terms||'',from_template_id:tmpl.id,expiry_date:tmpl.expiry_days?new Date(Date.now()+tmpl.expiry_days*86400000).toISOString().split('T')[0]:''}}
  }
  window._faxBidEditing=Object.assign({id:null,number:number,version:1,project_name:'',project_description:'',project_address:'',project_city:'',project_state:'',project_zip:'',estimator_id:'',job_id:'',issue_date:new Date().toISOString().split('T')[0],bid_due_date:'',recipients:[],trade:FAX_DEFAULT_TRADE},prefill)
  faxRenderBidEditor()
}

async function faxOpenBid(id){
  if(!window._faxBidGcs){var r=await sb.from('gcs').select('*');window._faxBidGcs=r.data||[]}
  if(!window._faxBidUsers){var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','foreman','stager','estimator']);window._faxBidUsers=r.data||[]}
  var r1=await sb.from('fax_bids').select('*').eq('id',id).single()
  var r2=await sb.from('fax_bid_recipients').select('*').eq('quote_id',id).order('created_at',{ascending:true})
  window._faxBidEditing=Object.assign({},r1.data,{recipients:r2.data||[]})
  faxRenderBidEditor()
}

function faxRenderBidEditor(){
  var q=window._faxBidEditing
  var isNew=!q.id
  var status=faxDeriveStatus(q.recipients)
  var awarded=(q.recipients||[]).filter(function(r){return r.status==='awarded'})[0]
  var estimators=window._faxBidUsers||[]
  document.getElementById('topbar-actions').innerHTML=
    ((!isNew&&status==='awarded')?'<button class="btn btn-g btn-sm" onclick="faxGenerateInvoice()">→ Invoice</button> ':'')+
    '<button class="btn btn-sm btn-b" onclick="faxPrintQuote()">🖨 Print</button> '+
    (!isNew?'<button class="btn btn-sm btn-b" onclick="faxLinkJobId()">🔗 Link Job</button> ':'')+
    (!isNew?'<button class="btn btn-sm" onclick="faxAssignEstimator()">👤 Assign</button> ':'')+
    '<button class="btn btn-ghost btn-sm" onclick="faxSaveAsTemplate()">Save as Template</button> '+
    '<button class="btn btn-p btn-sm" onclick="faxSaveBid()">Save</button> '+
    '<button class="btn btn-ghost btn-sm" onclick="faxNavBids()">← Back</button>'
  document.getElementById('page-title').textContent=isNew?'New Quote':q.number+' — v'+q.version
  var awardedBanner=(!isNew&&status==='awarded')?'<div style="background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;color:#16a34a;font-size:13px;font-weight:500">✓ Awarded to '+(awarded?awarded.company||awarded.name:'')+'</div>':''
  var estOpts=estimators.map(function(u){return'<option value="'+u.id+'" '+(q.estimator_id===u.id?'selected':'')+'>'+(u.full_name||u.id)+'</option>'}).join('')
  var tradeOpts='<option value="">— Select —</option>'+FAX_TRADES.map(function(t){return'<option '+(q.trade===t?'selected':'')+'>'+t+'</option>'}).join('')
  var pdfBanner=q.pdf_url?'<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">'+'<span style="font-size:20px">📄</span>'+'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:#60a5fa">'+(q.pdf_filename||'Uploaded PDF Quote')+'</div>'+'<div style="font-size:11px;color:#8a96ab">PDF-based quote</div></div>'+'<a href="'+q.pdf_url+'" target="_blank" class="btn btn-sm btn-b">View PDF</a>'+'<label class="btn btn-sm" style="cursor:pointer">Replace PDF<input type="file" accept=".pdf" style="display:none" onchange="faxReplacePdf(this)"></label>'+'</div>':''
  var h=awardedBanner+pdfBanner
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">'
  h+='<div>'
  h+='<div class="card"><div class="card-title">Project Details</div>'
  h+='<div class="fg"><label class="fl">Project Name</label><input class="fi" id="qf-pname" value="'+(q.project_name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Description</label><textarea class="ft" id="qf-pdesc" style="min-height:50px">'+(q.project_description||'')+'</textarea></div>'
  h+='<div class="fg"><label class="fl">Address</label><input class="fi" id="qf-addr" value="'+(q.project_address||'')+'"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">City</label><input class="fi" id="qf-city" value="'+(q.project_city||'')+'"></div><div class="fg"><label class="fl">State</label><input class="fi" id="qf-state" value="'+(q.project_state||'')+'"></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Trade</label><select class="fs" id="qf-trade">'+tradeOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Estimator</label><select class="fs" id="qf-est"><option value="">— Select —</option>'+estOpts+'</select></div></div>'
  h+='<div class="fg"><label class="fl">Link to Job (optional)</label><select class="fs" id="qf-job"><option value="">— No linked job —</option></select></div>'
  h+='<div class="three"><div class="fg"><label class="fl">Issue Date</label><input class="fi" type="date" id="qf-issue" value="'+(q.issue_date||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Bid Due</label><input class="fi" type="date" id="qf-biddue" value="'+(q.bid_due_date||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Expiry</label><input class="fi" type="date" id="qf-exp" value="'+(q.expiry_date||'')+'"></div></div>'
  h+='</div>'
  h+='<div class="card"><div class="card-title">Notes &amp; Terms</div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="qf-notes">'+(q.notes||'')+'</textarea></div>'
  h+='<div class="fg"><label class="fl">Terms</label><textarea class="ft" id="qf-terms">'+(q.terms||'')+'</textarea></div>'
  h+='</div></div>'
  h+='<div>'
  h+='<div class="card"><div class="card-title">Line Items <div style="display:flex;gap:6px"><button class="btn btn-sm" onclick="faxAddLi()">+ Add</button><button class="btn btn-sm" onclick="faxInsertBlock()">Scope Block</button><label class="btn btn-sm" style="cursor:pointer">CSV/XLS<input type="file" accept=".csv,.xlsx" style="display:none" onchange="faxImportLiFile(this)"></label></div></div>'
  h+='<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 26px;gap:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase">'
  h+='<div>Description</div><div style="text-align:right">Qty</div><div style="text-align:right">Rate</div><div style="text-align:right">Total</div><div></div></div>'
  h+='<div id="qf-li-body"></div>'
  h+='<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:8px">'
  h+='<div style="display:flex;justify-content:space-between;font-size:12px;color:#8a96ab;margin-bottom:4px"><span>Subtotal</span><span id="qf-subtotal">—</span></div>'
  h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#8a96ab;margin-bottom:6px"><span>Tax %</span>'
  h+='<div style="display:flex;align-items:center;gap:8px"><input class="fi" type="number" id="qf-tax" value="'+(q.tax_rate||0)+'" min="0" max="100" step="0.1" style="width:65px;padding:4px 7px;text-align:right" oninput="faxUpdateTotals()"><span id="qf-taxamt">—</span></div></div>'
  h+='<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:600;border-top:1px solid rgba(255,255,255,.06);padding-top:8px"><span>Total</span><span id="qf-total" style="color:#e8edf5">—</span></div>'
  h+='</div></div>'
  h+='<div class="card"><div class="card-title">Recipients'
  var gcOpts='<option value="">+ From GC list...</option>'+(window._faxBidGcs||[]).map(function(g){return'<option value="'+g.id+'">'+(g.company||g.name)+'</option>'}).join('')
  h+='<div style="display:flex;gap:6px"><select class="fs" id="qf-gc-pick" style="width:160px">'+gcOpts+'</select><button class="btn btn-sm" onclick="faxAddRecipFromGC()">Add</button></div></div>'
  h+='<div id="qf-recs-body"></div>'
  h+='<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px">'
  h+='<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;margin-bottom:6px">Or add manually</div>'
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:end">'
  h+='<div><label class="fl">Name</label><input class="fi" id="qf-rn" placeholder="Contact name"></div>'
  h+='<div><label class="fl">Company</label><input class="fi" id="qf-rc" placeholder="Company"></div>'
  h+='<div><label class="fl">Email *</label><input class="fi" id="qf-re" type="email" placeholder="email@gc.com"></div>'
  h+='<button class="btn btn-sm btn-p" onclick="faxAddRecipManual()">Add</button>'
  h+='</div></div></div>'
  if(!isNew&&q.revisions&&q.revisions.length){
    h+='<div class="card"><div class="card-title">Revision History</div>'
    q.revisions.forEach(function(r){h+='<div style="font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);color:#8a96ab">v'+r.version+' · '+fd(r.changed_at)+' · '+(r.changed_by||'')+'</div>'})
    h+='</div>'
  }
  h+='</div></div>'
  document.getElementById('page-area').innerHTML=h
  faxRenderLiBody()
  faxRenderRecsBody()
  faxUpdateTotals()
  // Populate jobs dropdown async
  sb.from('jobs').select('id,name').order('name',{ascending:true}).then(function(res){
    var sel=document.getElementById('qf-job')
    if(!sel)return
    ;(res.data||[]).forEach(function(job){var o=document.createElement('option');o.value=job.id;o.textContent=job.name||job.id;if(q.job_id===job.id)o.selected=true;sel.appendChild(o)})
  })
}

function faxRenderLiBody(){
  var q=window._faxBidEditing
  var el=document.getElementById('qf-li-body')
  if(!el)return
  if(!q.line_items||!q.line_items.length){el.innerHTML='<div style="font-size:12px;color:#414e63;padding:8px 0">No line items yet</div>';faxUpdateTotals();return}
  var h=''
  q.line_items.forEach(function(li,i){
    h+='<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 26px;gap:4px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<input class="fi" value="'+(li.description||'')+'" placeholder="Description" style="padding:5px 7px;font-size:12px" oninput="window._faxBidEditing.line_items['+i+'].description=this.value">'
    h+='<input class="fi" type="number" value="'+(li.qty||'')+'" style="padding:5px 7px;font-size:12px;text-align:right" oninput="window._faxBidEditing.line_items['+i+'].qty=parseFloat(this.value)||0;faxUpdateTotals()">'
    h+='<input class="fi" type="number" value="'+(li.rate||'')+'" step="0.01" style="padding:5px 7px;font-size:12px;text-align:right" oninput="window._faxBidEditing.line_items['+i+'].rate=parseFloat(this.value)||0;faxUpdateTotals()">'
    h+='<div style="font-size:12px;text-align:right;padding-right:4px;color:#8a96ab">'+fm((li.qty||0)*(li.rate||0),2)+'</div>'
    h+='<button class="btn btn-sm btn-ghost" style="color:#dc2626;padding:2px 6px" onclick="window._faxBidEditing.line_items.splice('+i+',1);faxRenderLiBody();faxUpdateTotals()">×</button>'
    h+='</div>'
  })
  el.innerHTML=h
  faxUpdateTotals()
}
function faxAddLi(){window._faxBidEditing.line_items.push({id:'li'+Date.now(),description:'',qty:1,rate:0});faxRenderLiBody();faxUpdateTotals()}
function faxUpdateTotals(){
  var q=window._faxBidEditing;if(!q)return
  var tax=parseFloat((document.getElementById('qf-tax')||{}).value)||0
  var t=faxBidCalc(q.line_items,tax)
  var s=document.getElementById('qf-subtotal');if(s)s.textContent=fm(t.subtotal,2)
  var ta=document.getElementById('qf-taxamt');if(ta)ta.textContent=fm(t.tax,2)
  var tot=document.getElementById('qf-total');if(tot)tot.textContent=fm(t.total,2)
}
function faxImportLiFile(input){
  var file=input.files[0];if(!file)return
  var fr=new FileReader()
  fr.onload=function(e){
    var lines=e.target.result.split('\\n').filter(function(l){return l.trim()})
    var hdr=null
    lines.forEach(function(line){
      var cols=line.match(/("(?:[^"]|"")*"|[^,]*)/g).map(function(v){return v.replace(/^"|"$/g,'').replace(/""/g,'"')})
      if(!hdr){hdr=cols.map(function(h){return h.trim().toLowerCase()});return}
      var di=['description','item','name'].map(function(k){return hdr.indexOf(k)}).filter(function(i){return i>=0})[0]||0
      var qi=['qty','quantity'].map(function(k){return hdr.indexOf(k)}).filter(function(i){return i>=0})[0]||1
      var ri=['rate','price','cost','unit'].map(function(k){return hdr.indexOf(k)}).filter(function(i){return i>=0})[0]||2
      var desc=(cols[di]||'').trim();if(!desc)return
      window._faxBidEditing.line_items.push({id:'li'+Date.now()+Math.random(),description:desc,qty:parseFloat(cols[qi])||1,rate:parseFloat(cols[ri])||0})
    })
    faxRenderLiBody();faxUpdateTotals();toast('Imported from '+file.name)
  }
  fr.readAsText(file);input.value=''
}
async function faxInsertBlock(){
  if(!window._faxBidScopeBlocks){var r=await sb.from('fax_bid_scope_blocks').select('*').order('name',{ascending:true});window._faxBidScopeBlocks=r.data||[]}
  var blocks=window._faxBidScopeBlocks
  var h=blocks.length?'<div style="display:flex;flex-direction:column;gap:6px">':''
  blocks.forEach(function(b){
    h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#131c2e;border-radius:7px;cursor:pointer;border:1px solid rgba(255,255,255,.07)" data-blockid="'+b.id+'" onclick="faxPickBlockById(this)">'
    h+='<div><div style="font-size:13px;font-weight:500">'+b.name+'</div><div style="font-size:10px;color:#414e63">'+(b.trade||'All trades')+' · '+(b.line_items||[]).length+' items</div></div>'
    h+='<button class="btn btn-sm btn-p">Insert</button></div>'
    h+='<div><div style="font-size:13px;font-weight:500">'+b.name+'</div><div style="font-size:10px;color:#414e63">'+(b.trade||'All trades')+' · '+(b.line_items||[]).length+' items</div></div>'
    h+='<button class="btn btn-sm btn-p">Insert</button></div>'
  })
  if(blocks.length)h+='</div>'
  modal('Insert Scope Block',blocks.length?h:empty('📦','No scope blocks yet. Create them in Templates.'),null,'',true)
}
function faxPickBlock(id){
  var b=(window._faxBidScopeBlocks||[]).filter(function(x){return x.id===id})[0];if(!b)return
  var items=JSON.parse(JSON.stringify(b.line_items||[])).map(function(li){return Object.assign({},li,{id:'li'+Date.now()+Math.random()})})
  window._faxBidEditing.line_items=window._faxBidEditing.line_items.concat(items)
  faxRenderLiBody();faxUpdateTotals();closeModal();toast('Inserted "'+b.name+'"')
}

function faxRenderRecsBody(){
  var el=document.getElementById('qf-recs-body');if(!el)return
  var recs=(window._faxBidEditing||{}).recipients||[]
  if(!recs.length){el.innerHTML='<div style="font-size:12px;color:#414e63;padding:6px 0">No recipients yet</div>';return}
  var h=''
  recs.forEach(function(r,i){
    h+='<div style="background:#131c2e;border-radius:7px;padding:9px 11px;margin-bottom:6px;border:1px solid rgba(255,255,255,.06)">'
    h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'
    h+='<div><div style="font-size:13px;font-weight:500">'+(r.company||r.name||'')+'</div>'
    h+='<div style="font-size:11px;color:#8a96ab">'+(r.name||'')+' '+( r.email||'')+'</div>'
    if(r.signature_name)h+='<div style="font-size:10px;color:#16a34a;margin-top:3px">✓ Signed by '+r.signature_name+(r.signature_title?' ('+r.signature_title+')':'')+'</div>'
    if(r.decline_reason)h+='<div style="font-size:10px;color:#dc2626;margin-top:3px">Declined: '+r.decline_reason+'</div>'
    h+='</div>'
    h+='<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'+faxBidStatusBadge(r.status||'draft')
    if(r.id){
      h+='<div style="display:flex;gap:4px;margin-top:4px">'
      if(['draft','sent'].indexOf(r.status)>=0)h+='<button class="btn btn-sm btn-p" onclick="faxSendRecipIdx('+i+')">Send</button>'
      h+='<button class="btn btn-sm btn-ghost" onclick="faxCopyLinkIdx('+i+')">Copy Link</button>'
      if(['draft','sent','viewed'].indexOf(r.status)>=0)h+='<button class="btn btn-sm" style="color:#dc2626" onclick="faxDeclineRecipIdx('+i+')">Decline</button>'
    if(['draft','sent','viewed'].indexOf(r.status)>=0)h+='<button class="btn btn-sm" style="color:#8a96ab" onclick="faxNoScopeRecipIdx('+i+')">No Scope</button>'
      h+='</div>'
    }else{h+='<div style="font-size:10px;color:#414e63;margin-top:4px">Save first to send</div>'}
    h+='</div></div>'
    if(!r.id)h+='<button class="btn btn-ghost btn-sm" style="color:#dc2626;margin-top:5px" onclick="window._faxBidEditing.recipients.splice('+i+',1);faxRenderRecsBody()">Remove</button>'
    h+='</div>'
  })
  el.innerHTML=h
}
function faxAddRecipFromGC(){
  var sel=document.getElementById('qf-gc-pick');var id=sel?sel.value:'';if(!id)return
  var gc=(window._faxBidGcs||[]).filter(function(g){return g.id===id})[0];if(!gc)return
  window._faxBidEditing.recipients.push({gc_id:gc.id,name:gc.name||'',company:gc.company||'',email:gc.email||'',status:'draft'})
  sel.value='';faxRenderRecsBody();toast('Added: '+(gc.company||gc.name))
}
function faxAddRecipManual(){
  var name=((document.getElementById('qf-rn')||{}).value||'').trim()
  var company=((document.getElementById('qf-rc')||{}).value||'').trim()
  var email=((document.getElementById('qf-re')||{}).value||'').trim()
  if(!email){toast('Email required','error');return}
  window._faxBidEditing.recipients.push({name:name,company:company,email:email,status:'draft'})
  var rn=document.getElementById('qf-rn');if(rn)rn.value=''
  var rc=document.getElementById('qf-rc');if(rc)rc.value=''
  var re=document.getElementById('qf-re');if(re)re.value=''
  faxRenderRecsBody()
}
async function faxSendRecipIdx(i){var r=(window._faxBidEditing||{}).recipients&&window._faxBidEditing.recipients[i];if(r&&r.id)await faxSendRecip(r.id)}
async function faxCopyLinkIdx(i){var r=(window._faxBidEditing||{}).recipients&&window._faxBidEditing.recipients[i];if(r&&r.id)await faxCopyLink(r.id)}
async function faxDeclineRecipIdx(i){var r=(window._faxBidEditing||{}).recipients&&window._faxBidEditing.recipients[i];if(r&&r.id)await faxDeclineRecip(r.id,i)}
async function faxSendRecip(recId){
  if(!window._faxBidEditing||!window._faxBidEditing.id){toast('Save the quote first','warn');return}
  try{
    var res=await fetch('/api/qf/recipients/'+recId+'/send',{method:'POST',headers:{Authorization:'Bearer '+(window._sbToken||''),'Content-Type':'application/json'}})
    var d=await res.json()
    if(d.error)throw new Error(d.error)
    toast('Email sent!');faxOpenBid(window._faxBidEditing.id)
  }catch(e){toast(e.message,'error')}
}
async function faxCopyLink(recId){
  if(!window._faxBidEditing||!window._faxBidEditing.id){toast('Save the quote first','warn');return}
  try{
    var res=await fetch('/api/qf/recipients/'+recId+'/link',{headers:{Authorization:'Bearer '+(window._sbToken||'')}})
    var d=await res.json()
    if(navigator.clipboard){navigator.clipboard.writeText(d.url).then(function(){toast('Link copied!')}).catch(function(){prompt('Copy this award link:',d.url)})}
    else{prompt('Copy this award link:',d.url)}
  }catch(e){toast(e.message,'error')}
}
async function faxNoScopeRecipIdx(i){
  var r=(window._faxBidEditing||{}).recipients&&window._faxBidEditing.recipients[i]
  if(r&&r.id)await faxNoScopeRecip(r.id,i)
}
async function faxNoScopeRecip(recId,idx){
  var res=await sb.from('fax_bid_recipients').update({status:'no_scope',declined_at:new Date().toISOString(),decline_reason:'No scope required'}).eq('id',recId)
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidEditing.recipients[idx]=Object.assign({},window._faxBidEditing.recipients[idx],{status:'no_scope',decline_reason:'No scope required'})
  faxRenderRecsBody();toast('Marked: No Scope Required')
}
async function faxDeclineRecip(recId,idx){
  var reason=prompt('Decline reason? Type one of: Price too high, Lost to competitor, Timing, Scope changed, Project cancelled, No response, Other')||'Other'
  var res=await sb.from('fax_bid_recipients').update({status:'declined',declined_at:new Date().toISOString(),decline_reason:reason}).eq('id',recId)
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidEditing.recipients[idx]=Object.assign({},window._faxBidEditing.recipients[idx],{status:'declined',decline_reason:reason})
  faxRenderRecsBody();toast('Marked declined')
}

async function faxSaveBid(){
  var q=window._faxBidEditing;if(!q)return
  q.project_name=((document.getElementById('qf-pname')||{}).value||'').trim()
  q.project_description=((document.getElementById('qf-pdesc')||{}).value||'').trim()
  q.project_address=((document.getElementById('qf-addr')||{}).value||'').trim()
  q.project_city=((document.getElementById('qf-city')||{}).value||'').trim()
  q.project_state=((document.getElementById('qf-state')||{}).value||'').trim()
  q.trade=(document.getElementById('qf-trade')||{}).value||''
  q.estimator_id=(document.getElementById('qf-est')||{}).value||null
  q.job_id=(document.getElementById('qf-job')||{}).value||null
  q.issue_date=(document.getElementById('qf-issue')||{}).value||null
  q.bid_due_date=(document.getElementById('qf-biddue')||{}).value||null
  q.expiry_date=(document.getElementById('qf-exp')||{}).value||null
  q.tax_rate=parseFloat((document.getElementById('qf-tax')||{}).value)||0
  q.notes=((document.getElementById('qf-notes')||{}).value||'').trim()
  q.terms=((document.getElementById('qf-terms')||{}).value||'').trim()
  var tots=faxBidCalc(q.line_items,q.tax_rate)
  Object.assign(q,tots)
  try{
    // Upload replacement PDF if selected
    if(window._faxPdfFile){
      toast('Uploading PDF...')
      var up=await uploadToCloudinary(window._faxPdfFile,'fieldaxishq/quotes')
      if(up&&up.url){q.pdf_url=up.url;q.pdf_filename=window._faxPdfFile.name;q.quote_type='pdf';window._faxPdfFile=null}
    }
    var savedId=q.id
    if(q.id){
      var cur=await sb.from('fax_bids').select('line_items,tax_rate,subtotal,total,version,revisions').eq('id',q.id).single()
      var revisions=(cur.data||{}).revisions||[]
      if(JSON.stringify((cur.data||{}).line_items)!==JSON.stringify(q.line_items)||(cur.data||{}).tax_rate!==q.tax_rate){
        revisions.push({version:(cur.data||{}).version,snapshot:{line_items:(cur.data||{}).line_items,tax_rate:(cur.data||{}).tax_rate,total:(cur.data||{}).total},changed_by:(window._faxUser||{}).full_name||'',changed_at:new Date().toISOString()})
        q.revisions=revisions
      }
      var res=await sb.from('fax_bids').update({project_name:q.project_name,project_description:q.project_description,project_address:q.project_address,project_city:q.project_city,project_state:q.project_state,trade:q.trade,estimator_id:q.estimator_id,job_id:q.job_id,issue_date:q.issue_date,bid_due_date:q.bid_due_date,expiry_date:q.expiry_date,line_items:q.line_items,tax_rate:q.tax_rate,subtotal:q.subtotal,tax:q.tax,total:q.total,notes:q.notes,terms:q.terms,revisions:q.revisions||[],pdf_url:q.pdf_url||null,pdf_filename:q.pdf_filename||null,quote_type:q.quote_type||null,updated_at:new Date().toISOString()}).eq('id',q.id)
      if(res.error)throw new Error(res.error.message)
    }else{
      var newId=uuid()
      var res=await sb.from('fax_bids').insert({id:newId,number:q.number,version:1,project_name:q.project_name,project_description:q.project_description,project_address:q.project_address,project_city:q.project_city,project_state:q.project_state,project_zip:q.project_zip||'',trade:q.trade,estimator_id:q.estimator_id,job_id:q.job_id,issue_date:q.issue_date,bid_due_date:q.bid_due_date,expiry_date:q.expiry_date,line_items:q.line_items,tax_rate:q.tax_rate,subtotal:q.subtotal,tax:q.tax,total:q.total,notes:q.notes,terms:q.terms,from_template_id:q.from_template_id||null,revisions:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      if(res.error)throw new Error(res.error.message)
      savedId=newId;window._faxBidEditing.id=savedId
    }
    var newRecs=(q.recipients||[]).filter(function(r){return!r.id})
    for(var i=0;i<newRecs.length;i++){
      var r=newRecs[i]
      var token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function(b){return b.toString(16).padStart(2,'0')}).join('')
      var ins=await sb.from('fax_bid_recipients').insert({id:uuid(),quote_id:savedId,gc_id:r.gc_id||null,name:r.name,company:r.company,email:r.email,status:'draft',token:token,created_at:new Date().toISOString()}).select().single()
      if(ins.data)Object.assign(r,ins.data)
    }
    toast('Saved: '+q.number)
    faxRenderRecsBody()
    document.getElementById('page-title').textContent=q.number+' — v'+(q.version||1)
  }catch(e){toast(e.message,'error')}
}
async function faxSaveAsTemplate(){
  var q=window._faxBidEditing;if(!q)return
  var name=prompt('Template name:',q.project_name||q.trade||'New Template');if(!name)return
  var res=await sb.from('fax_bid_templates').insert({id:uuid(),name:name,trade:q.trade||'',description:q.project_description||'',line_items:q.line_items||[],tax_rate:q.tax_rate||0,notes:q.notes||'',terms:q.terms||'',expiry_days:30,created_at:new Date().toISOString()})
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidTemplates=null;toast('Template saved: '+name)
}
async function faxGenerateInvoice(){
  var q=window._faxBidEditing;if(!q||!q.id)return
  var awarded=(q.recipients||[]).filter(function(r){return r.status==='awarded'})[0]
  var r=await sb.from('fax_bid_invoices').select('number').order('created_at',{ascending:false}).limit(1)
  var lastN=parseInt(((r.data||[])[0]||{}).number||'INV-0000')-0||0
  var number='INV-'+String(lastN+1).padStart(4,'0')
  var tots=faxBidCalc(q.line_items,q.tax_rate)
  var res=await sb.from('fax_bid_invoices').insert({id:uuid(),number:number,quote_id:q.id,job_id:q.job_id,client_name:(awarded||{}).name||'',client_company:(awarded||{}).company||'',client_email:(awarded||{}).email||'',project_name:q.project_name,project_address:q.project_address,project_city:q.project_city,project_state:q.project_state||'',project_zip:q.project_zip||'',issue_date:new Date().toISOString().split('T')[0],line_items:q.line_items,tax_rate:q.tax_rate,subtotal:tots.subtotal,tax:tots.tax,total:tots.total,notes:q.notes,terms:q.terms,status:'draft',created_at:new Date().toISOString()})
  if(res.error){toast(res.error.message,'error');return}
  toast('Invoice created: '+number);P('fax_bid_invoices',null)
}

async function pgFaxInvoices(){
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="faxNewInvoice()">+ New Invoice</button>'
  var res=await sb.from('fax_bid_invoices').select('*').order('created_at',{ascending:false})
  var list=res.data||[]
  var unpaid=list.filter(function(i){return i.status!=='paid'}).reduce(function(s,i){return s+(i.total||0)},0)
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat"><div class="stat-label">Total</div><div class="stat-value">'+list.length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Unpaid</div><div class="stat-value" style="color:#d97706">'+fm(unpaid)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Paid</div><div class="stat-value" style="color:#16a34a">'+list.filter(function(i){return i.status==='paid'}).length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Draft</div><div class="stat-value">'+list.filter(function(i){return i.status==='draft'}).length+'</div></div>'
  h+='</div>'
  if(list.length){
    h+='<table class="tbl"><thead><tr><th>Number</th><th>Project</th><th>Client</th><th>Total</th><th>Due Date</th><th>Status</th></tr></thead><tbody>'
    list.forEach(function(inv){
      var dueColor=inv.due_date&&new Date(inv.due_date)<new Date()&&inv.status!=='paid'?'#dc2626':'#8a96ab'
      h+='<tr data-invid="'+inv.id+'" onclick="faxOpenInvById(this)" style="cursor:pointer">';
      h+='<td style="font-weight:500">'+inv.number+'</td>'
      h+='<td>'+(inv.project_name||'—')+'</td>'
      h+='<td>'+(inv.client_company||inv.client_name||'—')+'</td>'
      h+='<td style="font-weight:500">'+fm(inv.total,2)+'</td>'
      h+='<td style="color:'+dueColor+'">'+fd(inv.due_date)+'</td>'
      h+='<td>'+faxBidStatusBadge(inv.status)+'</td>'
      h+='</tr>'
    })
    h+='</tbody></table>'
  }else{h+=empty('🧾','No invoices yet')}
  document.getElementById('page-area').innerHTML=h
}
async function faxOpenInvoice(id){
  var res=await sb.from('fax_bid_invoices').select('*').eq('id',id).single()
  window._faxBidInv=res.data;faxRenderInvoiceEditor()
}
async function faxNewInvoice(){
  var r=await sb.from('fax_bid_invoices').select('number').order('created_at',{ascending:false}).limit(1)
  var lastN=parseInt(((r.data||[])[0]||{}).number||'INV-0000')-0||0
  window._faxBidInv={id:null,number:'INV-'+String(lastN+1).padStart(4,'0'),client_name:'',client_company:'',client_email:'',project_name:'',project_address:'',issue_date:new Date().toISOString().split('T')[0],due_date:'',line_items:[],tax_rate:0,notes:'',terms:'',status:'draft'}
  faxRenderInvoiceEditor()
}
function faxRenderInvoiceEditor(){
  var inv=window._faxBidInv
  document.getElementById('topbar-actions').innerHTML=
    (inv.id&&inv.status!=='paid'?'<button class="btn btn-g btn-sm" onclick="faxMarkInvPaid()">Mark Paid</button> ':'')+
    (inv.id&&inv.status==='draft'?'<button class="btn btn-a btn-sm" onclick="faxMarkInvSent()">Mark Sent</button> ':'')+
    '<button class="btn btn-p btn-sm" onclick="faxSaveInvoice()">Save</button> '+
    '<button class="btn btn-ghost btn-sm" onclick="faxNavInvoices()">← Back</button>'
  document.getElementById('page-title').textContent=inv.id?inv.number+' — Invoice':'New Invoice'
  var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">'
  h+='<div><div class="card"><div class="card-title">Client &amp; Project</div>'
  h+='<div class="two"><div class="fg"><label class="fl">Client Name</label><input class="fi" id="qfi-cn" value="'+(inv.client_name||'')+'"></div><div class="fg"><label class="fl">Company</label><input class="fi" id="qfi-co" value="'+(inv.client_company||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Email</label><input class="fi" id="qfi-em" type="email" value="'+(inv.client_email||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Project Name</label><input class="fi" id="qfi-pn" value="'+(inv.project_name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Address</label><input class="fi" id="qfi-pa" value="'+(inv.project_address||'')+'"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Issue Date</label><input class="fi" type="date" id="qfi-iss" value="'+(inv.issue_date||'')+'"></div><div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="qfi-due" value="'+(inv.due_date||'')+'"></div></div>'
  h+='</div><div class="card"><div class="card-title">Notes &amp; Terms</div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="qfi-notes">'+(inv.notes||'')+'</textarea></div>'
  h+='<div class="fg"><label class="fl">Terms</label><textarea class="ft" id="qfi-terms">'+(inv.terms||'')+'</textarea></div>'
  h+='</div></div>'
  h+='<div><div class="card"><div class="card-title">Line Items <button class="btn btn-sm" onclick="faxInvAddLi()">+ Add</button></div>'
  h+='<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 26px;gap:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase">'
  h+='<div>Description</div><div style="text-align:right">Qty</div><div style="text-align:right">Rate</div><div style="text-align:right">Total</div><div></div></div>'
  h+='<div id="qfi-li-body"></div>'
  h+='<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:8px">'
  h+='<div style="display:flex;justify-content:space-between;font-size:12px;color:#8a96ab;margin-bottom:4px"><span>Subtotal</span><span id="qfi-sub">—</span></div>'
  h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#8a96ab;margin-bottom:6px"><span>Tax %</span>'
  h+='<div style="display:flex;align-items:center;gap:8px"><input class="fi" type="number" id="qfi-tax" value="'+(inv.tax_rate||0)+'" step="0.1" style="width:65px;padding:4px 7px;text-align:right" oninput="faxInvUpdateTotals()"><span id="qfi-taxamt">—</span></div></div>'
  h+='<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:600;border-top:1px solid rgba(255,255,255,.06);padding-top:8px"><span>Total</span><span id="qfi-total">—</span></div>'
  h+='</div></div></div></div>'
  document.getElementById('page-area').innerHTML=h
  faxInvRenderLi();faxInvUpdateTotals()
}
function faxInvRenderLi(){
  var el=document.getElementById('qfi-li-body');if(!el)return
  var items=(window._faxBidInv||{}).line_items||[]
  if(!items.length){el.innerHTML='<div style="font-size:12px;color:#414e63;padding:8px 0">No line items</div>';return}
  var h=''
  items.forEach(function(li,i){
    h+='<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 26px;gap:4px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<input class="fi" value="'+(li.description||'')+'" style="padding:5px 7px;font-size:12px" oninput="window._faxBidInv.line_items['+i+'].description=this.value">'
    h+='<input class="fi" type="number" value="'+(li.qty||'')+'" style="padding:5px 7px;font-size:12px;text-align:right" oninput="window._faxBidInv.line_items['+i+'].qty=parseFloat(this.value)||0;faxInvUpdateTotals()">'
    h+='<input class="fi" type="number" value="'+(li.rate||'')+'" step="0.01" style="padding:5px 7px;font-size:12px;text-align:right" oninput="window._faxBidInv.line_items['+i+'].rate=parseFloat(this.value)||0;faxInvUpdateTotals()">'
    h+='<div style="font-size:12px;text-align:right;padding-right:4px;color:#8a96ab">'+fm((li.qty||0)*(li.rate||0),2)+'</div>'
    h+='<button class="btn btn-sm btn-ghost" style="color:#dc2626;padding:2px 6px" onclick="window._faxBidInv.line_items.splice('+i+',1);faxInvRenderLi();faxInvUpdateTotals()">×</button>'
    h+='</div>'
  })
  el.innerHTML=h
}
function faxInvAddLi(){(window._faxBidInv.line_items=window._faxBidInv.line_items||[]).push({id:'li'+Date.now(),description:'',qty:1,rate:0});faxInvRenderLi();faxInvUpdateTotals()}
function faxInvUpdateTotals(){
  var inv=window._faxBidInv;if(!inv)return
  var tax=parseFloat((document.getElementById('qfi-tax')||{}).value)||0
  var t=faxBidCalc(inv.line_items,tax)
  var s=document.getElementById('qfi-sub');if(s)s.textContent=fm(t.subtotal,2)
  var ta=document.getElementById('qfi-taxamt');if(ta)ta.textContent=fm(t.tax,2)
  var tot=document.getElementById('qfi-total');if(tot)tot.textContent=fm(t.total,2)
}
async function faxSaveInvoice(){
  var inv=window._faxBidInv
  inv.client_name=((document.getElementById('qfi-cn')||{}).value||'').trim()
  inv.client_company=((document.getElementById('qfi-co')||{}).value||'').trim()
  inv.client_email=((document.getElementById('qfi-em')||{}).value||'').trim()
  inv.project_name=((document.getElementById('qfi-pn')||{}).value||'').trim()
  inv.project_address=((document.getElementById('qfi-pa')||{}).value||'').trim()
  inv.issue_date=(document.getElementById('qfi-iss')||{}).value||null
  inv.due_date=(document.getElementById('qfi-due')||{}).value||null
  inv.tax_rate=parseFloat((document.getElementById('qfi-tax')||{}).value)||0
  inv.notes=((document.getElementById('qfi-notes')||{}).value||'').trim()
  inv.terms=((document.getElementById('qfi-terms')||{}).value||'').trim()
  var tots=faxBidCalc(inv.line_items,inv.tax_rate);Object.assign(inv,tots)
  var res=inv.id?await sb.from('fax_bid_invoices').update(Object.assign({},inv,{updated_at:new Date().toISOString()})).eq('id',inv.id)
    :await sb.from('fax_bid_invoices').insert(Object.assign({},inv,{id:uuid(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()}))
  if(res.error){toast(res.error.message,'error');return}
  toast('Saved: '+inv.number)
}
async function faxMarkInvPaid(){
  var res=await sb.from('fax_bid_invoices').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',window._faxBidInv.id)
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidInv.status='paid';faxRenderInvoiceEditor();toast('Marked paid')
}
async function faxMarkInvSent(){
  var res=await sb.from('fax_bid_invoices').update({status:'sent'}).eq('id',window._faxBidInv.id)
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidInv.status='sent';faxRenderInvoiceEditor();toast('Marked sent')
}

async function pgFaxBidTemplates(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-p btn-sm" onclick="faxNewTemplate()">+ Template</button> '+
    '<button class="btn btn-sm" onclick="faxNewScopeBlock()">+ Scope Block</button> '+
    '<button class="btn btn-ghost btn-sm" onclick="faxExportTemplates()">Export</button>'
  var r1=await sb.from('fax_bid_templates').select('*').order('name',{ascending:true})
  var r2=await sb.from('fax_bid_scope_blocks').select('*').order('name',{ascending:true})
  window._faxBidTemplates=r1.data||[];window._faxBidScopeBlocks=r2.data||[]
  var h='<div class="tab-bar" id="tmpl-tabs">'
  h+='<div class="tab active" onclick="faxTmplTabQt(this)">Quote Templates ('+(r1.data||[]).length+')</div>'
  h+='<div class="tab" onclick="faxTmplTabSb(this)">Scope Blocks ('+(r2.data||[]).length+')</div>'
  h+='</div><div id="tmpl-body" style="margin-top:14px"></div>'
  document.getElementById('page-area').innerHTML=h
  faxRenderTemplateList('qt')
}
function faxTmplTab(tab,el){
  document.querySelectorAll('#tmpl-tabs .tab').forEach(function(t){t.classList.remove('active')})
  el.classList.add('active');faxRenderTemplateList(tab)
}
function faxRenderTemplateList(tab){
  var el=document.getElementById('tmpl-body');if(!el)return
  if(tab==='qt'){
    var t=window._faxBidTemplates||[]
    if(!t.length){el.innerHTML=empty('📋','No quote templates yet');return}
    var h='<table class="tbl"><thead><tr><th>Name</th><th>Trade</th><th>Items</th><th>Subtotal</th><th></th></tr></thead><tbody>'
    t.forEach(function(tmpl){
      h+='<tr><td style="font-weight:500">'+tmpl.name+'</td><td>'+(tmpl.trade||'—')+'</td>'
      h+='<td>'+(tmpl.line_items||[]).length+'</td>'
      h+='<td>'+fm((tmpl.line_items||[]).reduce(function(s,i){return s+(i.qty||0)*(i.rate||0)},0),2)+'</td>'
      h+='<td style="display:flex;gap:5px"><button class="btn btn-sm btn-p" data-tmplid="'+tmpl.id+'" onclick="faxUseTemplateById(this)">Use →</button><button class="btn btn-sm" data-tmplid="'+tmpl.id+'" onclick="faxEditTemplateById(this)">Edit</button><button class="btn btn-sm btn-r" data-tmplid="'+tmpl.id+'" onclick="faxDelTemplateById(this)">Del</button></td></tr>'
    })
    el.innerHTML=h+'</tbody></table>'
  }else{
    var b=window._faxBidScopeBlocks||[]
    if(!b.length){el.innerHTML=empty('📦','No scope blocks yet');return}
    var h='<table class="tbl"><thead><tr><th>Name</th><th>Trade</th><th>Items</th><th>Subtotal</th><th></th></tr></thead><tbody>'
    b.forEach(function(blk){
      h+='<tr><td style="font-weight:500">'+blk.name+'</td><td>'+(blk.trade||'—')+'</td>'
      h+='<td>'+(blk.line_items||[]).length+'</td>'
      h+='<td>'+fm((blk.line_items||[]).reduce(function(s,i){return s+(i.qty||0)*(i.rate||0)},0),2)+'</td>'
      h+='<td style="display:flex;gap:5px"><button class="btn btn-sm" data-blkid="'+blk.id+'" onclick="faxEditBlkById(this)">Edit</button><button class="btn btn-sm btn-r" data-blkid="'+blk.id+'" onclick="faxDelBlkById(this)">Del</button></td></tr>'
    })
    el.innerHTML=h+'</tbody></table>'
  }
}
function faxTmplEditorModal(data,type,onSave){
  var isSB=type==='scopeblock'
  window._faxBidTmplItems=JSON.parse(JSON.stringify(data.line_items||[]))
  var h='<div class="fg"><label class="fl">Name *</label><input class="fi" id="tm-name" value="'+(data.name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Trade</label><select class="fs" id="tm-trade"><option value="">All trades</option>'+FAX_TRADES.map(function(t){return'<option '+(data.trade===t?'selected':'')+'>'+t+'</option>'}).join('')+'</select></div>'
  if(!isSB){
    h+='<div class="fg"><label class="fl">Description</label><textarea class="ft" id="tm-desc" style="min-height:50px">'+(data.description||'')+'</textarea></div>'
    h+='<div class="two"><div class="fg"><label class="fl">Expiry days</label><input class="fi" type="number" id="tm-exp" value="'+(data.expiry_days||30)+'"></div>'
    h+='<div class="fg"><label class="fl">Tax rate %</label><input class="fi" type="number" id="tm-tax" value="'+(data.tax_rate||0)+'" step="0.1"></div></div>'
    h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="tm-notes">'+(data.notes||'')+'</textarea></div>'
    h+='<div class="fg"><label class="fl">Terms</label><textarea class="ft" id="tm-terms">'+(data.terms||'')+'</textarea></div>'
  }
  h+='<div class="sec-hdr">Line Items <button class="btn btn-sm" onclick="faxTmplAddLi()">+ Add</button></div>'
  h+='<div id="tm-li-body"></div>'
  modal(data.id?(isSB?'Edit Scope Block':'Edit Template'):(isSB?'New Scope Block':'New Template'),h,function(){onSave()},'Save')
  faxTmplRenderLi()
}
function faxTmplRenderLi(){
  var el=document.getElementById('tm-li-body');if(!el)return
  var items=window._faxBidTmplItems||[]
  if(!items.length){el.innerHTML='<div style="font-size:11px;color:#414e63;padding:5px 0">No items</div>';return}
  var h=''
  items.forEach(function(li,i){
    h+='<div style="display:grid;grid-template-columns:1fr 55px 75px 26px;gap:4px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<input class="fi" value="'+(li.description||'')+'" style="padding:4px 6px;font-size:12px" oninput="window._faxBidTmplItems['+i+'].description=this.value">'
    h+='<input class="fi" type="number" value="'+(li.qty||'')+'" style="padding:4px 6px;font-size:12px;text-align:right" oninput="window._faxBidTmplItems['+i+'].qty=parseFloat(this.value)||0">'
    h+='<input class="fi" type="number" value="'+(li.rate||'')+'" step="0.01" style="padding:4px 6px;font-size:12px;text-align:right" oninput="window._faxBidTmplItems['+i+'].rate=parseFloat(this.value)||0">'
    h+='<button class="btn btn-sm btn-ghost" style="color:#dc2626;padding:2px 5px" onclick="window._faxBidTmplItems.splice('+i+',1);faxTmplRenderLi()">×</button>'
    h+='</div>'
  })
  el.innerHTML=h
}
function faxNewTemplate(){faxTmplEditorModal({},'template',async function(){
  var name=((document.getElementById('tm-name')||{}).value||'').trim();if(!name){toast('Name required','error');return}
  var res=await sb.from('fax_bid_templates').insert({id:uuid(),name:name,trade:(document.getElementById('tm-trade')||{}).value||'',description:((document.getElementById('tm-desc')||{}).value||'').trim(),line_items:window._faxBidTmplItems||[],tax_rate:parseFloat((document.getElementById('tm-tax')||{}).value)||0,notes:((document.getElementById('tm-notes')||{}).value||'').trim(),terms:((document.getElementById('tm-terms')||{}).value||'').trim(),expiry_days:parseInt((document.getElementById('tm-exp')||{}).value)||30,created_at:new Date().toISOString()})
  if(res.error){toast(res.error.message,'error');return}
  closeModal();pgFaxBidTemplates();toast('Template created')
})}
function faxEditTemplate(id){
  var tmpl=(window._faxBidTemplates||[]).filter(function(t){return t.id===id})[0];if(!tmpl)return
  faxTmplEditorModal(tmpl,'template',async function(){
    var name=((document.getElementById('tm-name')||{}).value||'').trim();if(!name){toast('Name required','error');return}
    var res=await sb.from('fax_bid_templates').update({name:name,trade:(document.getElementById('tm-trade')||{}).value||'',description:((document.getElementById('tm-desc')||{}).value||'').trim(),line_items:window._faxBidTmplItems||[],tax_rate:parseFloat((document.getElementById('tm-tax')||{}).value)||0,notes:((document.getElementById('tm-notes')||{}).value||'').trim(),terms:((document.getElementById('tm-terms')||{}).value||'').trim(),expiry_days:parseInt((document.getElementById('tm-exp')||{}).value)||30}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgFaxBidTemplates();toast('Updated')
  })
}
async function faxDelTemplate(id){if(!confirm('Delete template?'))return;await sb.from('fax_bid_templates').delete().eq('id',id);pgFaxBidTemplates();toast('Deleted')}
function faxNewScopeBlock(){faxTmplEditorModal({},'scopeblock',async function(){
  var name=((document.getElementById('tm-name')||{}).value||'').trim();if(!name){toast('Name required','error');return}
  var res=await sb.from('fax_bid_scope_blocks').insert({id:uuid(),name:name,trade:(document.getElementById('tm-trade')||{}).value||'',line_items:window._faxBidTmplItems||[],created_at:new Date().toISOString()})
  if(res.error){toast(res.error.message,'error');return}
  closeModal();pgFaxBidTemplates();toast('Scope block created')
})}
function faxEditScopeBlock(id){
  var blk=(window._faxBidScopeBlocks||[]).filter(function(b){return b.id===id})[0];if(!blk)return
  faxTmplEditorModal(blk,'scopeblock',async function(){
    var name=((document.getElementById('tm-name')||{}).value||'').trim();if(!name){toast('Name required','error');return}
    var res=await sb.from('fax_bid_scope_blocks').update({name:name,trade:(document.getElementById('tm-trade')||{}).value||'',line_items:window._faxBidTmplItems||[]}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgFaxBidTemplates();toast('Updated')
  })
}
async function faxDelScopeBlock(id){if(!confirm('Delete?'))return;await sb.from('fax_bid_scope_blocks').delete().eq('id',id);pgFaxBidTemplates();toast('Deleted')}
async function faxExportTemplates(){
  var r1=await sb.from('fax_bid_templates').select('*')
  var r2=await sb.from('fax_bid_scope_blocks').select('*')
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({templates:r1.data||[],scopeblocks:r2.data||[]},null,2)],{type:'application/json'}));a.download='fieldaxishq_bid_templates.json';a.click();toast('Exported')
}

async function pgFaxBidReports(){
  var period=window._faxBidRptPeriod||'all'
  var h='<div style="display:flex;gap:6px;margin-bottom:16px">'
  ;[['all','All time'],['30','Last 30d'],['90','Last 90d'],['365','Last year']].forEach(function(p){
    h+='<button class="btn btn-sm '+(period===p[0]?'btn-p':'btn-ghost')+'" data-period="'+p[0]+'" onclick="faxSetRptPeriod(this)">'+p[1]+'</button>'
  })
  h+='</div><div class="loading"><div class="spin"></div> Loading...</div>'
  document.getElementById('page-area').innerHTML=h
  var since=period!=='all'?new Date(Date.now()-parseInt(period)*86400000).toISOString():null
  var q1=sb.from('fax_bids').select('*,fax_bid_recipients(*)').order('created_at',{ascending:false})
  if(since)q1=q1.gte('created_at',since)
  var q2=since?sb.from('fax_bid_invoices').select('*').gte('created_at',since):sb.from('fax_bid_invoices').select('*')
  var results=await Promise.all([q1,q2,sb.from('profiles').select('id,full_name').in('role',['admin','pm','foreman','stager','estimator'])])
  var qs=(results[0].data||[]).map(function(q){return Object.assign({},q,{status:faxDeriveStatus(q.fax_bid_recipients)})})
  var awarded=qs.filter(function(q){return q.status==='awarded'})
  var closed=qs.filter(function(q){return q.status==='awarded'||q.status==='declined'})
  var winRate=closed.length?Math.round(awarded.length/closed.length*100):0
  var awardedVol=awarded.reduce(function(s,q){return s+(q.total||0)},0)
  var pipeline=qs.filter(function(q){return q.status!=='awarded'&&q.status!=='declined'}).reduce(function(s,q){return s+(q.total||0)},0)
  var unpaid=(results[1].data||[]).filter(function(i){return i.status!=='paid'}).reduce(function(s,i){return s+(i.total||0)},0)
  var uMap={};(results[2].data||[]).forEach(function(u){uMap[u.id]=u.full_name||u.id})
  var lossR={};qs.forEach(function(q){(q.fax_bid_recipients||[]).filter(function(r){return r.status==='declined'&&r.decline_reason}).forEach(function(r){lossR[r.decline_reason]=(lossR[r.decline_reason]||0)+1})})
  var maxLoss=Math.max.apply(null,[1].concat(Object.values(lossR)))
  var byTrade={};qs.forEach(function(q){var t=q.trade||'Other';if(!byTrade[t])byTrade[t]={name:t,n:0,won:0,vol:0};byTrade[t].n++;if(q.status==='awarded'){byTrade[t].won++;byTrade[t].vol+=q.total||0}})
  var byEst={};awarded.forEach(function(q){var e=q.estimator_id||'Unknown';if(!byEst[e])byEst[e]={name:uMap[e]||e,n:0,vol:0};byEst[e].n++;byEst[e].vol+=q.total||0})
  var byGC={};qs.forEach(function(q){(q.fax_bid_recipients||[]).forEach(function(r){var k=r.company||r.name||r.email;if(!byGC[k])byGC[k]={name:k,sent:0,won:0};byGC[k].sent++;if(r.status==='awarded')byGC[k].won++})})
  h='<div style="display:flex;gap:6px;margin-bottom:16px">'
    h+='<button class="btn btn-sm '+(period===p[0]?'btn-p':'btn-ghost')+'" data-period="'+p[0]+'" onclick="faxSetRptPeriod(this)">'+p[1]+'</button>'
  h+='</div>'
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:18px">'
  h+='<div class="stat"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:#16a34a">'+winRate+'%</div></div>'
  h+='<div class="stat"><div class="stat-label">Pipeline</div><div class="stat-value" style="font-size:18px">'+fm(pipeline)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Awarded Volume</div><div class="stat-value" style="font-size:18px;color:#16a34a">'+fm(awardedVol)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Unpaid Invoices</div><div class="stat-value" style="font-size:18px;color:#d97706">'+fm(unpaid)+'</div></div>'
  h+='</div>'
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
  h+='<div><div class="card"><div class="card-title">Estimator Leaderboard</div>'
  var estList=Object.values(byEst).sort(function(a,b){return b.vol-a.vol})
  if(estList.length){estList.forEach(function(e,i){h+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="font-size:11px;color:#414e63;width:16px">#'+(i+1)+'</div><div style="flex:1"><div style="font-size:13px;font-weight:500">'+e.name+'</div><div style="font-size:10px;color:#8a96ab">'+e.n+' won</div></div><div style="font-size:14px;font-weight:600;color:#16a34a">'+fm(e.vol)+'</div></div>'})}
  else h+='<div style="font-size:12px;color:#414e63;padding:12px 0">No awarded quotes yet</div>'
  h+='</div>'
  h+='<div class="card"><div class="card-title">Why We Lose</div>'
  var lossKeys=Object.keys(lossR)
  if(lossKeys.length){lossKeys.sort(function(a,b){return lossR[b]-lossR[a]}).forEach(function(reason){h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>'+reason+'</span><span style="color:#8a96ab">'+lossR[reason]+'</span></div><div class="pbar"><div class="pb r" style="width:'+Math.round(lossR[reason]/maxLoss*100)+'%"></div></div></div>'})}
  else h+='<div style="font-size:12px;color:#414e63;padding:12px 0">No declined quotes yet</div>'
  h+='</div></div>'
  h+='<div><div class="card"><div class="card-title">By Trade</div>'
  var tradeList=Object.values(byTrade).sort(function(a,b){return b.vol-a.vol})
  if(tradeList.length){tradeList.forEach(function(t){h+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="flex:1"><div style="font-size:13px;font-weight:500">'+t.name+'</div><div style="font-size:10px;color:#8a96ab">'+t.n+' quotes · '+t.won+' won</div></div><div style="text-align:right"><div style="font-size:12px;font-weight:600;color:#16a34a">'+(t.n?Math.round(t.won/t.n*100):0)+'%</div><div style="font-size:10px;color:#8a96ab">'+fm(t.vol)+'</div></div></div>'})}
  else h+='<div style="font-size:12px;color:#414e63;padding:12px 0">No data yet</div>'
  h+='</div>'
  h+='<div class="card"><div class="card-title">GC Win Rates</div>'
  var gcList=Object.values(byGC).sort(function(a,b){return b.won-a.won}).slice(0,8)
  if(gcList.length){gcList.forEach(function(g){h+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)"><div style="flex:1"><div style="font-size:13px;font-weight:500">'+g.name+'</div><div style="font-size:10px;color:#8a96ab">'+g.sent+' sent · '+g.won+' won</div></div><div style="font-size:14px;font-weight:600;color:'+(g.won>0?'#16a34a':'#414e63')+'">'+(g.sent?Math.round(g.won/g.sent*100):0)+'%</div></div>'})}
  else h+='<div style="font-size:12px;color:#414e63;padding:12px 0">No data yet</div>'
  h+='</div></div></div>'
  document.getElementById('page-area').innerHTML=h
}

function faxExportBidsCsv(){
  var rows=[['Number','Project','Address','Trade','Estimator','Status','Total','Bid Due','Recipients']]
  var uMap={};(window._faxBidUsers||[]).forEach(function(u){uMap[u.id]=u.full_name||u.id})
  ;(window._faxBidQuotes||[]).forEach(function(q){rows.push([q.number,q.project_name,q.project_address,q.trade,uMap[q.estimator_id]||'',q.status,q.total,q.bid_due_date||'',(q.fax_bid_recipients||[]).map(function(r){return r.company||r.name}).join('; ')])})
  var csv=rows.map(function(r){return r.map(function(c){return'"'+String(c||'').replace(/"/g,'""')+'"'}).join(',')}).join('\\\\n')
  var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='fieldaxishq_bids.csv';a.click()
}

// Token capture for API calls
window._sbToken=null
document.addEventListener('DOMContentLoaded',function(){
  if(typeof sb!=='undefined')sb.auth.getSession().then(function(res){
    var session=res.data&&res.data.session
    if(session){window._sbToken=session.access_token;window._faxUser={full_name:(ME&&ME.full_name)||''};window._faxRole=(ME&&ME.role)||session.user.role||'admin'}
  })
})

// ══════════════════════════════════════════
// QUICK QUOTE — Phone-in / walk-in customer
// ══════════════════════════════════════════
function faxQuickQuote(){
  // Preload users so estimator dropdown is populated
  if(!window._faxBidUsers){
    sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','foreman','stager','estimator']).then(function(r){window._faxBidUsers=r.data||[]})
  }
  var h='<div class="fg"><label class="fl">Customer Name *</label><input class="fi" id="qq-name" placeholder="John Smith"></div>'
  h+='<div class="fg"><label class="fl">Phone</label><input class="fi" id="qq-phone" type="tel" placeholder="(555) 000-0000"></div>'
  h+='<div class="fg"><label class="fl">Email (optional)</label><input class="fi" id="qq-email" type="email" placeholder="customer@email.com"></div>'
  h+='<div class="fg"><label class="fl">Company (optional)</label><input class="fi" id="qq-co" placeholder="ABC Construction"></div>'
  h+='<div class="fg"><label class="fl">Job Description *</label><textarea class="ft" id="qq-desc" placeholder="Describe the scope of work..."></textarea></div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Trade</label><select class="fs" id="qq-trade">'
  FAX_TRADES.forEach(function(t){h+='<option '+(t===FAX_DEFAULT_TRADE?'selected':'')+'>'+t+'</option>'})
  h+='</select></div>'
  h+='<div class="fg"><label class="fl">Bid Due Date</label><input class="fi" type="date" id="qq-due"></div>'
  h+='</div>'
  h+='<div class="fg"><label class="fl">Assign Estimator</label><select class="fs" id="qq-est"><option value="">— No estimator —</option>'
  ;(window._faxBidUsers||[]).forEach(function(u){h+='<option value="'+u.id+'">'+(u.full_name||u.id)+'</option>'})
  h+='</select></div>'
  modal('Quick Quote — Phone/Walk-in', h, async function(){
    var name=(document.getElementById('qq-name').value||'').trim()
    if(!name){toast('Customer name required','error');return}
    var desc=(document.getElementById('qq-desc').value||'').trim()
    if(!desc){toast('Job description required','error');return}
    // Auto number
    var rNum=await sb.from('fax_bids').select('number').order('created_at',{ascending:false}).limit(1)
    var lastN=parseInt(((rNum.data||[])[0]||{}).number||'Q-0000')-0||0
    var number='Q-'+String(lastN+1).padStart(4,'0')
    var newId=uuid()
    var token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function(b){return b.toString(16).padStart(2,'0')}).join('')
    // Create bid
    var res=await sb.from('fax_bids').insert({
      id:newId,number:number,version:1,
      project_name:name+' — '+(document.getElementById('qq-trade').value||'Quote'),
      project_description:desc,
      trade:document.getElementById('qq-trade').value||'',
      estimator_id:document.getElementById('qq-est')&&document.getElementById('qq-est').value||null,
      bid_due_date:document.getElementById('qq-due').value||null,
      line_items:[],tax_rate:0,subtotal:0,tax:0,total:0,
      notes:'',terms:'',revisions:[],
      created_at:new Date().toISOString(),updated_at:new Date().toISOString()
    })
    if(res.error){toast(res.error.message,'error');return}
    // Create recipient
    var phone=(document.getElementById('qq-phone').value||'').trim()
    var email=(document.getElementById('qq-email').value||'').trim()
    var co=(document.getElementById('qq-co').value||'').trim()
    var recRes=await sb.from('fax_bid_recipients').insert({
      id:uuid(),quote_id:newId,name:name,company:co,
      email:email||('noemail+'+Date.now()+'@fieldaxishq.local'),
      status:'draft',token:token,created_at:new Date().toISOString()
    })
    closeModal()
    toast('Quick quote created: '+number)
    // Open the bid for editing / sending
    faxOpenBid(newId)
    // If they have email, offer to send immediately
    if(email&&recRes.data){
      setTimeout(function(){
        if(confirm('Send quote link to '+email+' now?')){
          faxSendRecipIdx(0)
        }
      },500)
    }
  },'Create Quote')
}

// ══════════════════════════════════════════
// PRINT / PDF — Printable quote
// ══════════════════════════════════════════
function faxPrintQuote(){
  var q=window._faxBidEditing
  if(!q){toast('Open a quote first','error');return}
  var tots=faxBidCalc(q.line_items,q.tax_rate)
  var awarded=(q.recipients||[]).filter(function(r){return r.status==='awarded'})[0]
  var win=window.open('','_blank','width=850,height=1100')
  var rows=''
  ;(q.line_items||[]).forEach(function(li){
    rows+='<tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">'+li.description+'</td>'
    rows+='<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">'+li.qty+'</td>'
    rows+='<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">$'+Number(li.rate||0).toFixed(2)+'</td>'
    rows+='<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">$'+Number((li.qty||0)*(li.rate||0)).toFixed(2)+'</td></tr>'
  })
  var recList=(q.recipients||[]).map(function(r){return r.company||r.name}).filter(Boolean).join(', ')
  win.document.write('<!DOCTYPE html><html><head><title>Quote '+q.number+'</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px}@media print{body{padding:16px}}'
    +'.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111}'
    +'.co-name{font-size:22px;font-weight:700}.quote-num{font-size:13px;color:#666;margin-top:4px}'
    +'.section{margin-bottom:20px}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}'
    +'table{width:100%;border-collapse:collapse}th{background:#f9fafb;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:2px solid #e5e7eb}'
    +'.total-row{display:flex;justify-content:space-between;padding:5px 10px;font-size:13px}'
    +'.total-row.grand{font-size:16px;font-weight:700;border-top:2px solid #111;margin-top:4px;padding-top:8px}'
    +'.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#666}'
    +'.sig-block{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}'
    +'.sig-line{border-top:1px solid #111;padding-top:6px;font-size:11px;color:#666;margin-top:40px}'
    +'</style></head><body>'
    +'<div class="hdr"><div><div class="co-name">FieldAxisHQ</div></div>'
    +'<div style="text-align:right"><div style="font-size:18px;font-weight:700">QUOTE</div>'
    +'<div class="quote-num">#'+q.number+' &nbsp;·&nbsp; v'+q.version+'</div>'
    +'<div style="font-size:12px;color:#666;margin-top:4px">Date: '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'</div>'
    +(q.bid_due_date?'<div style="font-size:12px;color:#dc2626;margin-top:2px">Bid Due: '+q.bid_due_date+'</div>':'')
    +'</div></div>'
    +'<div class="section"><div class="section-title">Project</div>'
    +'<div style="font-size:16px;font-weight:600;margin-bottom:4px">'+(q.project_name||'—')+'</div>'
    +(q.project_address?'<div style="color:#444">'+q.project_address+(q.project_city?', '+q.project_city:'')+(q.project_state?' '+q.project_state:'')+'</div>':'')
    +(q.trade?'<div style="color:#666;font-size:12px;margin-top:3px">Trade: '+q.trade+'</div>':'')
    +(q.project_description?'<div style="margin-top:8px;color:#444;line-height:1.5">'+q.project_description+'</div>':'')
    +'</div>'
    +(recList?'<div class="section"><div class="section-title">Prepared For</div><div style="font-size:14px;font-weight:500">'+recList+'</div></div>':'')
    +'<div class="section"><table><thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead><tbody>'
    +rows+'</tbody></table>'
    +'<div style="margin-top:12px;max-width:300px;margin-left:auto">'
    +'<div class="total-row"><span>Subtotal</span><span>$'+tots.subtotal.toFixed(2)+'</span></div>'
    +(q.tax_rate>0?'<div class="total-row"><span>Tax ('+q.tax_rate+'%)</span><span>$'+tots.tax.toFixed(2)+'</span></div>':'')
    +'<div class="total-row grand"><span>Total</span><span>$'+tots.total.toFixed(2)+'</span></div>'
    +'</div></div>'
    +(q.notes?'<div class="section"><div class="section-title">Notes</div><div style="color:#444;line-height:1.6">'+q.notes+'</div></div>':'')
    +(q.terms?'<div class="section"><div class="section-title">Terms &amp; Conditions</div><div style="color:#666;font-size:12px;line-height:1.6">'+q.terms+'</div></div>':'')
    +(awarded?'<div class="section"><div class="section-title">Award Signature</div>'
      +'<div style="margin-top:8px"><strong>'+awarded.signature_name+'</strong>'+(awarded.signature_title?' — '+awarded.signature_title:'')+'</div>'
      +(awarded.signature_image?'<img src="'+awarded.signature_image+'" style="height:60px;margin-top:8px;border-bottom:1px solid #111">':'')
      +'<div style="font-size:11px;color:#666;margin-top:4px">Signed: '+new Date(awarded.awarded_at||'').toLocaleString()+'</div>'
      +'</div>':'')
    +'<div class="sig-block"><div><div class="sig-line">Authorized Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>'
    +'<div><div class="sig-line">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div></div>'
    +'<div class="footer">This quote is valid for 30 days from the date issued. Prices subject to change after expiration.</div>'
    +'</body></html>')
  win.document.close()
  setTimeout(function(){win.print()},400)
}

// ══════════════════════════════════════════
// LINK JOB ID — After award, link to job
// ══════════════════════════════════════════
async function faxLinkJobId(){
  var q=window._faxBidEditing
  if(!q||!q.id){toast('Save quote first','error');return}
  // Load jobs for picker
  var rJobs=await sb.from('jobs').select('id,name,address').order('created_at',{ascending:false}).limit(50)
  var jobs=rJobs.data||[]
  var h='<div class="fg"><label class="fl">Enter Job ID manually</label>'
  h+='<input class="fi" id="ljid-manual" placeholder="Paste job ID here">'
  h+='</div>'
  h+='<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">— or pick from existing jobs —</div>'
  h+='<div style="max-height:200px;overflow-y:auto">'
  if(jobs.length){
    jobs.forEach(function(j){
  h+='</div>'
      h+='<div style="font-size:13px;font-weight:500">'+(j.name||j.id)+'</div>'
      h+='<div style="font-size:10px;color:#414e63">'+(j.address||j.id)+'</div></div>'
    })
  }else{h+='<div style="font-size:12px;color:#414e63">No jobs found</div>'}
  h+='</div>'
  h+='<div class="fg" style="margin-top:12px"><label class="fl">Or create a new Job ID now</label>'
  h+='<button class="btn btn-sm btn-b" onclick="faxCreateJobFromQuote()">+ Create Job from this Quote</button></div>'
  modal('Link to Job', h, async function(){
    var jobId=(document.getElementById('ljid-manual').value||'').trim()
    if(!jobId){toast('Enter a job ID','error');return}
    var res=await sb.from('fax_bids').update({job_id:jobId,updated_at:new Date().toISOString()}).eq('id',q.id)
    if(res.error){toast(res.error.message,'error');return}
    window._faxBidEditing.job_id=jobId
    closeModal()
    toast('Linked to job: '+jobId)
    faxOpenBid(q.id)
  },'Link Job')
}

async function faxCreateJobFromQuote(){
  var q=window._faxBidEditing
  if(!q){return}
  closeModal()
  // Pre-fill new job form and navigate there
  var jobName=q.project_name||'New Job from '+q.number
  var addr=q.project_address||''
  // Navigate to new job page with pre-fill
  P('newjob', document.querySelector('.nav-item[onclick*="newjob"]'))
  // Pre-fill after a tick
  setTimeout(function(){
    var nf=document.getElementById('nj-name')
    var af=document.getElementById('nj-address')
    var dnf=document.getElementById('nj-desc')
    if(nf)nf.value=jobName
    if(af)af.value=addr
    if(dnf)dnf.value=q.project_description||''
    toast('Fill in the job details, save, then come back to link the Job ID to this quote')
  },300)
}

// ══════════════════════════════════════════
// ESTIMATOR ASSIGNMENT
// ══════════════════════════════════════════
async function faxAssignEstimator(){
  var q=window._faxBidEditing
  if(!q||!q.id){toast('Save quote first','error');return}
  if(!window._faxBidUsers){
    var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','foreman','stager','estimator'])
    window._faxBidUsers=r.data||[]
  }
  var users=window._faxBidUsers||[]
  var h='<div style="display:flex;flex-direction:column;gap:8px">'
  users.forEach(function(u){
    var isCurrent=q.estimator_id===u.id
    h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#131c2e;border-radius:7px;border:1px solid rgba(255,255,255,'+(isCurrent?'.25':'.07')+')">'
    h+='<div><div style="font-size:13px;font-weight:500">'+(u.full_name||u.id)+'</div>'
    h+='<div style="font-size:10px;color:#414e63">'+u.role+'</div></div>'
    if(isCurrent){h+='<span class="badge bg-green">Assigned</span>'}
    else{h+='<button class="btn btn-sm btn-p" data-uid="'+u.id+'" data-uname="'+(u.full_name||'').replace(/"/g,'')+'" onclick="faxDoAssignBtn(this)">Assign</button>'}
    h+='</div>'
  })
  if(!users.length)h+='<div class="empty">No staff found</div>'
  h+='</div>'
  modal('Assign Estimator', h, null, '', true)
}

async function faxDoAssign(userId, userName){
  var q=window._faxBidEditing
  if(!q||!q.id)return
  var res=await sb.from('fax_bids').update({estimator_id:userId,updated_at:new Date().toISOString()}).eq('id',q.id)
  if(res.error){toast(res.error.message,'error');return}
  window._faxBidEditing.estimator_id=userId
  closeModal()
  toast('Assigned to '+userName)
  // Update the estimator dropdown if visible
  var sel=document.getElementById('qf-est')
  if(sel)sel.value=userId
}



// ══════════════════════════════════════════
// PDF QUOTE UPLOAD
// ══════════════════════════════════════════
function faxPdfDragOver(el){el.style.borderColor='#2563eb'}
function faxPdfDragLeave(el){el.style.borderColor='rgba(255,255,255,.15)'}

function faxUploadPdfQuote(){
  var h='<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#8a96ab">'
  h+='Upload a quote you built elsewhere (Excel, Word, etc.). The GC gets a link where they can view your PDF and sign to award it.'
  h+='</div>'
  h+='<div class="fg"><label class="fl">PDF File *</label>'
  h+='<div id="pdf-dropzone" style="border:1.5px dashed rgba(255,255,255,.15);border-radius:8px;padding:24px;text-align:center;cursor:pointer;transition:.15s" ondragover="event.preventDefault();faxPdfDragOver(this)" ondragleave="faxPdfDragLeave(this)" ondrop="faxPdfDrop(event)">'
  h+='<div style="font-size:24px;margin-bottom:8px">📄</div>'
  h+='<div style="font-size:13px;color:#8a96ab;margin-bottom:8px">Drag PDF here or click to browse</div>'
  h+='<label class="btn btn-sm btn-b" style="cursor:pointer">Browse<input type="file" id="pdf-file-input" accept=".pdf" style="display:none" onchange="faxPdfSelected(this)"></label>'
  h+='<div id="pdf-file-name" style="font-size:12px;color:#16a34a;margin-top:8px"></div>'
  h+='</div></div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Quote Number</label><input class="fi" id="pdf-number" placeholder="Auto-generated if blank"></div>'
  h+='<div class="fg"><label class="fl">Total Value *</label><input class="fi" type="number" id="pdf-total" placeholder="0.00" step="0.01" min="0"></div>'
  h+='</div>'
  h+='<div class="fg"><label class="fl">Project Name *</label><input class="fi" id="pdf-project" placeholder="Project name or address"></div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Trade</label><select class="fs" id="pdf-trade"><option value="">— Select —</option>'
  FAX_TRADES.forEach(function(t){h+='<option>'+t+'</option>'})
  h+='</select></div>'
  h+='<div class="fg"><label class="fl">Bid Due Date</label><input class="fi" type="date" id="pdf-due"></div>'
  h+='</div>'
  h+='<div class="fg"><label class="fl">Estimator</label><select class="fs" id="pdf-est"><option value="">— Select —</option>'
  ;(window._faxBidUsers||[]).forEach(function(u){h+='<option value="'+u.id+'">'+(u.full_name||u.id)+'</option>'})
  h+='</select></div>'
  h+='<div class="fg"><label class="fl">Notes (optional)</label><textarea class="ft" id="pdf-notes" style="min-height:50px" placeholder="Any notes for the GC..."></textarea></div>'
  modal('Upload PDF Quote', h, faxSubmitPdfQuote, 'Upload & Create Quote')
  // Load users if needed
  if(!window._faxBidUsers){
    sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','foreman','stager','estimator']).then(function(r){
      window._faxBidUsers=r.data||[]
      var sel=document.getElementById('pdf-est')
      if(sel){(r.data||[]).forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=u.full_name||u.id;sel.appendChild(o)})}
    })
  }
}

function faxPdfDrop(event){
  event.preventDefault()
  var file=(event.dataTransfer.files||[])[0]
  if(file)faxSetPdfFile(file)
}
function faxPdfSelected(input){
  var file=(input.files||[])[0]
  if(file)faxSetPdfFile(file)
}
function faxSetPdfFile(file){
  if(!file.name.toLowerCase().endsWith('.pdf')){toast('Please select a PDF file','error');return}
  window._faxPdfFile=file
  var el=document.getElementById('pdf-file-name')
  if(el)el.textContent='✓ '+file.name+' ('+Math.round(file.size/1024)+'KB)'
  var dz=document.getElementById('pdf-dropzone')
  if(dz)dz.style.borderColor='#16a34a'
}

async function faxSubmitPdfQuote(){
  var file=window._faxPdfFile
  if(!file){toast('Please select a PDF file','error');return}
  var project=(document.getElementById('pdf-project').value||'').trim()
  if(!project){toast('Project name required','error');return}
  var total=parseFloat(document.getElementById('pdf-total').value)||0
  if(!total){toast('Total value required','error');return}

  // Show progress
  var okBtn=document.getElementById('modal-ok')
  if(okBtn){okBtn.disabled=true;okBtn.textContent='Uploading PDF...'}

  try{
    // Upload PDF to Cloudinary
    var uploaded=await uploadToCloudinary(file,'fieldaxishq/quotes')
    if(!uploaded||!uploaded.url)throw new Error('Upload failed - check Cloudinary config')

    // Auto quote number
    var rNum=await sb.from('fax_bids').select('number').order('created_at',{ascending:false}).limit(1)
    var lastN=parseInt(((rNum.data||[])[0]||{}).number||'Q-0000')-0||0
    var numInput=(document.getElementById('pdf-number').value||'').trim()
    var number=numInput||('Q-'+String(lastN+1).padStart(4,'0'))

    var newId=uuid()
    var res=await sb.from('fax_bids').insert({
      id:newId,
      number:number,
      version:1,
      project_name:project,
      project_description:'',
      project_address:'',
      project_city:'',
      project_state:'',
      project_zip:'',
      trade:document.getElementById('pdf-trade').value||'',
      estimator_id:document.getElementById('pdf-est').value||null,
      job_id:null,
      issue_date:new Date().toISOString().split('T')[0],
      bid_due_date:document.getElementById('pdf-due').value||null,
      expiry_date:null,
      line_items:[],
      tax_rate:0,
      subtotal:total,
      tax:0,
      total:total,
      notes:document.getElementById('pdf-notes').value||'',
      terms:'',
      pdf_url:uploaded.url,
      pdf_filename:file.name,
      quote_type:'pdf',
      revisions:[],
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    if(res.error)throw new Error(res.error.message)

    window._faxPdfFile=null
    closeModal()
    toast('PDF quote created: '+number)
    faxOpenBid(newId)
  }catch(e){
    toast(e.message,'error')
    if(okBtn){okBtn.disabled=false;okBtn.textContent='Upload & Create Quote'}
  }
}



function faxReplacePdf(input){
  var file=(input.files||[])[0]
  if(!file)return
  if(!file.name.toLowerCase().endsWith('.pdf')){toast('Please select a PDF file','error');return}
  var q=window._faxBidEditing
  if(!q||!q.id){toast('Save quote first','error');return}
  window._faxPdfFile=file
  toast('PDF selected. Click Save to upload and replace.')
}


// ══════════════════════════════════════════
// URGENT FLAG & TASKS SYSTEM
// ══════════════════════════════════════════

// ── Urgent flag on job header ──────────────────────────────────────────────
async function toggleUrgent(){
  var j=currentJob
  if(j.is_urgent){
    // Removing urgent - clear it
    if(!confirm('Remove urgent flag from this job?'))return
    await sb.from('jobs').update({is_urgent:false,urgent_note:'',urgent_assigned_to:null,urgent_flagged_at:null,updated_at:new Date().toISOString()}).eq('id',j.id)
    currentJob.is_urgent=false;currentJob.urgent_note='';currentJob.urgent_assigned_to=null
    renderJobDetail();toast('Urgent flag removed')
    return
  }
  // Adding urgent - collect details
  if(!window._faxBidUsers){
    var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','estimator','foreman','stager'])
    window._faxBidUsers=r.data||[]
  }
  var userOpts=''
  ;(window._faxBidUsers||[]).forEach(function(u){userOpts+='<option value="'+u.id+'">'+(u.full_name||u.id)+'</option>'})
  var h='<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#dc2626;font-weight:500">'
  h+='This will flag the job as URGENT and show a fire icon on the map.</div>'
  h+='<div class="fg"><label class="fl">Description *</label><textarea class="ft" id="urg-note" placeholder="What needs urgent attention? Be specific..." style="min-height:80px"></textarea></div>'
  h+='<div class="fg"><label class="fl">Assign To *</label><select class="fs" id="urg-assign"><option value="">— Select person —</option>'+userOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Priority</label><select class="fs" id="urg-pri"><option value="critical">🔴 Critical — Stop everything</option><option value="high" selected>🟠 High — Fix today</option><option value="medium">🟡 Medium — Fix this week</option></select></div>'
  modal('Flag as Urgent', h, async function(){
    var note=(document.getElementById('urg-note').value||'').trim()
    var assignTo=document.getElementById('urg-assign').value
    var priority=document.getElementById('urg-pri').value
    if(!note){toast('Description required','error');return}
    if(!assignTo){toast('Must assign to someone','error');return}
    var assignName=(window._faxBidUsers||[]).filter(function(u){return u.id===assignTo})[0]
    assignName=assignName?assignName.full_name||assignName.id:assignTo
    // Flag the job
    await sb.from('jobs').update({is_urgent:true,urgent_note:note,urgent_assigned_to:assignTo,urgent_assigned_name:assignName,urgent_priority:priority,urgent_flagged_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',j.id)
    currentJob.is_urgent=true;currentJob.urgent_note=note;currentJob.urgent_assigned_to=assignTo;currentJob.urgent_assigned_name=assignName;currentJob.urgent_priority=priority;currentJob.urgent_flagged_at=new Date().toISOString()
    // Create task
    await sb.from('job_tasks').insert({id:uuid(),job_id:j.id,job_name:j.name||'',title:'URGENT: '+note,description:note,assigned_to:assignTo,assigned_name:assignName,priority:priority,status:'open',source:'urgent_flag',created_by:(typeof ME!=='undefined'?ME.full_name||'':''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    closeModal();renderJobDetail();toast('Job flagged as urgent and task assigned to '+assignName,'warn')
  },'Flag Urgent')
}

async function resolveUrgent(){
  var j=currentJob
  var note=(prompt('Resolution notes (required):','')||'').trim()
  if(!note){toast('Notes required to resolve','error');return}
  var resolver=(typeof ME!=='undefined'?ME.full_name||'':'someone')
  await sb.from('daily_reports').insert({id:uuid(),job_id:j.id,report_date:new Date().toISOString().split('T')[0],submitted_by:resolver,crew_count:0,hours_worked:0,weather:'',issues:'URGENT RESOLVED by '+resolver+': '+note,notes:'Original flag: '+(j.urgent_note||''),created_at:new Date().toISOString()})
  await sb.from('job_tasks').update({status:'resolved',resolved_at:new Date().toISOString(),resolution_notes:note,updated_at:new Date().toISOString()}).eq('job_id',j.id).eq('source','urgent_flag').eq('status','open')
  await sb.from('jobs').update({is_urgent:false,urgent_note:'',urgent_assigned_to:null,urgent_flagged_at:null,updated_at:new Date().toISOString()}).eq('id',j.id)
  currentJob.is_urgent=false
  renderJobDetail();toast('Resolved — logged to Daily Reports and task closed')
}

// ── Tasks page ─────────────────────────────────────────────────────────────
function taskOpenJob(el){openJob(el.getAttribute('data-jid'))}
async function pgTasks(){
  document.getElementById('page-title').textContent='Tasks'
  document.getElementById('topbar-actions').innerHTML='<button class="btn btn-p btn-sm" onclick="newTaskModal()">+ New Task</button> <button class="btn btn-sm" id="my-tasks-btn" onclick="filterMyTasks()">👤 My Tasks</button>'
  var res=await sb.from('job_tasks').select('*').order('created_at',{ascending:false})
  var tasks=res.data||[]
  window._allTasks=tasks
  renderTaskList(tasks)
}

function renderTaskList(tasks){
  // Filters
  var sf=(document.getElementById('tk-search')||{}).value||''
  var statf=(document.getElementById('tk-stat')||{}).value||''
  var prif=(document.getElementById('tk-pri')||{}).value||''
  var assignf=(document.getElementById('tk-assign')||{}).value||''
  var agef=(document.getElementById('tk-age')||{}).value||''
  var now=Date.now()
  var filtered=(tasks||window._allTasks||[]).filter(function(t){
    if(sf&&!(t.title+t.job_name+t.assigned_name).toLowerCase().includes(sf.toLowerCase()))return false
    if(statf&&t.status!==statf)return false
    if(prif&&t.priority!==prif)return false
    if(assignf&&t.assigned_to!==assignf)return false
    if(agef){
      var ageDays=Math.floor((now-new Date(t.created_at).getTime())/(86400000))
      if(agef==='today'&&ageDays>0)return false
      if(agef==='week'&&ageDays>7)return false
      if(agef==='month'&&ageDays>30)return false
      if(agef==='old'&&ageDays<30)return false
    }
    return true
  })
  // Sort: open first, then by priority, then by age
  var priOrder={critical:0,high:1,medium:2,low:3}
  filtered.sort(function(a,b){
    if(a.status==='open'&&b.status!=='open')return -1
    if(a.status!=='open'&&b.status==='open')return 1
    return (priOrder[a.priority]||9)-(priOrder[b.priority]||9)
  })
  // Stats
  var open=filtered.filter(function(t){return t.status==='open'}).length
  var critical=filtered.filter(function(t){return t.priority==='critical'&&t.status==='open'}).length
  // Unique assignees for filter
  var assignees=[]
  var seen={}
  ;(window._allTasks||[]).forEach(function(t){if(t.assigned_to&&!seen[t.assigned_to]){seen[t.assigned_to]=1;assignees.push({id:t.assigned_to,name:t.assigned_name||t.assigned_to})}})
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat"><div class="stat-label">Open</div><div class="stat-value">'+open+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Critical</div><div class="stat-value" style="color:#dc2626">'+critical+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Total</div><div class="stat-value">'+(window._allTasks||[]).length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Resolved</div><div class="stat-value" style="color:#16a34a">'+(window._allTasks||[]).filter(function(t){return t.status==='resolved'}).length+'</div></div>'
  h+='</div>'
  h+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">'
  h+='<input class="fi" id="tk-search" placeholder="Search tasks..." style="width:180px" oninput="renderTaskList()">'
  h+='<select class="fs" id="tk-stat" style="width:130px" onchange="renderTaskList()"><option value="">All status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select>'
  h+='<select class="fs" id="tk-pri" style="width:130px" onchange="renderTaskList()"><option value="">All priority</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>'
  h+='<select class="fs" id="tk-assign" style="width:160px" onchange="renderTaskList()"><option value="">All assignees</option>'
  assignees.forEach(function(a){h+='<option value="'+a.id+'">'+a.name+'</option>'})
  h+='</select>'
  h+='<select class="fs" id="tk-age" style="width:140px" onchange="renderTaskList()"><option value="">Any age</option><option value="today">Created today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option><option value="old">Older than 30d</option></select>'
  h+='</div>'
  if(!filtered.length){document.getElementById('page-area').innerHTML=h+'<div style="text-align:center;padding:40px;color:#414e63">No tasks match filters</div>';return}
  h+='<table class="tbl"><thead><tr><th>Priority</th><th>Task</th><th>Job</th><th>Assigned To</th><th>Status</th><th>Age</th><th></th></tr></thead><tbody>'
  var priColors={critical:'#dc2626',high:'#d97706',medium:'#2563eb',low:'#16a34a'}
  var priBadge={critical:'🔴',high:'🟠',medium:'🟡',low:'🟢'}
  filtered.forEach(function(t){
    var ageDays=Math.floor((now-new Date(t.created_at).getTime())/(86400000))
    var ageStr=ageDays===0?'Today':ageDays===1?'1 day':ageDays+'d'
    var ageColor=ageDays>14?'#dc2626':ageDays>7?'#d97706':'#8a96ab'
    var isUrgent=t.source==='urgent_flag'
    h+='<tr>'
    h+='<td><span style="font-size:13px">'+(priBadge[t.priority]||'⚪')+'</span></td>'
    h+='<td><div style="font-weight:500;font-size:13px">'+(isUrgent?'🔥 ':'')+t.title+'</div>'
    if(t.description&&t.description!==t.title)h+='<div style="font-size:11px;color:#8a96ab;margin-top:2px">'+(t.description||'').substring(0,80)+(t.description.length>80?'…':'')+'</div>'
    h+='</td>'
    h+='<td style="font-size:12px"><a href="javascript:void(0)" data-jid="'+t.job_id+'" onclick="taskOpenJob(this)" style="color:#2563eb">'+(t.job_name||'—')+'</a></td>'
    h+='<td style="font-size:12px">'+(t.assigned_name||'—')+'</td>'
    h+='<td><span class="badge '+(t.status==='resolved'?'bg-green':t.status==='in_progress'?'bg-blue':'bg-red')+'">'+(t.status==='in_progress'?'In Progress':t.status==='resolved'?'Resolved':'Open')+'</span></td>'
    h+='<td style="font-size:12px;color:'+ageColor+'">'+ageStr+'</td>'
    h+='<td style="display:flex;gap:4px">'
    if(t.status==='open')h+='<button class="btn btn-sm btn-a" data-tid="'+t.id+'" onclick="progressTask(this)">Start</button>'
    if(t.status!=='resolved')h+='<button class="btn btn-sm btn-g" data-tid="'+t.id+'" onclick="resolveTask(this)">Resolve</button>'
    h+='<button class="btn btn-sm" data-tid="'+t.id+'" onclick="editTask(this)">Edit</button>'
    h+='<button class="btn btn-sm btn-ghost" data-tid="'+t.id+'" onclick="viewTask(this)">View</button>'
    h+='</td></tr>'
  })
  h+='</tbody></table>'
  document.getElementById('page-area').innerHTML=h
}

async function progressTask(btn){
  var id=btn.getAttribute('data-tid')
  await sb.from('job_tasks').update({status:'in_progress',updated_at:new Date().toISOString()}).eq('id',id)
  var t=window._allTasks.find(function(x){return x.id===id});if(t)t.status='in_progress'
  renderTaskList();toast('Marked in progress')
}

async function resolveTask(btn){
  var id=btn.getAttribute('data-tid')
  var note=(prompt('Resolution notes:')||'').trim()
  if(!note){toast('Notes required','error');return}
  await sb.from('job_tasks').update({status:'resolved',resolution_notes:note,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id)
  // If this is an urgent task, also clear the job's urgent flag
  var t=window._allTasks.find(function(x){return x.id===id})
  if(t){
    t.status='resolved';t.resolution_notes=note
    if(t.source==='urgent_flag'&&t.job_id){
      var openUrgent=window._allTasks.filter(function(x){return x.job_id===t.job_id&&x.source==='urgent_flag'&&x.status!=='resolved'&&x.id!==id})
      if(!openUrgent.length){
        await sb.from('jobs').update({is_urgent:false,urgent_note:'',urgent_assigned_to:null,updated_at:new Date().toISOString()}).eq('id',t.job_id)
        // Log to daily reports
        await sb.from('daily_reports').insert({id:uuid(),job_id:t.job_id,report_date:new Date().toISOString().split('T')[0],submitted_by:(typeof ME!=='undefined'?ME.full_name||'':''),crew_count:0,hours_worked:0,weather:'',issues:'URGENT RESOLVED: '+note,notes:'Task: '+t.title,created_at:new Date().toISOString()})
        toast('Task resolved — urgent flag removed and logged to daily reports')
      } else {
        toast('Task resolved — other urgent tasks still open')
      }
    } else {
      toast('Task resolved')
    }
  }
  renderTaskList()
}

async function editTask(btn){
  var id=btn.getAttribute('data-tid')
  var t=(window._allTasks||[]).find(function(x){return x.id===id})
  if(!t){toast('Task not found','error');return}
  if(!window._faxBidUsers){
    var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','estimator','foreman','stager'])
    window._faxBidUsers=r.data||[]
  }
  var userOpts=''
  ;(window._faxBidUsers||[]).forEach(function(u){
    userOpts+='<option value="'+u.id+'"'+(t.assigned_to===u.id?' selected':'')+' >'+(u.full_name||u.id)+'</option>'
  })
  var rJobs=await sb.from('jobs').select('id,name').eq('archived',false).order('name',{ascending:true}).limit(100)
  var jobOpts='<option value="">— No linked job —</option>'
  ;(rJobs.data||[]).forEach(function(j){
    jobOpts+='<option value="'+j.id+'|'+j.name+'"'+(t.job_id===j.id?' selected':'')+'>'+j.name+'</option>'
  })
  var h='<div class="fg"><label class="fl">Title *</label><input class="fi" id="etk-title" value="'+(t.title||'').replace(/"/g,'&quot;')+'"></div>'
  h+='<div class="fg"><label class="fl">Description / Notes</label><textarea class="ft" id="etk-desc" style="min-height:100px">'+(t.description||'')+'</textarea></div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Priority</label><select class="fs" id="etk-pri">'
  ;['critical','high','medium','low'].forEach(function(p){h+='<option value="'+p+'"'+(t.priority===p?' selected':'')+'>'+p.charAt(0).toUpperCase()+p.slice(1)+'</option>'})
  h+='</select></div>'
  h+='<div class="fg"><label class="fl">Status</label><select class="fs" id="etk-stat">'
  ;['open','in_progress','resolved'].forEach(function(s){h+='<option value="'+s+'"'+(t.status===s?' selected':'')+'>'+s.replace('_',' ').replace(/^\w/,function(c){return c.toUpperCase()})+'</option>'})
  h+='</select></div>'
  h+='</div>'
  h+='<div class="fg"><label class="fl">Assign To</label><select class="fs" id="etk-assign"><option value="">— Unassigned —</option>'+userOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Linked Job</label><select class="fs" id="etk-job">'+jobOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Resolution Notes</label><textarea class="ft" id="etk-res" placeholder="Add resolution notes here...">'+(t.resolution_notes||'')+'</textarea></div>'
  modal('Edit Task', h, async function(){
    var title=(document.getElementById('etk-title').value||'').trim()
    if(!title){toast('Title required','error');return}
    var stat=document.getElementById('etk-stat').value
    var assignTo=document.getElementById('etk-assign').value||null
    var assignName=assignTo?(window._faxBidUsers||[]).find(function(u){return u.id===assignTo}):null
    assignName=assignName?assignName.full_name||assignName.id:t.assigned_name||''
    var jobVal=document.getElementById('etk-job').value
    var jobId=t.job_id,jobName=t.job_name
    if(jobVal){var parts=jobVal.split('|');jobId=parts[0];jobName=parts.slice(1).join('|')}
    else if(!jobVal){jobId=null;jobName=''}
    var resNotes=(document.getElementById('etk-res').value||'').trim()
    var resolvedAt=t.resolved_at
    if(stat==='resolved'&&!resolvedAt)resolvedAt=new Date().toISOString()
    var updates={
      title:title,
      description:document.getElementById('etk-desc').value||title,
      priority:document.getElementById('etk-pri').value,
      status:stat,
      assigned_to:assignTo,
      assigned_name:assignName,
      job_id:jobId||null,
      job_name:jobName||'',
      resolution_notes:resNotes||null,
      resolved_at:resolvedAt||null,
      updated_at:new Date().toISOString()
    }
    var res=await sb.from('job_tasks').update(updates).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    // Update local cache
    Object.assign(t,updates)
    closeModal()
    // If resolved and was urgent flag - clear the job urgent status
    if(stat==='resolved'&&t.source==='urgent_flag'&&t.job_id){
      var stillOpen=(window._allTasks||[]).filter(function(x){return x.job_id===t.job_id&&x.source==='urgent_flag'&&x.status!=='resolved'&&x.id!==id})
      if(!stillOpen.length){
        await sb.from('jobs').update({is_urgent:false,urgent_note:'',urgent_assigned_to:null,updated_at:new Date().toISOString()}).eq('id',t.job_id)
        if(resNotes)await sb.from('daily_reports').insert({id:uuid(),job_id:t.job_id,report_date:new Date().toISOString().split('T')[0],submitted_by:(typeof ME!=='undefined'?ME.full_name||'':''),crew_count:0,hours_worked:0,weather:'',issues:'URGENT RESOLVED: '+resNotes,notes:'Task: '+title,created_at:new Date().toISOString()})
        toast('Task saved — urgent flag cleared and logged to daily reports')
      }else{toast('Task saved')}
    }else{toast('Task saved')}
    renderTaskList()
    loadMyTasksBadge()
  },'Save Changes')
}
async function viewTask(btn){
  var id=btn.getAttribute('data-tid')
  var t=window._allTasks.find(function(x){return x.id===id});if(!t)return
  var h='<div class="two" style="margin-bottom:12px">'
  h+='<div><div style="font-size:10px;color:#414e63">JOB</div><a href="javascript:void(0)" data-jid="'+t.job_id+'" onclick="closeModal();taskOpenJob(this)" style="font-size:13px;font-weight:500;color:#2563eb">'+(t.job_name||'—')+'</a></div>'
  h+='<div><div style="font-size:10px;color:#414e63">ASSIGNED TO</div><div style="font-size:13px;font-weight:500">'+(t.assigned_name||'—')+'</div></div>'
  h+='</div>'
  h+='<div class="two" style="margin-bottom:12px">'
  h+='<div><div style="font-size:10px;color:#414e63">PRIORITY</div><div style="font-size:13px;font-weight:500">'+(t.priority||'medium')+'</div></div>'
  h+='<div><div style="font-size:10px;color:#414e63">CREATED</div><div style="font-size:13px">'+(t.created_by||'')+'<br><span style="color:#8a96ab">'+fd(t.created_at)+'</span></div></div>'
  h+='</div>'
  h+='<div style="background:#131c2e;border-radius:8px;padding:11px 13px;font-size:13px;margin-bottom:12px">'+( t.description||t.title)+'</div>'
  if(t.resolution_notes)h+='<div style="background:rgba(22,163,74,.1);border-radius:8px;padding:11px 13px;font-size:13px"><div style="font-size:10px;color:#16a34a;font-weight:600;margin-bottom:4px">RESOLUTION</div>'+t.resolution_notes+'</div>'
  modal('Task: '+t.title.substring(0,50), h, null, '', true)
}

async function newTaskModal(){
  if(!window._faxBidUsers){
    var r=await sb.from('profiles').select('id,full_name,role').in('role',['admin','pm','estimator','foreman','stager'])
    window._faxBidUsers=r.data||[]
  }
  var userOpts=''
  ;(window._faxBidUsers||[]).forEach(function(u){userOpts+='<option value="'+u.id+'">'+(u.full_name||u.id)+'</option>'})
  var rJobs=await sb.from('jobs').select('id,name').eq('archived',false).order('name',{ascending:true}).limit(50)
  var jobOpts=''
  ;(rJobs.data||[]).forEach(function(j){jobOpts+='<option value="'+j.id+'|'+j.name+'">'+j.name+'</option>'})
  var h='<div class="fg"><label class="fl">Title *</label><input class="fi" id="ntk-title" placeholder="What needs to be done?"></div>'
  h+='<div class="fg"><label class="fl">Description</label><textarea class="ft" id="ntk-desc"></textarea></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Linked Job</label><select class="fs" id="ntk-job"><option value="">— No linked job —</option>'+jobOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Priority</label><select class="fs" id="ntk-pri"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></div></div>'
  h+='<div class="fg"><label class="fl">Assign To *</label><select class="fs" id="ntk-assign"><option value="">— Select person —</option>'+userOpts+'</select></div>'
  modal('New Task', h, async function(){
    var title=(document.getElementById('ntk-title').value||'').trim()
    if(!title){toast('Title required','error');return}
    var assignTo=document.getElementById('ntk-assign').value
    if(!assignTo){toast('Must assign to someone','error');return}
    var assignName=(window._faxBidUsers||[]).find(function(u){return u.id===assignTo})
    assignName=assignName?assignName.full_name||assignName.id:assignTo
    var jobVal=document.getElementById('ntk-job').value
    var jobId='',jobName=''
    if(jobVal){var parts=jobVal.split('|');jobId=parts[0];jobName=parts.slice(1).join('|')}
    await sb.from('job_tasks').insert({id:uuid(),job_id:jobId||null,job_name:jobName,title:title,description:document.getElementById('ntk-desc').value||title,assigned_to:assignTo,assigned_name:assignName,priority:document.getElementById('ntk-pri').value,status:'open',source:'manual',created_by:(typeof ME!=='undefined'?ME.full_name||'':''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    closeModal();pgTasks();toast('Task created and assigned to '+assignName)
  },'Create Task')
}



// ══════════════════════════════════════════
// MY TASKS — Badge, notifications, dashboard widget
// ══════════════════════════════════════════

function faxNavToTasks(){
  var el=document.querySelector('.nav-item[onclick*=tasks]')
  P('tasks',el)
}
function faxNavToMyTasks(){
  filterMyTasks()
  var el=document.querySelector('.nav-item[onclick*=tasks]')
  P('tasks',el)
}
async function loadMyTasksBadge(){
  if(typeof ME==='undefined'||!ME||!ME.id)return
  try{
    var res=await sb.from('job_tasks').select('id,priority,title,job_name,created_at').eq('assigned_to',ME.id).eq('status','open')
    var myTasks=res.data||[]
    var count=myTasks.length
    // Update badge
    var badge=document.getElementById('tasks-badge')
    if(badge){
      if(count>0){badge.textContent=count>99?'99+':String(count);badge.style.display='inline-block'}
      else{badge.style.display='none'}
    }
    // Store for dashboard use
    window._myOpenTasks=myTasks
    // Show notification for critical/overdue tasks
    var critical=myTasks.filter(function(t){return t.priority==='critical'})
    var oldTasks=myTasks.filter(function(t){return(Date.now()-new Date(t.created_at).getTime())>7*86400000})
    if(critical.length){
      setTimeout(function(){
        toast('🔴 You have '+critical.length+' CRITICAL task'+(critical.length>1?'s':'')+' assigned to you','error')
      },1500)
    } else if(count>0){
      setTimeout(function(){
        toast('📋 You have '+count+' open task'+(count>1?'s':'')+' assigned to you','warn')
      },1500)
    }
    if(oldTasks.length){
      setTimeout(function(){
        toast('⏰ '+oldTasks.length+' task'+(oldTasks.length>1?'s have':' has')+' been open for 7+ days','warn')
      },3000)
    }
  }catch(e){console.warn('loadMyTasksBadge:',e)}
}

function filterMyTasks(){
  if(typeof ME==='undefined'||!ME)return
  // Set the assignee filter to current user and re-render
  var sel=document.getElementById('tk-assign')
  if(sel){
    sel.value=ME.id
    renderTaskList()
    // Update button state
    var btn=document.getElementById('my-tasks-btn')
    if(btn){btn.classList.add('active');btn.style.background='rgba(37,99,235,.2)';btn.style.color='#60a5fa'}
  }
}

function buildMyTasksDashWidget(tasks){
  if(!tasks||!tasks.length)return ''
  var priBadge={critical:'🔴',high:'🟠',medium:'🟡',low:'🟢'}
  var sorted=tasks.slice().sort(function(a,b){
    var po={critical:0,high:1,medium:2,low:3}
    return (po[a.priority]||9)-(po[b.priority]||9)
  })
  var h='<div class="card" style="border-left:3px solid #2563eb;margin-bottom:13px">'
  h+='<div class="card-title" style="margin-bottom:10px">My Tasks'
  h+='<span style="font-size:11px;color:#8a96ab;font-weight:400;margin-left:5px">('+tasks.length+' active)</span>'
  h+='<div style="display:flex;gap:5px;margin-left:auto">'
  h+='<button class="btn btn-sm btn-ghost" style="font-size:10px;padding:3px 8px" onclick="faxNavToTasks()">All</button>'
  h+='<button class="btn btn-sm btn-p" style="font-size:10px;padding:3px 8px" onclick="faxNavToMyTasks()">Mine</button>'
  h+='</div></div>'
  sorted.slice(0,4).forEach(function(t){
    var ageDays=Math.floor((Date.now()-new Date(t.created_at).getTime())/86400000)
    var ageStr=ageDays===0?'Today':ageDays+'d'
    var statusColor=t.status==='in_progress'?'#d97706':'#8a96ab'
    var isUrgent=t.source==='urgent_flag'
    h+='<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
    h+='<span style="font-size:11px;flex-shrink:0">'+(priBadge[t.priority]||'')+'</span>'
    h+='<div style="font-size:12px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(isUrgent?'🔥 ':'')+t.title+'</div>'
    h+='</div>'
    h+='<div style="display:flex;gap:6px;padding-left:18px;align-items:center">'
    h+='<span style="font-size:10px;color:'+statusColor+'">'+t.status.replace('_',' ')+'</span>'
    h+='<span style="font-size:10px;color:#1a2540">·</span>'
    h+='<span style="font-size:10px;color:#8a96ab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">'+(t.job_name||'—')+'</span>'
    h+='<span style="font-size:10px;color:#414e63;margin-left:auto;flex-shrink:0">'+ageStr+'</span>'
    h+='</div>'
    h+='</div>'
  })
  if(tasks.length>4)h+='<div style="font-size:11px;color:#414e63;padding-top:7px;text-align:center"><a href="javascript:void(0)" onclick="faxNavToMyTasks()" style="color:#2563eb">+' +(tasks.length-4)+' more</a></div>'
  h+='</div>'
  return h
}

async function dashStartTask(btn){
  var id=btn.getAttribute('data-tid')
  await sb.from('job_tasks').update({status:'in_progress',updated_at:new Date().toISOString()}).eq('id',id)
  if(window._myOpenTasks){
    var t=window._myOpenTasks.find(function(x){return x.id===id})
    if(t)t.status='in_progress'
  }
  btn.textContent='In Progress'
  btn.disabled=true
  btn.style.opacity='0.5'
  loadMyTasksBadge()
  toast('Task started')
}



// ══════════════════════════════════════════
// PARTS ADMIN — Edit, delete, status change
// ══════════════════════════════════════════
async function reloadPartsTab(){loadJT('jt-parts')}
function editPartStatus(btn){
  var id=btn.getAttribute('data-pid')
  var parts=window._currentJobParts||[]
  var p=parts.find(function(x){return x.id===id})
  if(!p){toast('Part not found','error');return}
  var statuses=['ordered','staged','signed_out','partial_install','installed','returned']
  var opts=statuses.map(function(s){return'<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+s.replace(/_/g,' ')+'</option>'}).join('')
  var h='<div class="fg"><label class="fl">Part</label><div style="font-weight:500;font-size:13px">'+p.part_name+'</div></div>'
  h+='<div class="fg"><label class="fl">Current Status</label><span class="badge bg-amber">'+p.status.replace(/_/g,' ')+'</span></div>'
  h+='<div class="fg"><label class="fl">New Status</label><select class="fs" id="eps-stat">'+opts+'</select></div>'
  h+='<div class="fg"><label class="fl">Note (optional)</label><input class="fi" id="eps-note" placeholder="Reason for change..."></div>'
  modal('Edit Part Status', h, async function(){
    var newStat=document.getElementById('eps-stat').value
    var res=await sb.from('job_parts').update({status:newStat,updated_at:new Date().toISOString()}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    p.status=newStat
    closeModal();loadJT('jt-parts');toast('Status updated')
  },'Save')
}

async function editPartItem(btn){
  var id=btn.getAttribute('data-pid')
  var parts=window._currentJobParts||[]
  var p=parts.find(function(x){return x.id===id})
  if(!p){toast('Part not found','error');return}
  var h='<div class="fg"><label class="fl">Part Name</label><input class="fi" id="epi-name" value="'+p.part_name+'"></div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Ordered Qty</label><input class="fi" type="number" id="epi-oqty" value="'+(p.ordered_qty||p.assigned_qty||0)+'"></div>'
  h+='<div class="fg"><label class="fl">Staged Qty</label><input class="fi" type="number" id="epi-sqty" value="'+(p.assigned_qty||0)+'"></div>'
  h+='</div>'
  h+='<div class="two">'
  h+='<div class="fg"><label class="fl">Taken Qty</label><input class="fi" type="number" id="epi-tqty" value="'+(p.taken_qty||0)+'"></div>'
  h+='<div class="fg"><label class="fl">Installed Qty</label><input class="fi" type="number" id="epi-iqty" value="'+(p.installed_qty||0)+'"></div>'
  h+='</div>'
  modal('Edit Part', h, async function(){
    var updates={
      part_name:document.getElementById('epi-name').value||p.part_name,
      ordered_qty:parseInt(document.getElementById('epi-oqty').value)||0,
      assigned_qty:parseInt(document.getElementById('epi-sqty').value)||0,
      taken_qty:parseInt(document.getElementById('epi-tqty').value)||0,
      installed_qty:parseInt(document.getElementById('epi-iqty').value)||0,
      updated_at:new Date().toISOString()
    }
    var res=await sb.from('job_parts').update(updates).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();loadJT('jt-parts');toast('Part updated')
  },'Save')
}

async function deletePartItem(btn){
  if(!confirm('Delete this part from the job?'))return
  var id=btn.getAttribute('data-pid')
  var res=await sb.from('job_parts').delete().eq('id',id)
  if(res.error){toast(res.error.message,'error');return}
  loadJT('jt-parts');toast('Part deleted','warn')
}

// ══════════════════════════════════════════
// STAGE-IN FROM ORDERED — +/- and scan flow
// ══════════════════════════════════════════
async function renderPartsTab(el){
  var res=await sb.from('job_parts').select('*').eq('job_id',currentJobId).order('created_at',{ascending:false})
  var parts=res.data||[]
  window._currentJobParts=parts
  var isAdmin=['admin','pm','estimator'].indexOf((typeof ME!=='undefined'?ME.role:'')||'')>=0
  var ordered=parts.filter(function(p){return p.status==='ordered'||p.status==='none'||!p.status||p.status==='pending'})
  var staged=parts.filter(function(p){return p.status==='staged'})
  var checkedOut=parts.filter(function(p){return p.status==='signed_out'})
  var installed=parts.filter(function(p){return p.status==='installed'||p.status==='partial_install'})
  var allStaged=parts.length>0&&parts.every(function(p){return['staged','signed_out','partial_install','installed'].includes(p.status)})
  var stagingInProcess=parts.some(function(p){return p.status==='staged'})&&parts.some(function(p){return p.status==='ordered'||p.status==='pending'||!p.status})

  var h='<div style="display:flex;gap:8px;margin-bottom:13px;flex-wrap:wrap">'
  h+='<button class="btn btn-sm" onclick="reloadPartsTab()">↻ Refresh</button>'
  if(isAdmin)h+='<button class="btn btn-sm btn-a" onclick="showTransferPartsModal()">↔ Transfer Parts</button>'
  if(isAdmin)h+='<button class="btn btn-sm btn-b" onclick="showExpectedStagingDate()">📅 Expected Staging Date</button>'
  h+='</div>'

  // Staging status banner
  if(allStaged){
    h+='<div style="background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.25);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">'
    h+='<span style="font-size:20px">✅</span><div><div style="font-weight:600;color:#16a34a">All Parts Staged Complete</div><div style="font-size:11px;color:#8a96ab">All ordered parts have been staged</div></div></div>'
  }else if(stagingInProcess){
    h+='<div style="background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.2);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">'
    h+='<span style="font-size:20px">⏳</span><div><div style="font-weight:600;color:#d97706">Staging In Process</div><div style="font-size:11px;color:#8a96ab">'+staged.length+' staged, '+ordered.length+' still ordered</div></div></div>'
  }

  // Expected staging date
  var currentJob2=window._currentJobForParts||currentJob
  if(currentJob2&&currentJob2.expected_staging_date){
    var sd=new Date(currentJob2.expected_staging_date)
    var isOverdue=sd<new Date()&&!allStaged
    h+='<div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.15);border-radius:7px;padding:8px 12px;margin-bottom:10px;font-size:12px">'
    h+='<span style="color:#60a5fa;font-weight:600">📅 Expected Staging: </span>'
    h+='<span style="color:'+(isOverdue?'#dc2626':'#8a96ab')+'">'+sd.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+(isOverdue?' — OVERDUE':'')+'</span></div>'
  }

  // Ordered → Stage section
  if(ordered.length){
    h+='<div class="card"><div class="card-title">📦 Ordered — Stage These In ('+ordered.length+' items)'
    if(isAdmin)h+='<button class="btn btn-sm btn-p" style="margin-left:auto" onclick="stageAllOrdered()">Stage All</button>'
    h+='</div>'
    ordered.forEach(function(p){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:500">'+p.part_name+'</div>'
      h+='<div style="font-size:10px;color:#414e63">Ordered: '+(p.ordered_qty||p.assigned_qty||0)+'</div></div>'
      h+='<div style="display:flex;align-items:center;gap:5px">'
      h+='<button class="btn btn-sm" data-pid="'+p.id+'" onclick="adjustStageQty(this,-1)">−</button>'
      h+='<input class="fi" type="number" id="stq-'+p.id+'" value="'+(p.ordered_qty||p.assigned_qty||0)+'" min="0" style="width:55px;text-align:center;padding:4px">'
      h+='<button class="btn btn-sm" data-pid="'+p.id+'" onclick="adjustStageQty(this,1)">+</button>'
      h+='<button class="btn btn-sm btn-a" data-pid="'+p.id+'" data-pname="'+p.part_name+'" onclick="stageOneIn(this)">Stage In</button>'
      h+='</div></div>'
    })
    h+='</div>'
  }

  // Staged → Check Out section
  if(staged.length){
    h+='<div class="card"><div class="card-title">📤 Staged — Check Out to Tech ('+staged.length+' items)'
    if(isAdmin)h+='<button class="btn btn-sm btn-p" style="margin-left:auto" onclick="checkOutAllStaged()">Check Out All</button>'
    h+='</div>'
    staged.forEach(function(p){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:500">'+p.part_name+'</div>'
      h+='<div style="font-size:10px;color:#414e63">Staged qty: '+(p.assigned_qty||0)+'</div></div>'
      h+='<div style="display:flex;align-items:center;gap:5px">'
      h+='<button class="btn btn-sm" data-pid="'+p.id+'" onclick="adjustCheckQty(this,-1)">−</button>'
      h+='<input class="fi" type="number" id="ckq-'+p.id+'" value="'+(p.assigned_qty||0)+'" min="0" style="width:55px;text-align:center;padding:4px">'
      h+='<button class="btn btn-sm" data-pid="'+p.id+'" onclick="adjustCheckQty(this,1)">+</button>'
      h+='<button class="btn btn-sm btn-b" data-pid="'+p.id+'" data-pname="'+p.part_name+'" onclick="checkOutOne(this)">Check Out</button>'
      h+='</div></div>'
    })
    h+='</div>'
  }

  // Full parts table
  h+='<div class="card" style="padding:0;overflow:hidden">'+buildPartsTable(parts)+'</div>'
  el.innerHTML=h
}

function adjustStageQty(btn,delta){
  var id=btn.getAttribute('data-pid')
  var inp=document.getElementById('stq-'+id)
  if(!inp)return
  inp.value=Math.max(0,(parseInt(inp.value)||0)+delta)
}
function adjustCheckQty(btn,delta){
  var id=btn.getAttribute('data-pid')
  var inp=document.getElementById('ckq-'+id)
  if(!inp)return
  inp.value=Math.max(0,(parseInt(inp.value)||0)+delta)
}

async function stageOneIn(btn){
  var id=btn.getAttribute('data-pid')
  var name=btn.getAttribute('data-pname')
  var inp=document.getElementById('stq-'+id)
  var qty=inp?parseInt(inp.value)||0:0
  if(!qty){toast('Quantity must be > 0','error');return}
  var parts=window._currentJobParts||[]
  var p=parts.find(function(x){return x.id===id})
  if(!p)return
  var orderedQty=p.ordered_qty||p.assigned_qty||0
  var extra=qty-orderedQty
  var res=await sb.from('job_parts').update({status:'staged',assigned_qty:qty,staged_by:(typeof ME!=='undefined'?ME.full_name||'':''),staged_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id)
  if(res.error){toast(res.error.message,'error');return}
  if(extra>0){
    toast('⚠ Alert: '+extra+' extra '+name+' staged beyond ordered qty!','warn')
    setTimeout(function(){toast('⚠ Extra Parts: '+extra+' extra '+name+' staged beyond ordered qty of '+orderedQty,'warn')},200)
  }else{
    toast('✓ Staged: '+name+' (×'+qty+')')
  }
  // Check if all parts are now staged
  var updatedParts=await sb.from('job_parts').select('status').eq('job_id',currentJobId)
  var allDone=(updatedParts.data||[]).every(function(x){return['staged','signed_out','partial_install','installed'].includes(x.status)})
  if(allDone){
    await sb.from('jobs').update({staging_status:'complete',updated_at:new Date().toISOString()}).eq('id',currentJobId)
    setTimeout(function(){toast('🎉 All parts staged! Job marked as Staging Complete.','success')},300)
  }else{
    await sb.from('jobs').update({staging_status:'in_progress',updated_at:new Date().toISOString()}).eq('id',currentJobId)
  }
  loadJT('jt-parts')
}

async function stageAllOrdered(){
  var parts=window._currentJobParts||[]
  var ordered=parts.filter(function(p){return p.status==='ordered'||p.status==='pending'||!p.status})
  if(!ordered.length){toast('No ordered parts to stage','warn');return}
  if(!confirm('Stage in all '+ordered.length+' ordered items at their ordered quantities?'))return
  var errors=0
  for(var i=0;i<ordered.length;i++){
    var p=ordered[i]
    var res=await sb.from('job_parts').update({status:'staged',assigned_qty:p.ordered_qty||p.assigned_qty||0,staged_by:(typeof ME!=='undefined'?ME.full_name||'':''),staged_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',p.id)
    if(res.error)errors++
  }
  if(!errors){
    await sb.from('jobs').update({staging_status:'complete',updated_at:new Date().toISOString()}).eq('id',currentJobId)
    toast('🎉 All parts staged complete!')
  }else{
    toast('Staged with '+errors+' errors','warn')
  }
  loadJT('jt-parts')
}

async function checkOutOne(btn){
  var id=btn.getAttribute('data-pid')
  var name=btn.getAttribute('data-pname')
  var inp=document.getElementById('ckq-'+id)
  var qty=inp?parseInt(inp.value)||0:0
  if(!qty){toast('Quantity must be > 0','error');return}
  var parts=window._currentJobParts||[]
  var p=parts.find(function(x){return x.id===id})
  if(!p)return
  var stagedQty=p.assigned_qty||0
  var extra=qty-stagedQty
  var res=await sb.from('job_parts').update({status:'signed_out',taken_qty:qty,checked_out_by:(typeof ME!=='undefined'?ME.full_name||'':''),checked_out_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id)
  if(res.error){toast(res.error.message,'error');return}
  if(extra>0){
    toast('⚠ Alert: '+extra+' extra '+name+' checked out beyond staged qty!','warn')
    setTimeout(function(){toast('⚠ Extra Parts: '+extra+' extra '+name+' staged beyond ordered qty of '+orderedQty,'warn')},200)
  }else{
    toast('✓ Checked out: '+name+' (×'+qty+')')
  }
  loadJT('jt-parts')
}

async function checkOutAllStaged(){
  var parts=window._currentJobParts||[]
  var staged=parts.filter(function(p){return p.status==='staged'})
  if(!staged.length){toast('No staged parts to check out','warn');return}
  if(!confirm('Check out all '+staged.length+' staged items?'))return
  for(var i=0;i<staged.length;i++){
    var p=staged[i]
    await sb.from('job_parts').update({status:'signed_out',taken_qty:p.assigned_qty||0,checked_out_by:(typeof ME!=='undefined'?ME.full_name||'':''),checked_out_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',p.id)
  }
  toast('All staged parts checked out')
  loadJT('jt-parts')
}

// ══════════════════════════════════════════
// TRANSFER STAGED PARTS TO ANOTHER JOB
// ══════════════════════════════════════════
async function showTransferPartsModal(){
  var parts=window._currentJobParts||[]
  var staged=parts.filter(function(p){return p.status==='staged'})
  if(!staged.length){toast('No staged parts to transfer','warn');return}
  var rJobs=await sb.from('jobs').select('id,name').eq('archived',false).order('name').limit(50)
  var jobs=(rJobs.data||[]).filter(function(j){return j.id!==currentJobId})
  var jobOpts=jobs.map(function(j){return'<option value="'+j.id+'">'+j.name+'</option>'}).join('')
  var h='<div class="fg"><label class="fl">Transfer To Job *</label><select class="fs" id="tr-job"><option value="">— Select destination —</option>'+jobOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Select Parts to Transfer</label>'
  staged.forEach(function(p){
    h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
    h+='<input type="checkbox" id="tr-'+p.id+'" class="tr-chk" data-pid="'+p.id+'" checked style="width:16px;height:16px">'
    h+='<label for="tr-'+p.id+'" style="flex:1;font-size:13px;cursor:pointer">'+p.part_name+'</label>'
    h+='<span style="font-size:11px;color:#8a96ab">×'+(p.assigned_qty||0)+'</span></div>'
  })
  h+='</div>'
  modal('Transfer Staged Parts', h, async function(){
    var destJobId=document.getElementById('tr-job').value
    if(!destJobId){toast('Select a destination job','error');return}
    var destJob=jobs.find(function(j){return j.id===destJobId})
    var selected=Array.from(document.querySelectorAll('.tr-chk:checked')).map(function(cb){return cb.getAttribute('data-pid')})
    if(!selected.length){toast('Select at least one part','error');return}
    var transferred=0
    for(var i=0;i<selected.length;i++){
      var pid=selected[i]
      var p=staged.find(function(x){return x.id===pid})
      if(!p)continue
      // Insert into destination job
      await sb.from('job_parts').insert({id:uuid(),job_id:destJobId,part_id:p.part_id,part_name:p.part_name,barcode:p.barcode||'',ordered_qty:p.assigned_qty||0,assigned_qty:p.assigned_qty||0,taken_qty:0,installed_qty:0,status:'staged',staged_by:(typeof ME!=='undefined'?ME.full_name||'':''),staged_at:new Date().toISOString(),notes:'Transferred from job '+currentJobId,created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      // Remove from current job
      await sb.from('job_parts').delete().eq('id',pid)
      transferred++
    }
    // Update staging status of current job
    var remaining=await sb.from('job_parts').select('status').eq('job_id',currentJobId)
    var remainingParts=remaining.data||[]
    var newStatus=remainingParts.some(function(x){return x.status==='staged'})?'in_progress':'pending'
    await sb.from('jobs').update({staging_status:newStatus,updated_at:new Date().toISOString()}).eq('id',currentJobId)
    closeModal()
    toast('Transferred '+transferred+' part(s) to '+(destJob?destJob.name:'destination job'))
    loadJT('jt-parts')
  },'Transfer')
}

// ══════════════════════════════════════════
// EXPECTED STAGING DATE
// ══════════════════════════════════════════
async function showExpectedStagingDate(){
  var job=currentJob
  var h='<div class="fg"><label class="fl">Expected Staging Completion Date</label>'
  h+='<input class="fi" type="date" id="esd-date" value="'+(job&&job.expected_staging_date?job.expected_staging_date.split('T')[0]:'')+'"></div>'
  h+='<div style="font-size:11px;color:#8a96ab;margin-top:4px">This date shows on the Parts tab and alerts if overdue.</div>'
  modal('Expected Staging Date', h, async function(){
    var date=document.getElementById('esd-date').value
    var res=await sb.from('jobs').update({expected_staging_date:date||null,updated_at:new Date().toISOString()}).eq('id',currentJobId)
    if(res.error){toast(res.error.message,'error');return}
    if(currentJob)currentJob.expected_staging_date=date||null
    closeModal();loadJT('jt-parts');toast('Expected staging date saved')
  },'Save')
}

// ══════════════════════════════════════════
// SCAN PARTS — Edit status for admin
// ══════════════════════════════════════════
async function editScanPartStatus(btn){
  var id=btn.getAttribute('data-pid')
  var name=btn.getAttribute('data-pname')
  var curStatus=btn.getAttribute('data-status')
  var statuses=['ordered','staged','signed_out','partial_install','installed','returned']
  var opts=statuses.map(function(s){return'<option value="'+s+'"'+(curStatus===s?' selected':'')+'>'+s.replace(/_/g,' ')+'</option>'}).join('')
  var h='<div class="fg"><label class="fl">Part</label><div style="font-weight:500">'+name+'</div></div>'
  h+='<div class="fg"><label class="fl">Status</label><select class="fs" id="esp-stat">'+opts+'</select></div>'
  modal('Edit Part Status', h, async function(){
    var newStat=document.getElementById('esp-stat').value
    var res=await sb.from('job_parts').update({status:newStat,updated_at:new Date().toISOString()}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();loadJobPartsPanel();toast('Status updated')
  },'Save')
}



// ════════════════════════════════════════════════════════════════
// CRM MODULE — Accounts, Contacts, Pipeline, Inspections
// ════════════════════════════════════════════════════════════════

// ── ACCOUNTS ────────────────────────────────────────────────────
async function pgCrmAccounts(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-p btn-sm" onclick="crmNewAccount()">+ New Account</button>'
  var res=await sb.from('crm_accounts').select('*,crm_contacts(id),crm_buildings(id),crm_agreements(id,status)').order('name',{ascending:true})
  var accounts=res.data||[]
  window._crmAccounts=accounts
  renderCrmAccounts(accounts,'')
}

function crmOpenAccountCard(el){crmOpenAccount(el.getAttribute('data-aid'))}
function crmOpenAccountTopbar(){
  var id=window._crmOpenId||''
  return '<button class="btn btn-sm btn-p" data-id="'+id+'" onclick="crmEditBtn(this)">Edit</button> '
    +'<button class="btn btn-sm" data-id="'+id+'" onclick="crmContactBtn(this)">+ Contact</button> '
    +'<button class="btn btn-sm" data-id="'+id+'" onclick="crmBuildingBtn(this)">+ Building</button> '
    +'<button class="btn btn-sm btn-a" data-id="'+id+'" onclick="crmActivityBtn(this)">+ Log Activity</button> '
    +'<button class="btn btn-ghost btn-sm" onclick="pgCrmAccounts()">← Accounts</button>'
}
function crmEditBtn(b){crmEditAccount(b.getAttribute('data-id'))}
function crmContactBtn(b){crmNewContact(b.getAttribute('data-id'))}
function crmBuildingBtn(b){crmNewBuilding(b.getAttribute('data-id'))}
function crmActivityBtn(b){crmLogActivity(b.getAttribute('data-id'))}
function crmBtn_crmDeleteAccount(b){crmDeleteAccount(b.getAttribute('data-id'))}
function crmInspSearchFilter(q){filterInspections((document.getElementById('insp-filter')||{}).value||'all')}
function crmBtn_crmLogActivity(b){crmLogActivity(b.getAttribute('data-id'))}
function crmBtn_crmNewAgreement(b){crmNewAgreement(b.getAttribute('data-id'))}
function crmBtn_crmNewBuilding(b){crmNewBuilding(b.getAttribute('data-id'))}
function crmBtn_crmNewContact(b){crmNewContact(b.getAttribute('data-id'))}
function crmBtn_crmSetFollowup(b){crmSetFollowup(b.getAttribute('data-id'))}




function crmAccTypeFilter(){
  var q=(document.getElementById('crm-acc-search')||{}).value||''
  renderCrmAccounts(window._crmAccounts||[],q)
}
function renderCrmAccounts(accounts,search){
  var q=search.toLowerCase()
  var filtered=accounts.filter(function(a){
    return !q||(a.name||'').toLowerCase().includes(q)||(a.type||'').toLowerCase().includes(q)||(a.city||'').toLowerCase().includes(q)
  })
  var gc=accounts.filter(function(a){return a.type==='gc'}).length
  var owner=accounts.filter(function(a){return a.type==='owner'}).length
  var pm=accounts.filter(function(a){return a.type==='property_manager'}).length
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat"><div class="stat-label">Total Accounts</div><div class="stat-value">'+accounts.length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">GCs</div><div class="stat-value" style="color:#2563eb">'+gc+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Owners</div><div class="stat-value" style="color:#16a34a">'+owner+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Prop Managers</div><div class="stat-value" style="color:#d97706">'+pm+'</div></div>'
  h+='</div>'
  h+='<div style="display:flex;gap:8px;margin-bottom:14px">'
  h+='<input class="fi" id="crm-acc-search" placeholder="Search accounts..." style="width:250px" oninput="renderCrmAccounts(window._crmAccounts,this.value)">'
  h+='<select class="fs" id="crm-acc-type" style="width:160px" onchange="crmAccTypeFilter()">'
  h+='<option value="">All types</option><option value="gc">General Contractor</option><option value="owner">Owner/Developer</option><option value="property_manager">Property Manager</option><option value="other">Other</option>'
  h+='</select></div>'
  var typeFilter=(document.getElementById('crm-acc-type')||{}).value||''
  if(typeFilter)filtered=filtered.filter(function(a){return a.type===typeFilter})
  if(!filtered.length){document.getElementById('page-area').innerHTML=h+empty('🏢','No accounts yet');return}
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">'
  filtered.forEach(function(a){
    var contacts=(a.crm_contacts||[]).length
    var buildings=(a.crm_buildings||[]).length
    var activeAgreements=(a.crm_agreements||[]).filter(function(x){return x.status==='active'}).length
    var typeColor={gc:'#2563eb',owner:'#16a34a',property_manager:'#d97706',other:'#8a96ab'}[a.type]||'#8a96ab'
    var typeLabel={gc:'General Contractor',owner:'Owner/Developer',property_manager:'Property Manager',other:'Other'}[a.type]||a.type||'—'
    h+='<div class="card" style="cursor:pointer;transition:.15s" data-aid="'+a.id+'" onclick="crmOpenAccountCard(this)" onmouseover="this.style.borderColor=&quot;rgba(37,99,235,.4)&quot;" onmouseout="this.style.borderColor=&quot;rgba(255,255,255,.07)&quot;">'
    h+='<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">'
    h+='<div style="width:38px;height:38px;border-radius:8px;background:rgba(37,99,235,.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🏢</div>'
    h+='<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.name+'</div>'
    h+='<div style="font-size:11px;color:'+typeColor+';margin-top:2px">'+typeLabel+'</div></div></div>'
    if(a.city||a.state)h+='<div style="font-size:11px;color:#8a96ab;margin-bottom:6px">📍 '+(a.city||'')+(a.city&&a.state?', ':'')+( a.state||'')+'</div>'
    if(a.primary_contact)h+='<div style="font-size:11px;color:#8a96ab;margin-bottom:6px">👤 '+a.primary_contact+'</div>'
    if(a.phone)h+='<div style="font-size:11px;color:#8a96ab;margin-bottom:6px">📞 '+a.phone+'</div>'
    h+='<div style="display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#414e63">'
    h+='<span>'+contacts+' contact'+(contacts!==1?'s':'')+'</span>'
    h+='<span>·</span><span>'+buildings+' building'+(buildings!==1?'s':'')+'</span>'
    if(activeAgreements)h+='<span>·</span><span style="color:#16a34a">'+activeAgreements+' active agreement'+(activeAgreements!==1?'s':'')+'</span>'
    h+='</div></div>'
  })
  h+='</div>'
  document.getElementById('page-area').innerHTML=h
}

function crmNewAccount(){
  var typeOpts=['gc','owner','property_manager','other'].map(function(t){
    var l={gc:'General Contractor',owner:'Owner/Developer',property_manager:'Property Manager',other:'Other'}[t]
    return'<option value="'+t+'">'+l+'</option>'
  }).join('')
  var h='<div class="two"><div class="fg"><label class="fl">Account Name *</label><input class="fi" id="ca-name"></div>'
  h+='<div class="fg"><label class="fl">Type</label><select class="fs" id="ca-type">'+typeOpts+'</select></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Phone</label><input class="fi" id="ca-phone" type="tel"></div>'
  h+='<div class="fg"><label class="fl">Email</label><input class="fi" id="ca-email" type="email"></div></div>'
  h+='<div class="fg"><label class="fl">Website</label><input class="fi" id="ca-web" placeholder="https://..."></div>'
  h+='<div class="three"><div class="fg"><label class="fl">City</label><input class="fi" id="ca-city"></div>'
  h+='<div class="fg"><label class="fl">State</label><input class="fi" id="ca-state" style="width:80px"></div>'
  h+='<div class="fg"><label class="fl">Zip</label><input class="fi" id="ca-zip" style="width:90px"></div></div>'
  h+='<div class="fg"><label class="fl">Primary Contact Name</label><input class="fi" id="ca-primary"></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ca-notes" style="min-height:60px"></textarea></div>'
  modal('New Account', h, async function(){
    var name=(document.getElementById('ca-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var res=await sb.from('crm_accounts').insert({id:uuid(),name,type:document.getElementById('ca-type').value,phone:document.getElementById('ca-phone').value||null,email:document.getElementById('ca-email').value||null,website:document.getElementById('ca-web').value||null,city:document.getElementById('ca-city').value||null,state:document.getElementById('ca-state').value||null,zip:document.getElementById('ca-zip').value||null,primary_contact:document.getElementById('ca-primary').value||null,notes:document.getElementById('ca-notes').value||null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgCrmAccounts();toast('Account created')
  },'Create Account')
}

async function crmOpenAccount(id){
  var res=await sb.from('crm_accounts').select('*').eq('id',id).single()
  var a=res.data
  if(!a){toast('Account not found','error');return}
  var [contRes,bldRes,agrRes,actRes,inspRes,jobRes,quoteRes]=await Promise.all([
    sb.from('crm_contacts').select('*').eq('account_id',id).order('name'),
    sb.from('crm_buildings').select('*').eq('account_id',id).order('name'),
    sb.from('crm_agreements').select('*').eq('account_id',id).order('created_at',{ascending:false}),
    sb.from('crm_activities').select('*').eq('account_id',id).order('activity_date',{ascending:false}).limit(20),
    sb.from('crm_inspections').select('*').eq('account_id',id).order('next_due',{ascending:true}),
    sb.from('jobs').select('id,name,phase,created_at').eq('gc_company',a.name).order('created_at',{ascending:false}).limit(10),
    sb.from('fax_bids').select('id,number,project_name,total,status:fax_bid_recipients(status)').eq('project_name',a.name).order('created_at',{ascending:false}).limit(10)
  ])
  window._crmOpenAccount=a
  window._crmOpenId=id
  document.getElementById('topbar-actions').innerHTML=crmOpenAccountTopbar()
  document.getElementById('page-title').textContent=a.name
  var typeLabel={gc:'General Contractor',owner:'Owner/Developer',property_manager:'Property Manager',other:'Other'}[a.type]||a.type||'Account'
  var h='<div style="display:grid;grid-template-columns:1fr 340px;gap:16px">'
  // Left column
  h+='<div>'
  // Account info card
  h+='<div class="card" style="margin-bottom:13px"><div class="card-title">Account Info</div>'
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'
  ;[['Type',typeLabel],['Phone',a.phone||'—'],['Email',a.email||'—'],['Website',a.website||'—'],['City/State',(a.city||'')+(a.city&&a.state?', ':'')+( a.state||'')||'—'],['Primary Contact',a.primary_contact||'—']].forEach(function(r){
    h+='<div><div style="font-size:10px;color:#414e63;text-transform:uppercase;font-weight:600;margin-bottom:2px">'+r[0]+'</div><div>'+r[1]+'</div></div>'
  })
  h+='</div>'
  if(a.notes)h+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#8a96ab">'+a.notes+'</div>'
  h+='</div>'
  // Contacts
  h+='<div class="card" style="margin-bottom:13px"><div class="card-title">Contacts ('+( contRes.data||[]).length+')<button class="btn btn-sm" onclick="crmBtn_crmNewContact(this)" data-id=\\"'+id+'\\" style="margin-left:auto">+ Add</button></div>'
  var conts=contRes.data||[]
  if(conts.length){
    conts.forEach(function(c){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:500">'+c.name+'</div>'
      h+='<div style="font-size:11px;color:#8a96ab">'+(c.title||'')+(c.title&&c.email?' · ':'')+( c.email||'')+'</div></div>'
      if(c.phone)h+='<a href="tel:'+c.phone+'" style="font-size:11px;color:#60a5fa">'+c.phone+'</a>'
      h+='<button class="btn btn-sm btn-ghost" data-cid="'+c.id+'" onclick="crmEditContact(this)">Edit</button></div>'
    })
  }else{h+='<div style="font-size:12px;color:#414e63">No contacts yet</div>'}
  h+='</div>'
  // Buildings
  h+='<div class="card"><div class="card-title">Buildings / Sites ('+(bldRes.data||[]).length+')<button class="btn btn-sm" onclick="crmBtn_crmNewBuilding(this)" data-id=\\"'+id+'\\" style="margin-left:auto">+ Add</button></div>'
  var blds=bldRes.data||[]
  if(blds.length){
    blds.forEach(function(b){
      h+='<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="display:flex;align-items:flex-start;justify-content:space-between">'
      h+='<div><div style="font-size:13px;font-weight:500">'+b.name+'</div>'
      h+='<div style="font-size:11px;color:#8a96ab">'+(b.address||'')+'</div>'
      if(b.system_type)h+='<div style="font-size:10px;color:#414e63;margin-top:2px">'+b.system_type+(b.panel_type?' · '+b.panel_type:'')+(b.device_count?' · '+b.device_count+' devices':'')+'</div>'
      h+='</div>'
      h+='<button class="btn btn-sm btn-ghost" data-bid="'+b.id+'" onclick="crmEditBuilding(this)">Edit</button></div></div>'
    })
  }else{h+='<div style="font-size:12px;color:#414e63">No buildings yet</div>'}
  h+='</div>'
  h+='</div>'
  // Right column
  h+='<div>'
  // Activity feed
  h+='<div class="card" style="margin-bottom:13px"><div class="card-title">Activity<button class="btn btn-sm btn-a" onclick="crmBtn_crmLogActivity(this)" data-id=\\"'+id+'\\" style="margin-left:auto">+ Log</button></div>'
  var acts=actRes.data||[]
  if(acts.length){
    acts.forEach(function(act){
      var typeIcon={call:'📞',email:'📧',meeting:'🤝',visit:'🏗',note:'📝',quote:'📄',other:'💬'}[act.activity_type]||'💬'
      h+='<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="font-size:16px;flex-shrink:0;margin-top:1px">'+typeIcon+'</div>'
      h+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500">'+act.summary+'</div>'
      h+='<div style="font-size:10px;color:#414e63">'+fd(act.activity_date)+' · '+(act.logged_by||'')+'</div>'
      if(act.notes)h+='<div style="font-size:11px;color:#8a96ab;margin-top:2px">'+act.notes+'</div>'
      h+='</div></div>'
    })
  }else{h+='<div style="font-size:12px;color:#414e63">No activity logged yet</div>'}
  h+='</div>'
  // Agreements
  h+='<div class="card" style="margin-bottom:13px"><div class="card-title">Agreements<button class="btn btn-sm" onclick="crmBtn_crmNewAgreement(this)" data-id=\\"'+id+'\\" style="margin-left:auto">+ Add</button></div>'
  var agrs=agrRes.data||[]
  if(agrs.length){
    agrs.forEach(function(ag){
      var stColor={active:'#16a34a',expired:'#dc2626',pending:'#d97706'}[ag.status]||'#8a96ab'
      h+='<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      h+='<div><div style="font-size:13px;font-weight:500">'+ag.name+'</div>'
      h+='<div style="font-size:11px;color:#8a96ab">'+(ag.agreement_type||'')+(ag.value?' · $'+Number(ag.value).toLocaleString():'')+'</div>'
      if(ag.renewal_date)h+='<div style="font-size:10px;color:#414e63">Renewal: '+fd(ag.renewal_date)+'</div>'
      h+='</div><span style="font-size:11px;font-weight:600;color:'+stColor+'">'+ag.status+'</span></div></div>'
    })
  }else{h+='<div style="font-size:12px;color:#414e63">No agreements</div>'}
  h+='</div>'
  // Linked Jobs
  var jobs=jobRes.data||[]
  if(jobs.length){
    h+='<div class="card" style="margin-bottom:13px"><div class="card-title">Linked Jobs ('+jobs.length+')</div>'
    jobs.slice(0,5).forEach(function(j){
      h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer" data-jid="'+j.id+'" onclick="openJobFromJid(this)">'
      h+='<div style="flex:1;font-size:12px;font-weight:500">'+j.name+'</div>'
      h+=stageBadge(j.phase)+'</div>'
    })
    h+='</div>'
  }
  // Follow-up reminder
  if(a.next_followup){
    var fo=new Date(a.next_followup)
    var isOverdue=fo<new Date()
    h+='<div style="background:rgba('+(isOverdue?'220,38,38':'37,99,235')+',.1);border:1px solid rgba('+(isOverdue?'220,38,38':'37,99,235')+',.2);border-radius:8px;padding:10px 13px;font-size:12px">'
    h+='<div style="font-weight:600;color:'+(isOverdue?'#dc2626':'#60a5fa')+'">'+(isOverdue?'⚠ Overdue Follow-up':'📅 Follow-up Scheduled')+'</div>'
    h+='<div style="color:#8a96ab;margin-top:3px">'+fo.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</div>'
    if(a.followup_note)h+='<div style="color:#8a96ab;margin-top:3px">'+a.followup_note+'</div>'
    h+='<button class="btn btn-sm" onclick="crmBtn_crmSetFollowup(this)" data-id=\\"'+id+'\\" style="margin-top:8px">Update</button></div>'
  }else{
    h+='<div class="card"><div class="card-title">Follow-up</div>'
    h+='<button class="btn btn-sm btn-p" onclick="crmBtn_crmSetFollowup(this)" data-id=\\"'+id+'\\">📅 Schedule Follow-up</button></div>'
  }
  h+='</div></div>'
  document.getElementById('page-area').innerHTML=h
}

async function crmEditAccount(id){
  var a=window._crmOpenAccount
  if(!a||a.id!==id){var r=await sb.from('crm_accounts').select('*').eq('id',id).single();a=r.data}
  if(!a)return
  var typeOpts=['gc','owner','property_manager','other'].map(function(t){
    var l={gc:'General Contractor',owner:'Owner/Developer',property_manager:'Property Manager',other:'Other'}[t]
    return'<option value="'+t+'"'+(a.type===t?' selected':'')+'>'+l+'</option>'
  }).join('')
  var h='<div class="two"><div class="fg"><label class="fl">Account Name *</label><input class="fi" id="ea-name" value="'+(a.name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Type</label><select class="fs" id="ea-type">'+typeOpts+'</select></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Phone</label><input class="fi" id="ea-phone" value="'+(a.phone||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Email</label><input class="fi" id="ea-email" value="'+(a.email||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Website</label><input class="fi" id="ea-web" value="'+(a.website||'')+'"></div>'
  h+='<div class="three"><div class="fg"><label class="fl">City</label><input class="fi" id="ea-city" value="'+(a.city||'')+'"></div>'
  h+='<div class="fg"><label class="fl">State</label><input class="fi" id="ea-state" value="'+(a.state||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Zip</label><input class="fi" id="ea-zip" value="'+(a.zip||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Primary Contact</label><input class="fi" id="ea-primary" value="'+(a.primary_contact||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ea-notes">'+(a.notes||'')+'</textarea></div>'
  h+='<div style="padding-top:12px;border-top:1px solid rgba(255,255,255,.06)"><button class="btn btn-ghost btn-sm" style="color:#dc2626" onclick="crmBtn_crmDeleteAccount(this)" data-id=\\"'+id+'\\">Delete Account</button></div>'
  modal('Edit Account', h, async function(){
    var name=(document.getElementById('ea-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var res=await sb.from('crm_accounts').update({name,type:document.getElementById('ea-type').value,phone:document.getElementById('ea-phone').value||null,email:document.getElementById('ea-email').value||null,website:document.getElementById('ea-web').value||null,city:document.getElementById('ea-city').value||null,state:document.getElementById('ea-state').value||null,zip:document.getElementById('ea-zip').value||null,primary_contact:document.getElementById('ea-primary').value||null,notes:document.getElementById('ea-notes').value||null,updated_at:new Date().toISOString()}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();crmOpenAccount(id);toast('Account updated')
  },'Save')
}

async function crmDeleteAccount(id){
  if(!confirm('Delete this account? All contacts, buildings, agreements and activities will be deleted.'))return
  await sb.from('crm_contacts').delete().eq('account_id',id)
  await sb.from('crm_buildings').delete().eq('account_id',id)
  await sb.from('crm_agreements').delete().eq('account_id',id)
  await sb.from('crm_activities').delete().eq('account_id',id)
  await sb.from('crm_inspections').delete().eq('account_id',id)
  await sb.from('crm_accounts').delete().eq('id',id)
  closeModal();pgCrmAccounts();toast('Account deleted','warn')
}

async function crmSetFollowup(id){
  var a=window._crmOpenAccount
  var h='<div class="fg"><label class="fl">Follow-up Date</label><input class="fi" type="date" id="fu-date" value="'+(a&&a.next_followup?a.next_followup.split('T')[0]:'')+'"></div>'
  h+='<div class="fg"><label class="fl">Note</label><input class="fi" id="fu-note" placeholder="What to follow up on..." value="'+(a&&a.followup_note||'')+'"></div>'
  modal('Schedule Follow-up', h, async function(){
    var date=document.getElementById('fu-date').value
    var note=document.getElementById('fu-note').value||null
    await sb.from('crm_accounts').update({next_followup:date||null,followup_note:note,updated_at:new Date().toISOString()}).eq('id',id)
    if(window._crmOpenAccount){window._crmOpenAccount.next_followup=date;window._crmOpenAccount.followup_note=note}
    closeModal();crmOpenAccount(id);toast('Follow-up set')
  },'Save')
}

// ── CONTACTS ────────────────────────────────────────────────────
async function pgCrmContacts(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-p btn-sm" onclick="crmNewContact(null)">+ New Contact</button>'
  var res=await sb.from('crm_contacts').select('*,crm_accounts(id,name,type)').order('name',{ascending:true})
  var contacts=res.data||[]
  var h='<div style="margin-bottom:12px"><input class="fi" id="crm-cnt-s" placeholder="Search contacts..." style="max-width:300px" oninput="filterCrmContacts(this.value)"></div>'
  h+='<div id="crm-cnt-list">'
  h+=renderContactsTable(contacts)
  h+='</div>'
  document.getElementById('page-area').innerHTML=h
  window._crmAllContacts=contacts
}

function renderContactsTable(contacts){
  if(!contacts.length)return empty('👤','No contacts yet')
  var h='<table class="tbl"><thead><tr><th>Name</th><th>Title</th><th>Account</th><th>Phone</th><th>Email</th><th>Last Contact</th><th></th></tr></thead><tbody>'
  contacts.forEach(function(c){
    var acc=c.crm_accounts
    h+='<tr>'
    h+='<td style="font-weight:500">'+c.name+'</td>'
    h+='<td style="font-size:11px;color:#8a96ab">'+(c.title||'—')+'</td>'
    h+='<td>'+(acc?'<a href="javascript:void(0)" data-aid="'+(acc.id||'')+'" onclick="crmOpenAccountCard(this)" style="color:#60a5fa">'+acc.name+'</a>':'—')+'</td>'
    h+='<td style="font-size:12px">'+(c.phone?'<a href="tel:'+c.phone+'" style="color:#e8edf5">'+c.phone+'</a>':'—')+'</td>'
    h+='<td style="font-size:12px">'+(c.email?'<a href="mailto:'+c.email+'" style="color:#60a5fa">'+c.email+'</a>':'—')+'</td>'
    h+='<td style="font-size:11px;color:#8a96ab">'+(c.last_contacted?fd(c.last_contacted):'Never')+'</td>'
    h+='<td><button class="btn btn-sm btn-ghost" data-cid="'+c.id+'" onclick="crmEditContact(this)">Edit</button></td></tr>'
  })
  return h+'</tbody></table>'
}

function filterCrmContacts(q){
  var filtered=(window._crmAllContacts||[]).filter(function(c){
    var s=(c.name||'')+(c.title||'')+(c.email||'')+(c.phone||'')+((c.crm_accounts||{}).name||'')
    return s.toLowerCase().includes(q.toLowerCase())
  })
  var el=document.getElementById('crm-cnt-list')
  if(el)el.innerHTML=renderContactsTable(filtered)
}

function crmNewContact(accountId){
  var h=''
  if(!accountId){
    h+='<div class="fg"><label class="fl">Account</label><select class="fs" id="nc-acc"><option value="">— No account —</option>'
    ;(window._crmAccounts||[]).forEach(function(a){h+='<option value="'+a.id+'">'+a.name+'</option>'})
    h+='</select></div>'
  }
  h+='<div class="two"><div class="fg"><label class="fl">Full Name *</label><input class="fi" id="nc-name"></div>'
  h+='<div class="fg"><label class="fl">Title / Role</label><input class="fi" id="nc-title" placeholder="Project Manager, Owner..."></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Phone</label><input class="fi" id="nc-phone" type="tel"></div>'
  h+='<div class="fg"><label class="fl">Email</label><input class="fi" id="nc-email" type="email"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="nc-notes" style="min-height:50px"></textarea></div>'
  modal('New Contact', h, async function(){
    var name=(document.getElementById('nc-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var accId=accountId||(document.getElementById('nc-acc')||{}).value||null
    var res=await sb.from('crm_contacts').insert({id:uuid(),account_id:accId||null,name,title:document.getElementById('nc-title').value||null,phone:document.getElementById('nc-phone').value||null,email:document.getElementById('nc-email').value||null,notes:document.getElementById('nc-notes').value||null,created_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal()
    if(accountId)crmOpenAccount(accountId)
    else pgCrmContacts()
    toast('Contact added')
  },'Add Contact')
}

async function crmEditContact(btn){
  var id=btn.getAttribute('data-cid')
  var r=await sb.from('crm_contacts').select('*').eq('id',id).single()
  var c=r.data;if(!c)return
  var h='<div class="two"><div class="fg"><label class="fl">Full Name *</label><input class="fi" id="ec-name" value="'+(c.name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Title</label><input class="fi" id="ec-title" value="'+(c.title||'')+'"></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Phone</label><input class="fi" id="ec-phone" value="'+(c.phone||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Email</label><input class="fi" id="ec-email" value="'+(c.email||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ec-notes">'+(c.notes||'')+'</textarea></div>'
  h+='<div class="fg"><label class="fl">Last Contacted</label><input class="fi" type="date" id="ec-lc" value="'+(c.last_contacted?c.last_contacted.split('T')[0]:'')+'"></div>'
  modal('Edit Contact', h, async function(){
    var name=(document.getElementById('ec-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var res=await sb.from('crm_contacts').update({name,title:document.getElementById('ec-title').value||null,phone:document.getElementById('ec-phone').value||null,email:document.getElementById('ec-email').value||null,notes:document.getElementById('ec-notes').value||null,last_contacted:document.getElementById('ec-lc').value||null,updated_at:new Date().toISOString()}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal()
    if(c.account_id)crmOpenAccount(c.account_id)
    else pgCrmContacts()
    toast('Contact updated')
  },'Save')
}

// ── BUILDINGS ───────────────────────────────────────────────────
function crmNewBuilding(accountId){
  var h='<div class="fg"><label class="fl">Building Name *</label><input class="fi" id="nb-name" placeholder="Main Office, Warehouse 2..."></div>'
  h+='<div class="fg"><label class="fl">Address</label><input class="fi" id="nb-addr"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">City</label><input class="fi" id="nb-city"></div>'
  h+='<div class="fg"><label class="fl">State</label><input class="fi" id="nb-state"></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">System Type</label><select class="fs" id="nb-sys"><option value="">— Select —</option><option>Addressable</option><option>Conventional</option><option>Hybrid</option><option>Wireless</option><option>Suppression</option></select></div>'
  h+='<div class="fg"><label class="fl">Panel Type</label><input class="fi" id="nb-panel" placeholder="Notifier, Simplex..."></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Device Count</label><input class="fi" type="number" id="nb-devices" placeholder="# of devices"></div>'
  h+='<div class="fg"><label class="fl">Sq Footage</label><input class="fi" type="number" id="nb-sqft"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="nb-notes" style="min-height:50px"></textarea></div>'
  modal('New Building / Site', h, async function(){
    var name=(document.getElementById('nb-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var res=await sb.from('crm_buildings').insert({id:uuid(),account_id:accountId,name,address:document.getElementById('nb-addr').value||null,city:document.getElementById('nb-city').value||null,state:document.getElementById('nb-state').value||null,system_type:document.getElementById('nb-sys').value||null,panel_type:document.getElementById('nb-panel').value||null,device_count:parseInt(document.getElementById('nb-devices').value)||null,sq_footage:parseInt(document.getElementById('nb-sqft').value)||null,notes:document.getElementById('nb-notes').value||null,created_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal();crmOpenAccount(accountId);toast('Building added')
  },'Add Building')
}

async function crmEditBuilding(btn){
  var id=btn.getAttribute('data-bid')
  var r=await sb.from('crm_buildings').select('*').eq('id',id).single()
  var b=r.data;if(!b)return
  var sysOpts=['','Addressable','Conventional','Hybrid','Wireless','Suppression'].map(function(s){return'<option'+(b.system_type===s?' selected':'')+'>'+s+'</option>'}).join('')
  var h='<div class="fg"><label class="fl">Name *</label><input class="fi" id="eb-name" value="'+(b.name||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Address</label><input class="fi" id="eb-addr" value="'+(b.address||'')+'"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">System Type</label><select class="fs" id="eb-sys">'+sysOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Panel Type</label><input class="fi" id="eb-panel" value="'+(b.panel_type||'')+'"></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Devices</label><input class="fi" type="number" id="eb-dev" value="'+(b.device_count||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Sq Ft</label><input class="fi" type="number" id="eb-sqft" value="'+(b.sq_footage||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="eb-notes">'+(b.notes||'')+'</textarea></div>'
  modal('Edit Building', h, async function(){
    var res=await sb.from('crm_buildings').update({name:document.getElementById('eb-name').value,address:document.getElementById('eb-addr').value||null,system_type:document.getElementById('eb-sys').value||null,panel_type:document.getElementById('eb-panel').value||null,device_count:parseInt(document.getElementById('eb-dev').value)||null,sq_footage:parseInt(document.getElementById('eb-sqft').value)||null,notes:document.getElementById('eb-notes').value||null}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();crmOpenAccount(b.account_id);toast('Building updated')
  },'Save')
}

// ── AGREEMENTS ──────────────────────────────────────────────────
function crmNewAgreement(accountId){
  var h='<div class="fg"><label class="fl">Agreement Name *</label><input class="fi" id="ag-name" placeholder="Annual Inspection Contract, Monitoring Agreement..."></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Type</label><select class="fs" id="ag-type"><option value="">— Select —</option><option value="inspection">Inspection</option><option value="monitoring">Monitoring</option><option value="service">Service</option><option value="installation">Installation</option><option value="other">Other</option></select></div>'
  h+='<div class="fg"><label class="fl">Status</label><select class="fs" id="ag-stat"><option value="active">Active</option><option value="pending">Pending</option><option value="expired">Expired</option></select></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Value ($/yr)</label><input class="fi" type="number" id="ag-val" placeholder="0.00" step="0.01"></div>'
  h+='<div class="fg"><label class="fl">Renewal Date</label><input class="fi" type="date" id="ag-renew"></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Start Date</label><input class="fi" type="date" id="ag-start"></div>'
  h+='<div class="fg"><label class="fl">End Date</label><input class="fi" type="date" id="ag-end"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ag-notes" style="min-height:50px"></textarea></div>'
  modal('New Agreement', h, async function(){
    var name=(document.getElementById('ag-name').value||'').trim()
    if(!name){toast('Name required','error');return}
    var res=await sb.from('crm_agreements').insert({id:uuid(),account_id:accountId,name,agreement_type:document.getElementById('ag-type').value||null,status:document.getElementById('ag-stat').value,value:parseFloat(document.getElementById('ag-val').value)||null,renewal_date:document.getElementById('ag-renew').value||null,start_date:document.getElementById('ag-start').value||null,end_date:document.getElementById('ag-end').value||null,notes:document.getElementById('ag-notes').value||null,created_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal();crmOpenAccount(accountId);toast('Agreement added')
  },'Add Agreement')
}

// ── ACTIVITY LOG ────────────────────────────────────────────────
function crmLogActivity(accountId){
  var typeOpts=['call','email','meeting','visit','note','quote','other'].map(function(t){
    var l={call:'📞 Call',email:'📧 Email',meeting:'🤝 Meeting',visit:'🏗 Site Visit',note:'📝 Note',quote:'📄 Quote Sent',other:'💬 Other'}[t]
    return'<option value="'+t+'">'+l+'</option>'
  }).join('')
  var h='<div class="two"><div class="fg"><label class="fl">Type</label><select class="fs" id="act-type">'+typeOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Date</label><input class="fi" type="date" id="act-date" value="'+new Date().toISOString().split('T')[0]+'"></div></div>'
  h+='<div class="fg"><label class="fl">Summary *</label><input class="fi" id="act-sum" placeholder="Brief description..."></div>'
  h+='<div class="fg"><label class="fl">Details / Notes</label><textarea class="ft" id="act-notes" style="min-height:70px"></textarea></div>'
  h+='<div class="fg"><label class="fl">Follow-up Date (optional)</label><input class="fi" type="date" id="act-fu"></div>'
  modal('Log Activity', h, async function(){
    var sum=(document.getElementById('act-sum').value||'').trim()
    if(!sum){toast('Summary required','error');return}
    var res=await sb.from('crm_activities').insert({id:uuid(),account_id:accountId,activity_type:document.getElementById('act-type').value,activity_date:document.getElementById('act-date').value,summary:sum,notes:document.getElementById('act-notes').value||null,logged_by:(typeof ME!=='undefined'?ME.full_name||'':''),created_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    // Update follow-up if set
    var fu=document.getElementById('act-fu').value
    if(fu)await sb.from('crm_accounts').update({next_followup:fu,updated_at:new Date().toISOString()}).eq('id',accountId)
    // Update last_contacted on all contacts for this account
    await sb.from('crm_contacts').update({last_contacted:document.getElementById('act-date').value}).eq('account_id',accountId)
    closeModal();crmOpenAccount(accountId);toast('Activity logged')
  },'Log Activity')
}

// ── PIPELINE ────────────────────────────────────────────────────
async function pgCrmPipeline(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-p btn-sm" onclick="crmNewLead()">+ New Lead</button>'
  var res=await sb.from('crm_pipeline').select('*,crm_accounts(name)').order('created_at',{ascending:false})
  var leads=res.data||[]
  var stages=['new_lead','contacted','qualified','quoted','negotiating','awarded','lost']
  var stageLabels={new_lead:'New Lead',contacted:'Contacted',qualified:'Qualified',quoted:'Quoted',negotiating:'Negotiating',awarded:'Awarded',lost:'Lost'}
  var stageColors={new_lead:'#414e63',contacted:'#2563eb',qualified:'#d97706',quoted:'#8b5cf6',negotiating:'#f59e0b',awarded:'#16a34a',lost:'#dc2626'}
  // Stats
  var open=leads.filter(function(l){return!['awarded','lost'].includes(l.stage)})
  var pipeline=open.reduce(function(s,l){return s+(l.value||0)},0)
  var awarded=leads.filter(function(l){return l.stage==='awarded'}).reduce(function(s,l){return s+(l.value||0)},0)
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat"><div class="stat-label">Open Leads</div><div class="stat-value">'+open.length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Pipeline Value</div><div class="stat-value" style="font-size:18px">'+fm(pipeline)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Awarded</div><div class="stat-value" style="color:#16a34a;font-size:18px">'+fm(awarded)+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Win Rate</div><div class="stat-value">'+(leads.filter(function(l){return['awarded','lost'].includes(l.stage)}).length?Math.round(leads.filter(function(l){return l.stage==='awarded'}).length/leads.filter(function(l){return['awarded','lost'].includes(l.stage)}).length*100):0)+'%</div></div>'
  h+='</div>'
  // Kanban board
  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;overflow-x:auto">'
  stages.forEach(function(stage){
    var col=leads.filter(function(l){return l.stage===stage})
    var colVal=col.reduce(function(s,l){return s+(l.value||0)},0)
    h+='<div style="background:#0c1220;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;min-height:200px">'
    h+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:'+stageColors[stage]+';margin-bottom:6px">'+stageLabels[stage]+'</div>'
    h+='<div style="font-size:10px;color:#414e63;margin-bottom:10px">'+col.length+' · '+fm(colVal)+'</div>'
    col.forEach(function(l){
      var acc=l.crm_accounts
      h+='<div style="background:#131c2e;border:1px solid rgba(255,255,255,.07);border-radius:7px;padding:8px 10px;margin-bottom:7px;cursor:pointer" data-lid="'+l.id+'" onclick="crmEditLead(this)">'
      h+='<div style="font-size:12px;font-weight:500;margin-bottom:3px">'+l.title+'</div>'
      if(acc)h+='<div style="font-size:10px;color:#8a96ab">'+acc.name+'</div>'
      if(l.value)h+='<div style="font-size:11px;color:#16a34a;margin-top:4px">'+fm(l.value)+'</div>'
      if(l.close_date){
        var cd=new Date(l.close_date)
        var overdue=cd<new Date()&&!['awarded','lost'].includes(l.stage)
        h+='<div style="font-size:10px;color:'+(overdue?'#dc2626':'#414e63')+';margin-top:3px">Close: '+fd(l.close_date)+'</div>'
      }
      h+='</div>'
    })
    h+='</div>'
  })
  h+='</div>'
  document.getElementById('page-area').innerHTML=h
  window._crmLeads=leads
}

async function crmNewLead(){
  if(!window._crmAccounts){var r=await sb.from('crm_accounts').select('id,name').order('name');window._crmAccounts=r.data||[]}
  var accOpts='<option value="">— No account —</option>'+(window._crmAccounts||[]).map(function(a){return'<option value="'+a.id+'">'+a.name+'</option>'}).join('')
  var stageOpts=['new_lead','contacted','qualified','quoted','negotiating','awarded','lost'].map(function(s){
    var l={new_lead:'New Lead',contacted:'Contacted',qualified:'Qualified',quoted:'Quoted',negotiating:'Negotiating',awarded:'Awarded',lost:'Lost'}[s]
    return'<option value="'+s+'">'+l+'</option>'
  }).join('')
  var h='<div class="fg"><label class="fl">Title / Opportunity *</label><input class="fi" id="nl-title" placeholder="Fire Alarm Install - Building Name"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Account</label><select class="fs" id="nl-acc">'+accOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Stage</label><select class="fs" id="nl-stage">'+stageOpts+'</select></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Value ($)</label><input class="fi" type="number" id="nl-val" step="0.01"></div>'
  h+='<div class="fg"><label class="fl">Expected Close Date</label><input class="fi" type="date" id="nl-close"></div></div>'
  h+='<div class="fg"><label class="fl">Description</label><textarea class="ft" id="nl-desc" style="min-height:60px"></textarea></div>'
  modal('New Lead / Opportunity', h, async function(){
    var title=(document.getElementById('nl-title').value||'').trim()
    if(!title){toast('Title required','error');return}
    var res=await sb.from('crm_pipeline').insert({id:uuid(),title,account_id:document.getElementById('nl-acc').value||null,stage:document.getElementById('nl-stage').value,value:parseFloat(document.getElementById('nl-val').value)||null,close_date:document.getElementById('nl-close').value||null,description:document.getElementById('nl-desc').value||null,created_by:(typeof ME!=='undefined'?ME.full_name||'':''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgCrmPipeline();toast('Lead added')
  },'Add Lead')
}

async function crmEditLead(el){
  var id=el.getAttribute('data-lid')
  var l=(window._crmLeads||[]).find(function(x){return x.id===id})
  if(!l){var r=await sb.from('crm_pipeline').select('*').eq('id',id).single();l=r.data}
  if(!l)return
  var stageOpts=['new_lead','contacted','qualified','quoted','negotiating','awarded','lost'].map(function(s){
    var lab={new_lead:'New Lead',contacted:'Contacted',qualified:'Qualified',quoted:'Quoted',negotiating:'Negotiating',awarded:'Awarded',lost:'Lost'}[s]
    return'<option value="'+s+'"'+(l.stage===s?' selected':'')+'>'+lab+'</option>'
  }).join('')
  var h='<div class="fg"><label class="fl">Title *</label><input class="fi" id="el-title" value="'+(l.title||'')+'"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Stage</label><select class="fs" id="el-stage">'+stageOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Value ($)</label><input class="fi" type="number" id="el-val" value="'+(l.value||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Expected Close</label><input class="fi" type="date" id="el-close" value="'+(l.close_date||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Description</label><textarea class="ft" id="el-desc">'+(l.description||'')+'</textarea></div>'
  h+='<div style="padding-top:10px;border-top:1px solid rgba(255,255,255,.06)"><button class="btn btn-ghost btn-sm" style="color:#dc2626" data-lid="'+id+'" onclick="crmDeleteLead(this)">Delete Lead</button></div>'
  modal('Edit Lead', h, async function(){
    var title=(document.getElementById('el-title').value||'').trim()
    if(!title){toast('Title required','error');return}
    var newStage=document.getElementById('el-stage').value
    var updates={title,stage:newStage,value:parseFloat(document.getElementById('el-val').value)||null,close_date:document.getElementById('el-close').value||null,description:document.getElementById('el-desc').value||null,updated_at:new Date().toISOString()}
    // If awarded, offer to create a job
    await sb.from('crm_pipeline').update(updates).eq('id',id)
    closeModal()
    if(newStage==='awarded'&&l.stage!=='awarded'){
      if(confirm('Lead marked Awarded! Create a new job from this opportunity?')){
        P('newjob',document.querySelector('.nav-item[onclick*=newjob]'))
        setTimeout(function(){
          var nj=document.getElementById('nj-name')
          if(nj)nj.value=title
        },300)
      }
    }
    pgCrmPipeline();toast('Lead updated')
  },'Save')
}

async function crmDeleteLead(btn){
  var id=btn.getAttribute('data-lid')
  if(!confirm('Delete this lead?'))return
  await sb.from('crm_pipeline').delete().eq('id',id)
  closeModal();pgCrmPipeline();toast('Lead deleted','warn')
}

// ── INSPECTIONS ─────────────────────────────────────────────────
async function pgCrmInspections(){
  document.getElementById('topbar-actions').innerHTML=
    '<button class="btn btn-p btn-sm" onclick="crmNewInspection()">+ Schedule Inspection</button>'
  var res=await sb.from('crm_inspections').select('*,crm_accounts(name),crm_buildings(name,address)').order('next_due',{ascending:true})
  var insps=res.data||[]
  var now=new Date()
  var overdue=insps.filter(function(i){return new Date(i.next_due)<now&&i.status!=='completed'})
  var due30=insps.filter(function(i){var d=new Date(i.next_due);return d>=now&&d<=new Date(now.getTime()+30*86400000)&&i.status!=='completed'})
  var due90=insps.filter(function(i){var d=new Date(i.next_due);return d>new Date(now.getTime()+30*86400000)&&d<=new Date(now.getTime()+90*86400000)&&i.status!=='completed'})
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:16px">'
  h+='<div class="stat" style="border-left:3px solid #dc2626"><div class="stat-label">Overdue</div><div class="stat-value" style="color:#dc2626">'+overdue.length+'</div></div>'
  h+='<div class="stat" style="border-left:3px solid #d97706"><div class="stat-label">Due in 30 Days</div><div class="stat-value" style="color:#d97706">'+due30.length+'</div></div>'
  h+='<div class="stat" style="border-left:3px solid #2563eb"><div class="stat-label">Due in 90 Days</div><div class="stat-value" style="color:#2563eb">'+due90.length+'</div></div>'
  h+='<div class="stat"><div class="stat-label">Total Tracked</div><div class="stat-value">'+insps.length+'</div></div>'
  h+='</div>'
  h+='<div style="display:flex;gap:8px;margin-bottom:14px">'
  h+='<select class="fs" id="insp-filter" style="width:180px" onchange="filterInspections(this.value)">'
  h+='<option value="all">All Inspections</option><option value="overdue">Overdue</option><option value="30">Due in 30 days</option><option value="90">Due in 90 days</option><option value="completed">Completed</option></select>'
  h+='<input class="fi" id="insp-search" placeholder="Search..." style="width:220px" oninput="crmInspSearchFilter(this.value)">'
  h+='</div>'
  h+='<div id="insp-list">'+buildInspTable(insps)+'</div>'
  document.getElementById('page-area').innerHTML=h
  window._crmInspections=insps
}

function buildInspTable(insps){
  if(!insps.length)return empty('🔍','No inspections tracked yet')
  var now=new Date()
  var h='<table class="tbl"><thead><tr><th>Building / Site</th><th>Account</th><th>Type</th><th>Last Done</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>'
  insps.forEach(function(i){
    var nextDue=new Date(i.next_due)
    var daysUntil=Math.ceil((nextDue-now)/86400000)
    var dueColor=daysUntil<0?'#dc2626':daysUntil<=30?'#d97706':daysUntil<=90?'#2563eb':'#8a96ab'
    var dueLabel=daysUntil<0?Math.abs(daysUntil)+'d overdue':daysUntil===0?'Today':daysUntil+'d'
    var bld=i.crm_buildings
    var acc=i.crm_accounts
    var stColor={scheduled:'#2563eb',completed:'#16a34a',overdue:'#dc2626',cancelled:'#414e63'}[i.status]||'#8a96ab'
    h+='<tr>'
    h+='<td style="font-weight:500">'+(bld?bld.name:i.building_name||'—')+'<div style="font-size:10px;color:#414e63">'+(bld?bld.address||'':'')+'</div></td>'
    h+='<td style="font-size:12px">'+(acc?acc.name:'—')+'</td>'
    h+='<td style="font-size:12px">'+(i.inspection_type||'Annual')+'</td>'
    h+='<td style="font-size:12px;color:#8a96ab">'+(i.last_completed?fd(i.last_completed):'Never')+'</td>'
    h+='<td><div style="font-weight:500;color:'+dueColor+'">'+fd(i.next_due)+'</div><div style="font-size:10px;color:'+dueColor+'">'+dueLabel+'</div></td>'
    h+='<td><span style="font-size:11px;font-weight:600;color:'+stColor+'">'+i.status+'</span></td>'
    h+='<td style="display:flex;gap:4px">'
    if(i.status!=='completed')h+='<button class="btn btn-sm btn-g" data-iid="'+i.id+'" onclick="crmCompleteInspection(this)">Complete</button>'
    h+='<button class="btn btn-sm btn-ghost" data-iid="'+i.id+'" onclick="crmEditInspection(this)">Edit</button>'
    h+='</td></tr>'
  })
  return h+'</tbody></table>'
}

function filterInspections(filter){
  var q=(document.getElementById('insp-search')||{}).value||''
  var now=new Date()
  var insps=(window._crmInspections||[]).filter(function(i){
    var matchQ=!q||(((i.crm_buildings||{}).name||i.building_name||'')+((i.crm_accounts||{}).name||'')+( i.inspection_type||'')).toLowerCase().includes(q.toLowerCase())
    if(!matchQ)return false
    if(filter==='all')return true
    var d=new Date(i.next_due)
    if(filter==='overdue')return d<now&&i.status!=='completed'
    if(filter==='30')return d>=now&&d<=new Date(now.getTime()+30*86400000)&&i.status!=='completed'
    if(filter==='90')return d>=now&&d<=new Date(now.getTime()+90*86400000)&&i.status!=='completed'
    if(filter==='completed')return i.status==='completed'
    return true
  })
  var el=document.getElementById('insp-list')
  if(el)el.innerHTML=buildInspTable(insps)
}

async function crmNewInspection(){
  if(!window._crmAccounts){var r=await sb.from('crm_accounts').select('id,name').order('name');window._crmAccounts=r.data||[]}
  var accOpts='<option value="">— No account —</option>'+(window._crmAccounts||[]).map(function(a){return'<option value="'+a.id+'">'+a.name+'</option>'}).join('')
  var h='<div class="fg"><label class="fl">Account</label><select class="fs" id="ni-acc" onchange="loadBuildingsForInspection(this.value)">'+accOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Building / Site</label><select class="fs" id="ni-bld"><option value="">— Select account first —</option></select></div>'
  h+='<div class="fg"><label class="fl">Or enter building name manually</label><input class="fi" id="ni-bname" placeholder="Leave blank if selected above"></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Inspection Type</label><select class="fs" id="ni-type"><option value="Annual">Annual</option><option value="Semi-Annual">Semi-Annual</option><option value="Quarterly">Quarterly</option><option value="Monthly">Monthly</option><option value="Pre-Test">Pre-Test</option><option value="Final">Final</option><option value="Other">Other</option></select></div>'
  h+='<div class="fg"><label class="fl">Next Due Date *</label><input class="fi" type="date" id="ni-due"></div></div>'
  h+='<div class="fg"><label class="fl">Last Completed Date</label><input class="fi" type="date" id="ni-last"></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ni-notes" style="min-height:50px"></textarea></div>'
  modal('Schedule Inspection', h, async function(){
    var due=document.getElementById('ni-due').value
    if(!due){toast('Due date required','error');return}
    var accId=document.getElementById('ni-acc').value||null
    var bldId=document.getElementById('ni-bld').value||null
    var bname=document.getElementById('ni-bname').value||null
    var res=await sb.from('crm_inspections').insert({id:uuid(),account_id:accId,building_id:bldId||null,building_name:bname,inspection_type:document.getElementById('ni-type').value,next_due:due,last_completed:document.getElementById('ni-last').value||null,status:'scheduled',notes:document.getElementById('ni-notes').value||null,created_at:new Date().toISOString()})
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgCrmInspections();toast('Inspection scheduled')
  },'Schedule')
}

async function loadBuildingsForInspection(accountId){
  var sel=document.getElementById('ni-bld')
  if(!sel)return
  if(!accountId){sel.innerHTML='<option value="">— Select account first —</option>';return}
  var r=await sb.from('crm_buildings').select('id,name').eq('account_id',accountId).order('name')
  sel.innerHTML='<option value="">— Select building —</option>'+( r.data||[]).map(function(b){return'<option value="'+b.id+'">'+b.name+'</option>'}).join('')
}

async function crmCompleteInspection(btn){
  var id=btn.getAttribute('data-iid')
  var today=new Date().toISOString().split('T')[0]
  var insp=(window._crmInspections||[]).find(function(x){return x.id===id})
  // Calculate next due based on type
  var nextDue=new Date()
  var type=(insp||{}).inspection_type||'Annual'
  if(type==='Annual')nextDue.setFullYear(nextDue.getFullYear()+1)
  else if(type==='Semi-Annual')nextDue.setMonth(nextDue.getMonth()+6)
  else if(type==='Quarterly')nextDue.setMonth(nextDue.getMonth()+3)
  else if(type==='Monthly')nextDue.setMonth(nextDue.getMonth()+1)
  else nextDue.setFullYear(nextDue.getFullYear()+1)
  var nextDueStr=nextDue.toISOString().split('T')[0]
  var notes=prompt('Completion notes (optional):')||null
  // Mark current as completed
  await sb.from('crm_inspections').update({status:'completed',last_completed:today,completion_notes:notes,updated_at:new Date().toISOString()}).eq('id',id)
  // Schedule next inspection
  await sb.from('crm_inspections').insert({id:uuid(),account_id:(insp||{}).account_id,building_id:(insp||{}).building_id,building_name:(insp||{}).building_name,inspection_type:type,next_due:nextDueStr,status:'scheduled',created_at:new Date().toISOString()})
  pgCrmInspections();toast('Inspection completed — next '+type+' scheduled for '+fd(nextDueStr))
}

async function crmEditInspection(btn){
  var id=btn.getAttribute('data-iid')
  var r=await sb.from('crm_inspections').select('*').eq('id',id).single()
  var i=r.data;if(!i)return
  var typeOpts=['Annual','Semi-Annual','Quarterly','Monthly','Pre-Test','Final','Other'].map(function(t){return'<option'+(i.inspection_type===t?' selected':'')+'>'+t+'</option>'}).join('')
  var statOpts=['scheduled','completed','overdue','cancelled'].map(function(s){return'<option value="'+s+'"'+(i.status===s?' selected':'')+'>'+s+'</option>'}).join('')
  var h='<div class="two"><div class="fg"><label class="fl">Type</label><select class="fs" id="ei-type">'+typeOpts+'</select></div>'
  h+='<div class="fg"><label class="fl">Status</label><select class="fs" id="ei-stat">'+statOpts+'</select></div></div>'
  h+='<div class="two"><div class="fg"><label class="fl">Next Due</label><input class="fi" type="date" id="ei-due" value="'+(i.next_due||'')+'"></div>'
  h+='<div class="fg"><label class="fl">Last Completed</label><input class="fi" type="date" id="ei-last" value="'+(i.last_completed||'')+'"></div></div>'
  h+='<div class="fg"><label class="fl">Notes</label><textarea class="ft" id="ei-notes">'+(i.notes||'')+'</textarea></div>'
  modal('Edit Inspection', h, async function(){
    var res=await sb.from('crm_inspections').update({inspection_type:document.getElementById('ei-type').value,status:document.getElementById('ei-stat').value,next_due:document.getElementById('ei-due').value,last_completed:document.getElementById('ei-last').value||null,notes:document.getElementById('ei-notes').value||null,updated_at:new Date().toISOString()}).eq('id',id)
    if(res.error){toast(res.error.message,'error');return}
    closeModal();pgCrmInspections();toast('Inspection updated')
  },'Save')
}


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
    if (/^\/award\/[a-f0-9]{64}$/.test(p)) { res.writeHead(200, h); return res.end(HTML_AWARD) }
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
    const validRoles = ['admin', 'pm', 'estimator', 'foreman', 'stager', 'signout', 'requestor', 'technician', 'sub_lead', 'sub_worker'];
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


  // ── FIELDAXISHQ BID ENGINE API ROUTES ──────────────────────────────────────────────────
  // GET /api/qf/award/:token — public, no auth
  const awardM = p.match(/^\/api\/qf\/award\/([a-f0-9]{64})$/);
  if (awardM && method === 'GET') {
    try {
      const token = awardM[1];
      const recs = await dbGet('fax_bid_recipients', { token: 'eq.' + token, select: '*' });
      const rec = recs[0]; if (!rec) return json(res, 404, { error: 'Invalid or expired link' });
      if (rec.status === 'sent') {
        await dbUpdate('fax_bid_recipients', { status: 'viewed', viewed_at: new Date().toISOString() }, { id: 'eq.' + rec.id });
        rec.status = 'viewed';
      }
      const quote = (await dbGet('fax_bids', { id: 'eq.' + rec.quote_id, select: '*' }))[0];
      if (!quote) return json(res, 404, { error: 'Quote not found' });
      const branding = (await dbGet('fax_bid_branding', { select: '*' }).catch(() => []))[0];
      const allRecs = await dbGet('fax_bid_recipients', { quote_id: 'eq.' + rec.quote_id, select: 'id,status' });
      const awardedElsewhere = allRecs.some(r => r.id !== rec.id && r.status === 'awarded');
      return json(res, 200, { quote, recipient: rec, branding: branding || {}, awardedElsewhere });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // POST /api/qf/award/:token — submit award signature (public, no auth)
  if (awardM && method === 'POST') {
    try {
      const token = awardM[1];
      const rec = (await dbGet('fax_bid_recipients', { token: 'eq.' + token, select: '*' }))[0];
      if (!rec) return json(res, 404, { error: 'Invalid link' });
      if (rec.status === 'awarded') return json(res, 400, { error: 'Already awarded' });
      const allRecs = await dbGet('fax_bid_recipients', { quote_id: 'eq.' + rec.quote_id, select: 'id,status' });
      if (allRecs.some(r => r.id !== rec.id && r.status === 'awarded')) return json(res, 400, { error: 'This bid has been awarded to another party' });
      const b = await readBody(req);
      if (!b.signature_name || !b.signature_image) return json(res, 400, { error: 'Signature required' });
      await dbUpdate('fax_bid_recipients', { status: 'awarded', awarded_at: new Date().toISOString(), signature_name: b.signature_name, signature_title: b.signature_title || '', signature_email: b.signature_email || '', signature_image: b.signature_image, signature_timestamp: new Date().toISOString() }, { id: 'eq.' + rec.id });
      return json(res, 200, { ok: true });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // POST /api/qf/award/:token/decline — decline from public page
  const awardDecM = p.match(/^\/api\/qf\/award\/([a-f0-9]{64})\/decline$/);
  if (awardDecM && method === 'POST') {
    try {
      const token = awardDecM[1];
      const rec = (await dbGet('fax_bid_recipients', { token: 'eq.' + token, select: '*' }))[0];
      if (!rec) return json(res, 404, { error: 'Invalid link' });
      const b = await readBody(req);
      await dbUpdate('fax_bid_recipients', { status: 'declined', declined_at: new Date().toISOString(), decline_reason: b.decline_reason || '' }, { id: 'eq.' + rec.id });
      return json(res, 200, { ok: true });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // POST /api/qf/recipients/:id/send — send email to recipient
  const recipSendM = p.match(/^\/api\/qf\/recipients\/([^/]+)\/send$/);
  if (recipSendM && method === 'POST') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const rec = (await dbGet('fax_bid_recipients', { id: 'eq.' + recipSendM[1], select: '*' }))[0];
      if (!rec) return json(res, 404, { error: 'Recipient not found' });
      const quote = (await dbGet('fax_bids', { id: 'eq.' + rec.quote_id, select: '*' }))[0];
      const branding = (await dbGet('fax_bid_branding', { select: '*' }).catch(() => []))[0] || {};
      const emailCfg = (await dbGet('fax_bid_email_config', { select: '*' }).catch(() => []))[0] || {};
      const appUrl = process.env.APP_URL || 'https://' + (process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000');
      const awardUrl = appUrl + '/award/' + rec.token;
      if (!emailCfg.resend_api_key) return json(res, 400, { error: 'Resend API key not configured. Set it in Quote Settings.' });
      const co = branding.company_name || 'FieldAxisHQ';
      const html = `<!DOCTYPE html><html><body style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;background:#060a10;color:#e8edf5;padding:20px">
        <div style="background:${branding.accent_color||'#2563eb'};color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
          ${branding.logo_data_url ? '<img src="'+branding.logo_data_url+'" style="height:36px;margin-bottom:8px;display:block">' : ''}
          <div style="font-size:18px;font-weight:700">${co}</div>
          ${branding.tagline ? '<div style="font-size:12px;opacity:.8;margin-top:3px">'+branding.tagline+'</div>' : ''}
        </div>
        <div style="background:#0c1220;border:1px solid rgba(255,255,255,.08);border-top:none;padding:22px 24px;border-radius:0 0 10px 10px">
          <p>Hi ${rec.name},</p>
          <p style="margin:12px 0">You have received a bid from <strong>${co}</strong> for:</p>
          <p style="font-size:20px;font-weight:700;margin:8px 0">${quote.project_name || 'Project'}</p>
          ${quote.project_address ? '<p style="color:#8a96ab;font-size:13px">'+quote.project_address+'</p>' : ''}
          <p style="margin:10px 0"><strong>Quote #${quote.number}</strong> · Total: <strong>$${(quote.total||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></p>
          ${quote.bid_due_date ? '<p style="color:#f87171;font-size:13px">Bid due: '+quote.bid_due_date+'</p>' : ''}
          <div style="margin:20px 0">
            <a href="${awardUrl}" style="display:inline-block;background:${branding.accent_color||'#2563eb'};color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Review &amp; Award Bid</a>
          </div>
          <p style="color:#414e63;font-size:12px">This link is unique to you. Once the bid is awarded to another party, this link will show as closed.</p>
        </div>
      </body></html>`;
      const emailRes = await new Promise((resolve, reject) => {
        const body = JSON.stringify({ from: `${emailCfg.from_name||co} <${emailCfg.from_email||'noreply@example.com'}>`, to: [rec.email], subject: `Bid from ${co}: ${quote.project_name||quote.number}`, html });
        const opts = { hostname: 'api.resend.com', path: '/emails', method: 'POST', headers: { 'Authorization': 'Bearer ' + emailCfg.resend_api_key, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const r = require('https').request(opts, resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); }}); });
        r.on('error', reject); r.write(body); r.end();
      });
      if (emailRes.statusCode >= 400 || emailRes.error) throw new Error(emailRes.message || emailRes.error || 'Email send failed');
      await dbUpdate('fax_bid_recipients', { status: 'sent', sent_at: new Date().toISOString() }, { id: 'eq.' + recipSendM[1] });
      return json(res, 200, { ok: true, awardUrl });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

  // GET /api/qf/recipients/:id/link — get award URL
  const recipLinkM = p.match(/^\/api\/qf\/recipients\/([^/]+)\/link$/);
  if (recipLinkM && method === 'GET') {
    const u = await getUser(req); if (!requireAuth(res, u)) return;
    try {
      const rec = (await dbGet('fax_bid_recipients', { id: 'eq.' + recipLinkM[1], select: 'token' }))[0];
      if (!rec) return json(res, 404, { error: 'Not found' });
      const appUrl = process.env.APP_URL || 'https://' + (process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000');
      return json(res, 200, { url: appUrl + '/award/' + rec.token });
    } catch(e) { return json(res, 500, { error: e.message }); }
  }

    json(res, 404, { error: 'Not found: ' + p });
});

// ── AWARD PAGE HTML ───────────────────────────────────────────────────────────
const HTML_AWARD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FieldAxisHQ — Review Bid</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#060a10;color:#e8edf5;font-family:'DM Sans',sans-serif;min-height:100vh;padding:20px 12px}
.fi{width:100%;padding:10px 13px;background:#131c2e;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e8edf5;font-size:14px;font-family:'DM Sans',sans-serif}
.fi:focus{outline:none;border-color:#2563eb}.fl{font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}.fg{margin-bottom:12px}
</style>
</head>
<body>
<div id="award-body"><div style="text-align:center;padding:60px 20px;color:#414e63">Loading…</div></div>
<script>
const token = window.location.pathname.split('/').pop()
async function faxBidCalc(items,taxRate){const sub=(items||[]).reduce((s,i)=>s+(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0),0);const tax=sub*(parseFloat(taxRate)||0)/100;return{subtotal:Math.round(sub*100)/100,tax:Math.round(tax*100)/100,total:Math.round((sub+tax)*100)/100}}
const FAX_LOSS=['Price too high','Lost to competitor','Timing / availability','Scope changed','Project cancelled','No response from GC','Other']
window.onload=()=>loadAwardPage(token)
async function loadAwardPage(token){
  const body=document.getElementById('award-body');
  body.innerHTML='<div style="text-align:center;padding:60px 20px"><div style="font-size:24px;margin-bottom:12px">⏳</div><div style="color:#8a96ab">Loading quote…</div></div>'
  try{
    const r=await fetch('/api/qf/award/'+token)
    const d=await r.json()
    if(d.error){body.innerHTML='<div style="text-align:center;padding:60px 20px"><div style="font-size:40px">❌</div><h2 style="margin-top:12px;color:#e8edf5">'+d.error+'</h2></div>';return}
    const{quote:q,recipient:rec,branding,awardedElsewhere}=d
    const accent=branding?.accent_color||'#2563eb'
    const tots=await faxBidCalc(q.line_items,q.tax_rate)
    body.innerHTML='<div style="max-width:680px;margin:0 auto">'+
      '<div style="background:'+accent+';color:#fff;padding:22px 26px;border-radius:12px 12px 0 0">'+
      (branding?.logo_data_url?'<img src="'+branding.logo_data_url+'" style="height:40px;margin-bottom:10px;display:block">':'')+
      '<div style="font-size:20px;font-weight:700">'+(branding?.company_name||'FieldAxisHQ')+'</div>'+
      (branding?.tagline?'<div style="font-size:12px;opacity:.8;margin-top:3px">'+branding.tagline+'</div>':'')+
      '</div>'+
      '<div style="background:#0c1220;border:1px solid rgba(255,255,255,.08);border-top:none;padding:24px 26px;border-radius:0 0 12px 12px;color:#e8edf5">'+
      '<div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px">Quote '+q.number+' · v'+q.version+'</div>'+
      '<div style="font-size:24px;font-weight:700;margin-bottom:5px">'+(q.project_name||'Project')+'</div>'+
      (q.project_address?'<div style="color:#8a96ab;font-size:13px;margin-bottom:14px">📍 '+q.project_address+(q.project_city?', '+q.project_city:'')+(q.project_state?' '+q.project_state:'')+'</div>':'')+
      (q.bid_due_date?'<div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:7px;padding:8px 12px;font-size:12px;color:#f87171;margin-bottom:14px">⏰ Bid due: '+q.bid_due_date+'</div>':'')+
      (q.project_description?'<div style="font-size:13px;color:#8a96ab;line-height:1.6;margin-bottom:16px">'+q.project_description+'</div>':'')+
      +(q.pdf_url?'<div style="margin-bottom:14px">'+'<a href="'+q.pdf_url+'" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:#0c1220;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#60a5fa;text-decoration:none;font-size:13px;font-weight:500">📄 View Full Quote PDF</a></div>':'')
      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">'+
      '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)"><th style="text-align:left;padding:7px 8px;font-size:10px;color:#414e63;font-weight:600;text-transform:uppercase">Item</th><th style="text-align:right;padding:7px 8px;font-size:10px;color:#414e63;font-weight:600">Qty</th><th style="text-align:right;padding:7px 8px;font-size:10px;color:#414e63;font-weight:600">Rate</th><th style="text-align:right;padding:7px 8px;font-size:10px;color:#414e63;font-weight:600">Total</th></tr></thead>'+
      '<tbody>'+(q.line_items||[]).map(li=>'<tr style="border-bottom:1px solid rgba(255,255,255,.04)"><td style="padding:8px">'+li.description+'</td><td style="text-align:right;padding:8px;color:#8a96ab">'+li.qty+'</td><td style="text-align:right;padding:8px;color:#8a96ab">$'+Number(li.rate||0).toFixed(2)+'</td><td style="text-align:right;padding:8px;font-weight:500">$'+Number((li.qty||0)*(li.rate||0)).toFixed(2)+'</td></tr>').join('')+'</tbody></table>'+
      '<div style="text-align:right;font-size:13px;color:#8a96ab;margin-bottom:3px">Subtotal: $'+tots.subtotal.toFixed(2)+'</div>'+
      (q.tax_rate>0?'<div style="text-align:right;font-size:13px;color:#8a96ab;margin-bottom:3px">Tax ('+q.tax_rate+'%): $'+tots.tax.toFixed(2)+'</div>':'')+
      '<div style="text-align:right;font-size:22px;font-weight:700;border-top:1px solid rgba(255,255,255,.1);padding-top:10px;margin-bottom:20px">Total: $'+tots.total.toFixed(2)+'</div>'+
      (q.notes?'<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Notes</div><div style="font-size:13px;color:#8a96ab;line-height:1.6">'+q.notes+'</div></div>':'')+
      (q.terms?'<div style="margin-bottom:20px"><div style="font-size:10px;font-weight:600;color:#414e63;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Terms</div><div style="font-size:12px;color:#414e63;line-height:1.6">'+q.terms+'</div></div>':'')+
      '<div id="award-actions">'+
      (rec.status==='awarded'?
        '<div style="background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:18px;text-align:center"><div style="font-size:28px;margin-bottom:8px">✅</div><div style="font-size:16px;font-weight:700;color:#16a34a">You have awarded this bid</div><div style="font-size:13px;color:#8a96ab;margin-top:4px">Signed by '+rec.signature_name+(rec.signature_title?' ('+rec.signature_title+')':'')+'</div></div>'
        :awardedElsewhere?
        '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:18px;text-align:center;color:#8a96ab"><div style="font-size:28px;margin-bottom:8px">🔒</div><div style="font-weight:600">This bid has been awarded to another party</div></div>'
        :'<div style="display:flex;gap:10px"><button onclick="showAwardModal()" style="flex:2;padding:14px;background:'+accent+';border:none;border-radius:9px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif">✓ Award This Bid</button><button onclick="showDeclineModal()" style="flex:1;padding:14px;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.2);border-radius:9px;color:#f87171;font-size:14px;cursor:pointer;font-family:DM Sans,sans-serif">Decline</button></div>')+
      '</div></div></div>'
  }catch(e){body.innerHTML='<div style="text-align:center;padding:60px;color:#e8edf5"><h2>Error</h2><p style="color:#8a96ab">'+e.message+'</p></div>'}
}
function showAwardModal(){
  const ov=document.createElement('div');ov.id='aw-ov';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9000;display:flex;align-items:flex-end;justify-content:center;padding:16px'
  ov.innerHTML='<div style="background:#0c1220;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto"><div style="font-size:17px;font-weight:700;margin-bottom:16px;color:#e8edf5">Award This Bid</div><div class="fg"><label class="fl">Full Name *</label><input class="fi" id="aw-name" placeholder="Your full name"></div><div class="fg"><label class="fl">Title</label><input class="fi" id="aw-title" placeholder="e.g. Project Manager"></div><div class="fg"><label class="fl">Email</label><input class="fi" id="aw-email" type="email" placeholder="your@company.com"></div><div class="fg"><label class="fl">Signature * — draw below</label><canvas id="sig-c" width="440" height="100" style="width:100%;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#060a10;cursor:crosshair;touch-action:none"></canvas><button onclick="document.getElementById(\'sig-c\').getContext(\'2d\').clearRect(0,0,440,100)" style="font-size:11px;color:#414e63;background:none;border:none;cursor:pointer;padding:4px 0">Clear</button></div><label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;cursor:pointer;font-size:13px;color:#8a96ab"><input type="checkbox" id="aw-agree" style="margin-top:2px;width:16px;height:16px;flex-shrink:0"> I agree to award this bid and authorize the work described above.</label><div style="display:flex;gap:8px"><button onclick="submitAward()" style="flex:2;padding:13px;background:#2563eb;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif">Submit Award</button><button onclick="document.getElementById(\'aw-ov\').remove()" style="flex:1;padding:13px;background:#131c2e;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e8edf5;font-size:13px;cursor:pointer;font-family:DM Sans,sans-serif">Cancel</button></div></div>'
  document.body.appendChild(ov)
  const c=document.getElementById('sig-c');const ctx=c.getContext('2d');let dr=false
  function gp(e){const r=c.getBoundingClientRect(),sx=c.width/r.width,sy=c.height/r.height;const s=e.touches?e.touches[0]:e;return{x:(s.clientX-r.left)*sx,y:(s.clientY-r.top)*sy}}
  c.onmousedown=c.ontouchstart=e=>{e.preventDefault();dr=true;ctx.beginPath();const p=gp(e);ctx.moveTo(p.x,p.y)}
  c.onmousemove=c.ontouchmove=e=>{e.preventDefault();if(!dr)return;const p=gp(e);ctx.lineWidth=2;ctx.strokeStyle='#60a5fa';ctx.lineCap='round';ctx.lineTo(p.x,p.y);ctx.stroke()}
  c.onmouseup=c.ontouchend=()=>dr=false
}
async function submitAward(){
  const name=(document.getElementById('aw-name')?.value||'').trim()
  if(!name){alert('Full name required');return}
  const c=document.getElementById('sig-c')
  if(!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(d=>d!==0)){alert('Please sign above');return}
  if(!document.getElementById('aw-agree')?.checked){alert('Please check the agreement box');return}
  const r=await fetch('/api/qf/award/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signature_name:name,signature_title:(document.getElementById('aw-title')?.value||'').trim(),signature_email:(document.getElementById('aw-email')?.value||'').trim(),signature_image:c.toDataURL()})})
  const d=await r.json()
  if(d.error){alert(d.error);return}
  document.getElementById('aw-ov')?.remove()
  loadAwardPage(token)
}
function showDeclineModal(){
  const r=prompt('Reason:\n'+FAX_LOSS.map((x,i)=>(i+1)+'. '+x).join('\n'));if(!r)return
  fetch('/api/qf/award/'+token+'/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decline_reason:r})}).then(x=>x.json()).then(d=>{if(d.ok)loadAwardPage(token);else alert(d.error||'Error')})
}
</script>
</body>
</html>`;


server.listen(PORT, '0.0.0.0', async () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       FieldAxisHQ  v1.0  starting      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('Port:', PORT);
  if (!SB_URL) console.log('⚠  SUPABASE_URL not set — set env vars before use');
  await setupDB();
  console.log('Ready.\n');
});
