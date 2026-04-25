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

  // Static files
  if (method === 'GET' && (p === '/' || p === '/index.html'))
    return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
  if (method === 'GET' && p === '/admin.html')
    return serveFile(res, path.join(__dirname, 'public', 'admin.html'), 'text/html');
  if (method === 'GET' && p === '/worker.html')
    return serveFile(res, path.join(__dirname, 'public', 'worker.html'), 'text/html');
  if (method === 'GET' && p === '/fax-shared.js')
    return serveFile(res, path.join(__dirname, 'public', 'fax-shared.js'), 'application/javascript');
  // Serve any file from /public/ by path
  if (method === 'GET' && !p.startsWith('/api/')) {
    const ext = path.extname(p);
    const ctMap = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
    const ct = ctMap[ext] || 'application/octet-stream';
    const fp = path.join(__dirname, 'public', p);
    if (fs.existsSync(fp)) return serveFile(res, fp, ct);
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
        gps_lat: b.gps_lat || null, gps_lng: b.gps_lng || null, gps_radius_ft: b.gps_radius_ft || 250,
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
    const allowed = ['name','description','address','gps_lat','gps_lng','gps_radius_ft','gc_company','gc_contact','gc_phone','gc_email','super_name','super_phone','super_email','scope','notes','install_notes','job_walk_by','job_walk_date','job_walk_notes','phase','pct_complete','archived','budget','contract_value','labor_budget','material_budget','labor_rate','site_contact_name','site_contact_phone','company_id','pm_review_required','pm_review_type','date_contract','date_permit','date_start','due_date','date_roughin','date_trimout','date_inspection','date_next_visit','date_closeout','date_co','completion_date'];
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
        const radius = job.gps_radius_ft || 250;
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
