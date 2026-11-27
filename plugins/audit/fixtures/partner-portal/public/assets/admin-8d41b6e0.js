// Partner Portal fixture — the admin chunk, loaded by dynamic import only when the role allows it. The
// demo partner never loads it, but the entry chunk names it, so a bundle reader still finds these screens.
// Invented throughout.
const adminRoutes=[{path:"/admin/users",handle:{title:"admin.users.title"}},{path:"/admin/audit-log",handle:{title:"admin.auditLog.title"}},{path:"/admin/settings",handle:{title:"admin.settings.title"}}];
const AdminRole={PARTNER:"ROLE_PARTNER",MANAGER:"ROLE_MANAGER",ADMIN:"ROLE_ADMIN",SUPPORT:"ROLE_SUPPORT"};
const AUDIT_LOG_RETENTION_DAYS=365,MAX_ADMIN_PAGE_SIZE=100;
const A={users:{title:{id:"admin.users.title",defaultMessage:"Users"},role:{id:"admin.users.role",defaultMessage:"Role"},changeRole:{id:"admin.users.changeRole",defaultMessage:"Change role"},saved:{id:"admin.users.saved",defaultMessage:"Role updated"}},
auditLog:{title:{id:"admin.auditLog.title",defaultMessage:"Audit log"},actor:{id:"admin.auditLog.actor",defaultMessage:"Filter by actor"}},
settings:{title:{id:"admin.settings.title",defaultMessage:"Admin settings"},payouts:{id:"admin.settings.payoutsEnabled",defaultMessage:"Payouts enabled"},minPayout:{id:"admin.settings.minPayout",defaultMessage:"Minimum payout"},maxPayout:{id:"admin.settings.maxPayout",defaultMessage:"Maximum payout"},retention:{id:"admin.settings.retention",defaultMessage:"Keep the audit log for (days)"},save:{id:"admin.settings.save",defaultMessage:"Save settings"},saved:{id:"admin.settings.saved",defaultMessage:"Settings saved"}}};
const USER_COLUMNS=[{field:"name",headerName:"Name"},{field:"email",headerName:"Email"},{field:"role",headerName:"Role"},{field:"lastSignIn",headerName:"Last sign-in"}];
const AUDIT_COLUMNS=[{field:"at",headerName:"Time"},{field:"actor",headerName:"Actor"},{field:"action",headerName:"Action"},{field:"target",headerName:"Target"}];
const ADMIN_USERS_QUERY=`query AdminUsers($first: Int) { users(first: $first) { id name email role lastSignIn } }`;
const UPDATE_USER_ROLE=`mutation UpdateUserRole($id: ID!, $role: Role!) { updateUserRole(id: $id, role: $role) { ok } }`;
const AUDIT_LOG_QUERY=`query AuditLog($first: Int, $actor: String) { auditLog(first: $first, actor: $actor) { at actor action target } }`;
const ADMIN_SETTINGS_QUERY=`query AdminSettings { adminSettings { payoutsEnabled minPayout maxPayout retentionDays } }`;
const UPDATE_ADMIN_SETTINGS=`mutation UpdateAdminSettings($input: AdminSettingsInput!) { updateAdminSettings(input: $input) { ok } }`;

async function users(el,x){const{users}=await x.gql(ADMIN_USERS_QUERY,{first:MAX_ADMIN_PAGE_SIZE});
el.replaceChildren(x.h("h1",null,x.fmt(A.users.title)),x.grid(USER_COLUMNS.concat([{field:"actions",headerName:""}]),users,{label:x.fmt(A.users.title),cell:(c,r)=>c.field==="actions"?x.h("button",{onclick:()=>changeRole(r,x)},x.fmt(A.users.changeRole)):r[c.field]}))}
function changeRole(u,x){const sel=x.h("select",null,Object.values(AdminRole).map(r=>x.h("option",{value:r,selected:r===u.role},r)));
const close=x.openDialog(x.fmt(A.users.changeRole),x.field(x.fmt(A.users.role),sel),[x.h("button",{onclick:()=>close()},"Cancel"),x.h("button",{class:"primary",onclick:async()=>{await x.gql(UPDATE_USER_ROLE,{id:u.id,role:sel.value});close();x.toast(x.fmt(A.users.saved))}},"Save")])}
async function auditLog(el,x){const{auditLog}=await x.gql(AUDIT_LOG_QUERY,{first:MAX_ADMIN_PAGE_SIZE});el.replaceChildren(x.h("h1",null,x.fmt(A.auditLog.title)),x.h("input",{type:"search","aria-label":x.fmt(A.auditLog.actor)}),x.grid(AUDIT_COLUMNS,auditLog,{label:x.fmt(A.auditLog.title)}))}
async function settings(el,x){const{adminSettings:s}=await x.gql(ADMIN_SETTINGS_QUERY);const f={payoutsEnabled:x.h("input",{type:"checkbox",checked:s.payoutsEnabled}),minPayout:x.h("input",{type:"number",value:s.minPayout}),maxPayout:x.h("input",{type:"number",value:s.maxPayout}),retentionDays:x.h("input",{type:"number",max:String(AUDIT_LOG_RETENTION_DAYS),value:s.retentionDays})};
el.replaceChildren(x.h("h1",null,x.fmt(A.settings.title)),x.h("form",{class:"panel",onsubmit:async e=>{e.preventDefault();await x.gql(UPDATE_ADMIN_SETTINGS,{input:{payoutsEnabled:f.payoutsEnabled.checked,minPayout:Number(f.minPayout.value),maxPayout:Number(f.maxPayout.value),retentionDays:Number(f.retentionDays.value)}});x.toast(x.fmt(A.settings.saved))}},
x.field(x.fmt(A.settings.payouts),f.payoutsEnabled),x.field(x.fmt(A.settings.minPayout),f.minPayout),x.field(x.fmt(A.settings.maxPayout),f.maxPayout),x.field(x.fmt(A.settings.retention),f.retentionDays),x.h("button",{class:"primary",type:"submit"},x.fmt(A.settings.save))))}

const VIEWS={users,auditLog,settings};
export function mount(view,el,x){return VIEWS[view](el,x)}
export{adminRoutes};
//# sourceMappingURL=admin-8d41b6e0.js.map
