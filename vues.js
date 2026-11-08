// Construction des écrans (DOM), sans état : app.js leur passe les données et les actions

import { ENDROITS, libelleEndroit, dateCourte, regrouperParEndroit, separerListe, texteBadge,
         produitsRetenus, articlesRayes, UNITES, estDecimale, formaterQuantite, lireQuantite,
         ticketValidable } from './logique.js';

const NOMS_UNITES = { unite: 'unités', paquet: 'paquets', l: 'L', kg: 'kg' };

/** el('div', {class:'x', onclick: f}, enfant, 'texte', …) */
export function el(balise, attributs = {}, ...enfants) {
  const n = document.createElement(balise);
  for (const [k, v] of Object.entries(attributs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

/* ---------- Réglages ---------- */

export function vueReglages(r, { surTester, surEnregistrer, premierLancement }) {
  const url = el('input', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: r.url, autocomplete: 'off' });
  const cle = el('input', { type: 'password', placeholder: 'Clé de la maison', value: r.cle, autocomplete: 'off' });
  const prenom = el('input', { type: 'text', placeholder: 'Ton prénom', value: r.prenom, autocomplete: 'given-name' });
  const resultat = el('p', { class: 'petit', role: 'status' });
  const valeurs = () => ({ url: url.value, cle: cle.value, prenom: prenom.value });

  return el('section', { class: 'reglages' },
    el('h2', {}, premierLancement ? 'Bienvenue' : 'Réglages'),
    premierLancement && el('p', { class: 'petit' },
      'À faire une fois sur ce téléphone : l\'adresse du script et la clé de la maison (demande-les à Thomas).'),
    el('label', {}, 'Adresse du script', url),
    el('label', {}, 'Clé', cle),
    el('label', {}, 'Prénom', prenom),
    resultat,
    el('div', { class: 'boutons' },
      el('button', { class: 'btn sur', type: 'button', onclick: async () => {
        resultat.textContent = 'Test en cours…';
        resultat.textContent = await surTester(valeurs());
      } }, 'Tester'),
      el('button', { class: 'btn acc', type: 'button', onclick: () => surEnregistrer(valeurs(), resultat) }, 'Enregistrer')));
}

/* ---------- Stock ---------- */

export function vueStock(produits, endroitCourant, { surEndroit, surMoins, surModifier }) {
  const groupes = regrouperParEndroit(produits);
  const segments = el('div', { class: 'seg seg-endroits', role: 'tablist' },
    ENDROITS.map(e => el('button', {
      type: 'button', role: 'tab', class: e === endroitCourant ? 'on' : '',
      'aria-selected': e === endroitCourant ? 'true' : 'false', onclick: () => surEndroit(e),
    }, libelleEndroit(e), el('span', { class: 'compte' }, groupes[e].length))));

  const liste = groupes[endroitCourant];
  return el('section', { class: 'stock' },
    segments,
    liste.length === 0
      ? el('p', { class: 'aucun' }, 'Aucun produit')
      : el('ul', { class: 'rangees' }, liste.map(p => el('li', { class: 'rang' },
          el('button', { class: 'textes modifier', type: 'button', 'aria-label': 'Modifier « ' + p.nom + ' »',
                         onclick: () => surModifier(p) },
            el('span', { class: 'nom' }, p.nom),
            el('span', { class: 'petit' }, 'acheté le ' + dateCourte(p.achete_le))),
          el('span', { class: 'badge' }, formaterQuantite(p.quantite, p.unite)),
          estDecimale(p.unite)
            ? el('span', { class: 'moins-absent', 'aria-hidden': 'true' })
            : el('button', { class: 'moins', type: 'button', 'aria-label': 'Retirer un « ' + p.nom + ' »',
                             onclick: () => surMoins(p) }, '−')))));
}

/* ---------- Fenêtre de question ---------- */

/** Fenêtre « titre / texte / Non / Oui » ; renvoie une promesse de true / false */
export function demander(titre, texte, oui = 'Oui', non = 'Non') {
  return new Promise(resolve => {
    const fermer = (valeur) => { voile.remove(); resolve(valeur); };
    const voile = el('div', { class: 'voile', onclick: (e) => { if (e.target === voile) fermer(false); } },
      el('div', { class: 'feuille', role: 'dialog', 'aria-modal': 'true' },
        el('h3', {}, titre),
        texte && el('p', { class: 'petit' }, texte),
        el('div', { class: 'boutons' },
          el('button', { class: 'btn sur', type: 'button', onclick: () => fermer(false) }, non),
          el('button', { class: 'btn acc', type: 'button', onclick: () => fermer(true) }, oui))));
    document.body.append(voile);
  });
}

/**
 * Fenêtre « quantité » : champ décimal et choix de l'unité ; promesse de { quantite, unite } ou null.
 * zeroPermis : 0 accepté (fenêtre « Modifier » du stock).
 */
export function demanderQuantite(titre, quantite, unite, zeroPermis = true) {
  return new Promise(resolve => {
    let choisie = UNITES.includes(unite) ? unite : 'unite';
    const champ = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Quantité',
                                value: quantite === null || quantite === undefined ? '' : String(quantite).replace('.', ',') });
    const enregistrer = el('button', { class: 'btn acc', type: 'button' }, 'Enregistrer');
    const boutonsUnite = UNITES.slice().reverse().map(u => el('button', { type: 'button', 'data-unite': u,
      onclick: () => { choisie = u; maj(); } }, NOMS_UNITES[u]));
    const maj = () => {
      for (const b of boutonsUnite) {
        const on = b.dataset.unite === choisie;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      enregistrer.disabled = lireQuantite(champ.value, choisie, zeroPermis) === null;
    };
    champ.addEventListener('input', maj);
    const fermer = (valeur) => { voile.remove(); resolve(valeur); };
    const valider = () => {
      const q = lireQuantite(champ.value, choisie, zeroPermis);
      if (q !== null) fermer({ quantite: q, unite: choisie });
    };
    enregistrer.addEventListener('click', valider);
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
    const voile = el('div', { class: 'voile', onclick: (e) => { if (e.target === voile) fermer(null); } },
      el('div', { class: 'feuille', role: 'dialog', 'aria-modal': 'true' },
        el('h3', {}, titre),
        el('label', { class: 'quantite' }, 'Quantité', champ),
        el('div', { class: 'seg seg-unites', role: 'group', 'aria-label': 'Unité' }, boutonsUnite),
        el('div', { class: 'boutons' },
          el('button', { class: 'btn sur', type: 'button', onclick: () => fermer(null) }, 'Annuler'),
          enregistrer)));
    document.body.append(voile);
    maj();
    champ.focus();
    champ.select();
  });
}

/* ---------- Bandeau de message ---------- */

let minuteurMessage = null;
export function message(texte, genre = 'erreur') {
  let b = document.getElementById('message');
  if (!b) {
    b = el('div', { id: 'message', role: 'alert' });
    document.body.append(b);
  }
  b.textContent = texte;
  b.className = genre;
  b.hidden = false;
  clearTimeout(minuteurMessage);
  minuteurMessage = setTimeout(() => { b.hidden = true; }, 3000);
}

/* ---------- Liste de courses ---------- */

const APPUI_LONG_MS = 550;

/** Appui long (ou clic droit) sur un élément → action ; un appui court reste un clic normal */
function appuiLong(n, action) {
  let minuteur = null;
  let long = false;
  const arreter = () => { clearTimeout(minuteur); minuteur = null; };
  n.addEventListener('pointerdown', () => {
    long = false;
    minuteur = setTimeout(() => { long = true; action(); }, APPUI_LONG_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) n.addEventListener(ev, arreter);
  n.addEventListener('contextmenu', (e) => { e.preventDefault(); arreter(); if (!long) action(); long = true; });
  n.addEventListener('click', (e) => { if (long) { e.stopImmediatePropagation(); e.preventDefault(); long = false; } }, true);
}

/** « Lait — 3 L », « Œufs — ×12 » ; « Pain » pour une seule unité */
function nomArticle(a) {
  const unite = a.unite || 'unite';
  return unite === 'unite' && Number(a.quantite) === 1 ? a.nom : a.nom + ' — ' + formaterQuantite(a.quantite, unite);
}

function rangeeArticle(a, { surCocher, surSupprimer }) {
  const badge = texteBadge(a.maison);
  const quoi = (!a.enAttente && a.ajoute_par) ? 'ajouté par ' + a.ajoute_par : '';
  const sous = [quoi, a.enAttente ? 'en attente d\'envoi' : ''].filter(Boolean).join(' · ');
  const r = el('li', { class: 'rang article' + (a.coche ? ' coche' : '') },
    el('button', { class: 'case-bouton', type: 'button', role: 'checkbox', 'aria-checked': a.coche ? 'true' : 'false',
                   'aria-label': (a.coche ? 'Décocher ' : 'Cocher ') + a.nom, onclick: () => surCocher(a) },
      el('span', { class: 'case' + (a.coche ? ' on' : '') }),
      el('span', { class: 'textes' },
        el('span', { class: 'nom' }, nomArticle(a)),
        sous && el('span', { class: 'petit' + (a.enAttente ? ' attente' : '') }, sous))),
    badge && !a.coche && el('span', { class: 'badge' + (badge === 'plus rien' ? ' vide' : '') }, badge));
  appuiLong(r, () => surSupprimer(a));
  return r;
}

export function vueListe(articles, { surAjouter, surCocher, surSupprimer, surEffacer, surScanner }) {
  const { aAcheter, panier } = separerListe(articles);
  const champ = el('input', { type: 'text', placeholder: 'Ajouter un article… (« Lait 3L »)', maxlength: '70',
                              enterkeyhint: 'done', autocomplete: 'off', 'aria-label': 'Nouvel article' });
  const ajouter = () => {
    const texte = champ.value;
    champ.value = '';                       // vidé avant : l'écran se reconstruit pendant l'ajout
    if (!surAjouter(texte)) champ.value = texte;
    const nouveau = document.querySelector('.ajout input');
    if (nouveau) nouveau.focus();
  };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });

  const actions = { surCocher, surSupprimer };
  return el('section', { class: 'liste' },
    el('div', { class: 'ajout' }, champ,
      el('button', { class: 'btn acc plus', type: 'button', 'aria-label': 'Ajouter', onclick: ajouter }, '+')),
    el('h2', { class: 'rubr' }, 'À acheter · ' + aAcheter.length),
    aAcheter.length === 0 ? el('p', { class: 'petit' }, 'Rien à acheter pour l\'instant.')
      : el('ul', { class: 'rangees' }, aAcheter.map(a => rangeeArticle(a, actions))),
    panier.length > 0 && el('div', { class: 'rubr-ligne' },
      el('h2', { class: 'rubr' }, 'Dans le panier · ' + panier.length),
      el('button', { class: 'lien', type: 'button', onclick: surEffacer }, 'Effacer le panier')),
    panier.length > 0 && el('ul', { class: 'rangees' }, panier.map(a => rangeeArticle(a, actions))),
    el('p', { class: 'petit aide' }, 'Appui long sur un article pour le supprimer.'),
    el('div', { class: 'espace' }),
    el('button', { class: 'btn acc scanner', type: 'button', onclick: surScanner }, 'Scanner le ticket de caisse'));
}

/* ---------- Ticket de caisse ---------- */

/**
 * t = { phase: 'depart' | 'lecture' | 'confirmation' | 'envoi', lu, coches }
 * lu = réponse de lire_ticket : { date, magasin, total, produits, doublon }
 */
export function vueTicket(t, articles, { surPhoto, surCocher, surEndroit, surQuantite, surAnnuler, surValider }) {
  if (t.phase === 'depart') {
    return el('section', { class: 'ticket depart' },
      el('h2', {}, 'Scanner un ticket'),
      el('p', { class: 'petit' }, 'Photographie le ticket bien à plat, en entier, avec assez de lumière. '
        + 'Les produits sont lus automatiquement, tu confirmes avant l\'ajout au stock.'),
      el('div', { class: 'espace' }),
      el('button', { class: 'btn acc scanner', type: 'button', onclick: surPhoto }, 'Prendre le ticket en photo'));
  }
  if (t.phase === 'lecture') {
    return el('section', { class: 'ticket attente-lecture', 'aria-busy': 'true' },
      el('div', { class: 'roue', 'aria-hidden': 'true' }),
      el('p', {}, 'Lecture du ticket…'),
      el('p', { class: 'petit' }, 'Quelques secondes.'));
  }

  const lu = t.lu;
  const retenus = produitsRetenus(lu.produits, t.coches);
  const rayes = articlesRayes(articles, retenus);
  const reconnus = lu.produits.filter(p => !p.ignorer).length;
  const titre = lu.date ? 'Ticket du ' + dateCourte(lu.date) : 'Ticket';
  const envoi = t.phase === 'envoi';

  const rangee = (p, i) => {
    const garde = t.coches[i] && !p.ignorer;
    return el('li', { class: 'rang produit' + (garde ? '' : ' ecarte') },
      el('button', { class: 'case-bouton', type: 'button', role: 'checkbox', 'aria-checked': garde ? 'true' : 'false',
                     'aria-label': (garde ? 'Retirer ' : 'Garder ') + p.nom, onclick: () => surCocher(i) },
        el('span', { class: 'case' + (garde ? ' on' : '') }),
        el('span', { class: 'textes' },
          el('span', { class: 'nom' }, p.nom),
          el('span', { class: 'petit ligne-ticket' }, p.ligne_ticket))),
      el('button', { class: 'endroit', type: 'button', 'aria-label': 'Endroit : ' + libelleEndroit(p.endroit) + ' (toucher pour changer)',
                     onclick: () => surEndroit(i) }, libelleEndroit(p.endroit)),
      p.ignorer ? el('span', { class: 'badge' }, 'ignoré')
        : el('button', { class: 'badge quantite' + (p.quantite === null ? ' a-preciser' : ''), type: 'button',
                         'aria-label': 'Quantité de ' + p.nom + ' (toucher pour changer)', onclick: () => surQuantite(i) },
             p.quantite === null ? 'Quantité à préciser' : formaterQuantite(p.quantite, p.unite)));
  };

  const rubriques = ENDROITS.map(e => {
    const indices = lu.produits.map((p, i) => i).filter(i => lu.produits[i].endroit === e);
    if (indices.length === 0) return null;
    return [el('h2', { class: 'rubr' }, libelleEndroit(e)),
            el('ul', { class: 'rangees' }, indices.map(i => rangee(lu.produits[i], i)))];
  });

  return el('section', { class: 'ticket confirmation' },
    el('h2', { class: 'titre-ticket' }, titre),
    el('p', { class: 'petit' }, [lu.magasin, reconnus + ' produit' + (reconnus > 1 ? 's' : '') + ' reconnu' + (reconnus > 1 ? 's' : ''),
                                 'décoche ce qui est faux'].filter(Boolean).join(' · ')),
    lu.doublon && el('p', { class: 'alerte' }, 'Ce ticket ressemble à celui ajouté le ' + dateCourte(lu.doublon) + '.'),
    rubriques,
    rayes.length > 0 && el('p', { class: 'petit rayes' },
      'Rayés de la liste de courses : ' + rayes.map(a => a.nom.toLowerCase()).join(', ') + '.'),
    el('div', { class: 'espace' }),
    el('div', { class: 'boutons bas' },
      el('button', { class: 'btn sur', type: 'button', onclick: surAnnuler, disabled: envoi }, 'Annuler'),
      el('button', { class: 'btn acc', type: 'button', onclick: surValider, disabled: envoi || !ticketValidable(lu.produits, t.coches) },
        envoi ? 'Ajout…' : 'Ajouter ' + retenus.length + ' produit' + (retenus.length > 1 ? 's' : '') + ' au stock')));
}
