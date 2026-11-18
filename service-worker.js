const CACHE="spellvault-static-v1";
const ASSETS=["./","./index.html","./style.css","./app.js","./database.js","./crypto.js","./manifest.json","./assets/icon.svg","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  // Only static app files are cached. IndexedDB vault contents are never intercepted.
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
    if(response.ok && (req.destination==="script"||req.destination==="style"||req.destination==="document"||req.destination==="image"||url.pathname.endsWith(".json"))){
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));
    }
    return response;
  })));
});