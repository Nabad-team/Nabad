import { useEffect, useState } from "react";
import Alert from "./ui/Alert";

// Cache only a public help page, never a signed-in page, request, medical document or account detail.
export default function OfflineSupport() {
  const [offline,setOffline]=useState(false);
  useEffect(()=>{
    const update=()=>setOffline(navigator.onLine===false);
    update();window.addEventListener("online",update);window.addEventListener("offline",update);
    if(process.env.NODE_ENV==="production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});
    }
    return ()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  if(!offline)return null;
  return <Alert tone="warning" role="status" title="You are offline">
    Nabad cannot load or save new information. In an emergency in Lebanon, <a href="tel:140">call 140</a>.{" "}
    <a href="/offline.html">Open emergency help</a>.
  </Alert>;
}
