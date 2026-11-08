// Garde les fichiers de l'appli pour l'ouvrir sans réseau.
// Les réponses du script ne sont pas mises en cache (le dernier état est dans le stockage local).
const VERSION = 'courses-11';
const ATTENTE_RESEAU_MS = 3000;   // réseau capté mais muet (au magasin) : on ouvre depuis le cache
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

// Fichiers de l'appli : réseau d'abord (mises à jour) ; cache si hors ligne ou si le réseau ne répond
// pas en 3 s (le réseau finit alors de mettre le cache à jour pour la prochaine ouverture)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const reseau = fetch(e.request, { cache: 'no-cache' })   // revalide auprès du serveur : jamais de fichier périmé
    .then(r => { const copie = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copie)); return r; });
  const cache = () => caches.match(e.request, { ignoreSearch: true });
  const lent = new Promise(resolve => setTimeout(resolve, ATTENTE_RESEAU_MS))
    .then(cache).then(r => r || reseau);
  e.respondWith(Promise.race([reseau, lent]).catch(() => cache()));
  e.waitUntil(reseau.catch(() => {}));
});
