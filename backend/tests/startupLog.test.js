const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { logEvent } = require("../src/logger");
const { loadConfig } = require("../src/config");
const password = "Fake-Db-Pass-" + crypto.randomBytes(4).toString("hex");
// Run outside the backend folder so dotenv cannot load a local .env.
function runServer(env) {
  return new Promise(resolve=>execFile(process.execPath,[path.join(__dirname,"../src/server.js")],{cwd:os.tmpdir(),env,timeout:30000},(err,out)=>resolve(out)));
}
function productionEnv() {
  const env={APP_ENV:"production",CLIENT_ORIGIN:"https://nabad.example.test",MONGO_DB_NAME:"nabad_production",SMTP_PORT:"2525",GOOGLE_REDIRECT_URI:"https://nabad.example.test/api/auth/google/callback"};
  for(const key of ["MONGO_URI","JWT_SECRET","SMTP_HOST","SMTP_USER","SMTP_PASS","EMAIL_FROM","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]) env[key]="value-of-"+key+"-"+crypto.randomBytes(20).toString("hex");
  return env;
}

test("startup_failed logs the error message without the database password",async()=>{
  const env={...process.env,APP_ENV:"test",JWT_SECRET:crypto.randomBytes(32).toString("hex"),MONGO_URI:`mongodb://nabad_user:${password}@/nabad`};
  const stdout=await runServer(env);
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
test("production startup names missing variables and never prints any value",async()=>{
  const env=productionEnv(); delete env.SMTP_PASS; env.EMAIL_FROM=" ";
  // Only what node needs to run; nothing from the developer's shell.
  const stdout=await runServer({...env,PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||""});
  const entry=JSON.parse(stdout.trim().split("\n").pop());
  assert.equal(entry.event,"startup_failed");
  assert.equal(entry.errorMessage,"Missing required environment variables: SMTP_PASS, EMAIL_FROM");
  assert.equal(stdout.includes("value-of-"),false);
});
test("production without Google credentials starts with one warning naming them",async()=>{
  const env=productionEnv(); delete env.GOOGLE_CLIENT_ID; delete env.GOOGLE_CLIENT_SECRET;
  // An unparseable URI makes startup stop right after the config checks, without a database.
  env.MONGO_URI="mongodb://nabad_user:value-of-db-pass@/nabad";
  const stdout=await runServer({...env,PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||""});
  const entries=stdout.trim().split("\n").map(line=>JSON.parse(line));
  const warnings=entries.filter(entry=>entry.event==="google_signin_disabled");
  assert.equal(warnings.length,1);
  assert.deepEqual(warnings[0].missingVariables,["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]);
  // Got past the config checks: the failure is the database URI, not a missing variable.
  assert.equal(entries.at(-1).errorType,"MongoParseError");
  assert.equal(stdout.includes("value-of-"),false);
});
test("production with only one Google credential refuses to start and names the missing one",async()=>{
  const env=productionEnv(); delete env.GOOGLE_CLIENT_SECRET;
  const stdout=await runServer({...env,PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||""});
  const entry=JSON.parse(stdout.trim().split("\n").pop());
  assert.equal(entry.event,"startup_failed");
  assert.equal(entry.errorMessage,"Google sign-in is only partly configured. Set both or neither; missing: GOOGLE_CLIENT_SECRET");
  assert.equal(stdout.includes("value-of-"),false);
  const onlySecret=productionEnv(); onlySecret.GOOGLE_CLIENT_ID=" ";
  assert.throws(()=>loadConfig(onlySecret),/missing: GOOGLE_CLIENT_ID$/);
});
test("production config accepts a complete environment and the legacy MAIL_FROM name",()=>{
  const env=productionEnv();
  assert.equal(loadConfig(env).environment,"production");
  assert.doesNotThrow(()=>loadConfig({...env,GOOGLE_CLIENT_ID:"",GOOGLE_CLIENT_SECRET:""}));
  env.MAIL_FROM=env.EMAIL_FROM; delete env.EMAIL_FROM;
  assert.doesNotThrow(()=>loadConfig(env));
  delete env.MAIL_FROM;
  assert.throws(()=>loadConfig(env),/^Error: Missing required environment variables: EMAIL_FROM$/);
  assert.doesNotThrow(()=>loadConfig({...env,APP_ENV:"staging",MONGO_DB_NAME:"nabad_staging"}));
});
