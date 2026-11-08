const CACHE = 'controle-financeiro-v2';
const ARQUIVOS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', evento => {
    evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)));
    self.skipWaiting();
});

self.addEventListener('activate', evento => {
    evento.waitUntil(caches.keys().then(chaves =>
        Promise.all(chaves.filter(chave => chave !== CACHE).map(chave => caches.delete(chave)))
    ));
    evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evento => {
    if (evento.request.method !== 'GET') return;
    evento.respondWith(
        fetch(evento.request)
            .then(resposta => {
                if (resposta.ok) {
                    const copia = resposta.clone();
                    caches.open(CACHE).then(cache => cache.put(evento.request, copia));
                }
                return resposta;
            })
            .catch(() => caches.match(evento.request, { ignoreSearch: true }).then(resposta =>
                resposta || caches.match('./index.html')
            ))
    );
});
