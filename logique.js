// Logique pure de l'appli (sans navigateur), testée par test/logique.test.js

export const ENDROITS = ['frigo', 'congelateur', 'placard', 'entretien'];

/* ---------- Unités (spec ecran-esp32 : docs/superpowers/specs/2026-11-08-unites-design.md) ---------- */

export const UNITES = ['l', 'kg', 'paquet', 'unite'];
const QUANTITE_MAX = 99;

/** Unité connue, sinon « unite » */
export function lireUnite(u) {
  return UNITES.includes(u) ? u : 'unite';
}

/** Litres et kilos : quantités décimales ; paquets et unités : on compte */
export function estDecimale(u) {
  return u === 'l' || u === 'kg';
}

const arrondi = (q) => Math.round(q * 100) / 100;

/** 3 → « 3 L », 1.2 → « 1,2 kg », 2 → « 2 paquets », 6 → « ×6 » */
export function formaterQuantite(q, unite) {
  const u = lireUnite(unite);
  const n = String(arrondi(Number(q) || 0)).replace('.', ',');
  if (u === 'l') return n + ' L';
  if (u === 'kg') return n + ' kg';
  if (u === 'paquet') return n + (Number(q) > 1 ? ' paquets' : ' paquet');
  return '×' + n;
}

/** Quantité valable pour l'unité (déjà un nombre) ou null : entier (paquet, unite), centième (l, kg), ≤ 99 */
function quantiteValide(q, unite, zeroPermis) {
  if (!Number.isFinite(q)) return null;
  const r = estDecimale(unite) ? arrondi(q) : q;
  if (!estDecimale(unite) && !Number.isInteger(r)) return null;
  if (r < 0 || r > QUANTITE_MAX || (r === 0 && !zeroPermis)) return null;
  return r;
}

/** Texte tapé (« 1,2 », « 1.25 », « ,5 ») → quantité pour l'unité, ou null */
export function lireQuantite(texte, unite, zeroPermis = false) {
  const t = String(texte || '').trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  return quantiteValide(Number(t), lireUnite(unite), zeroPermis);
}

const LIBELLES = { frigo: 'Frigo', congelateur: 'Congélateur', placard: 'Placard', entretien: 'Entretien' };
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function libelleEndroit(id) {
  return LIBELLES[id] || id;
}

/** '2026-11-08' → '8 nov.' ; '' si la date est illisible */
export function dateCourte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return '';
  const mois = Number(m[2]);
  if (mois < 1 || mois > 12) return '';
  return Number(m[3]) + ' ' + MOIS[mois - 1];
}

/** Produits présents (quantité > 0) rangés par endroit, du plus récent au plus ancien, puis par nom */
export function regrouperParEndroit(produits) {
  const groupes = {};
  for (const e of ENDROITS) groupes[e] = [];
  for (const p of produits || []) {
    if (p.quantite > 0 && groupes[p.endroit]) groupes[p.endroit].push(p);
  }
  for (const e of ENDROITS) {
    groupes[e].sort((a, b) =>
      a.achete_le !== b.achete_le ? (a.achete_le < b.achete_le ? 1 : -1) : a.nom.localeCompare(b.nom, 'fr'));
  }
  return groupes;
}

/** Adresse https, clé et prénom remplis */
export function reglagesComplets(r) {
  return !!r && /^https:\/\//.test(r.url || '') && !!(r.cle || '').trim() && !!(r.prenom || '').trim();
}

/* ---------- Liste de courses ---------- */

/** Même règle que google/courses.gs : minuscules, sans accents, œ → oe, æ → ae, espaces simples */
export function normaliser(nom) {
  if (nom === null || nom === undefined) return '';
  return String(nom).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function mots(nomNormalise) {
  return String(nomNormalise).split(/[\s\-']+/).filter(m => m !== '')
    .map(m => (m.length > 3 ? m.replace(/[sx]$/, '') : m));
}

/** Chaque mot de l'article est un mot du nom du stock (copie de la règle du script) */
export function contientTousLesMots(nomStockNormalise, nomArticleNormalise) {
  const article = mots(nomArticleNormalise);
  if (article.length === 0) return false;
  const stock = mots(nomStockNormalise);
  return article.every(m => stock.includes(m));
}

/** Ce qu'il reste à la maison pour un article, par unité ({ l: 1.2, paquet: 2 }) ; null si aucun produit */
export function badgeMaison(article, produits) {
  const nom = normaliser(article.nom);
  let total = null;
  for (const p of produits || []) {
    if (!contientTousLesMots(normaliser(p.nom), nom)) continue;
    const u = lireUnite(p.unite);
    total = total || {};
    total[u] = arrondi((total[u] || 0) + (Number(p.quantite) || 0));
  }
  return total;
}

/** null → '' ; tout à 0 → « plus rien » ; sinon « maison : 1 L · 2 paquets » (ordre de UNITES) */
export function texteBadge(maison) {
  if (maison === null || maison === undefined || typeof maison !== 'object') return '';
  const morceaux = UNITES.filter(u => Number(maison[u]) > 0).map(u => formaterQuantite(maison[u], u));
  return morceaux.length === 0 ? 'plus rien' : 'maison : ' + morceaux.join(' · ');
}

/** Unité proposée pour un article : celle du premier produit du stock qui correspond, sinon « unite » */
export function uniteParDefaut(nom, produits) {
  const n = normaliser(nom);
  const p = (produits || []).find(x => contientTousLesMots(normaliser(x.nom), n));
  return p ? lireUnite(p.unite) : 'unite';
}

const UNITES_TAPEES = { l: 'l', kg: 'kg', g: 'kg', paquet: 'paquet', paquets: 'paquet' };

/**
 * « Lait x2 », « Lait 3L », « Pâtes 1,5kg », « Viande 500g », « Mouchoirs 2 paquets » →
 * { nom, quantite, unite } ; sans quantité : 1 dans uniteDefaut ; null si vide.
 * Une quantité impossible pour son unité laisse le texte entier comme nom.
 */
export function lireArticle(texte, uniteDefaut = 'unite') {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const defaut = lireUnite(uniteDefaut);
  const m = /^(.*?)\s*(?:[x×]\s*(\d{1,2})|(\d+(?:[.,]\d+)?)\s*(l|kg|g|paquets?))$/i.exec(t);
  if (m && m[1].trim()) {
    const nom = m[1].trim().slice(0, 63);
    if (m[2] !== undefined) {
      const q = quantiteValide(Number(m[2]), defaut, false);
      if (q !== null) return { nom, quantite: q, unite: defaut };
    } else {
      const tapee = m[4].toLowerCase();
      const unite = UNITES_TAPEES[tapee];
      let q = Number(m[3].replace(',', '.'));
      if (tapee === 'g') q = q / 1000;
      const v = quantiteValide(q, unite, false);
      if (v !== null) return { nom, quantite: v, unite };
    }
  }
  return { nom: t.slice(0, 63), quantite: 1, unite: defaut };
}

/** Sépare les articles à acheter et ceux déjà dans le panier, dans l'ordre d'ajout */
export function separerListe(articles) {
  const aAcheter = [], panier = [];
  for (const a of articles || []) (a.coche ? panier : aAcheter).push(a);
  return { aAcheter, panier };
}

/* ---------- Opérations en attente (faites sans réseau) ---------- */
// { type: 'ajouter', id: 'local-…', nom, quantite, par } | { type: 'cocher', id, coche }
// | { type: 'supprimer', id } | { type: 'effacer' }

/** La liste telle que l'écran doit la montrer : celle du script + les opérations pas encore envoyées */
export function appliquerAttente(articles, attente, produits) {
  let liste = (articles || []).map(a => Object.assign({}, a));
  for (const op of attente || []) {
    if (op.type === 'ajouter') {
      liste.push({ id: op.id, nom: op.nom, quantite: op.quantite, unite: lireUnite(op.unite), coche: false, ajoute_par: op.par,
                   maison: badgeMaison(op, produits), enAttente: true });
    } else if (op.type === 'cocher') {
      const a = liste.find(x => x.id === op.id);
      if (a) { a.coche = op.coche; a.enAttente = true; }
    } else if (op.type === 'supprimer') {
      liste = liste.filter(x => x.id !== op.id);
    } else if (op.type === 'effacer') {
      liste = liste.filter(x => !x.coche);
    }
  }
  return liste;
}

/** Erreur passagère du script (verrou occupé, page d'erreur de Google, quota) : on réessaiera plus tard */
export function erreurPassagere(message) {
  return /lock|illisible|too many|timeout|temporar/i.test(String(message || ''));
}

/** Après l'envoi d'un ajout : les opérations suivantes visent l'identifiant donné par le script */
export function remplacerId(attente, ancien, nouveau) {
  return attente.map(op => (op.id === ancien ? Object.assign({}, op, { id: nouveau }) : op));
}

/** Corps POST d'une opération */
export function corpsOperation(op) {
  // client : le script reconnaît une demande renvoyée deux fois (réponse perdue) et n'ajoute pas l'article en double
  if (op.type === 'ajouter') return { action: 'ajouter_course', nom: op.nom, quantite: op.quantite, unite: lireUnite(op.unite), par: op.par, client: op.id };
  if (op.type === 'cocher') return { action: 'cocher_course', id: op.id, coche: op.coche };
  if (op.type === 'supprimer') return { action: 'supprimer_course', id: op.id };
  return { action: 'effacer_coches' };
}

/* ---------- Ticket de caisse ---------- */

/** Dimensions réduites pour que le plus grand côté fasse au plus max pixels (jamais agrandies) */
export function dimensionsReduites(l, h, max = 1600) {
  const plusGrand = Math.max(l, h);
  if (plusGrand <= max) return { l, h };
  const r = max / plusGrand;
  return { l: Math.round(l * r), h: Math.round(h * r) };
}

/** Produits gardés pour le stock : cochés et non ignorés */
export function produitsRetenus(produits, coches) {
  return (produits || [])
    .filter((p, i) => !p.ignorer && coches[i])
    .map(p => ({ nom: p.nom, endroit: p.endroit, quantite: p.quantite, unite: lireUnite(p.unite) }));
}

/** Articles de la liste qui seront rayés (même règle que le script) */
export function articlesRayes(articles, retenus) {
  const noms = retenus.map(p => normaliser(p.nom));
  return (articles || []).filter(a => noms.some(n => contientTousLesMots(n, normaliser(a.nom))));
}

/** Endroit suivant (toucher l'endroit d'un produit le fait tourner) */
export function endroitSuivant(e) {
  const i = ENDROITS.indexOf(e);
  return ENDROITS[(i + 1) % ENDROITS.length];
}

/**
 * Après la lecture du ticket : un produit dont l'unité diffère de celle du produit du stock (même nom
 * normalisé, même endroit) devient « à préciser », dans l'unité du stock, sans quantité.
 */
export function preparerLecture(lu, produitsStock) {
  for (const p of lu.produits || []) {
    const s = (produitsStock || []).find(x => normaliser(x.nom) === normaliser(p.nom) && x.endroit === p.endroit);
    if (s && lireUnite(s.unite) !== lireUnite(p.unite)) {
      p.unite = lireUnite(s.unite);
      p.quantite = null;
      p.a_preciser = true;
    }
  }
  return lu;
}

/** Le script a refusé ces noms pour leur unité : à préciser dans l'unité du stock */
export function marquerAPreciser(produits, noms, unites) {
  (noms || []).forEach((nom, i) => {
    for (const p of produits || []) {
      if (normaliser(p.nom) === normaliser(nom)) { p.unite = lireUnite(unites[i]); p.quantite = null; p.a_preciser = true; }
    }
  });
  return produits;
}

/** Au moins un produit retenu, et tous les produits retenus ont une quantité */
export function ticketValidable(produits, coches) {
  const retenus = (produits || []).filter((p, i) => !p.ignorer && coches[i]);
  return retenus.length > 0 && retenus.every(p => p.quantite !== null && p.quantite !== undefined);
}
