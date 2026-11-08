import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dimensionsReduites, produitsRetenus, articlesRayes, endroitSuivant } from '../logique.js';

test('dimensionsReduites', () => {
  assert.deepEqual(dimensionsReduites(4000, 3000), { l: 1600, h: 1200 });
  assert.deepEqual(dimensionsReduites(3000, 4000), { l: 1200, h: 1600 });
  assert.deepEqual(dimensionsReduites(800, 600), { l: 800, h: 600 });
});

test('produitsRetenus ignore les décochés et les « ignorer »', () => {
  const p = [
    { nom: 'Lait', endroit: 'frigo', quantite: 2, ignorer: false, ligne_ticket: 'LAIT' },
    { nom: 'Sac', endroit: 'placard', quantite: 1, ignorer: true },
    { nom: 'Café', endroit: 'placard', quantite: 1, ignorer: false },
  ];
  assert.deepEqual(produitsRetenus(p, [true, true, false]), [{ nom: 'Lait', endroit: 'frigo', quantite: 2 }]);
});

test('articlesRayes : même règle de mots que le script', () => {
  const rayes = articlesRayes([{ nom: 'lait' }, { nom: 'pain' }, { nom: 'œufs' }],
                              [{ nom: 'Lait demi-écrémé' }, { nom: 'Oeufs frais' }]);
  assert.deepEqual(rayes.map(a => a.nom), ['lait', 'œufs']);
});

test('endroitSuivant tourne', () => {
  assert.equal(endroitSuivant('frigo'), 'congelateur');
  assert.equal(endroitSuivant('entretien'), 'frigo');
});
