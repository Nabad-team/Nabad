/** @jest-environment node */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const script=fs.readFileSync(path.join(__dirname,"../public/service-worker.js"),"utf8");
const help=fs.readFileSync(path.join(__dirname,"../public/offline.html"),"utf8");
function worker(fetcher=jest.fn().mockRejectedValue(new Error("offline"))){
 const handlers={},cache={add:jest.fn().mockResolvedValue(),match:jest.fn(async()=>new Response(help))};
 const caches={open:jest.fn(async()=>cache),keys:jest.fn(async()=>["nabad-public-help-v0","unrelated-cache"]),delete:jest.fn(async()=>true)};
 const self={addEventListener:(name,fn)=>handlers[name]=fn,location:{origin:"https://nabad.test"},skipWaiting:jest.fn(),clients:{claim:jest.fn()}};
 class RelativeRequest extends Request{constructor(url,options){super(new URL(url,"https://nabad.test"),options);}}
 vm.runInNewContext(script,{self,caches,Request:RelativeRequest,Response,URL,AbortController,setTimeout,clearTimeout,fetch:fetcher});
 const navigate=(url="/profile",extra={})=>{
  const event={request:{url:new URL(url,"https://nabad.test").href,method:"GET",mode:"navigate",signal:new AbortController().signal,...extra},respondWith:jest.fn()};
  handlers.fetch(event);return event;
 };
 return {handlers,caches,cache,self,navigate,fetcher};
}
test("installation stores only the public help document and cleanup touches only its own cache",async()=>{
 const w=worker();let installing,activating;
 w.handlers.install({waitUntil:p=>installing=p});await installing;
 expect(w.cache.add).toHaveBeenCalledTimes(1);
 const request=w.cache.add.mock.calls[0][0];expect(request.url).toBe("https://nabad.test/offline.html");expect(request.credentials).toBe("omit");
 w.handlers.activate({waitUntil:p=>activating=p});await activating;
 expect(w.caches.delete.mock.calls).toEqual([["nabad-public-help-v0"]]);
});
test("offline private-page navigation shows generic help without caching the private page",async()=>{
 const w=worker();const event=w.navigate("/profile?private=secret");
 const result=await event.respondWith.mock.calls[0][0];const body=await result.text();
 expect(body).toContain('href="tel:140"');expect(body).toContain('lang="en"');
 expect(body).not.toContain("secret");expect(w.cache.add).not.toHaveBeenCalled();
});
test("API requests, writes, assets and other origins are never intercepted",()=>{
 const w=worker();
 for(const event of [w.navigate("/api/profile/me"),w.navigate("/api"),w.navigate("/profile",{method:"POST"}),w.navigate("/_next/data/test.json",{mode:"cors"}),w.navigate("https://other.test")])
  expect(event.respondWith).not.toHaveBeenCalled();
 expect(w.fetcher).not.toHaveBeenCalled();
});
test("server errors receive help while authentication errors keep their original response",async()=>{
 const fetcher=jest.fn().mockResolvedValueOnce(new Response("outage",{status:503})).mockResolvedValueOnce(new Response("sign in",{status:401}));
 const w=worker(fetcher);
 expect(await (await w.navigate().respondWith.mock.calls[0][0]).text()).toContain("Nabad cannot connect");
 expect((await w.navigate().respondWith.mock.calls[0][0]).status).toBe(401);
});
test("a stalled navigation is aborted and falls back instead of spinning forever",async()=>{
 jest.useFakeTimers();
 try{
  const fetcher=jest.fn((request,{signal})=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(Error("aborted")))));
  const w=worker(fetcher);const pending=w.navigate().respondWith.mock.calls[0][0];
  await jest.advanceTimersByTimeAsync(10000);
  expect(await (await pending).text()).toContain("Nabad cannot connect");
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
 }finally{jest.useRealTimers();}
});
