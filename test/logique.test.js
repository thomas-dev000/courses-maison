import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regrouperParEndroit, dateCourte, libelleEndroit, reglagesComplets } from '../logique.js';

test('regrouperParEndroit : quantité 0 exclue, plus récents d\'abord puis par nom', () => {
  const g = regrouperParEndroit([
    { id: 'a', nom: 'Lait', endroit: 'frigo', quantite: 0, achete_le: '2026-11-08' },
    { id: 'b', nom: 'Yaourts', endroit: 'frigo', quantite: 4, achete_le: '2026-11-02' },
    { id: 'c', nom: 'Beurre', endroit: 'frigo', quantite: 1, achete_le: '2026-11-08' },
    { id: 'd', nom: 'Œufs', endroit: 'frigo', quantite: 6, achete_le: '2026-11-08' },
    { id: 'e', nom: 'Pâtes', endroit: 'placard', quantite: 2, achete_le: '2026-11-01' },
  ]);
  assert.deepEqual(g.frigo.map(p => p.id), ['c', 'd', 'b']);
  assert.deepEqual(g.placard.map(p => p.id), ['e']);
  assert.deepEqual(g.congelateur, []);
  assert.deepEqual(g.entretien, []);
});

test('dateCourte', () => {
  assert.equal(dateCourte('2026-12-17'), '17 déc.');
  assert.equal(dateCourte('2026-11-08'), '8 nov.');
  assert.equal(dateCourte('2026-05-01'), '1 mai');
  assert.equal(dateCourte('n\'importe quoi'), '');
});

test('libelleEndroit', () => {
  assert.equal(libelleEndroit('congelateur'), 'Congélateur');
  assert.equal(libelleEndroit('frigo'), 'Frigo');
  assert.equal(libelleEndroit('cave'), 'cave');
});

test('reglagesComplets', () => {
  assert.equal(reglagesComplets({ url: 'https://x', cle: 'abc', prenom: '' }), false);
  assert.equal(reglagesComplets({ url: 'https://x', cle: 'abc', prenom: 'Thomas' }), true);
  assert.equal(reglagesComplets({ url: 'http://x', cle: 'abc', prenom: 'Thomas' }), false);
  assert.equal(reglagesComplets(null), false);
});
