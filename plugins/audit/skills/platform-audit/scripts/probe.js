// platform-audit probe. Paste whole into javascript_tool: sets window.__auditProbe, returns recon().
// Every method returns cleaned JSON: URLs as host+path; queries, emails, long numbers masked; no values or cells.
// After a full load: (()=>{try{return(0,eval)(sessionStorage.__auditProbe||'"paste probe.js"')}catch(e){return'eval blocked: paste probe.js'}})()
(function P(){
const V='1.0.0',W=window,D=document,K='__auditProbe',L=location;
if(W[K]&&W[K].version==V)return W[K].recon();
try{sessionStorage[K]='('+P+')()'}catch(e){}
const Q=(r,s)=>[...r.querySelectorAll(s)],q=(r,s)=>r.querySelector(s),M=(e,s)=>e.matches(s),A=(e,a)=>e.getAttribute(a),T=(e,a)=>A(e,'aria-'+a)=='true',
U=h=>{try{return new URL(h,L.href)}catch(e){}},vis=e=>e.getClientRects().length>0,sh=e=>vis(e)||e.type=='file',
cl=s=>(s=String(s).replace(/\s+/g,' ').trim().replace(/https?:\/\/([^\/\s?#"']+)([^\s?#"']*)\S*/g,'$1$2').replace(/[?&][^\s"'?&]*=\S*/g,'?…').replace(/%[\da-f]{2}/gi,'·').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g,'<email>').replace(/\d[\d.,:\/-]{2,}\d/g,'#')).length>200?s.slice(0,199)+'…':s,
ok=v=>v!=null&&v!==false&&v!==''&&v.length!==0,
sf=(o,k)=>o&&o.map?o.map(x=>sf(x)).filter(ok):o&&typeof o=='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,sf(v,k)]).filter(x=>ok(x[1]))):typeof o=='string'&&!/^(version|host)$/.test(k)?cl(o):o,
J=o=>JSON.stringify(sf(o)),
nm=s=>cl(s||'').replace(/^[^\p{L}\p{N}#<(]+|[^\p{L}\p{N}#>).!?%]+$/gu,''),tc=e=>nm(e&&e.textContent),
tx=e=>{const c=e.cloneNode(1);Q(c,'input,select,textarea').map(x=>x.remove());return tc(c)},
lab=e=>A(e,'aria-label')||(A(e,'aria-labelledby')||'').split(' ').map(i=>tc(D.getElementById(i))).join(' ').trim()||e.labels&&e.labels[0]&&tx(e.labels[0])||'',
name=e=>nm(lab(e)||(M(e,'input,select,textarea')?/^(button|submit)$/.test(e.type)?e.value:e.title||e.placeholder||e.name:e.innerText||e.textContent||e.title)),
R=[],ix=e=>{const i=R.indexOf(e);return i<0?R.push(e)-1:i},
B='button,[role=button],input[type=button],input[type=submit],summary',O='[role=option],[role^=menuitem],[role=treeitem]',
F='input:not([type=hidden],[type=checkbox],[type=radio],[type=button],[type=submit]),select,textarea,[role=combobox]',
G='input[type=checkbox],input[type=radio],[role=switch],[role=checkbox],[role=radio],[aria-pressed]',
DG='[role=dialog],[role=alertdialog],dialog',OV=DG+',[role=menu],[role=listbox],[class*=popover i]',CL='a[href],[role=tab],'+B+','+O+','+G+',input',
C=e=>({i:ix(e),t:name(e),dis:e.disabled||T(e,'disabled'),pop:A(e,'aria-haspopup'),exp:A(e,'aria-expanded')}),
S=e=>({...C(e),sel:T(e,'selected')||T(e,'checked')}),
pth=u=>u.origin==L.origin?u.pathname+(u.hash[1]=='/'?u.hash.split('?')[0]:''):u.host+u.pathname,
ext=u=>u&&/^http/.test(u.protocol)&&u.host!=L.host,
LK=e=>{const u=U(A(e,'href'));return{...C(e),path:u&&pth(u),ext:ext(u),dl:e.hasAttribute('download'),tab:e.target=='_blank'}},
FD=e=>({i:ix(e),t:name(e),type:e.type||A(e,'role'),ph:e.placeholder,req:e.required||T(e,'required'),dis:e.disabled,ro:e.readOnly,opts:e.options&&[...e.options].slice(0,12).map(o=>o.label)}),
TO=e=>({i:ix(e),t:name(e),on:e.checked||T(e,'checked')||T(e,'pressed')?1:0}),
up=(o,f)=>o.filter(e=>!o.some(p=>p!=e&&p.contains(e))&&f(e)),
ovl=()=>up(Q(D,OV),e=>vis(e)&&!e.closest('nav,[role=navigation]')),
own=(r,s)=>Q(r,s).filter(e=>sh(e)&&!e.closest('td,[role=gridcell],dd')&&!(r==D.body&&e.closest('nav,header,[role=navigation],[role=banner],'+OV))),
navs=()=>up(Q(D,'nav,[role=navigation],aside,[role=tree],[role=menubar]'),e=>!/bread|pag/i.test(lab(e)+e.className)),
items=n=>{const a=Q(n,'a[href],button,[role=menuitem],[role=treeitem],summary').map(e=>{let d=0;for(let p=e;p!=n;p=p.parentElement)M(p,'ul,ol,[role=group],[role=menu],details')&&d++;
return{...(M(e,'a')?LK(e):C(e)),d,cur:A(e,'aria-current'),hid:!vis(e)}}),m=Math.min(...a.map(x=>x.d));return a.map(x=>(x.d-=m,x))},
nv=()=>navs().flatMap(items),here=()=>pth(L),N=W.__auditNet||(W.__auditNet={q:[]}),seen=new Set(),
X=s=>RegExp('(^|[^\\p{L}])('+s+')(?!\\p{L})','iu'),
GD=X('delete|remove|destroy|erase|purge|transfer|pay|refund|withdraw|approve|reject|decline|revoke|ban|suspend|deactivate|archive|reset|publish|upload|copy|clipboard|duplicate|cancel \\p{L}+|löschen|entfernen|überweisen|bezahlen|kopieren|hochladen'),
SB=X('save|submit|confirm|ok|yes|apply changes|update|speichern|absenden|bestätigen'),FV=X('send|import|create|add|invite|finish|done|senden|importieren|erstellen'),
LO=X('log ?out|sign ?out|abmelden'),DL=X('export\\p{L}*|download\\p{L}*|herunterladen');
if(!N.on){N.on=1;try{new PerformanceObserver(l=>N.q.push(...l.getEntries().filter(e=>/^(fetch|xmlhttprequest|beacon)$/.test(e.initiatorType)).map(e=>[e.name,e.responseStatus]))).observe({type:'resource',buffered:true})}catch(e){}}
const guard=(e,o)=>{const n=name(e),a=e.closest('a[href]'),u=a&&U(A(a,'href')),p=e.parentElement,f=e.closest(DG+',form');
return e.disabled||T(e,'disabled')?'disabled':M(e,'[type=file]')||q(e,'[type=file]')||p&&q(p,':scope>[type=file]')?'file input':ext(u)?'other host':a&&a.target=='_blank'?'new tab':
LO.test(n)||u&&/log-?out|sign-?out/i.test(u.pathname)?'log out':!o.allowDownloads&&(DL.test(n)||a&&(a.hasAttribute('download')||/\.(csv|xlsx?|pdf|zip|json|txt|docx?)$|\/(export|download)s?\//i.test(u.pathname)))?'download':
GD.test(n)?'danger word':SB.test(n)||A(e,'type')=='submit'&&f||e.form&&e.type=='submit'||f&&FV.test(n)?'submit':M(e,'[role=switch],[role=menuitemradio],[role=menuitemcheckbox]')||!o.toggle&&M(e,G)?'toggle':0},
find=x=>{x=x.toLowerCase();for(const r of[...ovl(),D.body]){const c=Q(r,CL).filter(sh).map(e=>[e,name(e).toLowerCase()]),m=c.find(e=>e[1]==x)||c.find(e=>e[1].includes(x));if(m)return m[0]}},
fw=()=>{const h=[],e=Q(D,'body *').slice(0,300),t=(k,c)=>{try{c()&&h.push(k)}catch(x){}};
t('React',()=>e.some(x=>Object.keys(x).some(k=>k.startsWith('__react'))));t('Vue',()=>e.some(x=>x.__vue_app__||x.__vue__));t('webpack',()=>Object.keys(W).some(k=>k.startsWith('webpackChunk')));
for(const[k,g]of[['Next.js','__NEXT_DATA__'],['Nuxt','__NUXT__'],['jQuery','jQuery']])t(k,()=>W[g]);
for(const[k,s]of[['Angular','[ng-version]'],['Svelte','[class*=svelte-]'],['MUI','[class*=Mui]'],['generator','meta[name=generator]']])t(k,()=>q(D,s));return h};
const api={version:V,
recon:()=>J({version:V,title:D.title,lang:D.documentElement.lang,host:L.host,path:here(),params:[...new URLSearchParams(L.search).keys()],fw:fw(),
scripts:Q(D,'script[src]').map(s=>pth(U(s.src))),styles:Q(D,'link[rel=stylesheet]').map(s=>pth(U(s.href))),nav:{items:nv().length,top:nv().filter(x=>!x.d).map(x=>x.t)},
signin:q(D,'[type=password]')?'sign-in form':/(^|\.)(login|auth|sso|accounts?|idp?)\./i.test(L.host)||/\/(login|sign-?in|auth|oauth|sso)\b/i.test(L.pathname)?'auth page':null}),
nav:()=>J({path:here(),menus:navs().map(n=>({t:lab(n),items:items(n)}))}),
screen(sel){const s=sel?q(D,sel):q(D,'main,[role=main]')||D.body,rc={},tb=own(s,'table,[role=grid],[role=table],[role=treegrid]');
Q(s,'td *,[role=gridcell] *,dd *').filter(e=>M(e,CL)).map(e=>{const k=M(e,'[type=checkbox]')?'checkbox':M(e,'a')?'link':name(e);rc[k]=-~rc[k]});
return J({path:here(),title:D.title,h:own(s,'h1,h2,h3,h4,[role=heading]').map(e=>e.tagName[1]+' '+tc(e)),
crumbs:Q(s,':is([aria-label*=breadcrumb i],[class*=breadcrumb i]) :is(li,a):not(:has(a))').map(tc),
tabs:own(s,'[role=tab]').map(S),buttons:own(s,B).filter(e=>!M(e,O+',[role=tab]')).map(C),links:own(s,'a[href]:not([role=tab])').map(LK),
fields:own(s,F).map(FD),toggles:own(s,G).map(TO),terms:own(s,'dt').map(tc),
tables:tb.map(t=>{const r=Q(t,'tbody tr,[role=row]').filter(x=>!q(x,'th,[role=columnheader]')),one=r.length==1&&q(r[0],'[colspan]');
return{t:lab(t),cols:Q(t,'th,[role=columnheader]').map(h=>({t:tx(h)||q(h,'input')&&'(select)',sort:A(h,'aria-sort'),sortable:!!(A(h,'aria-sort')||q(h,'[aria-label*=sort i],[class*=sort i]')),menu:q(h,'[aria-haspopup]')&&ix(q(h,'[aria-haspopup]'))})),
rows:one?0:r.length,total:A(t,'aria-rowcount')-1||0,empty:one&&tc(r[0])}}),
empty:own(s,'[class*=empty i],[class*=no-data i],[class*=no-results i]').filter(e=>!tb.some(t=>t.contains(e))).map(e=>nm(e.innerText)),
pager:own(s,'[class*=pag i],[aria-label*=pagination i]').map(tx),rowControls:Object.entries(rc).filter(x=>x[1]>1&&x[0]).map(x=>x.join(' ×'))})},
overlays:()=>J(ovl().map(o=>({kind:A(o,'role')||o.tagName.toLowerCase(),t:nm(lab(o))||tc(q(o,'h1,h2,h3,[role=heading]')),
options:Q(o,O).filter(vis).map(S),groups:Q(o,'[role=group][aria-label]').map(lab),fields:Q(o,F).filter(sh).map(FD),toggles:Q(o,G).filter(e=>!M(e,O)).map(TO),
buttons:Q(o,B).filter(e=>vis(e)&&!M(e,O+',[role=tab]')).map(C),links:Q(o,'a[href]').filter(vis).map(LK),
notes:M(o,DG)&&Q(o,'p,small,[role=alert]').filter(e=>vis(e)&&!q(e,CL)).map(tc).slice(0,8)}))),
requests(){const by={},c={};let n429=0;for(const[u,s]of N.q.splice(0)){if(seen.has(u))continue;const x=U(u),k=x.host+' '+x.pathname+' '+(s||'?');by[k]=-~by[k];n429+=s==429}
for(const[k,n]of Object.entries(by)){const[h,...r]=k.split(' ');(c[h]=c[h]||[]).push(r.join(' ')+'×'+n)}return J({calls:c,n429})},
async peek(){const src=new Set([...Q(D,'script[src]').map(s=>s.src),...Q(D,'link[rel=modulepreload]').map(l=>l.href),...performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/\.m?js$/.test(U(u).pathname))]),
files=[],rt=new Set(),ch=new Set();let labels=0,ops=0;
for(const u of[...src].filter(u=>U(u).origin==L.origin).slice(0,30)){seen.add(u);const path=U(u).pathname;let s;try{const r=await fetch(u,{cache:'force-cache'});if(!r.ok)throw 0;s=await r.text()}catch(e){files.push({path,error:1});continue}
files.push({path,kb:Math.round(s.length/1024)});
for(const m of s.matchAll(/["'`](\/[\w\-.:\/*]*)["'`]/g)){const r=m[1].replace(/(.)\/$/,'$1');r.length<80&&!/^\/(api|assets|static|_next|graphql)(\/|$)|\.\w{2,5}$|\/\/|^\/$/.test(r)&&rt.add(r)}
labels+=(s.match(/defaultMessage\s*:|\b(t|\$t|i18n\.t|translate)\(\s*["'`][\w.-]+["'`]|\$localize`/g)||[]).length;ops+=(s.match(/\b(query|mutation|subscription)\s+[A-Z]\w*\s*[({]/g)||[]).length;
for(const m of s.matchAll(/import\(\s*["'`]([^"'`]+\.m?js)["'`]/g))ch.add(new URL(m[1],u).pathname)}
const np=new Set(nv().map(x=>x.path)),rs=[...rt].sort(),pr=r=>/[:*[]/.test(r);
return J({files,n:rs.length,routes:rs.slice(0,150),labels,ops,chunks:[...ch].filter(c=>!files.some(f=>f.path==c)),hidden:rs.filter(r=>!pr(r)&&!np.has(r)&&!LO.test(r.replace(/\W/g,' '))),detail:rs.filter(pr)})},
open(x,o={}){const e=typeof x=='number'?R[x]:find(x+''),t=e&&name(e),r=!e||!e.isConnected?'not found':guard(e,o);if(r)return J({refused:r,t});
const b=[],v={};for(const k of['alert','confirm','prompt','open']){v[k]=W[k];W[k]=()=>{b.push(k);return k=='confirm'&&false}}
try{e.click()}finally{Object.assign(W,v)}return J({ok:1,t,blocked:b})}};
return(W[K]=api).recon()})()
