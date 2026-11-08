import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITES, estDecimale, formaterQuantite, lireQuantite, texteBadge, badgeMaison, uniteParDefaut,
         lireArticle, corpsOperation, produitsRetenus } from '../logique.js';

test('unités', () => {
  assert.deepEqual(UNITES, ['l', 'kg', 'paquet', 'unite']);
  assert.equal(estDecimale('kg'), true);
  assert.equal(estDecimale('unite'), false);
});

test('formaterQuantite : virgule française, sans zéros inutiles', () => {
  assert.equal(formaterQuantite(3, 'l'), '3 L');
  assert.equal(formaterQuantite(1.5, 'l'), '1,5 L');
  assert.equal(formaterQuantite(0.75, 'l'), '0,75 L');
  assert.equal(formaterQuantite(0.1 + 0.2, 'kg'), '0,3 kg');
  assert.equal(formaterQuantite(1.2, 'kg'), '1,2 kg');
  assert.equal(formaterQuantite(1, 'paquet'), '1 paquet');
  assert.equal(formaterQuantite(2, 'paquet'), '2 paquets');
  assert.equal(formaterQuantite(6, 'unite'), '×6');
  assert.equal(formaterQuantite(6, undefined), '×6');
});

test('lireQuantite : virgule ou point, selon l\'unité', () => {
  assert.equal(lireQuantite('1,2', 'kg'), 1.2);
  assert.equal(lireQuantite(' 1.25 ', 'kg'), 1.25);
  assert.equal(lireQuantite('.5', 'l'), 0.5);
  assert.equal(lireQuantite(',5', 'l'), 0.5);
  assert.equal(lireQuantite('1,234', 'kg'), 1.23);
  assert.equal(lireQuantite('1,5', 'paquet'), null);
  assert.equal(lireQuantite('3', 'paquet'), 3);
  assert.equal(lireQuantite('0', 'kg'), null);
  assert.equal(lireQuantite('0', 'kg', true), 0);
  assert.equal(lireQuantite('100', 'unite'), null);
  assert.equal(lireQuantite('abc', 'kg'), null);
  assert.equal(lireQuantite('', 'kg'), null);
  assert.equal(lireQuantite('1,2,3', 'kg'), null);
});

test('pastille maison par unité', () => {
  assert.equal(texteBadge(null), '');
  assert.equal(texteBadge({ l: 1, paquet: 2 }), 'maison : 1 L · 2 paquets');
  assert.equal(texteBadge({ paquet: 2, l: 1 }), 'maison : 1 L · 2 paquets');
  assert.equal(texteBadge({ kg: 0 }), 'plus rien');
  assert.equal(texteBadge({ kg: 0, l: 2 }), 'maison : 2 L');
  const ps = [{ nom: 'Lait demi-écrémé', quantite: 1, unite: 'l' }, { nom: 'Lait en poudre', quantite: 2, unite: 'paquet' },
              { nom: 'Lait bio', quantite: 0.2, unite: 'l' }];
  assert.deepEqual(badgeMaison({ nom: 'lait' }, ps), { l: 1.2, paquet: 2 });
  assert.equal(badgeMaison({ nom: 'riz' }, ps), null);
  assert.equal(uniteParDefaut('Lait', ps), 'l');
  assert.equal(uniteParDefaut('Riz', ps), 'unite');
});

test('lireArticle : quantité et unité en fin de texte', () => {
  assert.deepEqual(lireArticle('Lait 3L', 'unite'), { nom: 'Lait', quantite: 3, unite: 'l' });
  assert.deepEqual(lireArticle('Lait 3 l', 'unite'), { nom: 'Lait', quantite: 3, unite: 'l' });
  assert.deepEqual(lireArticle('Pâtes 1,5kg', 'unite'), { nom: 'Pâtes', quantite: 1.5, unite: 'kg' });
  assert.deepEqual(lireArticle('Viande 500g', 'unite'), { nom: 'Viande', quantite: 0.5, unite: 'kg' });
  assert.deepEqual(lireArticle('Mouchoirs 2 paquets', 'unite'), { nom: 'Mouchoirs', quantite: 2, unite: 'paquet' });
  assert.deepEqual(lireArticle('Mouchoirs 1 paquet', 'unite'), { nom: 'Mouchoirs', quantite: 1, unite: 'paquet' });
  assert.deepEqual(lireArticle('Lait x2', 'l'), { nom: 'Lait', quantite: 2, unite: 'l' });
  assert.deepEqual(lireArticle('Lait', 'l'), { nom: 'Lait', quantite: 1, unite: 'l' });
  assert.deepEqual(lireArticle('Mouchoirs 1,5 paquets', 'unite'), { nom: 'Mouchoirs 1,5 paquets', quantite: 1, unite: 'unite' });
  assert.deepEqual(lireArticle('3L', 'unite'), { nom: '3L', quantite: 1, unite: 'unite' });
  assert.equal(lireArticle('  ', 'unite'), null);
});

test('les opérations et le ticket gardent l\'unité', () => {
  assert.deepEqual(corpsOperation({ type: 'ajouter', id: 'local-1', nom: 'Lait', quantite: 3, unite: 'l', par: 'T' }),
                   { action: 'ajouter_course', nom: 'Lait', quantite: 3, unite: 'l', par: 'T' });
  assert.deepEqual(produitsRetenus([{ nom: 'Pâtes', endroit: 'placard', quantite: 1, unite: 'kg', ignorer: false }], [true]),
                   [{ nom: 'Pâtes', endroit: 'placard', quantite: 1, unite: 'kg' }]);
});

test('preparerLecture : unité différente de celle du stock → quantité à préciser', async () => {
  const { preparerLecture } = await import('../logique.js');
  const stock = [{ nom: 'Pâtes', endroit: 'placard', quantite: 1.5, unite: 'kg' }];
  const lu = { produits: [
    { nom: 'pates', endroit: 'placard', quantite: 2, unite: 'paquet', a_preciser: false, ignorer: false },
    { nom: 'Pâtes', endroit: 'frigo', quantite: 2, unite: 'paquet', a_preciser: false, ignorer: false },
    { nom: 'Pâtes', endroit: 'placard', quantite: 0.5, unite: 'kg', a_preciser: false, ignorer: false }] };
  const r = preparerLecture(lu, stock);
  assert.deepEqual([r.produits[0].a_preciser, r.produits[0].unite, r.produits[0].quantite], [true, 'kg', null]);
  assert.deepEqual([r.produits[1].a_preciser, r.produits[1].unite, r.produits[1].quantite], [false, 'paquet', 2]);
  assert.deepEqual([r.produits[2].a_preciser, r.produits[2].quantite], [false, 0.5]);
});

test('marquerAPreciser : produits refusés par le script pour leur unité', async () => {
  const { marquerAPreciser } = await import('../logique.js');
  const produits = [{ nom: 'Pâtes', unite: 'paquet', quantite: 2, a_preciser: false }, { nom: 'Riz', unite: 'kg', quantite: 1 }];
  marquerAPreciser(produits, ['pates'], ['kg']);
  assert.deepEqual([produits[0].a_preciser, produits[0].unite, produits[0].quantite], [true, 'kg', null]);
  assert.equal(produits[1].quantite, 1);
});

test('ticketValidable : un produit coché doit avoir sa quantité', async () => {
  const { ticketValidable } = await import('../logique.js');
  const p = [{ nom: 'A', quantite: null, a_preciser: true, ignorer: false }, { nom: 'B', quantite: 1, ignorer: false }];
  assert.equal(ticketValidable(p, [true, true]), false);
  assert.equal(ticketValidable(p, [false, true]), true);
  assert.equal(ticketValidable(p, [false, false]), false);
});
