/*! Synthetic bundle, written by hand for the inventory tests: what a webpack (Create React App)
 *  build with i18next and axios leaves. Invented throughout; read as text, never run. */
(()=>{"use strict";var e,t,n={},r={};
function o(e){var t=r[e];if(void 0!==t)return t.exports;var a=r[e]={exports:{}};return n[e](a,a.exports,o),a.exports}
o.u=function(e){return"static/js/"+e+"."+{214:"8a7b6c5d",532:"1e2f3a4b"}[e]+".chunk.js"};
o.p="/";var preload=["static/js/787.9c8d7e6f.chunk.js"];
// the i18next resource, shipped as a JSON.parse blob
var en=JSON.parse('{"nav":{"orders":"Orders","customers":"Customers","reports":"Reports"},"customers":{"title":"Customers","sendVoucher":"Send voucher","import":"Import customers","count":"{{count}} customers","empty":"No customers match these filters"}}');
var i18n=o(9417);i18n.use(o(7781).initReactI18next).init({resources:{en:{translation:en}},lng:"en",fallbackLng:"en",interpolation:{escapeValue:!1}});
// REST calls through axios, with methods and template parameters
var BASE="",api=o(3296).create({baseURL:"https://api.example.com",timeout:15e3});
function listCustomers(e){return api.get("/api/customers",{params:e})}
function importCustomers(e){return api.post("/api/customers/import",e,{headers:{"Content-Type":"multipart/form-data"}})}
function deleteCustomer(e){return api.delete(`/api/customers/${e.id}`)}
function tagCustomer(t,e){return o(3296).put(`${BASE}/api/customers/${t.customerId}/tags`,e)}
function exportOrders(){return fetch("/api/export/orders.csv")}
function upload(e){return fetch("/api/upload",{method:"POST",body:e})}
var live=new WebSocket("wss://ws.example.com/live");
// a screen
function Customers(e){var t=(0,o(7781).useTranslation)().t,n=(0,o(2323).useNavigate)();
return(0,o(184).jsxs)("section",{children:[(0,o(184).jsx)("h2",{children:t("customers.title")}),
(0,o(184).jsx)("input",{placeholder:t("customers.filters.search")}),
(0,o(184).jsx)("button",{onClick:function(){return n("/customers/import")},children:t("customers.import")}),
(0,o(184).jsx)("button",{onClick:function(){return e.history.push("/customers/vouchers")},disabled:!e.selected,children:t("customers.sendVoucher")})]})}
var limits={maxImportRows:5e3,maxFileSizeMb:2};
})();
