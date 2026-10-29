// SCRUM-198: network-first navigation fallback. Never cache account pages or API responses.
const CACHE = "nabad-public-help-v1";
const OFFLINE = "/offline.html";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.add(new Request(OFFLINE,{credentials:"omit",cache:"reload"}))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key=>key.startsWith("nabad-public-help-")&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
async function fallback() {
  const cached = await (await caches.open(CACHE)).match(OFFLINE);
  return cached || new Response('<!doctype html><html lang="en"><title>Nabad unavailable</title><h1>Nabad cannot connect</h1><p>In an emergency in Lebanon, <a href="tel:140">call 140</a>. Do not wait for Nabad.</p></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
}
self.addEventListener("fetch", event => {
  const url=new URL(event.request.url);
  if(event.request.method!=="GET" || event.request.mode!=="navigate" ||
    url.origin!==self.location.origin || url.pathname==="/api" || url.pathname.startsWith("/api/"))return;
  event.respondWith((async()=>{
    const controller=new AbortController();
    const abort=()=>controller.abort();
    const signal=event.request.signal;
    if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});
    const timer=setTimeout(abort,10000);
    try {
      const response=await fetch(event.request,{signal:controller.signal});
      return response.status>=500 ? await fallback() : response;
    } catch {return await fallback();}
    finally{clearTimeout(timer);signal.removeEventListener("abort",abort);}
  })());
});
