// Synthetic bundle, written by hand for the inventory tests: the patterns a Vite + React build of a
// back office leaves. Invented throughout; it is read as text and never run.
import{j as jsx,r as React,c as createBrowserRouter,u as useNavigate,g as gql,A as ApolloClient,I as InMemoryCache}from"./vendor-0f1e2d3c.js";
const REACT_ELEMENT=Symbol.for("react.element");
const R={home:"/",orders:"/orders",orderDetails:"/orders/:orderId",payouts:"/payouts",customers:"/customers",salesReport:"/reports/sales"};

// roles, and the permission table the menu filters on
const Role={PARTNER:"ROLE_PARTNER",MANAGER:"ROLE_MANAGER",ADMIN:"ROLE_ADMIN"};
class Rule{constructor(e){this.roles=e}allows(e){return this.roles.includes(e)}}
const PERMS=[{name:"orders",rules:new Rule([Role.PARTNER,Role.MANAGER,Role.ADMIN])},{name:"finance",rules:new Rule([Role.MANAGER,Role.ADMIN])},{name:"adminUsers",rules:new Rule([Role.ADMIN])}];
const DENIED="You do not have permission to view this page.";

// enums and limits
const OrderStatus={PENDING:"PENDING",PAID:"PAID",REFUNDED:"REFUNDED",CANCELLED:"CANCELLED"};
const MAX_UPLOAD_SIZE=5*1024*1024,EXPORT_ROW_LIMIT=1e4,ad=100;
const gridDefaults={pageSize:25,maxPageSize:ad,rowsPerPageOptions:[10,25,50]};

// messages: formatjs descriptors in both orders, one with a description
const m={title:{id:"orders.title",defaultMessage:"Orders"},request:{defaultMessage:"Request payout",id:"payouts.request"},
empty:{id:"orders.empty",description:"Shown when the list has no rows",defaultMessage:"No orders yet"},
count:{id:"orders.count",defaultMessage:"{count, plural, one {# order} other {# orders}}"},
amount:{description:"Column header",defaultMessage:"Amount",id:"orders.columns.amount"}};
function ExportButton(e){const t=e.intl;return jsx.jsx("button",{onClick:e.onExport,children:t.formatMessage({id:"orders.export"})})}

// GraphQL documents: a fragment, a query with variables, a mutation, and a subscription in a plain string
const ORDER_FIELDS=gql`
  fragment OrderFields on Order {
    id
    status
    amount
    createdAt
    customer { id name }
  }
`;
const LIST_ORDERS=gql`
  query ListOrders($first: Int!, $after: String, $status: [OrderStatus!]) {
    orders(first: $first, after: $after, status: $status) {
      totalCount
      edges { node { ...OrderFields } }
      pageInfo { hasNextPage endCursor }
    }
    viewer { id }
  }
  ${ORDER_FIELDS}
`;
const REQUEST_PAYOUT=gql`mutation RequestPayout($input: PayoutInput!) { requestPayout(input: $input) { id status } }`;
const ON_ORDER="subscription OnOrderUpdated($partnerId: ID!) {\n  orderUpdated(partnerId: $partnerId) {\n    id\n    status\n  }\n}";

// MUI data-grid columns
const columns=[{field:"id",headerName:"Order",width:140},{field:"status",headerName:"Status",width:120},{field:"amount",headerName:"Amount",type:"number"},{field:"createdAt",headerName:"Created"}];
const gridClass="MuiDataGrid-root MuiButton-root";

// runtime config with a long key
window.__APP_CONFIG__={apiUrl:"https://api.example.com/graphql",authUrl:"https://auth.example.com/realms/partners",mapsKey:"AIzaFk93Lq0Zx7Rt2Mv8Np4Ws6Yb1Hc5Jd",release:"2026.11.1"};
const client=new ApolloClient({uri:"https://api.example.com/graphql",cache:new InMemoryCache()});

// screens and the router
function Shell(){return jsx.jsxs("div",{children:[jsx.jsx("h1",{children:"Partner dashboard"}),jsx.jsx(Link,{to:"/customers",children:"Customers"})]})}
function OrdersPage(){const n=useNavigate();return jsx.jsx(DataGrid,{columns,onRowClick:e=>n(R.orderDetails.replace(":orderId",e.id)),localeText:{noRowsLabel:"No rows"}})}
function Profile(){return jsx.jsx("form",{children:jsx.jsx(TextField,{label:"Display name",placeholder:"Your name",helperText:"Shown to your customers"})})}
const router=createBrowserRouter([{path:R.home,element:jsx.jsx(Shell,{}),children:[{path:R.orders,element:jsx.jsx(OrdersPage,{})},{path:R.orderDetails,element:jsx.jsx(OrderDetails,{})},{path:"settings/profile",element:jsx.jsx(Profile,{})},{path:"/admin/users",element:jsx.jsx(Users,{}),loader:()=>import("./admin-e5f6a7b8.js")}]}]);
export{router,client,PERMS,DENIED,OrderStatus,MAX_UPLOAD_SIZE,EXPORT_ROW_LIMIT,gridDefaults,m,LIST_ORDERS,REQUEST_PAYOUT,ON_ORDER,REACT_ELEMENT};
//# sourceMappingURL=index-a1b2c3d4.js.map
