// Runtime configuration, as a deployed single-page app serves it. The key is fake: a long random-looking
// value for the inventory's redaction test.
window.__CONFIG__ = {
  apiUrl: "/api/graphql",
  release: "2026.11.3",
  environment: "test",
  supportUrl: "https://help.example.com/partners",
  mapsApiKey: "pk_test_9fQ2xLr7Vb4KmZt8NwY3cHs6PdJ1gUe5Ao0RiTv",
  featureFlags: { customerImport: true, financeReport: true }
};
