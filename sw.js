const CACHE = 'controle-financeiro-v3';
const ARQUIVOS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];
const ESTATICOS = new Set(['styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg']);

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
    const url = new URL(evento.request.url);
    const navegacao = evento.request.mode === 'navigate';

    if (navegacao) {
        evento.respondWith(
            fetch(evento.request)
                .then(resposta => {
                    caches.open(CACHE).then(cache => cache.put('./index.html', resposta.clone()));
                    return resposta;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    if (ESTATICOS.has(url.pathname.split('/').pop())) {
        evento.respondWith(
            caches.match(evento.request, { ignoreSearch: true })
                .then(resposta => resposta || fetch(evento.request))
        );
    }
});
