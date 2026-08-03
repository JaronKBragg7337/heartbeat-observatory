// Static server for the local repo checkout, so changes can be rendered and
// screenshotted without deploying anything.
const http = require("http");
const handler = require("serve-handler");

const path = require("path");
// Repo root, derived from this file's location so any checkout works.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = +(process.argv[2] || 8099);

const server = http.createServer((req, res) =>
  handler(req, res, {
    public: ROOT,
    cleanUrls: false,
    headers: [{ source: "**", headers: [{ key: "Cache-Control", value: "no-store" }] }],
  })
);
server.listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
