// Synthetic bundle, written by hand for the inventory tests: a Vue 3 build with vue-router (named
// routes, children) and vue-i18n. Invented throughout; read as text, never run.
import{createApp as c,defineComponent as d,createElementVNode as _createElementVNode,createTextVNode as _createTextVNode,toDisplayString as _s,openBlock as _o,createElementBlock as _b}from"./vue-runtime-1a2b3c4d.js";
import{createRouter as cr,createWebHistory as wh}from"./vue-router-5e6f7a8b.js";
import{createI18n as ci}from"./vue-i18n-9c0d1e2f.js";
const Home=d({name:"Home"}),Rep=d({name:"Reports"}),W=d({name:"Weekly"}),D=d({name:"Daily"}),NF=d({name:"NotFound"});
const OrderDetails=d({name:"OrderDetails",render(){return _o(),_b("div",null,[_createElementVNode("h2",null,_s(this.$t("orders.details")),1),_createTextVNode("Back to orders")])}});
const routes=[
  {path:"/",name:"home",component:Home},
  {path:"/orders",name:"orders",component:()=>import("./Orders-ab12cd34.js"),children:[
    {path:":id(\\d+)",name:"order-details",component:OrderDetails,meta:{title:"Order details"}},
    {path:"export",name:"orders-export",component:()=>import("./OrdersExport-ef56ab78.js")}
  ]},
  {path:"/reports",component:Rep,children:[
    {path:"weekly",name:"reports-weekly",component:W},
    {path:"daily",name:"reports-daily",component:D}
  ]},
  {path:"/:pathMatch(.*)*",name:"not-found",component:NF}
];
const router=cr({history:wh(),routes});
const i18n=ci({legacy:!1,locale:"en",fallbackLocale:"en",messages:{
  en:{orders:{title:"Orders",empty:"No orders yet",details:"Order details"},reports:{weekly:"Sales weekly",daily:"Sales daily"},common:{cancel:"Cancel",save:"Save"}},
  de:{orders:{title:"Bestellungen",empty:"Noch keine Bestellungen"},common:{cancel:"Abbrechen"}}
}});
const App=d({name:"App",setup(){return(e,t)=>(_o(),_b("main",null,[_createElementVNode("h1",null,_s(e.$t("orders.title")),1),_createTextVNode("Export CSV")]))}});
c(App).use(router).use(i18n).mount("#app");
