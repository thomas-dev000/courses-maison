// Garde les fichiers de l'appli pour l'ouvrir sans réseau.
// Les réponses du script ne sont pas mises en cache (le dernier état est dans le stockage local).
const VERSION = 'courses-8';
const FICHIERS = ['./', 'index.html', 'style.css', 'app.js', 'api.js', 'vues.js', 'logique.js', 'ticket.js',
                  'manifest.webmanifest', 'icones/icone.svg', 'icones/icone-192.png', 'icones/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(noms => Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Fichiers de l'appli : réseau d'abord (mises à jour), cache si hors ligne
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' })   // revalide auprès du serveur : jamais de fichier périmé
    .then(r => { const copie = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copie)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
