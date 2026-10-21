const TXNS=[
 {d:"2026-10-20",t:"expense",c:"Food",n:"🍔",desc:"Lunch at Shad's",a:"350.00"},
 {d:"2026-10-18",t:"income",c:"Salary",n:"💼",desc:"October salary",a:"40000.00"},
 {d:"2026-10-15",t:"expense",c:"Rent",n:"🏠",desc:"House rent Oct",a:"15000.00"},
 {d:"2026-10-12",t:"expense",c:"Shopping",n:"🛍",desc:"Winter panjabi",a:"3200.00"},
 {d:"2026-10-10",t:"expense",c:"Transport",n:"🚌",desc:"Uber + bus",a:"850.00"},
 {d:"2026-10-08",t:"income",c:"Freelance",n:"💻",desc:"Landing page fix",a:"5000.00"},
 {d:"2026-10-05",t:"expense",c:"Food",n:"🍔",desc:"Groceries — Shwapno",a:"2400.00"},
 {d:"2026-10-03",t:"expense",c:"Utilities",n:"💡",desc:"Electricity + net",a:"2100.00"},
 {d:"2026-10-02",t:"expense",c:"Transport",n:"🚌",desc:"CNG + rickshaw",a:"1200.00"},
 {d:"2026-10-01",t:"expense",c:"Shopping",n:"🛍",desc:"Shoes",a:"2200.00"},
];
const CATS=[
 {n:"Salary",t:"income",i:"💼",c:1},{n:"Freelance",t:"income",i:"💻",c:1},{n:"Allowance",t:"income",i:"🎓",c:0},
 {n:"Food",t:"expense",i:"🍔",c:6},{n:"Transport",t:"expense",i:"🚌",c:4},{n:"Rent",t:"expense",i:"🏠",c:1},
 {n:"Shopping",t:"expense",i:"🛍",c:3},{n:"Utilities",t:"expense",i:"💡",c:2},{n:"Health",t:"expense",i:"💊",c:0},
];
const BUDGETS=[
 {s:"Overall",lim:35000,sp:30850},{s:"Food",lim:8000,sp:7250},{s:"Transport",lim:5000,sp:3200},{s:"Shopping",lim:6000,sp:5400},
];
const MONTHS=["2026-09","2026-10","2026-11"];let mi=1;
let fType="all";

const $=s=>document.querySelector(s);
function money(a){return "৳"+Number(a).toLocaleString("en-US",{minimumFractionDigits:2})}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.add("hidden"),2200)}
function enterApp(e){e.preventDefault();$("#authOverlay").classList.add("hidden");$("#app").classList.remove("hidden");toast("Logged in — access 15m, refresh rotates");return false}
function logout(){location.reload()}

// nav
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>goto(b.dataset.screen));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>goto(b.getAttribute("data-goto")));
function goto(s){document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===s));document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active",x.id==="screen-"+s));window.scrollTo(0,0)}

// auth tabs
document.querySelectorAll(".auth-tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".auth-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");$("#loginForm").classList.toggle("active",t.dataset.authtab==="login");$("#registerForm").classList.toggle("active",t.dataset.authtab==="register")});

// month
function changeMonth(d){mi=Math.min(2,Math.max(0,mi+d));const m=MONTHS[mi];$("#monthLabel").textContent=new Date(m+"-01").toLocaleString("en-US",{month:"long",year:"numeric"});$("#budgetMonth").textContent=m;if(m!=="2026-10"){toast("Empty month preview — zeros, not errors (FR-REP-05)")}}

// txn table
function txnRow(t,actions=true){return `<tr><td>${t.d}</td><td><span class="badge ${t.t==="income"?"in":"ex"}">${t.t}</span></td><td>${t.n} ${t.c}</td><td>${t.desc}</td><td class="r"><strong class="${t.t==="income"?"green":"red"}">${t.t==="income"?"+":"−"}${money(t.a)}</strong></td>${actions?`<td><div class="row-actions"><button class="icon-btn" onclick="toast('Edit wireframe — PATCH /transactions/{id}/')">✎</button><button class="icon-btn" onclick="openDelete()">🗑</button></div></td>`:""}</tr>`}
function renderTxns(){
 const fCat=$("#fCategory").value,q=($("#globalSearch").value||"").toLowerCase(),s=$("#fStart").value,e=$("#fEnd").value;
 if(s&&e&&s>e){toast("start_date must be ≤ end_date (400)");return}
 let rows=TXNS.filter(t=>(fType==="all"||t.t===fType)&&(!fCat||t.c===fCat)&&(!q||(t.desc+t.c).toLowerCase().includes(q))&&(!s||t.d>=s)&&(!e||t.d<=e));
 $("#txnBody").innerHTML=rows.map(t=>txnRow(t)).join("");
 $("#txnEmpty").classList.toggle("hidden",rows.length>0);
 $("#txnCount").textContent=`${rows.length} of 24 · page 1 · ordered −date`;
 $("#recentBody").innerHTML=TXNS.slice(0,5).map(t=>txnRow(t,false)).join("");
}
function filterTxns(){renderTxns()}
function resetFilters(){fType="all";document.querySelectorAll("#typeSeg button").forEach(b=>b.classList.toggle("active",b.dataset.t==="all"));$("#fCategory").value="";$("#globalSearch").value="";$("#fStart").value="2026-10-01";$("#fEnd").value="2026-10-31";renderTxns()}
document.querySelectorAll("#typeSeg button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#typeSeg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");fType=b.dataset.t;renderTxns()});
document.querySelectorAll("#catSeg button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#catSeg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderCats(b.dataset.c)});
document.querySelectorAll("#txnTypeSeg button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#txnTypeSeg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");fillTxnCats(b.dataset.tt)});

// categories
function renderCats(f="all"){
 $("#catGrid").innerHTML=CATS.filter(c=>f==="all"||c.t===f).map(c=>`<div class="cat-card"><div class="cat-ico" style="background:${c.t==="income"?"#dcfce7":"#fee2e2"}">${c.i}</div><h4>${c.n}</h4><p>${c.t} · ${c.c} txn${c.c===1?"":"s"} · owner-scoped</p><div class="row-actions" style="justify-content:flex-start"><button class="btn ghost sm" onclick="toast('Edit category (wireframe)')">Edit</button><button class="btn ghost sm" onclick="toast('Blocked: ${c.c} transactions use this (FR-CAT-06)')">${c.c>0?"Delete (blocked)":"Delete"}</button></div></div>`).join("");
}
function openCatModal(){$("#catModal").classList.remove("hidden")}

// budgets
function renderBudgets(){
 $("#budgetGrid").innerHTML=BUDGETS.map(b=>{const p=Math.round(b.sp/b.lim*100),over=b.sp>b.lim,cls=over?"bad":p>85?"warn":"ok";return `<div class="budget-card ${over?"over":""}"><div class="bc-head"><strong>${b.s==="Overall"?"🌐 Overall":"🏷 "+b.s}</strong><span class="pill ${over?"bad":p>85?"warn":"ok"}">${over?"OVER":""+p+"%"}</span></div><div class="bc-amt">${money(b.sp)} <span class="muted" style="font-size:13px;font-weight:400">/ ${money(b.lim)}</span></div><div class="progress ${cls}"><i style="width:${Math.min(100,p)}%"></i></div><small class="muted">Remaining ${money(b.lim-b.sp)} · spent from expense txns only</small><div class="row-actions" style="justify-content:flex-start;margin-top:10px"><button class="btn ghost sm" onclick="toast('Edit budget (wireframe)')">Edit</button><button class="btn ghost sm" onclick="toast('Budget deleted — txns kept (FR-BUD-09)')">Delete</button></div></div>`}).join("");
 $("#reportBudgetBody").innerHTML=BUDGETS.map(b=>{const r=b.lim-b.sp;return `<tr><td><strong>${b.s}</strong></td><td class="r">${money(b.lim)}</td><td class="r">${money(b.sp)}</td><td class="r"><strong class="${r<0?"red":"green"}">${money(r)}</strong></td><td>${r<0?'<span class="pill bad">OVER</span>':r<1000?'<span class="pill warn">NEAR</span>':'<span class="pill ok">OK</span>'}</td></tr>`}).join("");
 $("#reportBars").innerHTML=[["Rent",15000,100],["Food",7250,48],["Shopping",5400,36],["Transport",3200,21],["Utilities",2100,14]].map(x=>`<div class="bar-row"><span>${x[0]}</span><div class="hbar"><i style="width:${x[2]}%"></i></div><strong>${money(x[1])}</strong></div>`).join("");
}
function openBudgetModal(){$("#budgetModal").classList.remove("hidden")}

// txn modal
function fillTxnCats(t){const el=$("#txnCategory");el.innerHTML=(t==="expense"?["Food","Transport","Rent","Shopping","Utilities","Health"]:["Salary","Freelance","Allowance"]).map(c=>`<option>${c} (${t})</option>`).join("")}
function openTxnModal(){$("#txnModalTitle").textContent="Add transaction";fillTxnCats("expense");$("#txnModal").classList.remove("hidden")}
function openDelete(){$("#deleteModal").classList.remove("hidden")}
function closeModals(){document.querySelectorAll(".modal-backdrop").forEach(m=>m.classList.add("hidden"))}
function saveTxn(){const a=parseFloat($("#txnAmount").value);if(!(a>0)){$("#amtErr").classList.remove("hidden");return}$("#amtErr").classList.add("hidden");closeModals();toast("Saved — dashboard & budgets recalculated")}
$("#txnDesc")?.addEventListener("input",e=>$("#descCount").textContent=`${e.target.value.length} / 255`);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModals()});
document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModals()}));

// init
(function(){$("#fCategory").innerHTML='<option value="">All categories</option>'+[...new Set(CATS.map(c=>c.n))].map(n=>`<option>${n}</option>`).join("");fillTxnCats("expense");renderTxns();renderCats();renderBudgets()})();
