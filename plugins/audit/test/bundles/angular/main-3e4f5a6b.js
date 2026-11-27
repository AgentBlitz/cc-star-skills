// Synthetic bundle, written by hand for the inventory tests: an Angular build, with {path, component}
// routes and relative children, and $localize messages with :@@id: markers. Invented throughout; read
// as text, never run.
"use strict";(self.webpackChunkportal=self.webpackChunkportal||[]).push([[179],{4550:(t,e,n)=>{
var i=n(5879),r=n(6814),s=n(2181);
class DashboardComponent{static{this.ɵfac=function(o){return new(o||DashboardComponent)}}static{this.ɵcmp=i.ɵɵdefineComponent({type:DashboardComponent,selectors:[["app-dashboard"]],decls:3,vars:0,template:function(o,a){1&o&&(i.ɵɵelementStart(0,"h1"),i.ɵɵtext(1,"Audit log"),i.ɵɵelementEnd())}})}}
class OrdersComponent{}class OrderDetailComponent{}class UsersComponent{}class AuditLogComponent{}class AdminGuard{}
const routes=[
  {path:"",component:DashboardComponent},
  {path:"orders",component:OrdersComponent,children:[{path:":id",component:OrderDetailComponent}]},
  {path:"admin",canActivate:[AdminGuard],children:[{path:"users",component:UsersComponent},{path:"audit-log",component:AuditLogComponent}]},
  {path:"settings",loadChildren:()=>n.e(592).then(n.bind(n,592)).then(o=>o.SettingsModule)},
  {path:"**",redirectTo:""}
];
class AppRoutingModule{static{this.ɵmod=i.ɵɵdefineNgModule({type:AppRoutingModule})}static{this.ɵinj=i.ɵɵdefineInjector({imports:[s.RouterModule.forRoot(routes),s.RouterModule]})}}
let i18n_0;i18n_0=$localize`:@@orders.title:Orders`;
let i18n_1;i18n_1=$localize`:Greeting in the header|@@dashboard.welcome:Welcome back, ${"�0�"}:INTERPOLATION:!`;
let i18n_2;i18n_2=$localize`:@@nav.settings:Settings`;
let i18n_3;i18n_3=$localize`:Footer note:Kept for seven years`;
const navLinks=[["routerLink","/orders"],["routerLink","/admin/users"]];
}}]);
