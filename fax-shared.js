// FieldAxisHQ — Shared Utilities
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
function toCSV(rows){return rows.map(r=>r.map(c=>'"'+(String(c||'').replace(/"/g,'""'))+'"').join(',')).join('\n')}
async function geocodeAddr(addr){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(addr)+'&format=json&limit=1&countrycodes=us',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();if(!j.length)return null;return{lat:parseFloat(j[0].lat),lng:parseFloat(j[0].lon)}}catch{return null}}
async function addrSuggest(q){try{const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)+'&format=json&limit=5&countrycodes=us',{headers:{'User-Agent':'FieldAxisHQ/1.0'}});const j=await r.json();return j.map(x=>({label:x.display_name,lat:parseFloat(x.lat),lng:parseFloat(x.lon)}))}catch{return[]}}
