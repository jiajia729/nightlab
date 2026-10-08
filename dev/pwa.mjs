// node pwa.mjs → dist/pwa/（可安裝、離線可玩）
import fs from 'fs';
const game = fs.readFileSync('dist/nightlab.html', 'utf8');
const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#060a13">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
</head>
<body>
${game}
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>
</body>
</html>`;
fs.writeFileSync('dist/pwa/index.html', html);
fs.writeFileSync('dist/pwa/manifest.webmanifest', JSON.stringify({
  name: '夜間實驗室', short_name: '夜間實驗室', start_url: './', scope: './', display: 'fullscreen',
  orientation: 'any', background_color: '#060a13', theme_color: '#060a13', lang: 'zh-Hant',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 1));
const ver = Date.now();
fs.writeFileSync('dist/pwa/sw.js', `// 離線快取：遊戲本體先存好，字型第一次載入後也存起來
const CACHE = 'nightlab-${ver}';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const font = /fonts\\.(googleapis|gstatic)\\.com/.test(e.request.url);
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return res; }).catch(() => hit);
    return font ? (hit || net) : (net || hit);
  }));
});
`);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
