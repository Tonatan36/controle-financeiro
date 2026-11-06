const CACHE = 'controle-financeiro-v1';
const ARQUIVOS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

self.addEventListener('install', evento => {
    evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', evento => {
    evento.waitUntil(caches.keys().then(chaves =>
        Promise.all(chaves.filter(chave => chave !== CACHE).map(chave => caches.delete(chave)))
    ));
});

self.addEventListener('fetch', evento => {
    evento.respondWith(fetch(evento.request).catch(() => caches.match(evento.request)));
});
