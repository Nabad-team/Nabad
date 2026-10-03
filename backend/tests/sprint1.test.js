const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const { loadConfig, cookieOptions } = require("../src/config");
const { logEvent } = require("../src/logger");
let mongod, server, base, sent = [];
const password = "Sprint test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init()]);
  passwordHash = await bcrypt.hash(password, 12);
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); await LinkedProfile.deleteMany({}); sent = []; });
async function user(email = "elias@example.test") { return User.create({name:"Elias",email,passwordHash}); }
function token(account, extra = {}) { return jwt.sign({sub:String(account._id),ver:account.authVersion || 0,...extra},process.env.JWT_SECRET,{expiresIn:"15m"}); }
async function request(path, {body, cookie, origin = process.env.CLIENT_ORIGIN, raw} = {}) {
  const response = await fetch(base+path, {
    method:body === undefined && raw === undefined ? "GET" : "POST",
    headers:{"Content-Type":"application/json",Origin:origin,...(cookie ? {Cookie:`accessToken=${cookie}`} : {})},
    body:raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return {status:response.status,body:await response.json(),headers:response.headers};
}
test("existing signup supports multiple password-only users and rejects duplicate email",async()=>{
  assert.equal((await request("/auth/signup",{body:{name:"Test",email:"weak@example.test",password:"NoSymbol12345"}})).status,400);
  for (const email of ["one@example.test","two@example.test"]) assert.equal((await request("/auth/signup",{body:{name:"Test",email,password}})).status,201);
  assert.equal((await request("/auth/signup",{body:{name:"Again",email:"ONE@example.test",password}})).status,409);
  const saved=await User.findOne({email:"one@example.test"});
  assert.equal(saved.googleId,undefined); assert.notEqual(saved.passwordHash,password);
  assert.equal(await bcrypt.compare(password,saved.passwordHash),true);
});
test("login and me retain the existing frontend contract",async()=>{
  await user(); const login=await request("/auth/login",{body:{email:"elias@example.test",password}});
  assert.equal(login.status,200); assert.equal(login.body.user.name,"Elias");
  const cookie=login.headers.get("set-cookie").split(";")[0].split("=")[1];
  assert.equal((await request("/auth/me",{cookie})).body.user.email,"elias@example.test");
  assert.match(login.headers.get("set-cookie"),/HttpOnly/);
});
test("pending two-factor challenge cannot access protected routes",async()=>{
  const account=await user(), cookie=token(account,{purpose:"2fa"});
  assert.equal((await request("/auth/me",{cookie})).status,401);
  assert.equal((await request("/profile/emergency-contact",{cookie})).status,401);
  await request("/auth/logout",{cookie,body:{}});
  assert.equal((await User.findById(account._id)).authVersion,0);
});
test("logout revokes sessions, and stale logout does not revoke a new session",async()=>{
  const account=await user(), old=token(account);
  const response=await request("/auth/logout",{cookie:old,body:{}});
  assert.equal(response.status,200); assert.match(response.headers.get("set-cookie"),/Expires=Thu, 01 Jan 1970/);
  assert.equal((await request("/auth/me",{cookie:old})).status,401);
  const current=token(await User.findById(account._id));
  await request("/auth/logout",{cookie:old,body:{}});
  assert.equal((await request("/auth/me",{cookie:current})).status,200);
});
test("emergency contact is stored on the authenticated account and survives reload",async()=>{
  const account=await user(), cookie=token(account);
  assert.equal((await request("/profile/emergency-contact",{cookie})).body.contact,null);
  const res=await request("/profile/emergency-contact",{cookie,body:{name:"  Family  ",phone:"+961 71 123 456",userId:"ignored"}});
  assert.equal(res.status,201); assert.deepEqual(res.body.contact,{name:"Family",phone:"+96171123456"});
  assert.equal((await User.findById(account._id)).emergencyContact.name,"Family");
  assert.equal((await request("/profile/emergency-contact",{cookie})).body.contact.phone,"+96171123456");
});
test("contacts cannot be read or overwritten by another account",async()=>{
  const a=await user(), b=await user("other@example.test");
  await request("/profile/emergency-contact",{cookie:token(a),body:{name:"A",phone:"71123456"}});
  assert.equal((await request("/profile/emergency-contact",{cookie:token(b)})).body.contact,null);
  await request("/profile/emergency-contact",{cookie:token(b),body:{name:"B",phone:"03123456",userId:String(a._id)}});
  assert.equal((await User.findById(a._id)).emergencyContact.name,"A");
});
test("concurrent contact submissions create exactly one contact",async()=>{
  const cookie=token(await user());
  const responses=await Promise.all(["First","Second"].map(name=>request("/profile/emergency-contact",{cookie,body:{name,phone:"71123456"}})));
  assert.deepEqual(responses.map(x=>x.status).sort(),[201,409]);
});
test("invalid contact values and unauthenticated access are rejected",async()=>{
  const cookie=token(await user());
  for(const body of [{name:"",phone:"71123456"},{name:"A",phone:"bad"},{name:5,phone:6}]) assert.equal((await request("/profile/emergency-contact",{cookie,body})).status,400);
  assert.equal((await request("/profile/emergency-contact")).status,401);
});
test("browser writes require the configured origin",async()=>{
  const cookie=token(await user());
  assert.equal((await request("/auth/logout",{cookie,body:{},origin:"https://evil.example"})).status,403);
  assert.equal((await request("/auth/me",{cookie})).status,200);
});
test("password reset consumes its token atomically and invalidates sessions and challenges",async()=>{
  const account=await user(), cookie=token(account);
  const reset="a".repeat(64);
  await User.updateOne({_id:account._id},{$set:{resetPasswordTokenHash:crypto.createHash("sha256").update(reset).digest("hex"),resetPasswordExpires:new Date(Date.now()+60000)}});
  assert.equal((await request("/auth/reset-password",{body:{token:reset,password:"Weak password 123"}})).status,400);
  const responses=await Promise.all([1,2].map(()=>request("/auth/reset-password",{body:{token:reset,password:"New password 123!"}})));
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,400]);
  assert.equal((await request("/auth/me",{cookie})).status,401);
  assert.equal(await bcrypt.compare("New password 123!",(await User.findById(account._id)).passwordHash),true);
});
test("google sign-in answers 503 with a readable message when it is not configured",async()=>{
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  const res=await request("/auth/google");
  assert.equal(res.status,503); assert.equal(res.body.error,"Google sign-in is not configured.");
});
test("expired access tokens are rejected",async()=>{
  const account=await user();
  const cookie=jwt.sign({sub:String(account._id),ver:0},process.env.JWT_SECRET,{expiresIn:-1});
  assert.equal((await request("/auth/me",{cookie})).status,401);
});
test("staging and production require distinct database names and secure cookies",()=>{
  const common={MONGO_URI:"mongodb://localhost:27017",JWT_SECRET:"x".repeat(32),CLIENT_ORIGIN:"https://app.example"};
  const prodVars={SMTP_HOST:"smtp",SMTP_PORT:"2525",SMTP_USER:"u",SMTP_PASS:"p",EMAIL_FROM:"f",GOOGLE_REDIRECT_URI:"https://app.example/cb"};
  const stage=loadConfig({...common,APP_ENV:"staging",MONGO_DB_NAME:"nabad_staging"});
  const prod=loadConfig({...common,...prodVars,APP_ENV:"production",MONGO_DB_NAME:"nabad_production"});
  assert.notEqual(stage.databaseName,prod.databaseName);
  assert.throws(()=>loadConfig({...common,APP_ENV:"staging",MONGO_DB_NAME:"nabad_production"}));
  assert.throws(()=>loadConfig({...common,...prodVars,APP_ENV:"production",MONGO_DB_NAME:"nabad_production",CLIENT_ORIGIN:"http://app.example"}),/HTTPS/);
  process.env.APP_ENV="staging"; assert.equal(cookieOptions().secure,true); process.env.APP_ENV="test";
});
test("readiness checks MongoDB and reports failure without leaking details",async(t)=>{
  assert.equal((await request("/health")).status,200);
  assert.equal((await request("/health/ready")).status,200);
  t.mock.method(mongoose.connection.db,"command",async()=>{throw new Error("secret database URI");});
  assert.deepEqual((await request("/health/ready")).body,{status:"unavailable"});
  assert.equal((await request("/health/ready")).status,503);
});
test("unexpected auth database failures return a private 500",async(t)=>{
  const cookie=token(await user());
  t.mock.method(User,"findById",()=>{throw new Error("secret Mongo password");});
  const result=await request("/auth/me",{cookie});
  assert.equal(result.status,500); assert.equal(result.body.error,"An internal error occurred.");
  assert.equal(result.headers.get("x-request-id"),result.body.requestId);
});
test("structured logs ignore sensitive fields",(t)=>{
  const lines=[];
  const mock=t.mock.method(process.stdout,"write",(text)=>{lines.push(text);return true;});
  logEvent("test",{requestId:"id",errorType:"Error",password:"secret",email:"secret",token:"secret",message:"secret"});
  mock.mock.restore();
  const parsed=JSON.parse(lines[0]); assert.equal(parsed.requestId,"id"); assert.equal(lines[0].includes("secret"),false);
});
test("invalid JSON is handled without returning a stack trace",async()=>{
  const res=await request("/auth/login",{raw:"{"});
  assert.equal(res.status,400); assert.equal(res.body.error,"Invalid request body.");
});
test("linked-profile schema validates caregiver, relationship and date",async()=>{
  const account=await user();
  const profile=await LinkedProfile.create({owner:account._id,fullName:"Dependent",dateOfBirth:"2015-01-01",relationship:"child"});
  assert.equal(String(profile.owner),String(account._id));
  await assert.rejects(()=>LinkedProfile.create({owner:account._id,fullName:"X",dateOfBirth:"2999-01-01",relationship:"other"}));
  await assert.rejects(()=>LinkedProfile.create({fullName:"X",dateOfBirth:"2015-01-01",relationship:"child"}));
});
test("email two-factor login still requires and consumes a valid code",async(t)=>{
  const account=await user(); await User.updateOne({_id:account._id},{$set:{twoFactorEnabled:true}});
  for(const key of ["SMTP_HOST","SMTP_USER","SMTP_PASS","MAIL_FROM"]) process.env[key]="test";
  t.mock.method(nodemailer,"createTransport",()=>({sendMail:async message=>{sent.push(message);}}));
  const login=await request("/auth/login",{body:{email:account.email,password}});
  assert.equal(login.body.twoFactorRequired,true); assert.equal(login.headers.get("set-cookie"),null);
  const code=sent[0].text.match(/\b\d{6}\b/)[0];
  const verified=await request("/auth/2fa/verify",{body:{challenge:login.body.challenge,code}});
  assert.equal(verified.status,200); assert.ok(verified.headers.get("set-cookie"));
  assert.equal((await request("/auth/2fa/verify",{body:{challenge:login.body.challenge,code}})).status,401);
});
test("upgraded mail package can generate reset email content",async()=>{
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
  const result=await transport.sendMail({from:"nabad@example.test",to:"elias@example.test",subject:"Reset password",text:"Test reset message"});
  assert.match(result.message.toString(),/Test reset message/);
});
test("behind the Vercel and Render proxies, login rate limits count each visitor separately",async()=>{
  assert.throws(()=>loadConfig({MONGO_URI:"mongodb://localhost:27017",JWT_SECRET:"x".repeat(32),TRUST_PROXY:"yes"}));
  process.env.TRUST_PROXY="2";
  const { createApp } = require("../src/app");
  const proxied=createApp().listen(0,"127.0.0.1"); delete process.env.TRUST_PROXY;
  await new Promise(resolve=>proxied.once("listening",resolve));
  const login=visitor=>fetch(`http://127.0.0.1:${proxied.address().port}/api/auth/login`,{method:"POST",
    headers:{"Content-Type":"application/json",Origin:process.env.CLIENT_ORIGIN,"X-Forwarded-For":`${visitor}, 76.76.21.1`},
    body:JSON.stringify({email:"nobody@example.test",password:"wrong password"})});
  try {
    for (let i=0;i<20;i++) assert.equal((await login("203.0.113.1")).status,401);
    assert.equal((await login("203.0.113.1")).status,429);
    assert.equal((await login("203.0.113.2")).status,401);
  } finally { await new Promise(resolve=>proxied.close(resolve)); }
});
