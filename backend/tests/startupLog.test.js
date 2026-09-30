const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { logEvent } = require("../src/logger");
const password = "Fake-Db-Pass-" + crypto.randomBytes(4).toString("hex");

test("startup_failed logs the error message without the database password",async()=>{
  // Run outside the backend folder so dotenv cannot load a local .env.
  const env={...process.env,APP_ENV:"test",JWT_SECRET:crypto.randomBytes(32).toString("hex"),MONGO_URI:`mongodb://nabad_user:${password}@/nabad`};
  const stdout=await new Promise(resolve=>execFile(process.execPath,[path.join(__dirname,"../src/server.js")],{cwd:os.tmpdir(),env,timeout:30000},(err,out)=>resolve(out)));
  const entry=JSON.parse(stdout.trim().split("\n").pop());
  assert.equal(entry.event,"startup_failed"); assert.equal(entry.errorType,"MongoParseError");
  assert.match(entry.errorMessage,/mongodb:\/\/\*\*\*@\/nabad/);
  assert.equal(stdout.includes(password),false); assert.equal(stdout.includes("nabad_user"),false);
});
test("errorMessage redaction covers passwords with unescaped @ and /",(t)=>{
  const lines=[];
  const mock=t.mock.method(process.stdout,"write",(text)=>{lines.push(text);return true;});
  logEvent("startup_failed",{errorMessage:`Bad URI "mongodb+srv://u:${password}@x/y@cluster.example.net/db"`});
  mock.mock.restore();
  assert.equal(JSON.parse(lines[0]).errorMessage,'Bad URI "mongodb+srv://***@cluster.example.net/db"');
  assert.equal(lines[0].includes(password),false);
});
