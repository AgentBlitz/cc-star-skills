// Synthetic bundle, written by hand for the inventory tests: GraphQL documents compiled to ASTs
// (as graphql-tag and codegen leave them), one AST inside JSON.parse, and a persisted query.
// Invented throughout; read as text, never run.
const n={kind:"Name",value:"Payout"};
const GetPayouts={kind:"Document",definitions:[{kind:"OperationDefinition",operation:"query",name:{kind:"Name",value:"GetPayouts"},
variableDefinitions:[
 {kind:"VariableDefinition",variable:{kind:"Variable",name:{kind:"Name",value:"status"}},type:{kind:"ListType",type:{kind:"NonNullType",type:{kind:"NamedType",name:{kind:"Name",value:"PayoutStatus"}}}},directives:[]},
 {kind:"VariableDefinition",variable:{kind:"Variable",name:{kind:"Name",value:"first"}},type:{kind:"NonNullType",type:{kind:"NamedType",name:{kind:"Name",value:"Int"}}},directives:[]}],
directives:[],selectionSet:{kind:"SelectionSet",selections:[
 {kind:"Field",name:{kind:"Name",value:"payouts"},arguments:[{kind:"Argument",name:{kind:"Name",value:"status"},value:{kind:"Variable",name:{kind:"Name",value:"status"}}}],directives:[],
  selectionSet:{kind:"SelectionSet",selections:[{kind:"FragmentSpread",name:{kind:"Name",value:"PayoutFields"},directives:[]}]}},
 {kind:"Field",alias:{kind:"Name",value:"available"},name:{kind:"Name",value:"balance"},arguments:[],directives:[]}]}},
{kind:"FragmentDefinition",name:{kind:"Name",value:"PayoutFields"},typeCondition:{kind:"NamedType",name:n},directives:[],
 selectionSet:{kind:"SelectionSet",selections:[{kind:"Field",name:{kind:"Name",value:"id"}},{kind:"Field",name:{kind:"Name",value:"amount"}},{kind:"Field",name:{kind:"Name",value:"method"}},{kind:"Field",name:{kind:"Name",value:"status"}}]}}],
loc:{start:0,end:212}};
const CancelPayout={kind:"Document",definitions:[{kind:"OperationDefinition",operation:"mutation",name:{kind:"Name",value:"CancelPayout"},
variableDefinitions:[{kind:"VariableDefinition",variable:{kind:"Variable",name:{kind:"Name",value:"id"}},type:{kind:"NonNullType",type:{kind:"NamedType",name:{kind:"Name",value:"ID"}}}}],
selectionSet:{kind:"SelectionSet",selections:[{kind:"Field",name:{kind:"Name",value:"cancelPayout"},selectionSet:{kind:"SelectionSet",selections:[{kind:"Field",name:{kind:"Name",value:"id"}}]}}]}}]};
const OnPayoutChanged=JSON.parse('{"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"OnPayoutChanged"},"variableDefinitions":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"payoutChanged"}}]}}]}');
function getBalance(c){return c.post("/graphql",{operationName:"GetBalance",variables:{},extensions:{persistedQuery:{version:1,sha256Hash:"5c1f0e9a8b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e"}}})}
export{GetPayouts,CancelPayout,OnPayoutChanged,getBalance};
