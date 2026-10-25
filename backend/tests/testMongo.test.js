const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTestMongo } = require("./helpers/testMongo");

function fakeServer(errors) {
  const instances = [];
  class Server {
    constructor() { this.index = instances.length; instances.push(this); }
    async start() { if (errors[this.index]) throw errors[this.index]; }
    async stop(options) { this.cleanup = options; }
  }
  return { Server, instances };
}

test("temporary MongoDB retries port collisions with a fresh instance and cleans up failed instances", async () => {
  const { Server, instances } = fakeServer([new Error('Port "45151" already in use'), Object.assign(new Error("bind failed"), { code: "EADDRINUSE" })]);
  const result = await createTestMongo(undefined, Server);
  assert.equal(result, instances[2]);
  for (const instance of instances.slice(0, 2)) assert.deepEqual(instance.cleanup, { doCleanup: true, force: false });
  assert.equal(result.cleanup, undefined);
});

test("temporary MongoDB stops retrying after three port collisions", async () => {
  const error = new Error('Port "45151" already in use');
  const { Server, instances } = fakeServer([error, error, error]);
  await assert.rejects(createTestMongo(undefined, Server), (failure) => failure === error);
  assert.equal(instances.length, 3);
  assert.ok(instances.every((instance) => instance.cleanup.doCleanup));
});

test("temporary MongoDB preserves other startup failures without retrying", async () => {
  const error = new Error("MongoDB binary could not be downloaded");
  const { Server, instances } = fakeServer([error]);
  await assert.rejects(createTestMongo(undefined, Server), (failure) => failure === error);
  assert.equal(instances.length, 1);
  assert.ok(instances[0].cleanup.doCleanup);
});
