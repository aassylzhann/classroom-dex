const cacheName = 'classroom-dex-static-examples-01';
const shell = [
  './index.html','./styles.css','./app.js','./data.js','./storage.js','./ui.js',
  './icons.js','./media.js','./services.js','./capture.js','./learning.js','./teacher.js',
  './assets/mark.svg','./assets/dm-sans.woff2','./assets/fraunces.woff2','./assets/fraunces-italic.woff2',
  './assets/bottle.jpg','./assets/bottle-flat.svg','./assets/book.jpg','./assets/pencil.jpg','./assets/eraser.jpg',
  './assets/reading-bottle.wav','./assets/reading-bottle-first.wav',
  './assets/reading-book.wav','./assets/reading-pencil.wav','./assets/reading-eraser.wav',
];
const urls = new Set(shell.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install',event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(shell.map(url => new Request(url,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(key => key.startsWith('classroom-dex-static-') && key !== cacheName).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
async function sliceAudio(cached,requestedRange) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(requestedRange);
  const blob = await cached.blob(), size = blob.size;
  const fail = () => new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  if (!match || (!match[1] && !match[2])) return fail();
  const start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size-1,Number(match[2])) : size-1;
  if (start > end || start >= size) return fail();
  return new Response(blob.slice(start,end+1),{status:206,headers:{
    'Content-Type':cached.headers.get('Content-Type') || blob.type,
    'Accept-Ranges':'bytes','Content-Length':String(end-start+1),
    'Content-Range':`bytes ${start}-${end}/${size}`,
  }});
}
self.addEventListener('fetch',event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url), root = self.registration.scope;
  const shellPage = request.mode === 'navigate' && [root,new URL('./index.html',root).href].includes(url.origin+url.pathname);
  if (!shellPage && !urls.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(shellPage ? './index.html' : request.url);
    if (!cached) return fetch(request);
    const range = request.headers.get('range');
    return range && url.pathname.endsWith('.wav') ? sliceAudio(cached,range) : cached;
  })());
});
