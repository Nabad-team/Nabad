// The server's keep-alive and headers timeouts (loadtest/jmeter/README.md): a proxy in front of the backend must
// always be the side that closes an idle kept-alive connection, or a reused connection can be reset mid-request.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { start, applyServerTimeouts, SERVER_TIMEOUTS } = require("../src/server");

// Node's agent (used by the Next.js /api proxy) closes idle sockets after this long.
const AGENT_IDLE_MS = http.globalAgent.options.timeout;
// Longer than Node's default keepAliveTimeout (5 s), short enough for a test.
const IDLE_MS = 6500;

let mongod, server;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.PORT = "0";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  server = await start();
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
}, { timeout: 240000 });
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// Two GETs over one kept-alive socket, IDLE_MS apart. Resolves with what happened to the socket.
function reuseAfterIdle(port, path) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1, timeout: 0 });
  const get = () => new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path, agent }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, reused: req.reusedSocket, keepAlive: res.headers["keep-alive"] }));
    });
    req.on("error", reject);
  });
  return (async () => {
    const first = await get();
    const [socket] = Object.values(agent.freeSockets).flat();
    let closedByServer = false;
    socket.once("close", () => { closedByServer = true; });
    await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
    if (closedByServer) { agent.destroy(); return { first, closedByServer }; }
    const second = await get();
    agent.destroy();
    return { first, second, closedByServer };
  })();
}

test("the backend keeps idle connections open longer than the proxies in front of it", () => {
  assert.ok(SERVER_TIMEOUTS.keepAliveTimeout > AGENT_IDLE_MS, "longer than Node's agent in the Next.js proxy");
  assert.ok(SERVER_TIMEOUTS.keepAliveTimeout > 60 * 1000, "longer than a load balancer's usual 60 s idle timeout");
  assert.ok(SERVER_TIMEOUTS.headersTimeout > SERVER_TIMEOUTS.keepAliveTimeout, "headersTimeout must be longer than keepAliveTimeout");
});

test("start() applies them to the running server", () => {
  assert.equal(server.keepAliveTimeout, SERVER_TIMEOUTS.keepAliveTimeout);
  assert.equal(server.headersTimeout, SERVER_TIMEOUTS.headersTimeout);
  // Node's request timeout is kept, and stays longer than both.
  assert.ok(server.requestTimeout === 0 || server.requestTimeout > SERVER_TIMEOUTS.headersTimeout);
});

test("a kept-alive connection can be reused after being idle longer than Node's default, unlike a default server", async () => {
  const fallback = http.createServer((req, res) => res.end("ok"));
  const tuned = applyServerTimeouts(http.createServer((req, res) => res.end("ok")));
  await Promise.all([fallback, tuned].map((s) => new Promise((resolve) => s.listen(0, "127.0.0.1", resolve))));
  try {
    const [backend, withDefaults, withTimeouts] = await Promise.all([
      reuseAfterIdle(server.address().port, "/api/health"),
      reuseAfterIdle(fallback.address().port, "/"),
      reuseAfterIdle(tuned.address().port, "/"),
    ]);
    // The race the load test hit: a default server closes the idle connection after 5 s.
    assert.equal(withDefaults.closedByServer, true);
    for (const result of [backend, withTimeouts]) {
      assert.equal(result.closedByServer, false);
      assert.equal(result.second.status, 200);
      assert.equal(result.second.reused, true);
    }
    // The backend tells clients how long it keeps the connection.
    assert.equal(backend.first.keepAlive, `timeout=${SERVER_TIMEOUTS.keepAliveTimeout / 1000}`);
  } finally {
    for (const s of [fallback, tuned]) { s.closeAllConnections(); s.close(); }
  }
});
