// Partner Portal fixture — the app's entry chunk. Hand-written plain JS in the shapes a Vite + React
// build leaves (a route-constant object, {id, defaultMessage} descriptors, GraphQL documents in template
// strings, a permission table, enums and limits), and the app really runs on them. Invented throughout.
const R={login:"/login",orders:"/orders",orderDetails:"/orders/:orderId",payouts:"/payouts",customers:"/customers",customerDetails:"/customers/:customerId",salesWeekly:"/reports/sales-weekly",salesDaily:"/reports/sales-daily",financeReport:"/reports/finance",profile:"/settings/profile",adminUsers:"/admin/users",adminAuditLog:"/admin/audit-log",adminSettings:"/admin/settings"};

// roles, and the permission table the menu and the router check
const Role={PARTNER:"ROLE_PARTNER",MANAGER:"ROLE_MANAGER",ADMIN:"ROLE_ADMIN"};
const PERMS=[{name:"orders",roles:[Role.PARTNER,Role.MANAGER,Role.ADMIN]},{name:"customers",roles:[Role.PARTNER,Role.MANAGER,Role.ADMIN]},{name:"payouts",roles:[Role.PARTNER,Role.MANAGER,Role.ADMIN]},{name:"reports",roles:[Role.PARTNER,Role.MANAGER,Role.ADMIN]},{name:"settings",roles:[Role.PARTNER,Role.MANAGER,Role.ADMIN]},{name:"financeReport",roles:[Role.MANAGER,Role.ADMIN]},{name:"admin",roles:[Role.ADMIN]}];
const DENIED="You do not have permission to view this page.";

// enums and limits
const OrderStatus={PENDING:"PENDING",PAID:"PAID",SHIPPED:"SHIPPED",REFUNDED:"REFUNDED",CANCELLED:"CANCELLED"};
const PayoutMethod={BANK_TRANSFER:"BANK_TRANSFER",WALLET:"WALLET",CHEQUE:"CHEQUE"};
const CustomerTier={BRONZE:"BRONZE",SILVER:"SILVER",GOLD:"GOLD"};
const ReportPeriod={WEEKLY:"WEEKLY",DAILY:"DAILY"};
const MAX_IMPORT_SIZE=2*1024*1024,MIN_PAYOUT_AMOUNT=50,MAX_PAYOUT_AMOUNT=5e3,NOTE_MAX_LENGTH=200,MAX_VOUCHER_RECIPIENTS=50,EXPORT_ROW_LIMIT=1e4,SESSION_TIMEOUT=30*60*1e3;
const ROWS_PER_PAGE_OPTIONS=[10,25,50],VOUCHER_VALUES=[5,10,25];

// messages: formatjs descriptors
const M={
shell:{brand:{id:"shell.brand",defaultMessage:"Partner Portal"},available:{id:"shell.balance.available",defaultMessage:"Available balance"},pending:{id:"shell.balance.pending",defaultMessage:"Pending balance"},account:{id:"shell.account",defaultMessage:"Account"},mainMenu:{id:"shell.mainMenu",defaultMessage:"Main menu"}},
nav:{sales:{id:"nav.sales",defaultMessage:"Sales"},finance:{id:"nav.finance",defaultMessage:"Finance"},reports:{id:"nav.reports",defaultMessage:"Reports"},settings:{id:"nav.settings",defaultMessage:"Settings"},admin:{id:"nav.admin",defaultMessage:"Admin"},orders:{id:"nav.orders",defaultMessage:"Orders"},customers:{id:"nav.customers",defaultMessage:"Customers"},payouts:{id:"nav.payouts",defaultMessage:"Payouts"},salesWeekly:{id:"nav.salesWeekly",defaultMessage:"Sales weekly"},salesDaily:{id:"nav.salesDaily",defaultMessage:"Sales daily"},finance2:{id:"nav.financeReport",defaultMessage:"Finance"},profile:{id:"nav.profile",defaultMessage:"Profile"},users:{id:"nav.users",defaultMessage:"Users"},auditLog:{id:"nav.auditLog",defaultMessage:"Audit log"},adminSettings:{id:"nav.adminSettings",defaultMessage:"Settings"}},
account:{language:{id:"account.language",defaultMessage:"Language"},english:{id:"account.english",defaultMessage:"English"},german:{id:"account.german",defaultMessage:"Deutsch"},referral:{id:"account.referral",defaultMessage:"Referral link"},copy:{id:"account.copy",defaultMessage:"Copy"},copied:{id:"account.copied",defaultMessage:"Referral link copied"},logout:{id:"account.logout",defaultMessage:"Log out"},partnerId:{id:"account.partnerId",defaultMessage:"Partner ID"}},
orders:{title:{id:"orders.title",defaultMessage:"Orders"},status:{id:"orders.filter.status",defaultMessage:"Status"},allStatuses:{id:"orders.filter.allStatuses",defaultMessage:"All"},selected:{id:"orders.filter.selected",defaultMessage:"{count} selected"},dateRange:{id:"orders.filter.dateRange",defaultMessage:"Date range"},today:{id:"orders.preset.today",defaultMessage:"Today"},last7:{id:"orders.preset.last7",defaultMessage:"Last 7 days"},last30:{id:"orders.preset.last30",defaultMessage:"Last 30 days"},thisMonth:{id:"orders.preset.thisMonth",defaultMessage:"This month"},from:{id:"orders.filter.from",defaultMessage:"From"},to:{id:"orders.filter.to",defaultMessage:"To"},apply:{id:"orders.filter.apply",defaultMessage:"Apply"},search:{id:"orders.filter.search",defaultMessage:"Search"},searchHint:{id:"orders.filter.searchHint",defaultMessage:"Order number or customer"},amountFrom:{id:"orders.filter.amountFrom",defaultMessage:"Amount from"},amountTo:{id:"orders.filter.amountTo",defaultMessage:"Amount to"},clear:{id:"orders.filter.clear",defaultMessage:"Clear filters"},columns:{id:"orders.columns",defaultMessage:"Columns"},exportCsv:{id:"orders.export",defaultMessage:"Export CSV"},rowsPerPage:{id:"orders.rowsPerPage",defaultMessage:"Rows per page"},range:{id:"orders.range",defaultMessage:"{from}–{to} of {total}"},prev:{id:"orders.prev",defaultMessage:"Previous page"},next:{id:"orders.next",defaultMessage:"Next page"},sortAsc:{id:"orders.sortAsc",defaultMessage:"Sort ascending"},sortDesc:{id:"orders.sortDesc",defaultMessage:"Sort descending"},hide:{id:"orders.hideColumn",defaultMessage:"Hide column"},columnMenu:{id:"orders.columnMenu",defaultMessage:"Column menu"},count:{id:"orders.count",defaultMessage:"{count, plural, one {# order} other {# orders}}"},empty:{id:"orders.empty",defaultMessage:"No orders match these filters"}},
orderDetails:{title:{id:"orderDetails.title",defaultMessage:"Order {number}"},back:{id:"orderDetails.back",defaultMessage:"Back to orders"},summary:{id:"orderDetails.summary",defaultMessage:"Summary"},lines:{id:"orderDetails.lines",defaultMessage:"Line items"},timeline:{id:"orderDetails.timeline",defaultMessage:"Timeline"},notFound:{id:"orderDetails.notFound",defaultMessage:"Order not found"}},
payouts:{title:{id:"payouts.title",defaultMessage:"Payouts"},request:{id:"payouts.request",defaultMessage:"Request payout"},empty:{id:"payouts.empty",defaultMessage:"No payouts yet"},emptyHint:{id:"payouts.emptyHint",defaultMessage:"Payouts you request appear here."},amount:{id:"payouts.amount",defaultMessage:"Amount"},method:{id:"payouts.method",defaultMessage:"Method"},note:{id:"payouts.note",defaultMessage:"Note"},submit:{id:"payouts.submit",defaultMessage:"Submit"},requested:{id:"payouts.requested",defaultMessage:"Payout requested"},amountRange:{id:"payouts.amountRange",defaultMessage:"Enter an amount between {min} and {max}."}},
customers:{title:{id:"customers.title",defaultMessage:"Customers"},search:{id:"customers.search",defaultMessage:"Search"},tier:{id:"customers.tier",defaultMessage:"Tier"},allTiers:{id:"customers.allTiers",defaultMessage:"All tiers"},sendVoucher:{id:"customers.sendVoucher",defaultMessage:"Send voucher"},import:{id:"customers.import",defaultMessage:"Import customers"},selectRow:{id:"customers.selectRow",defaultMessage:"Select row"},selectAll:{id:"customers.selectAll",defaultMessage:"Select all"},selectedCount:{id:"customers.selectedCount",defaultMessage:"{count} selected"}},
voucher:{value:{id:"voucher.value",defaultMessage:"Voucher value"},message:{id:"voucher.message",defaultMessage:"Message"},send:{id:"voucher.send",defaultMessage:"Send"},sent:{id:"voucher.sent",defaultMessage:"Voucher sent to {count} customers"},tooMany:{id:"voucher.tooMany",defaultMessage:"Choose at most {max} customers."}},
import:{title:{id:"import.title",defaultMessage:"Import customers"},step:{id:"import.step",defaultMessage:"Step {n} of 3: {name}"},upload:{id:"import.step.upload",defaultMessage:"Upload file"},map:{id:"import.step.map",defaultMessage:"Map columns"},review:{id:"import.step.review",defaultMessage:"Review"},drop:{id:"import.drop",defaultMessage:"Drop a file here, or choose one"},accepts:{id:"import.accepts",defaultMessage:"CSV or XLSX, up to 2 MB"},template:{id:"import.template",defaultMessage:"Download template"},file:{id:"import.file",defaultMessage:"File"},tooLarge:{id:"import.tooLarge",defaultMessage:"The file is larger than 2 MB."},wrongType:{id:"import.wrongType",defaultMessage:"Choose a CSV or XLSX file."},rows:{id:"import.rows",defaultMessage:"{name}: {rows} rows"},detected:{id:"import.detected",defaultMessage:"Columns found: {columns}"},ready:{id:"import.ready",defaultMessage:"Ready to import {name}."},next:{id:"import.next",defaultMessage:"Next"},back:{id:"import.back",defaultMessage:"Back"},run:{id:"import.run",defaultMessage:"Import"},done:{id:"import.done",defaultMessage:"Import started"}},
customerDetails:{back:{id:"customerDetails.back",defaultMessage:"Back to customers"},contact:{id:"customerDetails.contact",defaultMessage:"Contact"},recent:{id:"customerDetails.recent",defaultMessage:"Recent orders"},notFound:{id:"customerDetails.notFound",defaultMessage:"Customer not found"}},
reports:{salesWeekly:{id:"reports.salesWeekly",defaultMessage:"Sales weekly"},salesDaily:{id:"reports.salesDaily",defaultMessage:"Sales daily"},weekly:{id:"reports.tab.weekly",defaultMessage:"Weekly"},daily:{id:"reports.tab.daily",defaultMessage:"Daily"},finance:{id:"reports.finance",defaultMessage:"Finance report"}},
profile:{title:{id:"profile.title",defaultMessage:"Profile"},displayName:{id:"profile.displayName",defaultMessage:"Display name"},email:{id:"profile.email",defaultMessage:"Email"},phone:{id:"profile.phone",defaultMessage:"Phone"},company:{id:"profile.company",defaultMessage:"Company"},notify:{id:"profile.notify",defaultMessage:"Email me about new orders"},save:{id:"profile.save",defaultMessage:"Save"},saved:{id:"profile.saved",defaultMessage:"Profile saved"}},
orderCols:{number:{id:"orders.columns.number",defaultMessage:"Order"},date:{id:"orders.columns.date",defaultMessage:"Date"},customer:{id:"orders.columns.customerName",defaultMessage:"Customer"},status:{id:"orders.columns.status",defaultMessage:"Status"},items:{id:"orders.columns.items",defaultMessage:"Items"},amount:{id:"orders.columns.amount",defaultMessage:"Amount"}},
customerCols:{name:{id:"customers.columns.name",defaultMessage:"Name"},email:{id:"customers.columns.email",defaultMessage:"Email"},tier:{id:"customers.columns.tier",defaultMessage:"Tier"},orders:{id:"customers.columns.orders",defaultMessage:"Orders"},lastOrder:{id:"customers.columns.lastOrder",defaultMessage:"Last order"}},
common:{cancel:{id:"common.cancel",defaultMessage:"Cancel"},close:{id:"common.close",defaultMessage:"Close"},loading:{id:"common.loading",defaultMessage:"Loading…"}},
errors:{deniedTitle:{id:"errors.deniedTitle",defaultMessage:"Access denied"},denied:{id:"errors.denied",defaultMessage:"You do not have permission to view this page."},rateLimited:{id:"errors.rateLimited",defaultMessage:"Too many requests. Try again in 30 seconds."},failed:{id:"errors.failed",defaultMessage:"Something went wrong. Try again."}}};

// column sets
const ORDER_COLUMNS=[{field:"number",headerName:"Order"},{field:"date",headerName:"Date"},{field:"customerName",headerName:"Customer"},{field:"status",headerName:"Status"},{field:"items",headerName:"Items"},{field:"amount",headerName:"Amount"}];
const ORDER_LINE_COLUMNS=[{field:"product",headerName:"Product"},{field:"quantity",headerName:"Quantity"},{field:"unitPrice",headerName:"Unit price"},{field:"total",headerName:"Total"}];
const PAYOUT_COLUMNS=[{field:"requestedAt",headerName:"Requested"},{field:"amount",headerName:"Amount"},{field:"method",headerName:"Method"},{field:"status",headerName:"Status"}];
const CUSTOMER_COLUMNS=[{field:"name",headerName:"Name"},{field:"email",headerName:"Email"},{field:"tier",headerName:"Tier"},{field:"orders",headerName:"Orders"},{field:"lastOrder",headerName:"Last order"}];
const CUSTOMER_ORDER_COLUMNS=[{field:"number",headerName:"Order"},{field:"date",headerName:"Date"},{field:"status",headerName:"Status"},{field:"amount",headerName:"Amount"}];
const WEEKLY_COLUMNS=[{field:"label",headerName:"Week"},{field:"orders",headerName:"Orders"},{field:"revenue",headerName:"Revenue"},{field:"average",headerName:"Average order"}];
const DAILY_COLUMNS=[{field:"label",headerName:"Day"},{field:"orders",headerName:"Orders"},{field:"revenue",headerName:"Revenue"},{field:"average",headerName:"Average order"}];

// GraphQL documents
const ORDER_FIELDS=`fragment OrderFields on Order { id number date customerId customerName status items amount }`;
const SHELL_QUERY=`query Shell { me { displayName email partnerId referralCode role } balances { available pending currency } }`;
const ORDERS_QUERY=`query Orders($filter: OrderFilter, $sort: OrderSort, $first: Int, $offset: Int) { orders(filter: $filter, sort: $sort, first: $first, offset: $offset) { total nodes { ...OrderFields } } }`;
const ORDER_DETAILS_QUERY=`query OrderDetails($id: ID!) { order(id: $id) { ...OrderFields lines { product quantity unitPrice } timeline { at event } } }`;
const PAYOUTS_QUERY=`query Payouts { payouts { id requestedAt amount method status } }`;
const REQUEST_PAYOUT=`mutation RequestPayout($input: PayoutInput!) { requestPayout(input: $input) { ok id status } }`;
const CUSTOMERS_QUERY=`query Customers($search: String, $tier: CustomerTier) { customers(search: $search, tier: $tier) { id name email tier orders lastOrder } }`;
const CUSTOMER_DETAILS_QUERY=`query CustomerDetails($id: ID!) { customer(id: $id) { id name email tier city orders lastOrder recentOrders { ...OrderFields } } }`;
const SEND_VOUCHER=`mutation SendVoucher($input: VoucherInput!) { sendVoucher(input: $input) { ok sent } }`;
const IMPORT_CUSTOMERS=`mutation ImportCustomers($uploadId: ID!) { importCustomers(uploadId: $uploadId) { ok imported } }`;
const SALES_REPORT_QUERY=`query SalesReport($period: ReportPeriod!) { salesReport(period: $period) { label orders revenue average } }`;
const PROFILE_QUERY=`query Profile { profile { displayName email phone company notifyOrders } }`;
const UPDATE_PROFILE=`mutation UpdateProfile($input: ProfileInput!) { updateProfile(input: $input) { ok } }`;
const FINANCE_REPORT_QUERY=`query FinanceReport($from: Date, $to: Date) { financeReport(from: $from, to: $to) { month grossRevenue commission netPayable } }`;
const ORDER_UPDATES=`subscription OrderUpdates { orderUpdated { ...OrderFields } }`;

// ───────── runtime ─────────
const BY_ID={};for(const ns of Object.values(M))for(const d of Object.values(ns))BY_ID[d.id]=d;
let LOCALE=null,LANG="en",ME=null,BAL=null;
function icu(s,v){return s.replace(/\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g,(_,k,a,b)=>(Number(v[k])===1?a:b).replace("#",v[k])).replace(/\{(\w+)\}/g,(_,k)=>v[k]!=null?v[k]:"")}
function fmt(d,v={}){const c=LOCALE&&LOCALE[d.id];if(c)return icu(c.map(p=>p.type===0?p.value:p.type===1?"{"+p.value+"}":p.type===6?"{"+p.value+", plural, one {"+p.options.one.value.map(x=>x.value).join("")+"} other {"+p.options.other.value.map(x=>x.value).join("")+"}}":"").join(""),v);return icu(d.defaultMessage,v)}
const col=(c,ns)=>{const d=BY_ID[ns+".columns."+c.field];return d?fmt(d):c.headerName};
const money=n=>new Intl.NumberFormat(LANG==="de"?"de-DE":"en-GB",{style:"currency",currency:(BAL&&BAL.currency)||"GBP"}).format(n);
const can=p=>{const r=PERMS.find(x=>x.name===p);return!!(r&&ME&&r.roles.includes(ME.role))};
function h(t,p,...k){const e=document.createElement(t);for(const[a,v]of Object.entries(p||{})){if(v==null||v===false)continue;if(a==="class")e.className=v;else if(a.startsWith("on"))e.addEventListener(a.slice(2).toLowerCase(),v);else if(a==="value")e.value=v;else if(a==="checked")e.checked=!!v;else e.setAttribute(a,v===true?"":v)}for(const c of k.flat(Infinity)){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
const main=()=>document.getElementById("main"),overlays=()=>document.getElementById("overlays");
function toast(text){const t=h("div",{class:"toast",role:"status"},text);document.body.append(t);setTimeout(()=>t.remove(),3e3)}

class ApiError extends Error{constructor(code,msg){super(msg||code);this.code=code}}
async function gql(query,variables){const operationName=/(?:query|mutation)\s+(\w+)/.exec(query)[1];
const r=await fetch("/api/graphql",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({operationName,query,variables:variables||{}})});
if(r.status===401){location.assign(R.login+"?next="+encodeURIComponent(location.pathname));throw new ApiError("UNAUTHENTICATED")}
if(r.status===429){toast(fmt(M.errors.rateLimited));throw new ApiError("RATE_LIMITED")}
const j=await r.json();if(j.errors&&j.errors.length){const e=j.errors[0];throw new ApiError(e.extensions&&e.extensions.code||"ERROR",e.message)}return j.data}

// overlays: one popover at a time, and modal dialogs
let POP=null;
function closePop(){if(POP){POP.el.remove();POP.anchor.setAttribute("aria-expanded","false");POP=null}}
function openPop(anchor,el){closePop();const b=anchor.getBoundingClientRect();el.style.left=b.left+scrollX+"px";el.style.top=b.bottom+scrollY+4+"px";overlays().append(el);anchor.setAttribute("aria-expanded","true");POP={el,anchor};const f=el.querySelector("[role=option],[role=menuitem],[role=menuitemradio],input,button");f&&f.focus()}
document.addEventListener("click",e=>{if(POP&&!POP.el.contains(e.target)&&!POP.anchor.contains(e.target))closePop()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(POP)closePop();else{const d=overlays().querySelector(".backdrop:last-child");d&&d.remove()}}});
let DLG=0;
function openDialog(title,body,actions){const id="dlg-"+ ++DLG;const box=h("div",{class:"backdrop"},h("div",{class:"modal",role:"dialog","aria-modal":"true","aria-labelledby":id},h("h2",{id},title),body,h("div",{class:"actions"},actions)));overlays().append(box);const f=box.querySelector("input,select,textarea,button");f&&f.focus();return()=>box.remove()}
const field=(label,input)=>h("label",{class:"field"},h("span",null,label),input);
function grid(cols,rows,opts={}){const ns=opts.ns||"";return h("table",{role:"grid","aria-label":opts.label,"aria-rowcount":rows.length+1},
h("thead",null,h("tr",{role:"row"},opts.select?h("th",{role:"columnheader"},opts.selectAll):null,cols.map(c=>h("th",{role:"columnheader","aria-sort":opts.sort&&opts.sort.field===c.field?(opts.sort.direction==="DESC"?"descending":"ascending"):null},col(c,ns),opts.menu?opts.menu(c):null)))),
h("tbody",null,rows.map((r,i)=>h("tr",{role:"row"},opts.select?h("td",{role:"gridcell"},opts.select(r,i)):null,cols.map(c=>h("td",{role:"gridcell"},opts.cell?opts.cell(c,r):r[c.field]))))))}
const panel=(title,...k)=>h("section",{class:"panel","aria-label":title},h("h2",null,title),k);
function link(to,text,attrs){return h("a",{href:to,"data-link":"",...attrs},text)}

// ───────── views ─────────
function denied(){main().replaceChildren(h("section",{class:"denied",role:"alert"},h("h1",null,fmt(M.errors.deniedTitle)),h("p",null,fmt(M.errors.denied))))}

const ORD={filter:{status:[],from:"",to:"",search:"",amountMin:"",amountMax:""},sort:null,first:25,offset:0,hidden:new Set()};
async function OrdersView(){const data=await gql(ORDERS_QUERY+" "+ORDER_FIELDS,{filter:ORD.filter,sort:ORD.sort,first:ORD.first,offset:ORD.offset});const{total,nodes}=data.orders;const cols=ORDER_COLUMNS.filter(c=>!ORD.hidden.has(c.field));const again=()=>{ORD.offset=0;render()};
const statusBtn=h("button",{"aria-haspopup":"listbox","aria-expanded":"false",onclick:e=>{e.stopPropagation();openPop(statusBtn,h("div",{role:"listbox","aria-multiselectable":"true","aria-label":fmt(M.orders.status)},Object.values(OrderStatus).map(s=>h("div",{role:"option",tabindex:"0","aria-selected":String(ORD.filter.status.includes(s)),onclick:()=>{const a=ORD.filter.status;ORD.filter.status=a.includes(s)?a.filter(x=>x!==s):a.concat(s);closePop();again()}},s))))}},fmt(M.orders.status)+": "+(ORD.filter.status.length?fmt(M.orders.selected,{count:ORD.filter.status.length}):fmt(M.orders.allStatuses)));
const iso=d=>d.toISOString().slice(0,10),today=new Date(),back=n=>iso(new Date(today-n*864e5));
const PRESETS=[[M.orders.today,()=>[iso(today),iso(today)]],[M.orders.last7,()=>[back(6),iso(today)]],[M.orders.last30,()=>[back(29),iso(today)]],[M.orders.thisMonth,()=>[iso(new Date(today.getFullYear(),today.getMonth(),1)),iso(today)]]];
const dateBtn=h("button",{"aria-haspopup":"dialog","aria-expanded":"false",onclick:e=>{e.stopPropagation();const from=h("input",{type:"date",value:ORD.filter.from}),to=h("input",{type:"date",value:ORD.filter.to});
openPop(dateBtn,h("div",{class:"popover",role:"dialog","aria-label":fmt(M.orders.dateRange)},h("div",{class:"toolbar"},PRESETS.map(([d,f])=>h("button",{onclick:()=>{const[a,b]=f();from.value=a;to.value=b}},fmt(d)))),field(fmt(M.orders.from),from),field(fmt(M.orders.to),to),h("div",{class:"actions"},h("button",{class:"primary",onclick:()=>{ORD.filter.from=from.value;ORD.filter.to=to.value;closePop();again()}},fmt(M.orders.apply)))))}},fmt(M.orders.dateRange)+(ORD.filter.from||ORD.filter.to?": "+(ORD.filter.from||"…")+" – "+(ORD.filter.to||"…"):""));
const search=h("input",{type:"search","aria-label":fmt(M.orders.search),placeholder:fmt(M.orders.searchHint),value:ORD.filter.search,onchange:e=>{ORD.filter.search=e.target.value;again()}});
const amt=(k,d)=>h("input",{type:"number",min:"0",step:"0.01","aria-label":fmt(d),placeholder:fmt(d),value:ORD.filter[k],onchange:e=>{ORD.filter[k]=e.target.value;again()}});
const colsBtn=h("button",{"aria-haspopup":"dialog","aria-expanded":"false",onclick:e=>{e.stopPropagation();openPop(colsBtn,h("div",{class:"popover",role:"dialog","aria-label":fmt(M.orders.columns)},ORDER_COLUMNS.map(c=>h("label",{class:"field"},h("span",null,h("input",{type:"checkbox",checked:!ORD.hidden.has(c.field),onchange:ev=>{ev.target.checked?ORD.hidden.delete(c.field):ORD.hidden.add(c.field);closePop();render()}})," ",col(c,"orders"))))))}},fmt(M.orders.columns));
const exportBtn=h("button",{onclick:()=>{const q=new URLSearchParams();ORD.filter.status.forEach(s=>q.append("status",s));ORD.filter.search&&q.set("search",ORD.filter.search);const a=h("a",{href:"/api/export/orders.csv?"+q,download:"orders.csv"});document.body.append(a);a.click();a.remove()}},fmt(M.orders.exportCsv));
const menu=c=>{const b=h("button",{class:"menu","aria-label":fmt(M.orders.columnMenu)+": "+col(c,"orders"),"aria-haspopup":"menu","aria-expanded":"false",onclick:e=>{e.stopPropagation();openPop(b,h("div",{role:"menu"},
h("button",{role:"menuitem",onclick:()=>{ORD.sort={field:c.field,direction:"ASC"};closePop();render()}},fmt(M.orders.sortAsc)),
h("button",{role:"menuitem",onclick:()=>{ORD.sort={field:c.field,direction:"DESC"};closePop();render()}},fmt(M.orders.sortDesc)),
h("button",{role:"menuitem",onclick:()=>{ORD.hidden.add(c.field);closePop();render()}},fmt(M.orders.hide))))}},"⋮");return b};
const cell=(c,r)=>c.field==="number"?link(R.orderDetails.replace(":orderId",r.id),r.number):c.field==="amount"?money(r.amount):r[c.field];
const per=h("select",{"aria-label":fmt(M.orders.rowsPerPage),onchange:e=>{ORD.first=Number(e.target.value);again()}},ROWS_PER_PAGE_OPTIONS.map(n=>h("option",{value:String(n),selected:n===ORD.first},String(n))));
const end=Math.min(ORD.offset+ORD.first,total);
main().replaceChildren(h("h1",null,fmt(M.orders.title)),
h("div",{class:"filters",role:"search"},statusBtn,dateBtn,search,amt("amountMin",M.orders.amountFrom),amt("amountMax",M.orders.amountTo),h("button",{onclick:()=>{ORD.filter={status:[],from:"",to:"",search:"",amountMin:"",amountMax:""};again()}},fmt(M.orders.clear))),
h("div",{class:"toolbar"},h("span",null,fmt(M.orders.count,{count:total})),colsBtn,exportBtn),
nodes.length?grid(cols,nodes,{ns:"orders",label:fmt(M.orders.title),menu,cell,sort:ORD.sort}):h("div",{class:"empty"},fmt(M.orders.empty)),
h("div",{class:"pager"},h("label",null,fmt(M.orders.rowsPerPage)+" ",per),h("span",null,fmt(M.orders.range,{from:total?ORD.offset+1:0,to:end,total})),
h("button",{"aria-label":fmt(M.orders.prev),disabled:ORD.offset===0,onclick:()=>{ORD.offset=Math.max(0,ORD.offset-ORD.first);render()}},"‹"),
h("button",{"aria-label":fmt(M.orders.next),disabled:end>=total,onclick:()=>{ORD.offset+=ORD.first;render()}},"›")))}

async function OrderDetailsView(p){const{order:o}=await gql(ORDER_DETAILS_QUERY+" "+ORDER_FIELDS,{id:p.orderId});const back=link(R.orders,"← "+fmt(M.orderDetails.back));
if(!o)return main().replaceChildren(back,h("h1",null,fmt(M.orderDetails.notFound)));
main().replaceChildren(back,h("h1",null,fmt(M.orderDetails.title,{number:o.number})),h("div",{class:"panels"},
panel(fmt(M.orderDetails.summary),h("dl",null,h("dt",null,col({field:"date",headerName:"Date"},"orders")),h("dd",null,o.date),h("dt",null,col({field:"status",headerName:"Status"},"orders")),h("dd",null,o.status),h("dt",null,col({field:"customerName",headerName:"Customer"},"orders")),h("dd",null,link(R.customerDetails.replace(":customerId",o.customerId),o.customerName)),h("dt",null,col({field:"amount",headerName:"Amount"},"orders")),h("dd",null,money(o.amount)))),
panel(fmt(M.orderDetails.lines),grid(ORDER_LINE_COLUMNS,o.lines.map(l=>({...l,total:l.quantity*l.unitPrice})),{ns:"orderLines",label:fmt(M.orderDetails.lines),cell:(c,r)=>c.field==="unitPrice"||c.field==="total"?money(r[c.field]):r[c.field]})),
panel(fmt(M.orderDetails.timeline),h("ol",null,o.timeline.map(t=>h("li",null,t.at+" — "+t.event))))))}

async function PayoutsView(){const{payouts}=await gql(PAYOUTS_QUERY);const btn=h("button",{class:"primary",onclick:requestPayout},fmt(M.payouts.request));
main().replaceChildren(h("h1",null,fmt(M.payouts.title)),h("div",{class:"toolbar"},btn),payouts.length?grid(PAYOUT_COLUMNS,payouts,{ns:"payouts",label:fmt(M.payouts.title)}):h("div",{class:"empty"},h("p",null,h("strong",null,fmt(M.payouts.empty))),h("p",null,fmt(M.payouts.emptyHint))))}
function requestPayout(){const amount=h("input",{type:"number",min:String(MIN_PAYOUT_AMOUNT),max:String(MAX_PAYOUT_AMOUNT),step:"0.01",required:true}),method=h("select",null,Object.values(PayoutMethod).map(m=>h("option",{value:m},m))),note=h("textarea",{maxlength:String(NOTE_MAX_LENGTH),rows:"3"}),err=h("p",{role:"alert"});
const close=openDialog(fmt(M.payouts.request),h("div",null,field(fmt(M.payouts.amount),amount),field(fmt(M.payouts.method),method),field(fmt(M.payouts.note),note),err),[
h("button",{onclick:()=>close()},fmt(M.common.cancel)),
h("button",{class:"primary",onclick:async()=>{const a=Number(amount.value);if(!(a>=MIN_PAYOUT_AMOUNT&&a<=MAX_PAYOUT_AMOUNT)){err.textContent=fmt(M.payouts.amountRange,{min:MIN_PAYOUT_AMOUNT,max:MAX_PAYOUT_AMOUNT});return}
try{await gql(REQUEST_PAYOUT,{input:{amount:a,method:method.value,note:note.value}});close();toast(fmt(M.payouts.requested))}catch(e){err.textContent=e.message}}},fmt(M.payouts.submit))])}

const CUS={search:"",tier:"",selected:new Set()};
async function CustomersView(){const{customers}=await gql(CUSTOMERS_QUERY,{search:CUS.search||null,tier:CUS.tier||null});CUS.selected=new Set([...CUS.selected].filter(id=>customers.some(c=>c.id===id)));
const sendBtn=h("button",{disabled:!CUS.selected.size,onclick:()=>sendVoucher([...CUS.selected])},fmt(M.customers.sendVoucher));const count=h("span",null,CUS.selected.size?fmt(M.customers.selectedCount,{count:CUS.selected.size}):"");
const sync=()=>{sendBtn.disabled=!CUS.selected.size;count.textContent=CUS.selected.size?fmt(M.customers.selectedCount,{count:CUS.selected.size}):""};
const boxes=[];const all=h("input",{type:"checkbox","aria-label":fmt(M.customers.selectAll),onchange:e=>{boxes.forEach(([b,id])=>{b.checked=e.target.checked;e.target.checked?CUS.selected.add(id):CUS.selected.delete(id)});sync()}});
const select=r=>{const b=h("input",{type:"checkbox","aria-label":fmt(M.customers.selectRow)+": "+r.name,checked:CUS.selected.has(r.id),onchange:e=>{e.target.checked?CUS.selected.add(r.id):CUS.selected.delete(r.id);sync()}});boxes.push([b,r.id]);return b};
main().replaceChildren(h("h1",null,fmt(M.customers.title)),
h("div",{class:"filters",role:"search"},h("input",{type:"search","aria-label":fmt(M.customers.search),placeholder:fmt(M.customers.search),value:CUS.search,onchange:e=>{CUS.search=e.target.value;render()}}),
h("select",{"aria-label":fmt(M.customers.tier),onchange:e=>{CUS.tier=e.target.value;render()}},h("option",{value:""},fmt(M.customers.allTiers)),Object.values(CustomerTier).map(t=>h("option",{value:t,selected:t===CUS.tier},t)))),
h("div",{class:"toolbar"},count,sendBtn,h("button",{onclick:importWizard},fmt(M.customers.import))),
grid(CUSTOMER_COLUMNS,customers,{ns:"customers",label:fmt(M.customers.title),select,selectAll:all,cell:(c,r)=>c.field==="name"?link(R.customerDetails.replace(":customerId",r.id),r.name):r[c.field]}))}
function sendVoucher(ids){const value=h("select",null,VOUCHER_VALUES.map(v=>h("option",{value:String(v)},money(v)))),message=h("textarea",{rows:"3",maxlength:String(NOTE_MAX_LENGTH)}),err=h("p",{role:"alert"});
const close=openDialog(fmt(M.customers.sendVoucher),h("div",null,field(fmt(M.voucher.value),value),field(fmt(M.voucher.message),message),err),[h("button",{onclick:()=>close()},fmt(M.common.cancel)),
h("button",{class:"primary",onclick:async()=>{if(ids.length>MAX_VOUCHER_RECIPIENTS){err.textContent=fmt(M.voucher.tooMany,{max:MAX_VOUCHER_RECIPIENTS});return}
try{const d=await gql(SEND_VOUCHER,{input:{customerIds:ids,value:Number(value.value),message:message.value}});close();toast(fmt(M.voucher.sent,{count:d.sendVoucher.sent}))}catch(e){err.textContent=e.message}}},fmt(M.voucher.send))])}
function importWizard(){let step=1,up=null;const body=h("div"),err=h("p",{role:"alert"}),nextBtn=h("button",{class:"primary"}),backBtn=h("button",null,fmt(M.import.back));
const input=h("input",{type:"file",accept:".csv,.xlsx",hidden:true,"aria-label":fmt(M.import.file),onchange:()=>input.files[0]&&upload(input.files[0])});
async function upload(f){err.textContent="";if(!/\.(csv|xlsx)$/i.test(f.name)){err.textContent=fmt(M.import.wrongType);return}if(f.size>MAX_IMPORT_SIZE){err.textContent=fmt(M.import.tooLarge);return}
const fd=new FormData();fd.append("file",f);const r=await fetch("/api/upload",{method:"POST",body:fd,credentials:"same-origin"});if(r.status===429){toast(fmt(M.errors.rateLimited));return}const j=await r.json();if(!r.ok){err.textContent=j.error||fmt(M.errors.failed);return}up=j;draw()}
const drop=h("div",{class:"dropzone",role:"button",tabindex:"0","aria-label":fmt(M.import.drop),onclick:()=>input.click(),onkeydown:e=>{(e.key==="Enter"||e.key===" ")&&input.click()},ondragover:e=>e.preventDefault(),ondrop:e=>{e.preventDefault();e.dataTransfer.files[0]&&upload(e.dataTransfer.files[0])}},h("p",null,fmt(M.import.drop)),h("small",null,fmt(M.import.accepts)));
const names=[M.import.upload,M.import.map,M.import.review];
function draw(){const head=h("p",null,fmt(M.import.step,{n:step,name:fmt(names[step-1])}));
if(step===1)body.replaceChildren(head,drop,input,up?h("p",null,fmt(M.import.rows,{name:up.fileName,rows:up.rows==null?"?":up.rows})):null,h("p",null,h("a",{href:"/api/export/customers-template.csv",download:"customers-template.csv"},fmt(M.import.template))),err);
else if(step===2)body.replaceChildren(head,h("p",null,fmt(M.import.detected,{columns:(up.columns||[]).join(", ")||"—"})),err);
else body.replaceChildren(head,h("p",null,fmt(M.import.ready,{name:up.fileName})),err);
nextBtn.textContent=fmt(step===3?M.import.run:M.import.next);nextBtn.disabled=!up;backBtn.hidden=step===1}
nextBtn.onclick=async()=>{if(step<3){step++;return draw()}try{await gql(IMPORT_CUSTOMERS,{uploadId:up.uploadId});close();toast(fmt(M.import.done))}catch(e){err.textContent=e.message}};backBtn.onclick=()=>{step--;draw()};
draw();const close=openDialog(fmt(M.import.title),body,[h("button",{onclick:()=>close()},fmt(M.common.cancel)),backBtn,nextBtn])}

async function CustomerDetailsView(p){const{customer:c}=await gql(CUSTOMER_DETAILS_QUERY+" "+ORDER_FIELDS,{id:p.customerId});const back=link(R.customers,"← "+fmt(M.customerDetails.back));
if(!c)return main().replaceChildren(back,h("h1",null,fmt(M.customerDetails.notFound)));
main().replaceChildren(back,h("h1",null,c.name),h("div",{class:"panels"},panel(fmt(M.customerDetails.contact),h("dl",null,h("dt",null,col({field:"email",headerName:"Email"},"customers")),h("dd",null,c.email),h("dt",null,col({field:"tier",headerName:"Tier"},"customers")),h("dd",null,c.tier),h("dt",null,"City"),h("dd",null,c.city))),
panel(fmt(M.customerDetails.recent),grid(CUSTOMER_ORDER_COLUMNS,c.recentOrders,{ns:"orders",label:fmt(M.customerDetails.recent),cell:(k,r)=>k.field==="number"?link(R.orderDetails.replace(":orderId",r.id),r.number):k.field==="amount"?money(r.amount):r[k.field]}))))}

async function SalesView(p,period){const{salesReport}=await gql(SALES_REPORT_QUERY,{period});const weekly=period===ReportPeriod.WEEKLY;
const tab=(to,d,sel)=>h("a",{role:"tab",href:to,"data-link":"","aria-selected":String(sel),tabindex:sel?"0":"-1"},fmt(d));
main().replaceChildren(h("h1",null,fmt(weekly?M.reports.salesWeekly:M.reports.salesDaily)),h("div",{role:"tablist","aria-label":fmt(M.nav.reports)},tab(R.salesWeekly,M.reports.weekly,weekly),tab(R.salesDaily,M.reports.daily,!weekly)),
h("div",{role:"tabpanel"},grid(weekly?WEEKLY_COLUMNS:DAILY_COLUMNS,salesReport,{ns:"reports",label:fmt(weekly?M.reports.salesWeekly:M.reports.salesDaily),cell:(c,r)=>c.field==="revenue"||c.field==="average"?money(r[c.field]):r[c.field]})))}

async function ProfileView(){const{profile:p}=await gql(PROFILE_QUERY);const f={displayName:h("input",{value:p.displayName}),email:h("input",{type:"email",value:p.email,readonly:true}),phone:h("input",{type:"tel",value:p.phone}),company:h("input",{value:p.company})},notify=h("input",{type:"checkbox",checked:p.notifyOrders});
main().replaceChildren(h("h1",null,fmt(M.profile.title)),h("form",{class:"panel","aria-label":fmt(M.profile.title),onsubmit:async e=>{e.preventDefault();await gql(UPDATE_PROFILE,{input:{displayName:f.displayName.value,phone:f.phone.value,company:f.company.value,notifyOrders:notify.checked}});toast(fmt(M.profile.saved))}},
field(fmt(M.profile.displayName),f.displayName),field(fmt(M.profile.email),f.email),field(fmt(M.profile.phone),f.phone),field(fmt(M.profile.company),f.company),h("label",null,notify," ",fmt(M.profile.notify)),h("div",{class:"actions"},h("button",{class:"primary",type:"submit"},fmt(M.profile.save)))))}

async function FinanceView(){const{financeReport}=await gql(FINANCE_REPORT_QUERY,{});main().replaceChildren(h("h1",null,fmt(M.reports.finance)),grid([{field:"month",headerName:"Month"},{field:"grossRevenue",headerName:"Gross revenue"},{field:"commission",headerName:"Commission"},{field:"netPayable",headerName:"Net payable"}],financeReport,{ns:"finance"}))}

const admin=view=>async p=>{const m=await import("./admin-8d41b6e0.js");return m.mount(view,main(),{h,gql,fmt,toast,grid,field,openDialog})};

// the router
const ROUTES=[{path:R.orders,perm:"orders",nav:"orders",view:OrdersView},{path:R.orderDetails,perm:"orders",nav:"orders",view:OrderDetailsView},{path:R.payouts,perm:"payouts",nav:"payouts",view:PayoutsView},
{path:R.customers,perm:"customers",nav:"customers",view:CustomersView},{path:R.customerDetails,perm:"customers",nav:"customers",view:CustomerDetailsView},
{path:R.salesWeekly,perm:"reports",nav:"salesWeekly",view:p=>SalesView(p,ReportPeriod.WEEKLY)},{path:R.salesDaily,perm:"reports",nav:"salesDaily",view:p=>SalesView(p,ReportPeriod.DAILY)},
{path:R.financeReport,perm:"financeReport",nav:"financeReport",view:FinanceView},{path:R.profile,perm:"settings",nav:"profile",view:ProfileView},
{path:R.adminUsers,perm:"admin",nav:"adminUsers",view:admin("users")},{path:R.adminAuditLog,perm:"admin",nav:"adminAuditLog",view:admin("auditLog")},{path:R.adminSettings,perm:"admin",nav:"adminSettings",view:admin("settings")}];
function match(path){for(const r of ROUTES){const keys=[];const re=new RegExp("^"+r.path.replace(/:(\w+)/g,(_,k)=>(keys.push(k),"([^/]+)"))+"/?$");const m=re.exec(path);if(m)return{route:r,params:Object.fromEntries(keys.map((k,i)=>[k,decodeURIComponent(m[i+1])]))}}return null}
const MENU=[{label:M.nav.sales,items:[{to:R.orders,key:"orders",label:M.nav.orders,perm:"orders"},{to:R.customers,key:"customers",label:M.nav.customers,perm:"customers"}]},
{label:M.nav.finance,items:[{to:R.payouts,key:"payouts",label:M.nav.payouts,perm:"payouts"}]},
{label:M.nav.reports,items:[{to:R.salesWeekly,key:"salesWeekly",label:M.nav.salesWeekly,perm:"reports"},{to:R.salesDaily,key:"salesDaily",label:M.nav.salesDaily,perm:"reports"},{to:R.financeReport,key:"financeReport",label:M.nav.finance2,perm:"financeReport"}]},
{label:M.nav.settings,items:[{to:R.profile,key:"profile",label:M.nav.profile,perm:"settings"}]},
{label:M.nav.admin,items:[{to:R.adminUsers,key:"adminUsers",label:M.nav.users,perm:"admin"},{to:R.adminAuditLog,key:"adminAuditLog",label:M.nav.auditLog,perm:"admin"},{to:R.adminSettings,key:"adminSettings",label:M.nav.adminSettings,perm:"admin"}]}];
const OPEN=new Set(MENU.map(g=>g.label.id));

function sidebar(active){const nav=document.querySelector(".sidebar");nav.setAttribute("aria-label",fmt(M.shell.mainMenu));
nav.replaceChildren(...MENU.map(g=>({...g,items:g.items.filter(i=>can(i.perm))})).filter(g=>g.items.length).map((g,gi)=>{const id="grp-"+gi,open=OPEN.has(g.label.id);
return h("div",{class:"group"},h("button",{"aria-expanded":String(open),"aria-controls":id,onclick:()=>{open?OPEN.delete(g.label.id):OPEN.add(g.label.id);sidebar(active)}},(open?"▾ ":"▸ ")+fmt(g.label)),
h("ul",{id,hidden:!open},g.items.map(i=>h("li",null,link(i.to,fmt(i.label),{"aria-current":i.key===active?"page":null})))))}))}
function topbar(){const bar=document.querySelector(".topbar");const acct=h("button",{"aria-haspopup":"menu","aria-expanded":"false",onclick:e=>{e.stopPropagation();const ref="https://partners.example.com/join?ref="+encodeURIComponent(ME.referralCode);
openPop(acct,h("div",{role:"menu","aria-label":fmt(M.shell.account)},h("div",{class:"profile"},h("strong",null,ME.displayName),h("small",null,ME.email),h("small",null,fmt(M.account.partnerId)+": "+ME.partnerId)),
h("div",{role:"group","aria-label":fmt(M.account.language)},h("small",null,fmt(M.account.language)),h("button",{role:"menuitemradio","aria-checked":String(LANG==="en"),onclick:()=>setLang("en")},fmt(M.account.english)),h("button",{role:"menuitemradio","aria-checked":String(LANG==="de"),onclick:()=>setLang("de")},fmt(M.account.german))),
h("div",{class:"profile"},h("small",null,fmt(M.account.referral)),h("code",null,ref)),h("button",{role:"menuitem",onclick:()=>{navigator.clipboard&&navigator.clipboard.writeText(ref).catch(()=>{});closePop();toast(fmt(M.account.copied))}},fmt(M.account.copy)),
h("button",{role:"menuitem",onclick:()=>location.assign("/logout")},fmt(M.account.logout))))}},fmt(M.shell.account)+" ▾");
bar.replaceChildren(h("span",{class:"brand"},fmt(M.shell.brand)),h("span",{class:"chip"},fmt(M.shell.available)+": ",h("strong",null,money(BAL.available))),h("span",{class:"chip"},fmt(M.shell.pending)+": ",h("strong",null,money(BAL.pending))),acct)}

async function setLang(l){closePop();if(l==="de"&&!LOCALE)LOCALE=(await import("./de-c27f5a94.js")).default;LANG=l;document.documentElement.lang=l;try{localStorage.setItem("pp.lang",l)}catch(e){}if(l==="en")LOCALE=null;topbar();render()}

let TOKEN=0;
async function render(){closePop();const t=++TOKEN,m=match(location.pathname);if(!m)return main().replaceChildren(h("h1",null,"Page not found"));sidebar(m.route.nav);if(!can(m.route.perm))return denied();
try{await m.route.view(m.params)}catch(e){if(t!==TOKEN)return;if(e.code==="FORBIDDEN")return denied();if(e.code!=="RATE_LIMITED"&&e.code!=="UNAUTHENTICATED")main().replaceChildren(h("p",{role:"alert"},fmt(M.errors.failed)))}}
function navigate(to){history.pushState(null,"",to);render();scrollTo(0,0)}
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a[data-link]");if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;const u=new URL(a.href);if(u.origin!==location.origin)return;e.preventDefault();navigate(u.pathname+u.search)});
addEventListener("popstate",render);

async function boot(){try{const d=await gql(SHELL_QUERY);ME=d.me;BAL=d.balances}catch(e){return}let l="en";try{l=localStorage.getItem("pp.lang")||"en"}catch(e){}
if(l==="de"){LOCALE=(await import("./de-c27f5a94.js")).default;LANG="de";document.documentElement.lang="de"}topbar();render()}
boot();
export{R as routes,PERMS,OrderStatus,ORDER_UPDATES};
//# sourceMappingURL=index-3f9c2a71.js.map
