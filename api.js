// Échanges avec le script Google de la maison (adresse et clé gardées dans ce téléphone)

const CLES = { url: 'courses.url', cle: 'courses.cle', prenom: 'courses.prenom' };

function lireStockage(nom) {
  try { return localStorage.getItem(nom) || ''; } catch (e) { return ''; }
}

function ecrireStockage(nom, valeur) {
  try { localStorage.setItem(nom, valeur); } catch (e) { /* stockage indisponible */ }
}

export function reglages() {
  return { url: lireStockage(CLES.url), cle: lireStockage(CLES.cle), prenom: lireStockage(CLES.prenom) };
}

export function enregistrerReglages(r) {
  ecrireStockage(CLES.url, (r.url || '').trim());
  ecrireStockage(CLES.cle, (r.cle || '').trim());
  ecrireStockage(CLES.prenom, (r.prenom || '').trim());
}

export function dernierEtat() {
  try { return JSON.parse(lireStockage('courses.dernierEtat')) || null; } catch (e) { return null; }
}

export function garderEtat(etat) {
  ecrireStockage('courses.dernierEtat', JSON.stringify(etat));
}

/** Erreur lisible : réseau absent ou refus du script */
export class ErreurScript extends Error {
  constructor(message, horsLigne, reponse) { super(message); this.horsLigne = !!horsLigne; this.reponse = reponse || null; }
}

async function repondre(promesse) {
  let reponse;
  try {
    reponse = await promesse;
  } catch (e) {
    throw new ErreurScript('Pas de réseau', true);
  }
  let objet;
  try {
    objet = await reponse.json();
  } catch (e) {
    throw new ErreurScript('Réponse illisible (adresse du script ?)');
  }
  if (!objet || objet.ok !== true) {
    const erreur = objet && objet.erreur;
    throw new ErreurScript(erreur === 'cle' ? 'Clé refusée' : (erreur || 'Refusé par le script'), false, objet);
  }
  return objet;
}

// Sans réponse au bout de ce délai (réseau capté mais muet, au magasin), on fait comme hors ligne
const DELAI_MS = 20000;

/** GET <url>?cle=…&action=…&… */
export function lire(action, params = {}, r = reglages()) {
  const adresse = new URL(r.url);
  adresse.searchParams.set('cle', r.cle);
  adresse.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) adresse.searchParams.set(k, v);
  return repondre(fetch(adresse, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_MS) }));
}

/** POST du corps JSON en text/plain (pas de requête préalable CORS), avec la clé */
export function ecrire(corps, r = reglages(), delai = DELAI_MS) {
  return repondre(fetch(r.url, {
    method: 'POST',
    signal: AbortSignal.timeout(delai),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ cle: r.cle }, corps)),
  }));
}
