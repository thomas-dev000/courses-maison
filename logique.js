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
