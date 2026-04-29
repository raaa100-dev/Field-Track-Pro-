// ═══════════════════════════════════════════════════════════════════════════
// QUOTEFLOW — Quote & Invoice Management
// ═══════════════════════════════════════════════════════════════════════════

const TRADES = ["Demo","Framing","Drywall","Roofing","Concrete","Electrical",
  "Plumbing","HVAC","Finish carpentry","Painting","Flooring","Landscaping","Other"];
const LOSS_REASONS = ["Price too high","Lost to competitor","Timing/availability",
  "Scope changed","Project cancelled","No response from GC","Other"];
const QF_STATUS_STYLE = {
  draft:   {bg:'var(--bg3)',       color:'var(--text2)',    label:'Draft'},
  sent:    {bg:'var(--blue-bg)',   color:'var(--blue-t)',   label:'Sent'},
  viewed:  {bg:'var(--purple-bg)',color:'var(--purple-t)', label:'Viewed'},
  awarded: {bg:'var(--green-bg)', color:'var(--green-t)',  label:'Awarded'},
  declined:{bg:'var(--red-bg)',   color:'var(--red-t)',    label:'Declined'},
  paid:    {bg:'var(--green-bg)', color:'var(--green-t)',  label:'Paid'},
  overdue: {bg:'var(--red-bg)',   color:'var(--red-t)',    label:'Overdue'},
};

// State
let qfState = {
  view: 'dashboard',   // dashboard|quotes|invoices|templates|reports|people|settings
  quotes: [], invoices: [], templates: [], scopeblocks: [], gcs: [], users: [],
  company: {}, integrations: {},
  currentQuote: null, currentInvoice: null,
  editingQuote: null, editingInvoice: null,
  reportsData: null, reportsPeriod: 'all',
  peopleTab: 'gcs',  templateTab: 'templates',
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function qfApi(method, path, body) { return api(method, path, body); }
function qfFmt$(v){ return '$'+(parseFloat(v)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function qfBadge(status){
  const s=QF_STATUS_STYLE[status]||QF_STATUS_STYLE.draft;
  return `<span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px">${s.label}</span>`;
}
function qfCalcTotals(items, taxRate){
  const sub = (items||[]).reduce((s,i)=>s+((parseFloat(i.qty)||0)*(parseFloat(i.rate)||0)),0);
  const tax = sub*(parseFloat(taxRate)||0)/100;
  return {subtotal:sub,tax,total:sub+tax};
}
function qfLiId(){ return 'li'+Date.now()+Math.random().toString(36).slice(2,6); }

// ── MOUNT ─────────────────────────────────────────────────────────────────────
function qfMount(container) {
  container.innerHTML = qfShell();
  qfLoadAll().then(()=> qfNav('dashboard'));
}
function qfShell() {
  return `
<div id="qf-app" style="display:flex;flex-direction:column;height:100%">
  <div style="display:flex;border-bottom:.5px solid var(--border);background:var(--bg);flex-shrink:0;overflow-x:auto" id="qf-nav">
    ${['dashboard','quotes','invoices','templates','reports','people','settings'].map(n=>
      `<button class="qf-nav-btn" data-view="${n}" onclick="qfNav('${n}')" style="flex:1;min-width:64px;padding:9px 4px 8px;font-size:10px;font-weight:500;background:none;border:none;border-bottom:2px solid transparent;color:var(--text2);cursor:pointer;font-family:inherit;white-space:nowrap">${n.charAt(0).toUpperCase()+n.slice(1)}</button>`
    ).join('')}
  </div>
  <div id="qf-body" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px max(14px,env(safe-area-inset-bottom))"></div>
</div>`;
}
async function qfLoadAll(){
  try {
    const [q,inv,tmpl,sb,gc,usr,comp] = await Promise.all([
      qfApi('GET','/qf/quotes'), qfApi('GET','/qf/invoices'), qfApi('GET','/qf/templates'),
      qfApi('GET','/qf/scopeblocks'), qfApi('GET','/qf/gcs'), qfApi('GET','/users'),
      qfApi('GET','/qf/company'),
    ]);
    qfState.quotes=q||[]; qfState.invoices=inv||[]; qfState.templates=tmpl||[];
    qfState.scopeblocks=sb||[]; qfState.gcs=gc||[]; qfState.users=usr||[];
    qfState.company=comp||{};
    if(CU?.role==='admin'){
      qfState.integrations = await qfApi('GET','/qf/integrations').catch(()=>({}));
    }
  } catch(e){ console.warn('QF load error',e); }
}
function qfNav(view, sub){
  qfState.view=view;
  document.querySelectorAll('.qf-nav-btn').forEach(b=>{
    const active=b.dataset.view===view;
    b.style.color=active?'var(--text)':'var(--text2)';
    b.style.borderBottomColor=active?'var(--text)':'transparent';
    b.style.fontWeight=active?'700':'500';
  });
  const body=document.getElementById('qf-body'); if(!body)return;
  if(view==='dashboard') body.innerHTML=qfDashboard();
  else if(view==='quotes') qfRenderQuotes(body);
  else if(view==='invoices') qfRenderInvoices(body);
  else if(view==='templates') qfRenderTemplates(body);
  else if(view==='reports') qfRenderReports(body);
  else if(view==='people') qfRenderPeople(body);
  else if(view==='settings') qfRenderSettings(body);
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function qfDashboard(){
  const open = qfState.quotes.filter(q=>!['awarded','declined'].includes(q.status));
  const awarded = qfState.quotes.filter(q=>q.status==='awarded');
  const closed = qfState.quotes.filter(q=>['awarded','declined'].includes(q.status));
  const winRate = closed.length ? Math.round(awarded.length/closed.length*100) : 0;
  const pipeline = open.reduce((s,q)=>s+q.total,0);
  const awardedVal = awarded.reduce((s,q)=>s+q.total,0);
  const unpaid = qfState.invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.total,0);

  // Reminders
  const now = Date.now();
  const reminders = [];
  qfState.quotes.forEach(q=>{
    (q.recipients||[]).forEach(r=>{
      if(r.status==='viewed'&&r.viewed_at&&(now-new Date(r.viewed_at).getTime())>3*864e5)
        reminders.push({type:'stale',msg:`${r.company||r.name} viewed "${q.project_name||q.number}" 3+ days ago`,qid:q.id});
      if(r.status==='sent'&&r.sent_at&&(now-new Date(r.sent_at).getTime())>5*864e5)
        reminders.push({type:'nopen',msg:`${r.company||r.name} hasn't opened "${q.project_name||q.number}"`,qid:q.id});
    });
    if(q.bid_due_date&&q.status!=='awarded'){
      const days=Math.ceil((new Date(q.bid_due_date)-now)/864e5);
      if(days>=0&&days<=2) reminders.push({type:'due',msg:`"${q.project_name||q.number}" bid due in ${days===0?'today':days+'d'}`,qid:q.id});
    }
  });

  const recent = [...qfState.quotes,...qfState.invoices].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).slice(0,5);

  return `
<div style="font-size:18px;font-weight:700;margin-bottom:14px">QuoteFlow</div>
<div class="sum-cards" style="margin-bottom:14px">
  <div class="sum-card blue"><div class="sv">${qfFmt$(pipeline)}</div><div class="sl">Open pipeline (${open.length})</div></div>
  <div class="sum-card green"><div class="sv">${winRate}%</div><div class="sl">Win rate</div></div>
  <div class="sum-card"><div class="sv" style="color:var(--teal-t)">${qfFmt$(awardedVal)}</div><div class="sl">Awarded value</div></div>
  <div class="sum-card amber"><div class="sv">${qfFmt$(unpaid)}</div><div class="sl">Unpaid invoices</div></div>
</div>
<div style="display:flex;gap:8px;margin-bottom:14px">
  <button class="btn btn-p btn-sm" style="flex:1" onclick="qfNewQuote()">+ New Quote</button>
  <button class="btn btn-sm" style="flex:1" onclick="qfNav('invoices')">+ Invoice</button>
  <button class="btn btn-sm" style="flex:1" onclick="qfNav('reports')">Reports</button>
</div>
${reminders.length?`<div style="background:var(--amber-bg);border:.5px solid var(--amber-b);border-radius:var(--r);padding:12px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--amber-t);margin-bottom:8px">⚠ Needs attention (${reminders.length})</div>
  ${reminders.map(r=>`<div style="font-size:12px;color:var(--amber-t);padding:4px 0;border-bottom:.5px solid var(--amber-b);cursor:pointer" onclick="qfOpenQuote('${r.qid}')">${r.msg}</div>`).join('')}
</div>`:''}
<div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Recent activity</div>
${recent.map(r=>{
  const isQ=r.number?.startsWith('Q-');
  return`<div class="job-card" style="margin-bottom:8px" onclick="${isQ?`qfOpenQuote('${r.id}')`:`qfOpenInvoice('${r.id}')`}">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:14px;font-weight:600">${r.number} ${r.project_name?'· '+r.project_name:''}</div>
      <div class="pa">${fmtDate(r.updated_at||r.created_at)}</div></div>
      <div style="text-align:right">${qfBadge(r.status||'draft')}<div style="font-size:14px;font-weight:600;margin-top:4px">${qfFmt$(r.total)}</div></div>
    </div>
  </div>`;
}).join('')}`;
}

// ── QUOTES LIST ───────────────────────────────────────────────────────────────
function qfRenderQuotes(el) {
  const canCreate = ['admin','foreman','estimator','stager'].includes(CU?.role);
  el.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
  <div style="font-size:18px;font-weight:700">Quotes</div>
  ${canCreate?'<button class="btn btn-p btn-sm" onclick="qfNewQuote()">+ New</button>':''}
</div>
<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
  <input id="qf-q-search" type="text" placeholder="Search…" style="flex:1;min-width:140px;margin-bottom:0" oninput="qfFilterQuotes()"/>
  <select id="qf-q-trade" style="flex:1;min-width:100px;margin-bottom:0" onchange="qfFilterQuotes()"><option value="">All trades</option>${TRADES.map(t=>`<option>${t}</option>`).join('')}</select>
  <select id="qf-q-status" style="flex:1;min-width:100px;margin-bottom:0" onchange="qfFilterQuotes()"><option value="">All status</option>${['draft','sent','viewed','awarded','declined'].map(s=>`<option>${s}</option>`).join('')}</select>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px">
  ${canCreate?`<select id="qf-from-tmpl" style="flex:2;margin-bottom:0" onchange="qfNewFromTemplate(this.value)"><option value="">From template…</option>${qfState.templates.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>`:''}
  <button class="btn btn-sm" onclick="qfExportQuotesCSV()" style="flex:1">Export CSV</button>
</div>
<div id="qf-q-list"></div>`;
  qfFilterQuotes();
}
function qfFilterQuotes(){
  const q=(document.getElementById('qf-q-search')?.value||'').toLowerCase();
  const trade=document.getElementById('qf-q-trade')?.value||'';
  const status=document.getElementById('qf-q-status')?.value||'';
  const el=document.getElementById('qf-q-list'); if(!el)return;
  let list=qfState.quotes.filter(qo=>{
    if(trade&&qo.trade!==trade)return false;
    if(status&&qo.status!==status)return false;
    if(q&&!(qo.number+qo.project_name+qo.project_address+(qo.recipients||[]).map(r=>r.company+r.name).join('')).toLowerCase().includes(q))return false;
    return true;
  });
  if(!list.length){el.innerHTML='<div class="empty">No quotes found</div>';return;}
  el.innerHTML=list.map(qo=>`
<div class="job-card" style="margin-bottom:8px" onclick="qfOpenQuote('${qo.id}')">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
    <div style="min-width:0;flex:1">
      <div style="font-size:15px;font-weight:700">${qo.number}${qo.trade?' <span style="font-size:10px;color:var(--text2)">· '+qo.trade+'</span>':''}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:2px">${qo.project_name||'—'}</div>
      <div style="font-size:11px;color:var(--text3)">${qo.project_address||''}</div>
      <div style="font-size:11px;color:var(--text3)">${(qo.recipients||[]).map(r=>r.company||r.name).join(', ')}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">${qfBadge(qo.status)}<div style="font-size:15px;font-weight:700;margin-top:4px">${qfFmt$(qo.total)}</div>
    ${qo.bid_due_date?'<div style="font-size:10px;color:var(--text3)">Due '+fmtDate(qo.bid_due_date)+'</div>':''}</div>
  </div>
</div>`).join('');
}

// ── QUOTE EDITOR ──────────────────────────────────────────────────────────────
async function qfNewQuote(templateId) {
  let prefill = {};
  if(templateId){
    const tmpl=qfState.templates.find(t=>t.id===templateId);
    if(tmpl){ prefill={trade:tmpl.trade,project_description:tmpl.description,line_items:JSON.parse(JSON.stringify(tmpl.line_items||[])),tax_rate:tmpl.tax_rate,notes:tmpl.notes,terms:tmpl.terms,from_template_id:tmpl.id,expiry_date:tmpl.expiry_days?new Date(Date.now()+tmpl.expiry_days*864e5).toISOString().split('T')[0]:null}; }
  }
  qfState.editingQuote = {id:null, number:'', version:1, project_name:'', project_description:'', project_address:'', project_city:'', project_state:'', project_zip:'', trade:'', estimator_id:CU?.id||'', job_id:'', issue_date:new Date().toISOString().split('T')[0], expiry_date:'', bid_due_date:'', line_items:[], tax_rate:0, notes:'', terms:'', recipients:[], ...prefill};
  qfState.view='quote-edit';
  document.getElementById('qf-body').innerHTML=qfQuoteEditorHTML(qfState.editingQuote);
  qfRenderLineItems('qf-li-body', qfState.editingQuote.line_items);
  qfRenderRecipients();
}
function qfNewFromTemplate(id){ if(id)qfNewQuote(id); }
async function qfOpenQuote(id){
  try{
    const q = await qfApi('GET','/qf/quotes/'+id);
    qfState.currentQuote=q;
    qfState.editingQuote=JSON.parse(JSON.stringify(q));
    qfState.view='quote-edit';
    document.getElementById('qf-body').innerHTML=qfQuoteEditorHTML(q, true);
    qfRenderLineItems('qf-li-body', qfState.editingQuote.line_items);
    qfRenderRecipients();
  }catch(e){toast('Error: '+e.message);}
}

function qfQuoteEditorHTML(q, existing=false){
  const estimators = qfState.users.filter(u=>['admin','foreman','estimator','stager'].includes(u.role));
  const jobs = Object.values(typeof jobs!=='undefined'?jobs:{});
  const accent = qfState.company?.accent_color||'#27500a';
  return `
<button class="backbtn" onclick="qfNav('quotes')">‹ Quotes</button>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
  <div style="font-size:20px;font-weight:700">${q.id?q.number+' · v'+q.version:'New Quote'}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    ${q.status==='awarded'?`<button class="btn btn-sm btn-g" onclick="qfGenerateInvoice('${q.id}')">→ Invoice</button>`:''}
    <button class="btn btn-sm btn-b" onclick="qfSaveAsTemplate()">Save as template</button>
    <button class="btn btn-p btn-sm" onclick="qfSaveQuote()">Save</button>
  </div>
</div>
${q.status==='awarded'?`<div style="background:var(--green-bg);border:.5px solid var(--green-b);border-radius:var(--rs);padding:10px 12px;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--green-t)">✓ Awarded — ${(q.recipients||[]).find(r=>r.status==='awarded')?.company||''}</div>`:''}

<div class="sec" style="margin-top:0">Project Details</div>
<div class="fl nt">Project name</div><input type="text" id="qf-proj-name" value="${q.project_name||''}" style="margin-bottom:8px"/>
<div class="fl">Description</div><textarea id="qf-proj-desc" style="margin-bottom:8px">${q.project_description||''}</textarea>
<div class="fl">Address</div><input type="text" id="qf-addr" value="${q.project_address||''}" style="margin-bottom:8px"/>
<div style="display:flex;gap:8px;margin-bottom:8px">
  <input type="text" id="qf-city" placeholder="City" value="${q.project_city||''}" style="flex:2;margin-bottom:0"/>
  <input type="text" id="qf-state" placeholder="ST" value="${q.project_state||''}" style="width:50px;margin-bottom:0"/>
  <input type="text" id="qf-zip" placeholder="ZIP" value="${q.project_zip||''}" style="width:80px;margin-bottom:0"/>
</div>
<div style="display:flex;gap:8px;margin-bottom:8px">
  <div style="flex:1"><div class="fl nt">Trade</div><select id="qf-trade" style="margin-bottom:0"><option value="">— Trade —</option>${TRADES.map(t=>`<option ${q.trade===t?'selected':''}>${t}</option>`).join('')}</select></div>
  <div style="flex:1"><div class="fl nt">Estimator</div><select id="qf-estimator" style="margin-bottom:0">${estimators.map(u=>`<option value="${u.id}" ${q.estimator_id===u.id?'selected':''}>${u.name}</option>`).join('')}</select></div>
</div>
<div class="fl">Link to Job (optional)</div>
<select id="qf-job-link" style="margin-bottom:8px">
  <option value="">— No job linked —</option>
  ${Object.values(typeof window.jobs!=='undefined'?window.jobs:{}).map(j=>`<option value="${j.id}" ${q.job_id===j.id?'selected':''}>${j.id}${j.name?' · '+j.name:''}</option>`).join('')}
</select>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <div style="flex:1"><div class="fl nt">Issue date</div><input type="date" id="qf-issue" value="${q.issue_date||''}" style="margin-bottom:0"/></div>
  <div style="flex:1"><div class="fl nt">Bid due</div><input type="date" id="qf-biddue" value="${q.bid_due_date||''}" style="margin-bottom:0"/></div>
  <div style="flex:1"><div class="fl nt">Expiry</div><input type="date" id="qf-expiry" value="${q.expiry_date||''}" style="margin-bottom:0"/></div>
</div>

<div class="sec">Line Items</div>
<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
  <button class="btn btn-sm btn-b" onclick="qfAddLineItem()" style="flex:1">+ Add line</button>
  <button class="btn btn-sm" onclick="qfInsertScopeBlock()" style="flex:1">Insert scope block</button>
  <label class="btn btn-sm" style="flex:1;text-align:center;cursor:pointer">Import CSV<input type="file" accept=".csv" style="display:none" onchange="qfImportLiCSV(this)"></label>
</div>
<div id="qf-li-head" style="display:grid;grid-template-columns:1fr 60px 80px 80px 30px;gap:4px;padding:4px 0;border-bottom:.5px solid var(--border);margin-bottom:4px">
  <div style="font-size:10px;font-weight:600;color:var(--text2)">DESCRIPTION</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">QTY</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">RATE</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">TOTAL</div>
  <div></div>
</div>
<div id="qf-li-body"></div>
<div style="border-top:.5px solid var(--border);padding-top:10px;margin-top:8px">
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span>Subtotal</span><span id="qf-subtotal">—</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:5px">
    <span>Tax %</span>
    <div style="display:flex;align-items:center;gap:8px">
      <input type="number" id="qf-taxrate" value="${q.tax_rate||0}" min="0" max="100" step="0.1" style="width:70px;margin-bottom:0;text-align:right;padding:5px 8px" oninput="qfUpdateTotals()"/>
      <span id="qf-tax">—</span>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;border-top:.5px solid var(--border);padding-top:8px"><span>Total</span><span id="qf-total">—</span></div>
</div>

<div class="sec">Notes & Terms</div>
<div class="fl nt">Notes</div><textarea id="qf-notes" style="margin-bottom:8px">${q.notes||''}</textarea>
<div class="fl">Terms</div><textarea id="qf-terms" style="margin-bottom:12px">${q.terms||''}</textarea>

<div class="sec">Recipients</div>
<div id="qf-recipients"></div>
<div style="margin-top:8px">
  <div class="fl">Add from GC list</div>
  <div style="display:flex;gap:8px;margin-bottom:6px">
    <select id="qf-gc-pick" style="flex:1;margin-bottom:0"><option value="">— Pick a GC —</option>${qfState.gcs.map(g=>`<option value="${g.id}">${g.company||g.name} &lt;${g.email}&gt;</option>`).join('')}</select>
    <button class="btn btn-sm btn-p" onclick="qfAddRecipientFromGC()">Add</button>
  </div>
  <div class="fl">Or add manually</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
    <input type="text" id="qf-rec-name" placeholder="Name" style="flex:1;min-width:100px;margin-bottom:0"/>
    <input type="text" id="qf-rec-co" placeholder="Company" style="flex:1;min-width:100px;margin-bottom:0"/>
    <input type="email" id="qf-rec-email" placeholder="Email *" style="flex:2;min-width:140px;margin-bottom:0"/>
    <button class="btn btn-sm btn-b" onclick="qfAddRecipientManual()">Add</button>
  </div>
</div>
${existing&&q.revisions?.length?`<div class="sec">Revision history</div><div class="card">${q.revisions.map(r=>`<div class="prow"><div class="pi"><div class="pid">v${r.version}</div><div class="pa">${r.changed_by} · ${fmtDate(r.changed_at)} · Total was ${qfFmt$(r.snapshot?.total)}</div></div></div>`).join('')}</div>`:''}`;
}

// ── LINE ITEMS ─────────────────────────────────────────────────────────────────
function qfRenderLineItems(containerId, items){
  const el=document.getElementById(containerId); if(!el)return;
  if(!items.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0">No line items yet</div>';qfUpdateTotals();return;}
  el.innerHTML=items.map((li,i)=>`
<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 30px;gap:4px;align-items:center;padding:4px 0;border-bottom:.5px solid var(--border2)">
  <input type="text" value="${li.description||''}" placeholder="Description" style="margin-bottom:0;padding:5px 6px;font-size:13px" oninput="qfLiChange(${i},'description',this.value)"/>
  <input type="number" value="${li.qty||''}" placeholder="1" style="margin-bottom:0;padding:5px 6px;font-size:13px;text-align:right" oninput="qfLiChange(${i},'qty',this.value)"/>
  <input type="number" value="${li.rate||''}" placeholder="0.00" step="0.01" style="margin-bottom:0;padding:5px 6px;font-size:13px;text-align:right" oninput="qfLiChange(${i},'rate',this.value)"/>
  <div style="font-size:13px;text-align:right;padding-right:4px">${qfFmt$((parseFloat(li.qty)||0)*(parseFloat(li.rate)||0))}</div>
  <button style="background:none;border:none;cursor:pointer;color:var(--red-t);font-size:16px" onclick="qfRemoveLi(${i})">×</button>
</div>`).join('');
  qfUpdateTotals();
}
function qfLiChange(i, field, val){
  const li=qfState.editingQuote?.line_items; if(!li)return;
  li[i][field]=field==='qty'||field==='rate'?parseFloat(val)||0:val;
  // Update total cell without full re-render
  const rows=document.querySelectorAll('#qf-li-body > div');
  if(rows[i]){
    const totalCell=rows[i].querySelectorAll('div')[0];
    if(totalCell)totalCell.textContent=qfFmt$((li[i].qty||0)*(li[i].rate||0));
  }
  qfUpdateTotals();
}
function qfAddLineItem(){
  if(!qfState.editingQuote)return;
  qfState.editingQuote.line_items.push({id:qfLiId(),description:'',qty:1,rate:0});
  qfRenderLineItems('qf-li-body',qfState.editingQuote.line_items);
  // Focus last description input
  const inputs=document.querySelectorAll('#qf-li-body input[type=text]');
  if(inputs.length)inputs[inputs.length-1].focus();
}
function qfRemoveLi(i){
  qfState.editingQuote.line_items.splice(i,1);
  qfRenderLineItems('qf-li-body',qfState.editingQuote.line_items);
}
function qfUpdateTotals(){
  const q=qfState.editingQuote; if(!q)return;
  const tax=parseFloat(document.getElementById('qf-taxrate')?.value)||0;
  const tots=qfCalcTotals(q.line_items,tax);
  const fmt=v=>qfFmt$(v);
  const sub=document.getElementById('qf-subtotal'); if(sub)sub.textContent=fmt(tots.subtotal);
  const tx=document.getElementById('qf-tax'); if(tx)tx.textContent=fmt(tots.tax);
  const tot=document.getElementById('qf-total'); if(tot)tot.textContent=fmt(tots.total);
}
function qfImportLiCSV(input){
  const file=input.files[0]; if(!file)return;
  const r=new FileReader(); r.onload=e=>{
    const lines=e.target.result.split('\n').filter(l=>l.trim()); let hdr=null;
    lines.forEach(line=>{
      const cols=line.match(/("(?:[^"]|"")*"|[^,]*)/g).map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"'));
      if(!hdr){hdr=cols.map(h=>h.trim().toLowerCase());return;}
      const di=['description','item','name'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??0;
      const qi=['qty','quantity'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??1;
      const ri=['rate','price','cost','unit'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??2;
      const desc=cols[di]?.trim(); if(!desc)return;
      qfState.editingQuote.line_items.push({id:qfLiId(),description:desc,qty:parseFloat(cols[qi])||1,rate:parseFloat(cols[ri])||0});
    });
    qfRenderLineItems('qf-li-body',qfState.editingQuote.line_items);
    toast('Imported '+qfState.editingQuote.line_items.length+' items');
  }; r.readAsText(file); input.value='';
}

// ── SCOPE BLOCK PICKER ────────────────────────────────────────────────────────
function qfInsertScopeBlock(){
  const modal=document.createElement('div');
  modal.className='modal-ov'; modal.id='qf-sb-modal';
  const blocks=qfState.scopeblocks;
  modal.innerHTML=`<div class="modal-sh"><div class="modal-title">Insert Scope Block</div>
  ${blocks.length?blocks.map(sb=>`<div class="prow" style="cursor:pointer" onclick="qfPickScopeBlock('${sb.id}')">
    <div class="pi"><div class="pid">${sb.name}</div><div class="pn">${sb.trade||'All trades'} · ${sb.line_items?.length||0} items · ${qfFmt$(( sb.line_items||[]).reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0))}</div></div>
  </div>`).join(''):'<div class="empty">No scope blocks yet. Create them in Templates.</div>'}
  <button class="btn" style="margin-top:12px" onclick="document.getElementById('qf-sb-modal').remove()">Cancel</button></div>`;
  document.body.appendChild(modal);
}
function qfPickScopeBlock(id){
  const sb=qfState.scopeblocks.find(b=>b.id===id); if(!sb)return;
  const items=JSON.parse(JSON.stringify(sb.line_items||[])).map(li=>({...li,id:qfLiId()}));
  qfState.editingQuote.line_items.push(...items);
  qfRenderLineItems('qf-li-body',qfState.editingQuote.line_items);
  document.getElementById('qf-sb-modal')?.remove();
  toast('Added '+items.length+' items from "'+sb.name+'"');
}

// ── RECIPIENTS ────────────────────────────────────────────────────────────────
function qfRenderRecipients(){
  const el=document.getElementById('qf-recipients'); if(!el)return;
  const recs=qfState.editingQuote?.recipients||[];
  if(!recs.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0">No recipients yet</div>';return;}
  el.innerHTML=recs.map((r,i)=>`
<div style="background:var(--bg2);border-radius:var(--rs);border:.5px solid var(--border2);padding:10px 12px;margin-bottom:8px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
    <div><div style="font-size:14px;font-weight:600">${r.company||r.name}</div>
    <div style="font-size:12px;color:var(--text2)">${r.name} · ${r.email}</div></div>
    <div style="text-align:right">${qfBadge(r.status||'draft')}</div>
  </div>
  ${r.signature_name?`<div style="font-size:11px;color:var(--green-t);margin-top:6px">✓ Signed by ${r.signature_name}${r.signature_title?' ('+r.signature_title+')':''} · ${fmtDate(r.signature_timestamp)}</div>`:''}
  ${r.decline_reason?`<div style="font-size:11px;color:var(--red-t);margin-top:4px">Declined: ${r.decline_reason}</div>`:''}
  ${r.id?`<div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">
    ${['draft','sent'].includes(r.status)?`<button class="btn btn-sm btn-p" onclick="qfSendRecipient('${r.id}')">Send</button>`:''}
    <button class="btn btn-sm btn-b" onclick="qfCopyLink('${r.id}')">Copy link</button>
    ${r.status==='draft'||r.status==='sent'?`<button class="btn btn-sm btn-d" onclick="qfDeclineRecipient('${r.id}','${i}')">Decline</button>`:''}
    <button class="btn btn-sm" style="color:var(--red-t)" onclick="qfRemoveRecipient(${i})">Remove</button>
  </div>`:`<div style="font-size:11px;color:var(--text3);margin-top:4px">Save quote first to send</div>`}
</div>`).join('');
}
function qfAddRecipientFromGC(){
  const sel=document.getElementById('qf-gc-pick'); if(!sel?.value)return;
  const gc=qfState.gcs.find(g=>g.id===sel.value); if(!gc)return;
  if(!qfState.editingQuote)return;
  qfState.editingQuote.recipients.push({gc_id:gc.id,name:gc.name,company:gc.company,email:gc.email,status:'draft'});
  sel.value=''; qfRenderRecipients(); toast('Added: '+gc.company);
}
function qfAddRecipientManual(){
  const name=(document.getElementById('qf-rec-name')?.value||'').trim();
  const co=(document.getElementById('qf-rec-co')?.value||'').trim();
  const email=(document.getElementById('qf-rec-email')?.value||'').trim();
  if(!email){toast('Email required');return;}
  qfState.editingQuote.recipients.push({name,company:co,email,status:'draft'});
  ['qf-rec-name','qf-rec-co','qf-rec-email'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  qfRenderRecipients();
}
function qfRemoveRecipient(i){
  qfState.editingQuote.recipients.splice(i,1); qfRenderRecipients();
}
async function qfSendRecipient(recId){
  if(!qfState.editingQuote?.id){toast('Save quote first');return;}
  try{
    await qfApi('POST',`/qf/quotes/${qfState.editingQuote.id}/recipients/${recId}?action=send`);
    toast('Email sent!');
    await qfOpenQuote(qfState.editingQuote.id);
  }catch(e){toast('Error: '+e.message);}
}
async function qfCopyLink(recId){
  if(!qfState.editingQuote?.id){toast('Save quote first');return;}
  try{
    const d=await qfApi('GET',`/qf/quotes/${qfState.editingQuote.id}/recipients/${recId}?action=link`);
    navigator.clipboard?.writeText(d.url).then(()=>toast('Link copied!')).catch(()=>{ prompt('Copy this link:',d.url); });
  }catch(e){toast('Error: '+e.message);}
}
async function qfDeclineRecipient(recId, idx){
  const reason=prompt('Decline reason?\n'+LOSS_REASONS.map((r,i)=>`${i+1}. ${r}`).join('\n'))||'Other';
  try{
    await qfApi('PUT',`/qf/quotes/${qfState.editingQuote.id}/recipients/${recId}`,{status:'declined',declined_at:new Date().toISOString(),decline_reason:reason});
    await qfOpenQuote(qfState.editingQuote.id); toast('Marked declined');
  }catch(e){toast('Error: '+e.message);}
}

// ── SAVE QUOTE ────────────────────────────────────────────────────────────────
async function qfSaveQuote(){
  const q=qfState.editingQuote; if(!q)return;
  // Pull form values
  q.project_name=document.getElementById('qf-proj-name')?.value.trim()||'';
  q.project_description=document.getElementById('qf-proj-desc')?.value.trim()||'';
  q.project_address=document.getElementById('qf-addr')?.value.trim()||'';
  q.project_city=document.getElementById('qf-city')?.value.trim()||'';
  q.project_state=document.getElementById('qf-state')?.value.trim()||'';
  q.project_zip=document.getElementById('qf-zip')?.value.trim()||'';
  q.trade=document.getElementById('qf-trade')?.value||'';
  q.estimator_id=document.getElementById('qf-estimator')?.value||q.estimator_id;
  q.job_id=document.getElementById('qf-job-link')?.value||null;
  q.issue_date=document.getElementById('qf-issue')?.value||null;
  q.bid_due_date=document.getElementById('qf-biddue')?.value||null;
  q.expiry_date=document.getElementById('qf-expiry')?.value||null;
  q.tax_rate=parseFloat(document.getElementById('qf-taxrate')?.value)||0;
  q.notes=document.getElementById('qf-notes')?.value.trim()||'';
  q.terms=document.getElementById('qf-terms')?.value.trim()||'';
  const tots=qfCalcTotals(q.line_items,q.tax_rate);
  Object.assign(q,tots);
  try {
    let saved;
    if(q.id){
      saved=await qfApi('PUT','/qf/quotes/'+q.id, q);
    } else {
      saved=await qfApi('POST','/qf/quotes', q);
      qfState.editingQuote.id=saved.id;
      qfState.editingQuote.number=saved.number;
    }
    // Save new recipients
    const newRecs=q.recipients.filter(r=>!r.id);
    for(const r of newRecs){
      const created=await qfApi('POST','/qf/quotes/'+saved.id+'/recipients', r);
      r.id=created.id; r.token=created.token;
    }
    // Reload
    const refreshed=await qfApi('GET','/qf/quotes/'+saved.id);
    qfState.currentQuote=refreshed; qfState.editingQuote=JSON.parse(JSON.stringify(refreshed));
    await qfLoadAll();
    qfRenderRecipients();
    toast('Saved: '+saved.number);
    // Update header number
    const hdr=document.querySelector('#qf-body .backbtn+div'); if(hdr)hdr.textContent=saved.number+' · v'+saved.version;
  }catch(e){toast('Error: '+e.message);}
}
async function qfSaveAsTemplate(){
  const q=qfState.editingQuote; if(!q)return;
  const name=prompt('Template name:',q.project_name||q.trade||'New template'); if(!name)return;
  try{
    await qfApi('POST','/qf/templates',{name,trade:q.trade||'',description:q.project_description||'',line_items:q.line_items,tax_rate:q.tax_rate,notes:q.notes,terms:q.terms,expiry_days:30});
    await qfLoadAll(); toast('Template saved: '+name);
  }catch(e){toast('Error: '+e.message);}
}
async function qfGenerateInvoice(qid){
  try{
    const inv=await qfApi('POST','/qf/quotes/'+qid+'/invoice');
    await qfLoadAll();
    toast('Invoice created: '+inv.number);
    qfOpenInvoice(inv.id);
  }catch(e){toast('Error: '+e.message);}
}

// ── INVOICES ──────────────────────────────────────────────────────────────────
function qfRenderInvoices(el){
  el.innerHTML=`
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
  <div style="font-size:18px;font-weight:700">Invoices</div>
  <button class="btn btn-p btn-sm" onclick="qfNewInvoice()">+ New</button>
</div>
<div id="qf-inv-list"></div>`;
  const list=qfState.invoices;
  const invEl=document.getElementById('qf-inv-list');
  if(!list.length){invEl.innerHTML='<div class="empty">No invoices yet</div>';return;}
  invEl.innerHTML=list.map(inv=>`
<div class="job-card" style="margin-bottom:8px" onclick="qfOpenInvoice('${inv.id}')">
  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div style="font-size:15px;font-weight:700">${inv.number}</div>
    <div style="font-size:13px;color:var(--text2)">${inv.project_name||inv.client_name||'—'}</div>
    <div class="pa">${inv.client_company||''} · Due ${fmtDate(inv.due_date)}</div></div>
    <div style="text-align:right">${qfBadge(inv.status)}<div style="font-size:15px;font-weight:700;margin-top:4px">${qfFmt$(inv.total)}</div></div>
  </div>
</div>`).join('');
}
async function qfNewInvoice(){
  qfState.editingInvoice={id:null,number:'',client_name:'',client_company:'',client_email:'',project_name:'',project_address:'',project_city:'',project_state:'',project_zip:'',issue_date:new Date().toISOString().split('T')[0],due_date:'',line_items:[],tax_rate:0,notes:'',terms:'',status:'draft'};
  qfRenderInvoiceEditor();
}
async function qfOpenInvoice(id){
  try{const inv=await qfApi('GET','/qf/invoices/'+id);qfState.editingInvoice=JSON.parse(JSON.stringify(inv));qfRenderInvoiceEditor();}
  catch(e){toast('Error: '+e.message);}
}
function qfRenderInvoiceEditor(){
  const inv=qfState.editingInvoice;
  document.getElementById('qf-body').innerHTML=`
<button class="backbtn" onclick="qfNav('invoices')">‹ Invoices</button>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
  <div style="font-size:20px;font-weight:700">${inv.id?inv.number:'New Invoice'}</div>
  <div style="display:flex;gap:6px">
    ${inv.status!=='paid'?`<button class="btn btn-sm btn-g" onclick="qfMarkInvoice('paid')">Mark Paid</button>`:''}
    ${inv.status==='draft'?`<button class="btn btn-sm btn-b" onclick="qfMarkInvoice('sent')">Mark Sent</button>`:''}
    <button class="btn btn-p btn-sm" onclick="qfSaveInvoice()">Save</button>
  </div>
</div>
<div class="fl nt">Client name</div><input type="text" id="qf-inv-cn" value="${inv.client_name||''}" style="margin-bottom:8px"/>
<div class="fl">Company</div><input type="text" id="qf-inv-co" value="${inv.client_company||''}" style="margin-bottom:8px"/>
<div class="fl">Email</div><input type="email" id="qf-inv-em" value="${inv.client_email||''}" style="margin-bottom:8px"/>
<div class="fl">Project name</div><input type="text" id="qf-inv-pn" value="${inv.project_name||''}" style="margin-bottom:8px"/>
<div class="fl">Project address</div><input type="text" id="qf-inv-pa" value="${inv.project_address||''}" style="margin-bottom:8px"/>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input type="date" id="qf-inv-issue" value="${inv.issue_date||''}" style="flex:1;margin-bottom:0"/>
  <input type="date" id="qf-inv-due" value="${inv.due_date||''}" placeholder="Due date" style="flex:1;margin-bottom:0"/>
</div>
<div class="sec">Line Items</div>
<div style="display:flex;gap:6px;margin-bottom:8px">
  <button class="btn btn-sm btn-b" onclick="qfAddInvLi()" style="flex:1">+ Add line</button>
  <label class="btn btn-sm" style="flex:1;text-align:center;cursor:pointer">Import CSV<input type="file" accept=".csv" style="display:none" onchange="qfImportInvLiCSV(this)"></label>
</div>
<div id="qf-inv-li-head" style="display:grid;grid-template-columns:1fr 60px 80px 80px 30px;gap:4px;padding:4px 0;border-bottom:.5px solid var(--border);margin-bottom:4px">
  <div style="font-size:10px;font-weight:600;color:var(--text2)">DESCRIPTION</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">QTY</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">RATE</div>
  <div style="font-size:10px;font-weight:600;color:var(--text2);text-align:right">TOTAL</div>
  <div></div>
</div>
<div id="qf-inv-li-body"></div>
<div style="border-top:.5px solid var(--border);padding-top:10px;margin-top:8px">
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span>Subtotal</span><span id="qf-inv-subtotal">—</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:5px">
    <span>Tax %</span>
    <div style="display:flex;align-items:center;gap:8px">
      <input type="number" id="qf-inv-taxrate" value="${inv.tax_rate||0}" min="0" max="100" step="0.1" style="width:70px;margin-bottom:0;text-align:right;padding:5px 8px" oninput="qfUpdateInvTotals()"/>
      <span id="qf-inv-tax">—</span>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;border-top:.5px solid var(--border);padding-top:8px"><span>Total</span><span id="qf-inv-total">—</span></div>
</div>
<div class="fl" style="margin-top:12px">Notes</div><textarea id="qf-inv-notes" style="margin-bottom:8px">${inv.notes||''}</textarea>
<div class="fl">Terms</div><textarea id="qf-inv-terms" style="margin-bottom:12px">${inv.terms||''}</textarea>`;
  qfRenderInvLineItems(); qfUpdateInvTotals();
}
function qfRenderInvLineItems(){
  const el=document.getElementById('qf-inv-li-body'); if(!el)return;
  const items=qfState.editingInvoice?.line_items||[];
  if(!items.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0">No line items</div>';qfUpdateInvTotals();return;}
  el.innerHTML=items.map((li,i)=>`
<div style="display:grid;grid-template-columns:1fr 60px 80px 80px 30px;gap:4px;align-items:center;padding:4px 0;border-bottom:.5px solid var(--border2)">
  <input type="text" value="${li.description||''}" style="margin-bottom:0;padding:5px 6px;font-size:13px" oninput="qfInvLiChange(${i},'description',this.value)"/>
  <input type="number" value="${li.qty||''}" style="margin-bottom:0;padding:5px 6px;font-size:13px;text-align:right" oninput="qfInvLiChange(${i},'qty',this.value)"/>
  <input type="number" value="${li.rate||''}" step="0.01" style="margin-bottom:0;padding:5px 6px;font-size:13px;text-align:right" oninput="qfInvLiChange(${i},'rate',this.value)"/>
  <div style="font-size:13px;text-align:right;padding-right:4px">${qfFmt$((parseFloat(li.qty)||0)*(parseFloat(li.rate)||0))}</div>
  <button style="background:none;border:none;cursor:pointer;color:var(--red-t);font-size:16px" onclick="qfRemoveInvLi(${i})">×</button>
</div>`).join('');
  qfUpdateInvTotals();
}
function qfInvLiChange(i,f,v){const li=qfState.editingInvoice?.line_items;if(li)li[i][f]=f==='qty'||f==='rate'?parseFloat(v)||0:v;qfUpdateInvTotals();}
function qfAddInvLi(){qfState.editingInvoice.line_items.push({id:qfLiId(),description:'',qty:1,rate:0});qfRenderInvLineItems();}
function qfRemoveInvLi(i){qfState.editingInvoice.line_items.splice(i,1);qfRenderInvLineItems();}
function qfUpdateInvTotals(){
  const inv=qfState.editingInvoice; if(!inv)return;
  const tax=parseFloat(document.getElementById('qf-inv-taxrate')?.value)||0;
  const tots=qfCalcTotals(inv.line_items,tax);
  const s=document.getElementById('qf-inv-subtotal');if(s)s.textContent=qfFmt$(tots.subtotal);
  const t=document.getElementById('qf-inv-tax');if(t)t.textContent=qfFmt$(tots.tax);
  const tt=document.getElementById('qf-inv-total');if(tt)tt.textContent=qfFmt$(tots.total);
}
function qfImportInvLiCSV(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();r.onload=e=>{
    const lines=e.target.result.split('\n').filter(l=>l.trim());let hdr=null;
    lines.forEach(line=>{const cols=line.match(/("(?:[^"]|"")*"|[^,]*)/g).map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"'));if(!hdr){hdr=cols.map(h=>h.trim().toLowerCase());return;}const di=['description','item','name'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??0;const qi=['qty','quantity'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??1;const ri=['rate','price','cost','unit'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??2;const desc=cols[di]?.trim();if(!desc)return;qfState.editingInvoice.line_items.push({id:qfLiId(),description:desc,qty:parseFloat(cols[qi])||1,rate:parseFloat(cols[ri])||0});});
    qfRenderInvLineItems();toast('Imported');
  };r.readAsText(file);input.value='';
}
async function qfSaveInvoice(){
  const inv=qfState.editingInvoice;
  inv.client_name=document.getElementById('qf-inv-cn')?.value.trim()||'';
  inv.client_company=document.getElementById('qf-inv-co')?.value.trim()||'';
  inv.client_email=document.getElementById('qf-inv-em')?.value.trim()||'';
  inv.project_name=document.getElementById('qf-inv-pn')?.value.trim()||'';
  inv.project_address=document.getElementById('qf-inv-pa')?.value.trim()||'';
  inv.issue_date=document.getElementById('qf-inv-issue')?.value||null;
  inv.due_date=document.getElementById('qf-inv-due')?.value||null;
  inv.tax_rate=parseFloat(document.getElementById('qf-inv-taxrate')?.value)||0;
  inv.notes=document.getElementById('qf-inv-notes')?.value.trim()||'';
  inv.terms=document.getElementById('qf-inv-terms')?.value.trim()||'';
  const tots=qfCalcTotals(inv.line_items,inv.tax_rate); Object.assign(inv,tots);
  try{
    let saved;
    if(inv.id){saved=await qfApi('PUT','/qf/invoices/'+inv.id,inv);}
    else{saved=await qfApi('POST','/qf/invoices',inv);}
    await qfLoadAll();
    qfState.editingInvoice={...qfState.editingInvoice,...saved};
    toast('Saved: '+saved.number);
  }catch(e){toast('Error: '+e.message);}
}
async function qfMarkInvoice(status){
  if(!qfState.editingInvoice?.id){await qfSaveInvoice();}
  const upd={status};if(status==='paid')upd.paid_at=new Date().toISOString();
  try{await qfApi('PUT','/qf/invoices/'+qfState.editingInvoice.id,upd);await qfLoadAll();toast(status==='paid'?'Marked paid!':'Marked sent');qfRenderInvoiceEditor();}
  catch(e){toast(e.message);}
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
function qfRenderTemplates(el){
  const tab=qfState.templateTab||'templates';
  el.innerHTML=`
<div style="font-size:18px;font-weight:700;margin-bottom:12px">Templates</div>
<div class="tab-row" style="margin-bottom:12px">
  <button class="tab-btn ${tab==='templates'?'active':''}" onclick="qfState.templateTab='templates';qfNav('templates')">Quote Templates</button>
  <button class="tab-btn ${tab==='blocks'?'active':''}" onclick="qfState.templateTab='blocks';qfNav('templates')">Scope Blocks</button>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <select id="qf-tmpl-trade" onchange="qfFilterTemplates()" style="flex:1;margin-bottom:0"><option value="">All trades</option>${TRADES.map(t=>`<option>${t}</option>`).join('')}</select>
  <button class="btn btn-p btn-sm" onclick="${tab==='templates'?'qfNewTemplate()':'qfNewScopeBlock()'}">+ New</button>
  <button class="btn btn-sm btn-b" onclick="qfExportTemplates()">Export</button>
  <label class="btn btn-sm" style="cursor:pointer;text-align:center">Import<input type="file" accept=".json" style="display:none" onchange="qfImportTemplates(this)"></label>
</div>
<div id="qf-tmpl-list"></div>`;
  qfFilterTemplates();
}
function qfFilterTemplates(){
  const trade=document.getElementById('qf-tmpl-trade')?.value||'';
  const tab=qfState.templateTab||'templates';
  const el=document.getElementById('qf-tmpl-list'); if(!el)return;
  if(tab==='templates'){
    const list=qfState.templates.filter(t=>!trade||t.trade===trade);
    el.innerHTML=list.length?list.map(t=>`
<div class="card" style="margin-bottom:8px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    <div><div style="font-size:14px;font-weight:600">${t.name}</div>
    <div class="pa">${t.trade||'All trades'} · ${t.line_items?.length||0} items · ${qfFmt$((t.line_items||[]).reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0))}</div></div>
    <div style="display:flex;gap:5px">
      <button class="btn btn-sm btn-p" onclick="qfNewQuote('${t.id}')">Use →</button>
      <button class="btn btn-sm" onclick="qfEditTemplate('${t.id}')">Edit</button>
      <button class="btn btn-sm btn-d" onclick="qfDeleteTemplate('${t.id}')">Del</button>
    </div>
  </div>
</div>`).join(''):'<div class="empty">No templates yet</div>';
  } else {
    const list=qfState.scopeblocks.filter(b=>!trade||b.trade===trade);
    el.innerHTML=list.length?list.map(b=>`
<div class="card" style="margin-bottom:8px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    <div><div style="font-size:14px;font-weight:600">${b.name}</div>
    <div class="pa">${b.trade||'All trades'} · ${b.line_items?.length||0} items · ${qfFmt$((b.line_items||[]).reduce((s,i)=>s+(i.qty||0)*(i.rate||0),0))}</div></div>
    <div style="display:flex;gap:5px">
      <button class="btn btn-sm" onclick="qfEditScopeBlock('${b.id}')">Edit</button>
      <button class="btn btn-sm btn-d" onclick="qfDeleteScopeBlock('${b.id}')">Del</button>
    </div>
  </div>
</div>`).join(''):'<div class="empty">No scope blocks yet</div>';
  }
}
function qfTemplateEditorModal(data, type, onSave){
  const isSB = type==='scopeblock';
  const modal=document.createElement('div'); modal.className='modal-ov'; modal.id='qf-tmpl-modal';
  modal.innerHTML=`<div class="modal-sh" style="max-height:88vh">
  <div class="modal-title">${data.id?(isSB?'Edit Scope Block':'Edit Template'):(isSB?'New Scope Block':'New Template')}</div>
  <div class="fl nt">Name *</div><input type="text" id="qf-tm-name" value="${data.name||''}" style="margin-bottom:8px"/>
  <div class="fl">Trade</div><select id="qf-tm-trade" style="margin-bottom:8px"><option value="">All trades</option>${TRADES.map(t=>`<option ${data.trade===t?'selected':''}>${t}</option>`).join('')}</select>
  ${!isSB?`<div class="fl">Description (pre-fills project)</div><textarea id="qf-tm-desc" style="margin-bottom:8px">${data.description||''}</textarea>
  <div class="fl">Default expiry (days)</div><input type="number" id="qf-tm-expiry" value="${data.expiry_days||30}" style="margin-bottom:8px"/>
  <div class="fl">Tax rate %</div><input type="number" id="qf-tm-tax" value="${data.tax_rate||0}" step="0.1" style="margin-bottom:8px"/>
  <div class="fl">Notes</div><textarea id="qf-tm-notes" style="margin-bottom:8px">${data.notes||''}</textarea>
  <div class="fl">Terms</div><textarea id="qf-tm-terms" style="margin-bottom:8px">${data.terms||''}</textarea>`:''}
  <div class="fl">Line Items</div>
  <div style="display:flex;gap:6px;margin-bottom:6px">
    <button class="btn btn-sm btn-b" onclick="qfTmplAddLi()" style="flex:1">+ Add</button>
    <label class="btn btn-sm" style="flex:1;cursor:pointer;text-align:center">CSV<input type="file" accept=".csv" style="display:none" onchange="qfTmplImportCSV(this)"></label>
  </div>
  <div id="qf-tm-li-head" style="display:grid;grid-template-columns:1fr 55px 75px 30px;gap:4px;padding:3px 0;border-bottom:.5px solid var(--border);margin-bottom:3px"><div style="font-size:10px;color:var(--text2)">DESCRIPTION</div><div style="font-size:10px;color:var(--text2);text-align:right">QTY</div><div style="font-size:10px;color:var(--text2);text-align:right">RATE</div><div></div></div>
  <div id="qf-tm-li-body"></div>
  <div class="row" style="margin-top:12px">
    <button class="btn btn-p" onclick="qfSaveTmplModal('${type}','${data.id||''}')" style="flex:2">Save</button>
    <button class="btn" onclick="document.getElementById('qf-tmpl-modal').remove()">Cancel</button>
  </div></div>`;
  document.body.appendChild(modal);
  // Render line items
  qfTmplItems = JSON.parse(JSON.stringify(data.line_items||[]));
  qfRenderTmplLi();
}
let qfTmplItems=[];
function qfRenderTmplLi(){
  const el=document.getElementById('qf-tm-li-body'); if(!el)return;
  el.innerHTML=qfTmplItems.length?qfTmplItems.map((li,i)=>`
<div style="display:grid;grid-template-columns:1fr 55px 75px 30px;gap:4px;padding:3px 0;border-bottom:.5px solid var(--border2)">
  <input type="text" value="${li.description||''}" style="margin-bottom:0;padding:4px 5px;font-size:12px" oninput="qfTmplItems[${i}].description=this.value"/>
  <input type="number" value="${li.qty||''}" style="margin-bottom:0;padding:4px 5px;font-size:12px;text-align:right" oninput="qfTmplItems[${i}].qty=parseFloat(this.value)||0"/>
  <input type="number" value="${li.rate||''}" step="0.01" style="margin-bottom:0;padding:4px 5px;font-size:12px;text-align:right" oninput="qfTmplItems[${i}].rate=parseFloat(this.value)||0"/>
  <button style="background:none;border:none;cursor:pointer;color:var(--red-t);font-size:14px" onclick="qfTmplItems.splice(${i},1);qfRenderTmplLi()">×</button>
</div>`).join(''):'<div style="font-size:11px;color:var(--text3);padding:5px 0">No items</div>';
}
function qfTmplAddLi(){qfTmplItems.push({id:qfLiId(),description:'',qty:1,rate:0});qfRenderTmplLi();}
function qfTmplImportCSV(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();r.onload=e=>{const lines=e.target.result.split('\n').filter(l=>l.trim());let hdr=null;lines.forEach(line=>{const cols=line.match(/("(?:[^"]|"")*"|[^,]*)/g).map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"'));if(!hdr){hdr=cols.map(h=>h.trim().toLowerCase());return;}const di=['description','item','name'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??0;const qi=['qty','quantity'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??1;const ri=['rate','price','cost','unit'].map(k=>hdr.indexOf(k)).find(i=>i>=0)??2;const desc=cols[di]?.trim();if(!desc)return;qfTmplItems.push({id:qfLiId(),description:desc,qty:parseFloat(cols[qi])||1,rate:parseFloat(cols[ri])||0});});qfRenderTmplLi();toast('Imported');};r.readAsText(file);input.value='';
}
async function qfSaveTmplModal(type, id){
  const name=document.getElementById('qf-tm-name')?.value.trim(); if(!name){toast('Name required');return;}
  const trade=document.getElementById('qf-tm-trade')?.value||'';
  const body={name,trade,line_items:qfTmplItems};
  if(type!=='scopeblock'){
    body.description=document.getElementById('qf-tm-desc')?.value.trim()||'';
    body.expiry_days=parseInt(document.getElementById('qf-tm-expiry')?.value)||30;
    body.tax_rate=parseFloat(document.getElementById('qf-tm-tax')?.value)||0;
    body.notes=document.getElementById('qf-tm-notes')?.value.trim()||'';
    body.terms=document.getElementById('qf-tm-terms')?.value.trim()||'';
  }
  const isSB=type==='scopeblock';
  const ep=isSB?'/qf/scopeblocks':'/qf/templates';
  try{
    if(id){await qfApi('PUT',ep+'/'+id,body);}else{await qfApi('POST',ep,body);}
    await qfLoadAll(); document.getElementById('qf-tmpl-modal')?.remove();
    qfNav('templates'); toast('Saved: '+name);
  }catch(e){toast('Error: '+e.message);}
}
function qfNewTemplate(){qfTemplateEditorModal({line_items:[]},'template');}
function qfEditTemplate(id){const t=qfState.templates.find(t=>t.id===id);if(t)qfTemplateEditorModal(t,'template');}
function qfNewScopeBlock(){qfTemplateEditorModal({line_items:[]},'scopeblock');}
function qfEditScopeBlock(id){const b=qfState.scopeblocks.find(b=>b.id===id);if(b)qfTemplateEditorModal(b,'scopeblock');}
async function qfDeleteTemplate(id){if(!confirm('Delete?'))return;try{await qfApi('DELETE','/qf/templates/'+id);await qfLoadAll();qfNav('templates');toast('Deleted');}catch(e){toast(e.message);}}
async function qfDeleteScopeBlock(id){if(!confirm('Delete?'))return;try{await qfApi('DELETE','/qf/scopeblocks/'+id);await qfLoadAll();qfNav('templates');toast('Deleted');}catch(e){toast(e.message);}}
async function qfExportTemplates(){
  const data={templates:qfState.templates,scopeblocks:qfState.scopeblocks};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='templates_export.json';a.click();toast('Exported');
}
async function qfImportTemplates(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();r.onload=async e=>{
    try{const data=JSON.parse(e.target.result);let count=0;
    for(const t of data.templates||[]){await qfApi('POST','/qf/templates',{...t,id:undefined}).catch(()=>{});count++;}
    for(const b of data.scopeblocks||[]){await qfApi('POST','/qf/scopeblocks',{...b,id:undefined}).catch(()=>{});count++;}
    await qfLoadAll();qfNav('templates');toast('Imported '+count+' items');}
    catch(e){toast('Import error: '+e.message);}
  };r.readAsText(file);input.value='';
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
async function qfRenderReports(el){
  el.innerHTML=`<div style="font-size:18px;font-weight:700;margin-bottom:12px">Reports</div>
<div style="display:flex;gap:6px;margin-bottom:14px">
  ${[['all','All time'],['30','Last 30d'],['90','Last 90d'],['365','Last year']].map(([v,l])=>`<button class="btn btn-sm ${qfState.reportsPeriod===v?'btn-p':''}" onclick="qfState.reportsPeriod='${v}';qfRenderReports(document.getElementById('qf-body'))">${l}</button>`).join('')}
</div>
<div id="qf-reports-body"><div class="empty">Loading…</div></div>`;
  try{
    const data=await qfApi('GET','/qf/reports?period='+qfState.reportsPeriod);
    qfState.reportsData=data;
    const rb=document.getElementById('qf-reports-body');
    const estNames={}; qfState.users.forEach(u=>estNames[u.id]=u.name);
    rb.innerHTML=`
<div class="sum-cards" style="margin-bottom:14px">
  <div class="sum-card green"><div class="sv">${data.winRate}%</div><div class="sl">Win rate</div></div>
  <div class="sum-card blue"><div class="sv">${data.totalQuotes}</div><div class="sl">Total quotes</div></div>
  <div class="sum-card"><div class="sv" style="color:var(--teal-t)">${qfFmt$(data.awardedVolume)}</div><div class="sl">Awarded volume</div></div>
  <div class="sum-card amber"><div class="sv">${qfFmt$(data.unpaidInvoices)}</div><div class="sl">Unpaid invoices</div></div>
</div>

<div class="sec" style="margin-top:0">Estimator Leaderboard</div>
<div class="card" style="margin-bottom:14px">
${data.byEstimator.length?data.byEstimator.sort((a,b)=>b.total-a.total).map(e=>`<div class="prow"><div class="pi"><div class="pid">${estNames[e.id]||e.id}</div><div class="pn">${e.count} won · ${qfFmt$(e.total)}</div></div></div>`).join(''):'<div style="font-size:12px;color:var(--text3);padding:8px 0">No awarded quotes yet</div>'}
</div>

<div class="sec">Why We Lose</div>
<div class="card" style="margin-bottom:14px">
${Object.keys(data.lossReasons).length?Object.entries(data.lossReasons).sort((a,b)=>b[1]-a[1]).map(([r,c])=>{const max=Math.max(...Object.values(data.lossReasons));return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${r}</span><span>${c}</span></div><div style="background:var(--bg3);border-radius:99px;height:6px"><div style="background:var(--red-t);height:100%;border-radius:99px;width:${Math.round(c/max*100)}%"></div></div></div>`;}).join(''):'<div style="font-size:12px;color:var(--text3);padding:8px 0">No declined quotes yet</div>'}
</div>

<div class="sec">By Trade</div>
<div class="card" style="margin-bottom:14px">
${data.byTrade.length?data.byTrade.sort((a,b)=>b.volume-a.volume).map(t=>`<div class="prow"><div class="pi"><div class="pid">${t.trade}</div><div class="pn">${t.count} quotes · ${t.won} won · ${qfFmt$(t.volume)}</div></div><div style="font-size:13px;font-weight:600;color:var(--green-t)">${t.count?Math.round(t.won/t.count*100):0}%</div></div>`).join(''):'<div style="font-size:12px;color:var(--text3);padding:8px 0">No data yet</div>'}
</div>

<div class="sec">Monthly Trend</div>
<div class="card" style="margin-bottom:14px">
${data.monthly.length?`<div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding-bottom:20px;position:relative">${data.monthly.map(m=>{const total=m.won+m.lost+m.open||1;const wH=Math.round(m.won/total*80);const lH=Math.round(m.lost/total*80);const oH=Math.round(m.open/total*80);return`<div style="flex:1;display:flex;flex-direction:column;align-items:center"><div style="width:100%;display:flex;flex-direction:column-reverse;gap:1px"><div style="background:var(--green-t);height:${wH}px;border-radius:3px 3px 0 0" title="${m.won} won"></div><div style="background:var(--red-t);height:${lH}px" title="${m.lost} lost"></div><div style="background:var(--bg3);height:${oH}px;border-radius:0" title="${m.open} open"></div></div><div style="font-size:9px;color:var(--text3);margin-top:4px;white-space:nowrap">${m.month.slice(5)}</div></div>`;}).join('')}</div>`:'<div style="font-size:12px;color:var(--text3);padding:8px 0">No data yet</div>'}
</div>`;
  }catch(e){document.getElementById('qf-reports-body').innerHTML='<div class="empty">Error: '+e.message+'</div>';}
}

// ── PEOPLE ─────────────────────────────────────────────────────────────────────
function qfRenderPeople(el){
  const tab=qfState.peopleTab||'gcs';
  el.innerHTML=`
<div style="font-size:18px;font-weight:700;margin-bottom:12px">People</div>
<div class="tab-row" style="margin-bottom:12px">
  <button class="tab-btn ${tab==='gcs'?'active':''}" onclick="qfState.peopleTab='gcs';qfNav('people')">General Contractors</button>
  <button class="tab-btn ${tab==='estimators'?'active':''}" onclick="qfState.peopleTab='estimators';qfNav('people')">Estimators</button>
</div>
${tab==='gcs'?qfGcList():qfEstimatorList()}`;
}
function qfGcList(){
  const gcs=qfState.gcs;
  return`<button class="btn btn-p btn-sm" onclick="qfNewGC()" style="margin-bottom:12px">+ Add GC</button>
${gcs.length?gcs.map(g=>{
  const qcount=qfState.quotes.filter(q=>q.recipients?.some(r=>r.gc_id===g.id)).length;
  const won=qfState.quotes.filter(q=>q.status==='awarded'&&q.recipients?.some(r=>r.gc_id===g.id&&r.status==='awarded')).length;
  return`<div class="card" style="margin-bottom:8px"><div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div style="font-size:15px;font-weight:600">${g.company||g.name}</div>
    <div class="pn">${g.name} · ${g.email}</div>
    ${g.phone?'<div class="pa">'+g.phone+'</div>':''}
    ${g.notes?'<div class="pa" style="color:var(--text3)">'+g.notes+'</div>':''}
    <div style="font-size:11px;color:var(--text2);margin-top:4px">${qcount} bids · ${won} won${qcount?(' · '+Math.round(won/qcount*100)+'% win rate'):''}</div></div>
    <div style="display:flex;gap:5px">
      <button class="btn btn-sm" onclick="qfEditGC('${g.id}')">Edit</button>
      <button class="btn btn-sm btn-d" onclick="qfDeleteGC('${g.id}')">Del</button>
    </div>
  </div></div>`;}).join(''):'<div class="empty">No GCs yet</div>'}`;
}
function qfEstimatorList(){
  const ests=qfState.users.filter(u=>['admin','foreman','estimator','stager'].includes(u.role));
  return`<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Estimators are managed in the Admin tab. Here you can see their quote performance.</div>
${ests.length?ests.map(u=>{
  const myQ=qfState.quotes.filter(q=>q.estimator_id===u.id);
  const won=myQ.filter(q=>q.status==='awarded').length;
  const vol=myQ.filter(q=>q.status==='awarded').reduce((s,q)=>s+q.total,0);
  return`<div class="card" style="margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:15px;font-weight:600">${u.name}<span class="role-badge role-${u.role}" style="margin-left:6px">${u.role}</span></div>
      <div class="pn">${u.username}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:var(--green-t)">${qfFmt$(vol)}</div><div class="pa">${myQ.length} quotes · ${won} won${myQ.length?(' · '+Math.round(won/myQ.length*100)+'%'):''}</div></div>
    </div>
  </div>`;}).join(''):'<div class="empty">No estimators</div>'}`;
}
function qfGCModal(data){
  const modal=document.createElement('div'); modal.className='modal-ov'; modal.id='qf-gc-modal';
  modal.innerHTML=`<div class="modal-sh">
  <div class="modal-title">${data.id?'Edit GC':'Add GC'}</div>
  <div class="fl nt">Company *</div><input type="text" id="qf-gc-co" value="${data.company||''}" style="margin-bottom:8px"/>
  <div class="fl">Contact name</div><input type="text" id="qf-gc-nm" value="${data.name||''}" style="margin-bottom:8px"/>
  <div class="fl">Email *</div><input type="email" id="qf-gc-em" value="${data.email||''}" style="margin-bottom:8px"/>
  <div class="fl">Phone</div><input type="tel" id="qf-gc-ph" value="${data.phone||''}" style="margin-bottom:8px"/>
  <div class="fl">Notes</div><textarea id="qf-gc-nt" style="margin-bottom:10px">${data.notes||''}</textarea>
  <div class="row"><button class="btn btn-p" onclick="qfSaveGC('${data.id||''}')">Save</button><button class="btn" onclick="document.getElementById('qf-gc-modal').remove()">Cancel</button></div>
  </div>`;
  document.body.appendChild(modal);
}
function qfNewGC(){qfGCModal({});}
function qfEditGC(id){const g=qfState.gcs.find(g=>g.id===id);if(g)qfGCModal(g);}
async function qfSaveGC(id){
  const b={company:document.getElementById('qf-gc-co')?.value.trim(),name:document.getElementById('qf-gc-nm')?.value.trim(),email:document.getElementById('qf-gc-em')?.value.trim(),phone:document.getElementById('qf-gc-ph')?.value.trim(),notes:document.getElementById('qf-gc-nt')?.value.trim()};
  if(!b.company&&!b.name){toast('Company required');return;}
  try{if(id){await qfApi('PUT','/qf/gcs/'+id,b);}else{await qfApi('POST','/qf/gcs',b);}await qfLoadAll();document.getElementById('qf-gc-modal')?.remove();qfNav('people');toast('Saved');}
  catch(e){toast(e.message);}
}
async function qfDeleteGC(id){if(!confirm('Delete GC?'))return;try{await qfApi('DELETE','/qf/gcs/'+id);await qfLoadAll();qfNav('people');toast('Deleted');}catch(e){toast(e.message);}}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function qfRenderSettings(el){
  const co=qfState.company||{}; const integ=qfState.integrations||{};
  el.innerHTML=`
<div style="font-size:18px;font-weight:700;margin-bottom:14px">QuoteFlow Settings</div>

<div class="sec" style="margin-top:0">Company / Branding</div>
<div class="card" style="margin-bottom:14px">
  <div class="fl nt">Company name</div><input type="text" id="qf-s-name" value="${co.name||''}" style="margin-bottom:8px"/>
  <div class="fl">Email</div><input type="email" id="qf-s-email" value="${co.email||''}" style="margin-bottom:8px"/>
  <div class="fl">Phone</div><input type="tel" id="qf-s-phone" value="${co.phone||''}" style="margin-bottom:8px"/>
  <div class="fl">Address</div><textarea id="qf-s-addr" style="margin-bottom:8px">${co.address||''}</textarea>
  <div class="fl">Tagline / header text</div><input type="text" id="qf-s-tagline" value="${co.header_text||''}" style="margin-bottom:8px"/>
  <div class="fl">Accent color</div>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
    <input type="color" id="qf-s-color" value="${co.accent_color||'#27500a'}" style="width:44px;height:36px;padding:2px;border-radius:6px;cursor:pointer;border:.5px solid var(--border)" oninput="document.getElementById('qf-s-color-hex').value=this.value;qfPreviewBranding()"/>
    <input type="text" id="qf-s-color-hex" value="${co.accent_color||'#27500a'}" placeholder="#27500a" style="width:100px;margin-bottom:0" oninput="document.getElementById('qf-s-color').value=this.value;qfPreviewBranding()"/>
  </div>
  <div class="fl">Logo</div>
  <label class="btn btn-b btn-sm" style="cursor:pointer;display:inline-block;margin-bottom:8px">
    Upload logo (≤ 500KB)
    <input type="file" accept="image/*" style="display:none" onchange="qfUploadLogo(this)">
  </label>
  ${co.logo_data_url?`<div style="margin-bottom:8px"><img src="${co.logo_data_url}" style="height:48px;border-radius:4px"/><button class="btn btn-sm btn-d" style="margin-left:8px" onclick="qfClearLogo()">Remove</button></div>`:''}
  <div id="qf-branding-preview" style="margin-bottom:12px">${qfBrandingPreview(co)}</div>
  <button class="btn btn-p" onclick="qfSaveCompany()">Save Company Settings</button>
</div>

${CU?.role==='admin'?`
<div class="sec">Email (Resend)</div>
<div class="card" style="margin-bottom:14px">
  <div class="fl nt">Resend API key</div><input type="password" id="qf-s-rkey" value="${integ.resend_api_key||''}" placeholder="re_..." autocomplete="new-password" style="margin-bottom:8px"/>
  <div class="fl">From email</div><input type="email" id="qf-s-rfrom" value="${integ.resend_from_email||''}" placeholder="quotes@yourcompany.com" style="margin-bottom:8px"/>
  <div class="fl">From name</div><input type="text" id="qf-s-rname" value="${integ.resend_from_name||''}" placeholder="Your Company" style="margin-bottom:12px"/>
  <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Get a free API key at <a href="https://resend.com" target="_blank" style="color:var(--blue-t)">resend.com</a>. You'll need to verify your sending domain.</div>
  <button class="btn btn-p" onclick="qfSaveIntegrations()">Save Email Settings</button>
</div>

<div class="sec">Award Page</div>
<div class="card" style="margin-bottom:14px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div><div style="font-size:14px;font-weight:600">Public award page</div><div class="pa">When ON, anyone with the link can view and sign. When OFF, the link still works but this setting is reserved for future token-gate options.</div></div>
    <label style="cursor:pointer;display:flex;align-items:center;gap:6px">
      <input type="checkbox" id="qf-s-public" ${integ.award_page_public!==false?'checked':''} style="width:18px;height:18px"/>
    </label>
  </div>
  <button class="btn btn-p" onclick="qfSaveIntegrations()">Save</button>
</div>

<div class="sec">Data</div>
<div class="card">
  <button class="btn btn-b" onclick="qfExportAll()" style="margin-bottom:8px;width:100%">Export all QuoteFlow data (JSON)</button>
  <div style="font-size:11px;color:var(--text3)">Exports quotes, invoices, templates, scope blocks, and GCs.</div>
</div>`:'<div class="bb bb-info" style="margin-top:12px"><div class="bm">Email and integration settings are admin-only.</div></div>'}`;
}
function qfBrandingPreview(co){
  const accent=document.getElementById('qf-s-color')?.value||co?.accent_color||'#27500a';
  return`<div style="border:.5px solid var(--border);border-radius:var(--rs);overflow:hidden;margin-top:4px"><div style="background:${accent};color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px">
    ${co?.logo_data_url?`<img src="${co.logo_data_url}" style="height:28px;border-radius:3px"/>`:''}
    <div><div style="font-size:13px;font-weight:700">${co?.name||'Your Company'}</div>${co?.header_text?'<div style="font-size:10px;opacity:.8">'+co.header_text+'</div>':''}</div>
  </div><div style="padding:10px 14px;font-size:12px;color:var(--text2)">${co?.address||''} ${co?.phone?'· '+co.phone:''}</div></div>`;
}
function qfPreviewBranding(){document.getElementById('qf-branding-preview').innerHTML=qfBrandingPreview(qfState.company);}
function qfUploadLogo(input){
  const file=input.files[0];if(!file)return;
  if(file.size>500*1024){toast('Logo must be ≤ 500KB');return;}
  const r=new FileReader();r.onload=e=>{qfState.company.logo_data_url=e.target.result;qfRenderSettings(document.getElementById('qf-body'));};r.readAsDataURL(file);input.value='';
}
function qfClearLogo(){qfState.company.logo_data_url='';qfRenderSettings(document.getElementById('qf-body'));}
async function qfSaveCompany(){
  const co={name:document.getElementById('qf-s-name')?.value.trim()||'',email:document.getElementById('qf-s-email')?.value.trim()||'',phone:document.getElementById('qf-s-phone')?.value.trim()||'',address:document.getElementById('qf-s-addr')?.value.trim()||'',header_text:document.getElementById('qf-s-tagline')?.value.trim()||'',accent_color:document.getElementById('qf-s-color-hex')?.value.trim()||'#27500a',logo_data_url:qfState.company.logo_data_url||''};
  try{await qfApi('PUT','/qf/company',co);qfState.company={...qfState.company,...co};toast('Company settings saved');}catch(e){toast('Error: '+e.message);}
}
async function qfSaveIntegrations(){
  const integ={resend_api_key:document.getElementById('qf-s-rkey')?.value.trim()||'',resend_from_email:document.getElementById('qf-s-rfrom')?.value.trim()||'',resend_from_name:document.getElementById('qf-s-rname')?.value.trim()||'',award_page_public:document.getElementById('qf-s-public')?.checked!==false};
  try{await qfApi('PUT','/qf/integrations',integ);qfState.integrations={...qfState.integrations,...integ};toast('Email settings saved');}catch(e){toast('Error: '+e.message);}
}
async function qfExportAll(){
  try{const data=await qfApi('GET','/qf/export');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='quoteflow_export_'+new Date().toISOString().split('T')[0]+'.json';a.click();toast('Exported');}
  catch(e){toast('Error: '+e.message);}
}
function qfExportQuotesCSV(){
  const rows=[['Number','Project','Address','Trade','Estimator','Status','Total','Bid Due','Recipients']];
  qfState.quotes.forEach(q=>{const est=qfState.users.find(u=>u.id===q.estimator_id);rows.push([q.number,q.project_name,q.project_address,q.trade,est?.name||'',q.status,q.total,q.bid_due_date||'',(q.recipients||[]).map(r=>r.company||r.name).join(';')]);});
  const csv=rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='quotes.csv';a.click();toast('Exported');
}

// ── PUBLIC AWARD PAGE ─────────────────────────────────────────────────────────
async function qfRenderAwardPage(token, container) {
  container.innerHTML='<div style="max-width:600px;margin:40px auto;padding:20px;text-align:center"><div style="font-size:24px;margin-bottom:12px">⏳</div><div>Loading quote…</div></div>';
  try{
    const data=await fetch('/api/award/'+token).then(r=>r.json());
    if(data.error){container.innerHTML=`<div style="max-width:600px;margin:40px auto;padding:20px;text-align:center"><div style="font-size:40px">❌</div><h2>${data.error}</h2></div>`;return;}
    const {quote:q,recipient:rec,branding,awardedElsewhere}=data;
    const accent=branding?.accent_color||'#27500a';
    const tots=qfCalcTotals(q.line_items,q.tax_rate);
    container.innerHTML=`
<div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="background:${accent};color:#fff;padding:20px 24px">
    ${branding?.logo_data_url?`<img src="${branding.logo_data_url}" style="height:44px;margin-bottom:8px;display:block"/>`:''}
    <div style="font-size:20px;font-weight:700">${branding?.name||'Field Ops'}</div>
    ${branding?.header_text?`<div style="font-size:13px;opacity:.85">${branding.header_text}</div>`:''}
    ${branding?.address?`<div style="font-size:12px;opacity:.75;margin-top:4px">${branding.address}</div>`:''}
  </div>
  <div style="padding:20px 24px;border:.5px solid var(--border)">
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Quote ${q.number} · v${q.version}</div>
    <div style="font-size:22px;font-weight:700;margin-bottom:4px">${q.project_name||'Project'}</div>
    ${q.project_address?`<div style="color:var(--text2);font-size:14px;margin-bottom:4px">📍 ${q.project_address}${q.project_city?', '+q.project_city:''} ${q.project_state||''}</div>`:''}
    ${q.trade?`<div style="font-size:13px;color:var(--text2);margin-bottom:12px">${q.trade}</div>`:''}
    ${q.bid_due_date?`<div style="background:#fff3cd;border-radius:6px;padding:8px 12px;font-size:13px;color:#856404;margin-bottom:12px">⏰ Bid due: ${q.bid_due_date}</div>`:''}
    ${q.project_description?`<div style="font-size:14px;color:var(--text);margin-bottom:16px;line-height:1.6">${q.project_description}</div>`:''}
    
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
      <thead><tr style="border-bottom:2px solid var(--border)"><th style="text-align:left;padding:6px 4px;color:#888">Item</th><th style="text-align:right;padding:6px 4px;color:#888">Qty</th><th style="text-align:right;padding:6px 4px;color:#888">Rate</th><th style="text-align:right;padding:6px 4px;color:#888">Total</th></tr></thead>
      <tbody>${(q.line_items||[]).map(li=>`<tr style="border-bottom:.5px solid var(--border2)"><td style="padding:7px 4px">${li.description}</td><td style="text-align:right;padding:7px 4px">${li.qty}</td><td style="text-align:right;padding:7px 4px">${qfFmt$(li.rate)}</td><td style="text-align:right;padding:7px 4px;font-weight:500">${qfFmt$((li.qty||0)*(li.rate||0))}</td></tr>`).join('')}</tbody>
    </table>
    <div style="text-align:right;font-size:14px;margin-bottom:4px">Subtotal: ${qfFmt$(tots.subtotal)}</div>
    ${q.tax_rate>0?`<div style="text-align:right;font-size:14px;color:var(--text2);margin-bottom:4px">Tax (${q.tax_rate}%): ${qfFmt$(tots.tax)}</div>`:''}
    <div style="text-align:right;font-size:20px;font-weight:700;border-top:2px solid var(--border);padding-top:8px">Total: ${qfFmt$(tots.total)}</div>

    ${q.notes?`<div style="margin-top:16px"><div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:4px">Notes</div><div style="font-size:13px;color:var(--text);line-height:1.6">${q.notes}</div></div>`:''}
    ${q.terms?`<div style="margin-top:12px"><div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:4px">Terms</div><div style="font-size:12px;color:var(--text2);line-height:1.6">${q.terms}</div></div>`:''}

    <div style="margin-top:24px">
    ${rec.status==='awarded'?`<div style="background:#eaf3de;border:1px solid #c0dd97;border-radius:8px;padding:16px;text-align:center"><div style="font-size:20px;margin-bottom:4px">✅</div><div style="font-size:16px;font-weight:700;color:#27500a">You have awarded this bid</div><div style="font-size:13px;color:#27500a;margin-top:4px">Signed by ${rec.signature_name}${rec.signature_title?' ('+rec.signature_title+')':''}</div></div>`
    :awardedElsewhere?`<div style="background:var(--bg3);border-radius:8px;padding:16px;text-align:center;color:#666"><div style="font-size:20px;margin-bottom:4px">🔒</div><div style="font-weight:600">This bid has been awarded to another party</div></div>`
    :`<div style="display:flex;gap:10px;margin-top:8px">
      <button onclick="qfAwardModal('${token}')" style="flex:2;padding:14px;background:${accent};color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">✓ Award this Bid</button>
      <button onclick="qfDeclineModal('${token}')" style="flex:1;padding:14px;background:#fff;color:#c00;border:1px solid #f7c1c1;border-radius:8px;font-size:14px;cursor:pointer">Decline</button>
    </div>`}
    </div>
  </div>
</div>`;
  }catch(e){container.innerHTML=`<div style="max-width:600px;margin:40px auto;padding:20px;text-align:center"><h2>Error loading quote</h2><p>${e.message}</p></div>`;}
}

function qfAwardModal(token){
  const modal=document.createElement('div');modal.id='qf-award-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:flex-end;justify-content:center;padding-bottom:max(24px,env(safe-area-inset-bottom))';
  modal.innerHTML=`<div style="background:var(--bg);border-radius:16px 16px 12px 12px;width:100%;max-width:480px;padding:20px;max-height:88vh;overflow-y:auto">
  <div style="font-size:18px;font-weight:700;margin-bottom:16px">Award this Bid</div>
  <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px">FULL NAME *</div>
  <input type="text" id="qf-aw-name" placeholder="Your full name" style="width:100%;padding:10px;border:.5px solid var(--border);border-radius:8px;font-size:15px;margin-bottom:10px"/>
  <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px">TITLE</div>
  <input type="text" id="qf-aw-title" placeholder="e.g. Project Manager" style="width:100%;padding:10px;border:.5px solid var(--border);border-radius:8px;font-size:15px;margin-bottom:10px"/>
  <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px">EMAIL</div>
  <input type="email" id="qf-aw-email" placeholder="your@email.com" style="width:100%;padding:10px;border:.5px solid var(--border);border-radius:8px;font-size:15px;margin-bottom:10px"/>
  <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px">SIGNATURE * <span style="font-weight:400;color:#aaa">— draw below</span></div>
  <canvas id="qf-sig-canvas" width="440" height="120" style="border:.5px solid var(--border);border-radius:8px;width:100%;touch-action:none;cursor:crosshair;background:var(--bg2)"></canvas>
  <button onclick="qfClearSig()" style="font-size:12px;color:var(--text2);background:none;border:none;cursor:pointer;margin:4px 0 10px">Clear signature</button>
  <label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;cursor:pointer">
    <input type="checkbox" id="qf-aw-agree" style="margin-top:2px;width:18px;height:18px"/>
    <span style="font-size:13px;color:#444">I agree to award this bid and authorize the work described above.</span>
  </label>
  <div style="display:flex;gap:10px">
    <button onclick="qfSubmitAward('${token}')" style="flex:2;padding:12px;background:#27500a;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">Submit Award</button>
    <button onclick="document.getElementById('qf-award-modal').remove()" style="flex:1;padding:12px;border:.5px solid var(--border);border-radius:8px;font-size:14px;cursor:pointer;background:#fff">Cancel</button>
  </div>
  </div>`;
  document.body.appendChild(modal);
  // Setup canvas drawing
  const canvas=document.getElementById('qf-sig-canvas');
  const ctx=canvas.getContext('2d');let drawing=false;
  function pos(e){const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;const s=e.touches?e.touches[0]:e;return{x:(s.clientX-r.left)*sx,y:(s.clientY-r.top)*sy};}
  canvas.onmousedown=canvas.ontouchstart=e=>{e.preventDefault();drawing=true;ctx.beginPath();const p=pos(e);ctx.moveTo(p.x,p.y);};
  canvas.onmousemove=canvas.ontouchmove=e=>{e.preventDefault();if(!drawing)return;const p=pos(e);ctx.lineWidth=2;ctx.strokeStyle='#1d1d1f';ctx.lineCap='round';ctx.lineTo(p.x,p.y);ctx.stroke();};
  canvas.onmouseup=canvas.ontouchend=()=>drawing=false;
}
function qfClearSig(){const c=document.getElementById('qf-sig-canvas');const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}
async function qfSubmitAward(token){
  const name=document.getElementById('qf-aw-name')?.value.trim();
  if(!name){alert('Full name required');return;}
  const canvas=document.getElementById('qf-sig-canvas');
  const blank=!canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some(d=>d!==0);
  if(blank){alert('Please sign above');return;}
  if(!document.getElementById('qf-aw-agree')?.checked){alert('Please check the agreement box');return;}
  const sig=canvas.toDataURL('image/png');
  try{
    const r=await fetch('/api/award/'+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signature_name:name,signature_title:document.getElementById('qf-aw-title')?.value.trim(),signature_email:document.getElementById('qf-aw-email')?.value.trim(),signature_image:sig})});
    const d=await r.json();
    if(d.error){alert(d.error);return;}
    document.getElementById('qf-award-modal')?.remove();
    // Refresh the page display
    qfRenderAwardPage(token,document.getElementById('award-container'));
  }catch(e){alert('Error: '+e.message);}
}
function qfDeclineModal(token){
  const reason=prompt('Reason for declining?\n'+LOSS_REASONS.map((r,i)=>`${i+1}. ${r}`).join('\n'));
  if(!reason)return;
  fetch('/api/award/'+token+'/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decline_reason:reason})})
    .then(r=>r.json()).then(d=>{if(d.ok)qfRenderAwardPage(token,document.getElementById('award-container'));else alert(d.error||'Error');});
}
