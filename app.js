// L'appli : état, navigation, rafraîchissement (toutes les 10 s quand la page est visible)

import { reglages, enregistrerReglages, dernierEtat, garderEtat, lire, ecrire } from './api.js';
import { reglagesComplets } from './logique.js';
import { el, vueReglages, vueStock, demander, message } from './vues.js';

const RAFRAICHISSEMENT_MS = 10000;

const etat = {
  vue: 'stock',                // 'liste' | 'stock' | 'ticket' | 'reglages'
  endroit: 'frigo',
  donnees: dernierEtat(),      // { produits: [...], maj } — dernier état lu (gardé hors ligne)
  horsLigne: false,
  enAttente: 0,                // écritures en cours : on ne réaffiche pas une lecture plus ancienne
};

const contenu = () => document.getElementById('contenu');

/* ---------- Lecture ---------- */

async function relire() {
  if (!reglagesComplets(reglages())) return;
  const depart = etat.enAttente;
  try {
    const r = await lire('stock');
    etat.horsLigne = false;
    if (etat.enAttente === 0 && depart === 0) {
      etat.donnees = { produits: r.produits, maj: r.maj };
      garderEtat(etat.donnees);
    }
  } catch (e) {
    etat.horsLigne = !!e.horsLigne;
    if (!e.horsLigne) message(e.message);
  }
  afficher();
}

/** Écriture optimiste : l'écran est déjà à jour ; en cas d'échec, on relit l'état confirmé */
async function envoyer(corps) {
  etat.enAttente++;
  try {
    await ecrire(corps);
  } catch (e) {
    message(e.horsLigne ? 'Pas de réseau : rien n\'a été enregistré' : 'Impossible d\'enregistrer : ' + e.message);
  } finally {
    etat.enAttente--;
  }
  relire();
}

/* ---------- Actions ---------- */

async function retirerUn(p) {
  p.quantite = Math.max(0, p.quantite - 1);
  garderEtat(etat.donnees);
  afficher();
  const fini = p.quantite === 0;
  const envoi = envoyer({ action: 'retirer_unite', id: p.id });
  if (fini && await demander('Plus de « ' + p.nom + ' » ?', 'Ajouter à la liste de courses ?', 'Ajouter')) {
    await envoi;
    envoyer({ action: 'ajouter_course', nom: p.nom, quantite: 1, par: reglages().prenom });
    message('« ' + p.nom + ' » ajouté à la liste');
  }
}

/* ---------- Affichage ---------- */

function enTete() {
  const r = reglages();
  document.getElementById('sous-titre').textContent = r.prenom ? 'Liste partagée · ' + r.prenom : '';
  const pastille = document.getElementById('etat');
  pastille.textContent = etat.horsLigne ? 'Hors ligne' : (etat.donnees ? 'À jour' : '…');
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
        etat.vue = 'stock';
        afficher();
        relire();
      },
    }));
    return;
  }
  if (etat.vue === 'stock') {
    c.append(vueStock(etat.donnees ? etat.donnees.produits : [], etat.endroit, {
      surEndroit: (e) => { etat.endroit = e; afficher(); },
      surMoins: retirerUn,
    }));
    return;
  }
  c.append(el('p', { class: 'vide' }, 'Bientôt'));
}

/* ---------- Démarrage ---------- */

function demarrer() {
  for (const b of document.querySelectorAll('#vues button')) {
    b.addEventListener('click', () => { etat.vue = b.dataset.vue; afficher(); });
  }
  document.getElementById('bouton-reglages').addEventListener('click', () => {
    etat.vue = etat.vue === 'reglages' && reglagesComplets(reglages()) ? 'stock' : 'reglages';
    afficher();
  });
  if (!reglagesComplets(reglages())) etat.vue = 'reglages';
  afficher();
  relire();

  setInterval(() => { if (document.visibilityState === 'visible') relire(); }, RAFRAICHISSEMENT_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') relire(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

demarrer();
