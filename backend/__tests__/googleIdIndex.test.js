process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../src/models/User");
const authRoutes = require("../src/routes/auth");
const fixGoogleIdIndex = require("../src/migrations/fixGoogleIdIndex");

// Same middleware as server.js, without connecting to a real database or listening on a port.
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await User.createIndexes();
});

function signup(email) {
  return request(app).post("/api/auth/signup").send({ name: "Test User", email, password: "password123" });
}

test("two email/password users can sign up", async () => {
  const first = await signup("first@example.com");
  const second = await signup("second@example.com");

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(await User.countDocuments()).toBe(2);
});

test("two users cannot share the same googleId", async () => {
  const base = { name: "Google User", passwordHash: "x", authProvider: "google", googleId: "google-123" };
  await User.create({ ...base, email: "one@example.com" });

  await expect(User.create({ ...base, email: "two@example.com" })).rejects.toMatchObject({ code: 11000 });
});

test("startup step replaces the old sparse googleId index", async () => {
  await User.collection.dropIndex("googleId_1");
  await User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  // An existing email/password user saved by the old model, with googleId: null.
  await User.collection.insertOne({ name: "Old User", email: "old@example.com", passwordHash: "x", googleId: null });

  await fixGoogleIdIndex();

  const index = (await User.collection.indexes()).find((i) => i.name === "googleId_1");
  expect(index.partialFilterExpression).toEqual({ googleId: { $type: "string" } });
  expect((await signup("new@example.com")).status).toBe(201);
});
