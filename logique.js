// Logique pure de l'appli (sans navigateur), testée par test/logique.test.js

export const ENDROITS = ['frigo', 'congelateur', 'placard', 'entretien'];

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

/** Ce qu'il reste à la maison pour un article : somme des quantités, null si inconnu */
export function badgeMaison(article, produits) {
  const nom = normaliser(article.nom);
  let total = null;
  for (const p of produits || []) {
    if (contientTousLesMots(normaliser(p.nom), nom)) total = (total || 0) + (Number(p.quantite) || 0);
  }
  return total;
}

export function texteBadge(maison) {
  if (maison === null || maison === undefined) return '';
  return maison === 0 ? 'plus rien' : 'maison : ' + maison;
}

/** « Lait x2 » → { nom: 'Lait', quantite: 2 } ; sans « xN » : quantité 1 ; null si vide */
export function lireArticle(texte) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)\s*[x×]\s*(\d{1,2})$/i.exec(t);
  const nom = (m && m[1].trim()) ? m[1].trim() : t;
  const quantite = m && m[1].trim() ? Math.min(99, Math.max(1, Number(m[2]))) : 1;
  return nom ? { nom: nom.slice(0, 63), quantite } : null;
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
      liste.push({ id: op.id, nom: op.nom, quantite: op.quantite, coche: false, ajoute_par: op.par,
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

/** Après l'envoi d'un ajout : les opérations suivantes visent l'identifiant donné par le script */
export function remplacerId(attente, ancien, nouveau) {
  return attente.map(op => (op.id === ancien ? Object.assign({}, op, { id: nouveau }) : op));
}

/** Corps POST d'une opération */
export function corpsOperation(op) {
  if (op.type === 'ajouter') return { action: 'ajouter_course', nom: op.nom, quantite: op.quantite, par: op.par };
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
    .map(p => ({ nom: p.nom, endroit: p.endroit, quantite: p.quantite }));
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
