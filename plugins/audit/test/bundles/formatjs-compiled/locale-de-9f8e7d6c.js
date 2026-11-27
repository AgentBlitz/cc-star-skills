// Synthetic bundle, written by hand for the inventory tests: a compiled formatjs locale, as a Vite
// build emits it. Most messages are built through variables (x=[{type:0,value:"…"}], then key:x);
// one has a placeholder and one a plural. Invented throughout; read as text, never run.
const e=[{type:0,value:"Bestellungen"}],a=[{type:0,value:"Auszahlung anfordern"}],t=[{type:0,value:"Hallo "},{type:1,value:"name"},{type:0,value:"!"}],
o=[{type:6,value:"count",options:{one:{value:[{type:0,value:"# Bestellung"}]},other:{value:[{type:0,value:"# Bestellungen"}]}},offset:0,pluralType:"cardinal"}],
r=[{type:0,value:"Kunden"}],
n={"orders.title":e,"payouts.request":a,"shell.greeting":t,"orders.count":o,customers_title:r,
"orders.empty":[{type:0,value:"Noch keine Bestellungen"}],
"reports.salesWeekly":[{type:0,value:"Umsatz pro Woche"}]};
export{n as default};
