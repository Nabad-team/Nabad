const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
const router=require("../src/routes/health");
const {databaseReady}=router;
let server,base;
before(async()=>{const app=express();app.use("/health",router);server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port;});
after(async()=>{await new Promise(r=>server.close(r));});
test("liveness stays separate from unavailable database readiness",async()=>{
 const live=await fetch(base+"/health");assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:"ok"});
 const ready=await fetch(base+"/health/ready");assert.equal(ready.status,503);assert.deepEqual(await ready.json(),{status:"unavailable"});
});
test("a ping that never settles cannot leave the readiness request hanging",async()=>{
 const started=performance.now();
 assert.equal(await databaseReady({readyState:1,db:{command:()=>new Promise(()=>{})}},25),false);
 assert.ok(performance.now()-started<500);
});
test("readiness checks require a working ping and suppress database details",async()=>{
 assert.equal(await databaseReady({readyState:0}),false);
 assert.equal(await databaseReady({readyState:1,db:{command:async()=>{throw Error("secret connection details");}}}),false);
 assert.equal(await databaseReady({readyState:1,db:{command:async(command,options)=>{assert.deepEqual(command,{ping:1});assert.equal(options.timeoutMS,50);}}},50),true);
});
