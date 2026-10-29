const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const UsageDaily = require("../src/models/UsageDaily");
const { recordAssessment, countTriageUsage, usageSummary } = require("../src/usageAnalytics");
let mongo, server, base;
before(async () => {
  mongo=await createTestMongo();await mongoose.connect(mongo.getUri());await UsageDaily.init();
  const app=express();app.use(express.json());app.use(countTriageUsage);
  app.post("/assess",(req,res)=>res.status(req.body.status||200).json({ok:true}));
  server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  base="http://127.0.0.1:"+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo.stop();});
beforeEach(async()=>{await UsageDaily.deleteMany({});delete process.env.USAGE_ANALYTICS_ENABLED;});
const send=body=>fetch(base+"/assess",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
async function eventually(check) {
  for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.fail("Background aggregate update did not finish");
}
test("concurrent increments distinguish initial checks and follow-up requests",async()=>{
  const now=new Date("2026-10-28T12:00:00Z");
  await Promise.all(Array.from({length:20},(_,i)=>recordAssessment(i>=12,now)));
  assert.deepEqual((await usageSummary(1,now)).totals,{assessments:20,sessionsStarted:12,followupAssessments:8});
  const row=await UsageDaily.findOne().lean();
  assert.deepEqual(Object.keys(row).sort(),["_id","assessments","expiresAt","followupAssessments","sessionsStarted"].sort());
  assert.equal(row.expiresAt.toISOString(),"2027-01-26T00:00:00.000Z");
  assert.ok((await UsageDaily.collection.indexes()).some(i=>i.expireAfterSeconds===0));
});
test("UTC windows include quiet days and exclude out-of-window records",async()=>{
  await recordAssessment(false,new Date("2026-10-26T23:59:59Z"));
  await recordAssessment(true,new Date("2026-10-28T00:00:00Z"));
  const summary=await usageSummary(2,new Date("2026-10-28T23:59:59Z"));
  assert.equal(summary.from,"2026-10-27");assert.equal(summary.timeZone,"UTC");
  assert.deepEqual(summary.daily.map(row=>row.assessments),[0,1]);
  for(const days of [0,91,1.5,"30"])await assert.rejects(usageSummary(days),RangeError);
});
test("only successes count and patient/request details cannot enter storage",async()=>{
  await send({symptoms:"private symptom",email:"private@example.test",status:400});
  assert.equal(await UsageDaily.countDocuments(),0);
  await send({symptoms:"private symptom",userId:"private-owner"});
  await eventually(async()=>(await UsageDaily.findOne().lean())?.assessments===1);
  await send({answers:{private:"private answer"},followUpState:{round:1}});
  await eventually(async()=>(await UsageDaily.findOne().lean())?.assessments===2);
  const row=await UsageDaily.findOne().lean();assert.equal(row.sessionsStarted,1);assert.equal(row.followupAssessments,1);
  assert.equal(JSON.stringify(row).includes("private"),false);
  assert.throws(()=>new UsageDaily({_id:"2026-10-28",symptoms:"secret"}),/strict/i);
});
test("disabled analytics and database failures do not fail the response",async()=>{
  process.env.USAGE_ANALYTICS_ENABLED="false";
  assert.equal((await send({})).status,200);assert.equal(await UsageDaily.countDocuments(),0);
  delete process.env.USAGE_ANALYTICS_ENABLED;
  const replacement=mock.method(UsageDaily,"updateOne",()=>Promise.reject(new Error("private database detail")));
  try {assert.equal((await send({})).status,200);} finally {replacement.mock.restore();}
});
