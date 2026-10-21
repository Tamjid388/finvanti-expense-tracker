const ICONS={
 salary:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
 freelance:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
 food:'<svg viewBox="0 0 24 24"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3c-2 2-2.5 5-2.5 8H16v10M16 3v10"/></svg>',
 transport:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M4 12h16M7 20l1.5-4M17 20l-1.5-4"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="18" r="1.4"/></svg>',
 rent:'<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 shopping:'<svg viewBox="0 0 24 24"><path d="M6 7h15l-1.5 9h-12zM6 7l-1-3H3M9 21a1.3 1.3 0 1 0 0-.1M18 21a1.3 1.3 0 1 0 0-.1"/></svg>',
 utilities:'<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>'
};
const TXNS=[
 {d:"Oct 20",t:"expense",c:"Food",desc:"Lunch near office",a:350},
 {d:"Oct 18",t:"income",c:"Salary",desc:"October salary",a:40000},
 {d:"Oct 15",t:"expense",c:"Rent",desc:"House rent, October",a:15000},
 {d:"Oct 12",t:"expense",c:"Shopping",desc:"Winter panjabi",a:3200},
 {d:"Oct 10",t:"expense",c:"Transport",desc:"Uber + bus",a:850},
 {d:"Oct 08",t:"income",c:"Freelance",desc:"Landing page fix",a:5000},
 {d:"Oct 05",t:"expense",c:"Food",desc:"Shwapno groceries",a:2400},
];
const BUDGETS=[
 {n:"Food",sp:7250,lim:8000,cls:"food"},
 {n:"Transport",sp:3200,lim:5000,cls:"transport"},
 {n:"Shopping",sp:5400,lim:6000,cls:"shopping"},
];
const CATS=[
 {n:"Salary",t:"income",c:1,cls:"salary"},{n:"Freelance",t:"income",c:1,cls:"freelance"},
 {n:"Food",t:"expense",c:2,cls:"food"},{n:"Transport",t:"expense",c:2,cls:"transport"},
 {n:"Rent",t:"expense",c:1,cls:"rent"},{n:"Shopping",t:"expense",c:1,cls:"shopping"},
 {n:"Utilities",t:"expense",c:1,cls:"utilities"},
];
const BARS=[["Rent",15000,100],["Food",7250,48],["Shopping",5400,36],["Transport",3200,21],["Utilities",2100,14]];
let mFilter="all";
const $=s=>document.querySelector(s);
const key=c=>c.toLowerCase();
function toast(m){const t=$("#mToast");t.textContent=m;t.classList.remove("hidden");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.add("hidden"),2200)}
function mGo(s){["auth","home","txns","budgets","more","cats","reports","profile"].forEach(x=>$("#m-"+x).classList.toggle("active",x===s));$("#tabbar").classList.toggle("hidden",s==="auth");document.querySelectorAll(".tabbar button[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===s));const el=$("#m-"+s);if(el)el.scrollTop=0}
document.querySelectorAll("[data-ma]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-ma]").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#ma-login").classList.toggle("hidden",b.dataset.ma!=="login");$("#ma-register").classList.toggle("hidden",b.dataset.ma!=="register")});
document.querySelectorAll("#mChips button[data-mt]").forEach(b=>b.onclick=()=>{document.querySelectorAll("#mChips button[data-mt]").forEach(x=>x.classList.remove("active"));b.classList.add("active");mFilter=b.dataset.mt;renderMobile()});
document.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-st]").forEach(x=>x.classList.remove("active"));b.classList.add("active");fillCats(b.dataset.st)});
function fillCats(t){$("#mCat").innerHTML=(t==="expense"?["Food","Transport","Rent","Shopping","Utilities"]:["Salary","Freelance"]).map(c=>`<option>${c} (${t})</option>`).join("")}
function openSheet(id){$("#"+id).classList.remove("hidden")}
function closeSheets(){document.querySelectorAll(".sheet-back").forEach(s=>s.classList.add("hidden"))}
document.querySelectorAll(".sheet-back").forEach(s=>s.addEventListener("click",e=>{if(e.target===s)closeSheets()}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheets()});
function saveMobileTxn(){const v=parseFloat(($("#mAmt")||{}).value);if(!(v>0)){toast("Amount must be greater than 0");$("#mAmt").focus();return}closeSheets();toast("Saved. Home, budgets and reports update together")}
function txnRow(t){return `<button class="txn" onclick="toast('Detail: ${t.desc} — PATCH /transactions/{id}/')"><span class="txn-ico">${ICONS[key(t.c)]||""}</span><span class="txn-body"><strong>${t.desc}</strong><small>${t.d} · ${t.c} · ${t.t}</small></span><span class="txn-amt ${t.t==="income"?"inc":"exp"}">${t.t==="income"?"+":"−"}৳${t.a.toLocaleString("en-US",{minimumFractionDigits:2})}</span></button>`}
function grouped(list){
 let html="",last="";
 list.forEach(t=>{if(t.d!==last){last=t.d;html+=`<div class="date-head">${t.d}</div>`}html+=txnRow(t)});
 return html;
}
function statusPill(p){return p>100?'<span class="pill bad">Over</span>':p>85?'<span class="pill warn">Tight</span>':'<span class="pill ok">On track</span>'}
function renderMobile(){
 const q=(($("#mQ")||{}).value||"").toLowerCase();
 const rows=TXNS.filter(t=>(mFilter==="all"||t.t===mFilter)&&(!q||(t.desc+t.c).toLowerCase().includes(q)));
 $("#mTxns").innerHTML=rows.length?grouped(rows):'<div class="empty-note"><strong>No transactions match.</strong><br>Widen the date range or clear search.</div>';
 $("#mRecent").innerHTML=grouped(TXNS.slice(0,4));
 $("#mBudgets").innerHTML=BUDGETS.map(b=>{const p=Math.round(b.sp/b.lim*100);return `<div class="budget-row"><div class="b-top"><span class="left"><span class="cdot ${b.cls}"></span><strong>${b.n}</strong></span>${statusPill(p)}</div><div class="b-fig">৳${b.sp.toLocaleString()} <span>/ ৳${b.lim.toLocaleString()} · ${p}%</span></div><div class="meter"><i style="width:${Math.min(100,p)}%"></i></div><small>৳${(b.lim-b.sp).toLocaleString()} left · spent from expense transactions only</small></div>`}).join("");
 $("#mCats").innerHTML=CATS.map(c=>`<button class="txn" onclick="toast('${c.c} transaction(s) use ${c.n}')"><span class="txn-ico">${ICONS[c.cls]||""}</span><span class="txn-body"><strong>${c.n}</strong><small>${c.t} · ${c.c} transaction${c.c===1?"":"s"}</small></span><span class="txn-amt">›</span></button>`).join("");
 const bars=$("#mBars");if(bars)bars.innerHTML=BARS.map(x=>`<div class="bar-card"><div class="bar-top"><span>${x[0]}</span><b>৳${x[1].toLocaleString()}</b></div><div class="hbar"><i style="width:${x[2]}%"></i></div></div>`).join("");
 const rb=$("#mRepBudgets");if(rb)rb.innerHTML=BUDGETS.map(b=>{const p=Math.round(b.sp/b.lim*100);return `<div class="bar-card"><div class="bar-top"><span>${b.n} · ${p}%</span><b>৳${(b.lim-b.sp).toLocaleString()} left</b></div><div class="hbar"><i style="width:${Math.min(100,p)}%"></i></div></div>`}).join("");
}
fillCats("expense");renderMobile();
