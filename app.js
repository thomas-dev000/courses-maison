// L'appli : état, navigation, rafraîchissement (toutes les 10 s quand la page est visible)
//
// Hors réseau : la liste de courses reste utilisable. Ajouts, coches et suppressions vont dans une
// file d'attente gardée sur le téléphone (courses.attente) et partent dès que le réseau revient.
// Le stock (« − ») et le ticket demandent le réseau : ils modifient le stock partagé.

import { reglages, enregistrerReglages, dernierEtat, garderEtat, lire, ecrire } from './api.js';
import { reglagesComplets, lireArticle, appliquerAttente, remplacerId, corpsOperation, produitsRetenus,
         endroitSuivant, dateCourte } from './logique.js';
import { vueReglages, vueStock, vueListe, vueTicket, demander, message } from './vues.js';
import { photographier, reduireEnJpeg } from './ticket.js';

const RAFRAICHISSEMENT_MS = 10000;
const CLE_ATTENTE = 'courses.attente';

function lireAttente() {
  try { return JSON.parse(localStorage.getItem(CLE_ATTENTE)) || []; } catch (e) { return []; }
}

const etat = {
  vue: 'liste',                // 'liste' | 'stock' | 'ticket' | 'reglages'
  endroit: 'frigo',
  donnees: dernierEtat(),      // { articles, produits, maj } — dernier état lu (gardé hors ligne)
  attente: lireAttente(),      // opérations de la liste pas encore envoyées
  horsLigne: false,
  ecrituresStock: 0,           // écritures du stock en cours : on ne réaffiche pas une lecture plus ancienne
  envoiEnCours: false,
  envois: 0,                   // opérations envoyées : une lecture commencée avant est périmée
  ticket: { phase: 'depart' }, // voir vueTicket
};

const contenu = () => document.getElementById('contenu');

function garderAttente() {
  try { localStorage.setItem(CLE_ATTENTE, JSON.stringify(etat.attente)); } catch (e) { /* plein */ }
}

/* ---------- File d'attente de la liste ---------- */

/** Envoie les opérations en attente, dans l'ordre ; s'arrête au premier problème de réseau */
async function viderAttente() {
  if (etat.envoiEnCours) return;
  etat.envoiEnCours = true;
  try {
    while (etat.attente.length > 0) {
      const op = etat.attente[0];
      try {
        const r = await ecrire(corpsOperation(op));
        etat.attente.shift();
        etat.envois++;
        if (op.type === 'ajouter' && r.id) etat.attente = remplacerId(etat.attente, op.id, r.id);
      } catch (e) {
        if (e.horsLigne) { etat.horsLigne = true; break; }
        etat.attente.shift();             // refusée par le script (article supprimé entre-temps…) : on l'oublie
        if (op.type !== 'cocher') message('Non enregistré : ' + e.message);
      }
      garderAttente();
    }
  } finally {
    etat.envoiEnCours = false;
  }
}

function ajouterOperation(op) {
  etat.attente.push(op);
  garderAttente();
  afficher();
  relire();
}

/* ---------- Lecture ---------- */

async function relire() {
  if (!reglagesComplets(reglages())) return;
  await viderAttente();
  const stockAvant = etat.ecrituresStock;
  const envoisAvant = etat.envois;
  try {
    const r = await lire('etat');
    etat.horsLigne = false;
    if (etat.ecrituresStock === 0 && stockAvant === 0 && etat.envois === envoisAvant) {
      etat.donnees = { articles: r.articles, produits: r.produits, maj: r.maj };
      garderEtat(etat.donnees);
    }
  } catch (e) {
    etat.horsLigne = !!e.horsLigne;
    if (!e.horsLigne) message(e.message);
  }
  afficher();
}

/**
 * Écriture du stock (réseau obligatoire) : l'écran est déjà à jour ; en cas d'échec, annuler()
 * remet l'affichage d'avant. Renvoie true si c'est enregistré.
 */
async function ecrireStock(corps, annuler) {
  etat.ecrituresStock++;
  let ok = true;
  try {
    await ecrire(corps);
  } catch (e) {
    ok = false;
    if (annuler) annuler();
    if (etat.donnees) garderEtat(etat.donnees);
    message(e.horsLigne ? 'Pas de réseau : rien n\'a été enregistré' : 'Impossible d\'enregistrer : ' + e.message);
  } finally {
    etat.ecrituresStock--;
  }
  relire();
  return ok;
}

/* ---------- Actions ---------- */

function nouvelArticle(nom, quantite) {
  ajouterOperation({ type: 'ajouter', id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                     nom, quantite, par: reglages().prenom });
}

async function retirerUn(p) {
  const avant = p.quantite;
  p.quantite = Math.max(0, avant - 1);
  garderEtat(etat.donnees);
  afficher();
  const envoi = ecrireStock({ action: 'retirer_unite', id: p.id }, () => { p.quantite = avant; });
  if (p.quantite > 0) return;
  const ajouter = await demander('Plus de « ' + p.nom + ' » ?', 'Ajouter à la liste de courses ?', 'Ajouter');
  if (ajouter && await envoi) nouvelArticle(p.nom, 1);
}

const actionsListe = {
  surAjouter: (texte) => {
    const a = lireArticle(texte);
    if (!a) return false;
    nouvelArticle(a.nom, a.quantite);
    return true;
  },
  surCocher: (a) => ajouterOperation({ type: 'cocher', id: a.id, coche: !a.coche }),
  surSupprimer: async (a) => {
    if (await demander('Supprimer « ' + a.nom + ' » ?', 'Il sera retiré de la liste de tout le monde.', 'Supprimer')) {
      ajouterOperation({ type: 'supprimer', id: a.id });
    }
  },
  surEffacer: async () => {
    if (await demander('Effacer le panier ?', 'Les articles cochés seront retirés de la liste.', 'Effacer')) {
      ajouterOperation({ type: 'effacer' });
    }
  },
  surScanner: () => { etat.vue = 'ticket'; afficher(); actionsTicket.surPhoto(); },
};

/* ---------- Ticket ---------- */

const actionsTicket = {
  surPhoto: async () => {
    const fichier = await photographier();
    if (!fichier) return;
    etat.ticket = { phase: 'lecture' };
    afficher();
    try {
      const image = await reduireEnJpeg(fichier);
      const lu = await ecrire({ action: 'lire_ticket', image });
      etat.ticket = { phase: 'confirmation', lu, coches: lu.produits.map(p => !p.ignorer) };
    } catch (e) {
      etat.ticket = { phase: 'depart' };
      message(e.horsLigne ? 'Pas de réseau : le scan du ticket en demande'
        : e.message === 'lecture' ? 'Impossible de lire ce ticket, réessaie avec une photo plus nette'
        : e.message === 'gemini_occupe' ? 'Gemini est surchargé en ce moment, réessaie dans une minute'
        : e.message === 'gemini' ? 'Gemini a refusé : ' + ((e.reponse && e.reponse.detail) || 'raison inconnue').slice(0, 120)
        : 'Lecture impossible : ' + e.message);
    }
    afficher();
  },
  surCocher: (i) => {
    const t = etat.ticket;
    const p = t.lu.produits[i];
    if (p.ignorer) { p.ignorer = false; t.coches[i] = true; } else { t.coches[i] = !t.coches[i]; }
    afficher();
  },
  surEndroit: (i) => {
    const p = etat.ticket.lu.produits[i];
    p.endroit = endroitSuivant(p.endroit);
    afficher();
  },
  surAnnuler: () => { etat.ticket = { phase: 'depart' }; afficher(); },
  surValider: async () => {
    const t = etat.ticket;
    const lu = t.lu;
    let forcer = false;
    if (lu.doublon) {
      forcer = await demander('Ticket déjà ajouté ?', 'Il ressemble à celui ajouté le ' + dateCourte(lu.doublon)
        + '. Deux passages en caisse le même jour ?', 'Ajouter quand même', 'Annuler');
      if (!forcer) return;
    }
    const produits = produitsRetenus(lu.produits, t.coches);
    t.phase = 'envoi';
    afficher();
    try {
      const r = await ecrire({ action: 'ajouter_stock', produits, forcer,
                               ticket: { date: lu.date, magasin: lu.magasin, total: lu.total } });
      etat.ticket = { phase: 'depart' };
      etat.vue = 'liste';
      message(r.ajoutes + ' produit' + (r.ajoutes > 1 ? 's' : '') + ' ajouté' + (r.ajoutes > 1 ? 's' : '') + ' au stock'
        + (r.retires && r.retires.length ? ' · ' + r.retires.length + ' rayé' + (r.retires.length > 1 ? 's' : '') + ' de la liste' : ''), 'ok');
    } catch (e) {
      t.phase = 'confirmation';
      if (e.reponse && e.reponse.erreur === 'doublon') {
        lu.doublon = e.reponse.deja_le;               // repéré par le script : on redemande
        afficher();
        return actionsTicket.surValider();
      }
      message(e.horsLigne ? 'Pas de réseau : rien n’a été ajouté' : 'Impossible d’ajouter : ' + e.message);
    }
    afficher();
    relire();
  },
};

/* ---------- Affichage ---------- */

function enTete() {
  const r = reglages();
  document.getElementById('sous-titre').textContent = r.prenom ? 'Liste partagée · ' + r.prenom : '';
  const pastille = document.getElementById('etat');
  const n = etat.attente.length;
  pastille.textContent = etat.horsLigne ? (n > 0 ? 'Hors ligne · ' + n + ' en attente' : 'Hors ligne')
    : n > 0 ? 'Envoi…' : (etat.donnees ? 'À jour' : '…');
  pastille.classList.toggle('vide', etat.horsLigne);
  for (const b of document.querySelectorAll('#vues button')) {
    const actif = b.dataset.vue === etat.vue;
    b.classList.toggle('on', actif);
    b.setAttribute('aria-selected', actif ? 'true' : 'false');
  }
  document.getElementById('vues').hidden = etat.vue === 'reglages';
}

function afficher() {
  enTete();
  const c = contenu();
  // garder la saisie en cours et le défilement quand la liste se rafraîchit
  const champ = c.querySelector('.ajout input');
  const saisie = champ ? champ.value : '';
  const focus = champ && document.activeElement === champ;
  const defilement = window.scrollY;
  c.replaceChildren();

  if (etat.vue === 'reglages') {
    const premier = !reglagesComplets(reglages());
    c.append(vueReglages(reglages(), {
      premierLancement: premier,
      surTester: async (r) => {
        if (!reglagesComplets(r)) return 'Remplis les trois champs (adresse en https).';
        try {
          const rep = await lire('stock', {}, r);
          return 'Ça marche : ' + rep.produits.length + ' produits dans le stock.';
        } catch (e) {
          return 'Échec : ' + e.message;
        }
      },
      surEnregistrer: (r, resultat) => {
        if (!reglagesComplets(r)) { resultat.textContent = 'Remplis les trois champs (adresse en https).'; return; }
        enregistrerReglages(r);
        etat.vue = 'liste';
        afficher();
        relire();
      },
    }));
    return;
  }
  const donnees = etat.donnees || {};
  if (etat.vue === 'liste') {
    c.append(vueListe(appliquerAttente(donnees.articles, etat.attente, donnees.produits), actionsListe));
    const nouveau = c.querySelector('.ajout input');
    nouveau.value = saisie;
    if (focus) nouveau.focus();
  } else if (etat.vue === 'stock') {
    c.append(vueStock(donnees.produits || [], etat.endroit, {
      surEndroit: (e) => { etat.endroit = e; afficher(); },
      surMoins: retirerUn,
    }));
  } else {
    c.append(vueTicket(etat.ticket, donnees.articles || [], actionsTicket));
  }
  window.scrollTo(0, defilement);
}

/* ---------- Démarrage ---------- */

function demarrer() {
  for (const b of document.querySelectorAll('#vues button')) {
    b.addEventListener('click', () => { etat.vue = b.dataset.vue; afficher(); });
  }
  document.getElementById('bouton-reglages').addEventListener('click', () => {
    etat.vue = etat.vue === 'reglages' && reglagesComplets(reglages()) ? 'liste' : 'reglages';
    afficher();
  });
  if (!reglagesComplets(reglages())) etat.vue = 'reglages';
  afficher();
  relire();

  setInterval(() => { if (document.visibilityState === 'visible') relire(); }, RAFRAICHISSEMENT_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') relire(); });
  window.addEventListener('online', relire);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

demarrer();
