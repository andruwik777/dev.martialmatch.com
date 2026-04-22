/**
 * devtest: cycles JSON from data/websocket/628-wss-timeline.json (no real MartialMatch).
 * Set PROXY_MODE=devtest (or default is devtest for this service).
 */
"use strict";

var path = require("path");
var { startWssProxy } = require(path.join(__dirname, "..", "_shared", "wss-proxy-core.js"));

var fixture = path.join(
  __dirname,
  "data",
  "websocket",
  "628-wss-timeline.json"
);

/** Same as Cloudflare worker CORS; full list on host: WSS_ALLOWED_ORIGINS=url1,url2 */
var allowedClientOrigins = [
  "https://andruwik777.github.io",
  "http://localhost:8080",
];

startWssProxy({
  mode: process.env.PROXY_MODE || "devtest",
  fixturePath: process.env.DEVTEST_FIXTURE || fixture,
  port: Number(process.env.PORT) || 8788,
  path: "/",
  allowedClientOrigins: allowedClientOrigins,
});
