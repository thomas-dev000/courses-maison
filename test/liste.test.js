import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteBadge, separerListe, lireArticle, badgeMaison, contientTousLesMots,
         appliquerAttente, remplacerId, corpsOperation } from '../logique.js';

test('texteBadge', () => {
  assert.equal(texteBadge(null), '');
  assert.equal(texteBadge({ unite: 0 }), 'plus rien');
  assert.equal(texteBadge({ unite: 2 }), 'maison : ×2');
});

test('separerListe garde l\'ordre', () => {
  const s = separerListe([{ id: 1, coche: false }, { id: 2, coche: true }, { id: 3, coche: false }]);
  assert.deepEqual(s.aAcheter.map(a => a.id), [1, 3]);
  assert.deepEqual(s.panier.map(a => a.id), [2]);
});

test('lireArticle : quantité « xN » à la fin', () => {
  assert.deepEqual(lireArticle('Lait x2'), { nom: 'Lait', quantite: 2, unite: 'unite' });
  assert.deepEqual(lireArticle('  œufs ×12 '), { nom: 'œufs', quantite: 12, unite: 'unite' });
  assert.deepEqual(lireArticle('Pain'), { nom: 'Pain', quantite: 1, unite: 'unite' });
  assert.deepEqual(lireArticle('x2'), { nom: 'x2', quantite: 1, unite: 'unite' });
  assert.equal(lireArticle('   '), null);
});

test('règle des mots (même que le script)', () => {
  assert.equal(contientTousLesMots('lait demi-ecreme', 'lait'), true);
  assert.equal(contientTousLesMots('laitue', 'lait'), false);
  assert.deepEqual(badgeMaison({ nom: 'Lait' }, [{ nom: 'Lait demi-écrémé', quantite: 1 }, { nom: 'Lait entier', quantite: 2 }]), { unite: 3 });
  assert.equal(badgeMaison({ nom: 'Riz' }, []), null);
});

test('appliquerAttente : ajout, coche, suppression, effacement', () => {
  const articles = [{ id: 'a', nom: 'Pain', coche: false }, { id: 'b', nom: 'Riz', coche: true }];
  const produits = [{ nom: 'Lait demi-écrémé', quantite: 1 }];
  const liste = appliquerAttente(articles, [
    { type: 'ajouter', id: 'local-1', nom: 'Lait', quantite: 2, par: 'Thomas' },
    { type: 'cocher', id: 'a', coche: true },
    { type: 'supprimer', id: 'b' },
  ], produits);
  assert.deepEqual(liste.map(a => [a.id, a.coche, !!a.enAttente]), [['a', true, true], ['local-1', false, true]]);
  assert.deepEqual(liste[1].maison, { unite: 1 });
  assert.equal(articles[0].coche, false, 'la liste du script n\'est pas modifiée');
  assert.deepEqual(appliquerAttente(articles, [{ type: 'effacer' }], []).map(a => a.id), ['a']);
});

test('remplacerId et corpsOperation', () => {
  const att = remplacerId([{ type: 'cocher', id: 'local-1', coche: true }, { type: 'supprimer', id: 'x' }], 'local-1', 'srv');
  assert.equal(att[0].id, 'srv');
  assert.equal(att[1].id, 'x');
  assert.deepEqual(corpsOperation({ type: 'ajouter', id: 'local-1', nom: 'Lait', quantite: 2, par: 'T' }),
                   { action: 'ajouter_course', nom: 'Lait', quantite: 2, unite: 'unite', par: 'T', client: 'local-1' });
  assert.deepEqual(corpsOperation({ type: 'effacer' }), { action: 'effacer_coches' });
});

test('erreurPassagere : on réessaie plus tard au lieu de jeter l’opération', async () => {
  const { erreurPassagere } = await import('../logique.js');
  assert.equal(erreurPassagere('Lock timeout: another process was holding the lock for too long.'), true);
  assert.equal(erreurPassagere('Réponse illisible (adresse du script ?)'), true);
  assert.equal(erreurPassagere('Service invoked too many times'), true);
  assert.equal(erreurPassagere('article introuvable'), false);
  assert.equal(erreurPassagere('Clé refusée'), false);
  assert.equal(erreurPassagere(undefined), false);
});
