const { MongoMemoryServer } = require("mongodb-memory-server");

// Port discovery releases its socket before mongod binds it. Parallel test
// processes can claim that port in between, so retry only this startup race.
async function createTestMongo(options, Server = MongoMemoryServer) {
  // Shared CI runners can need more than the library's 10-second default to
  // start mongod. Keep startup bounded, without retrying failed assertions.
  const serverOptions = {
    ...options,
    instance: { launchTimeout: 60000, ...options?.instance },
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const server = new Server(serverOptions);
    try {
      await server.start();
      return server;
    } catch (error) {
      await server.stop({ doCleanup: true, force: false });
      const portCollision = error.code === "EADDRINUSE" || /^Port "\d+" already in use$/.test(error.message);
      if (!portCollision || attempt === 2) throw error;
    }
  }
}

module.exports = { createTestMongo };
