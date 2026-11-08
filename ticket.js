// Photo du ticket : appareil photo du téléphone, puis réduction en JPEG (~1600 px) avant l'envoi

import { dimensionsReduites } from './logique.js';

/** Ouvre l'appareil photo (ou la galerie) ; résout avec le fichier choisi, ou null si annulé */
export function photographier() {
  return new Promise(resolve => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.setAttribute('capture', 'environment');
    champ.addEventListener('change', () => resolve(champ.files && champ.files[0] ? champ.files[0] : null));
    champ.addEventListener('cancel', () => resolve(null));
    champ.click();
  });
}

/** Réduit l'image et la renvoie en JPEG base64 (sans l'en-tête « data: ») */
export async function reduireEnJpeg(fichier, qualite = 0.8) {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const { l, h } = dimensionsReduites(image.width, image.height);
  const toile = document.createElement('canvas');
  toile.width = l;
  toile.height = h;
  toile.getContext('2d').drawImage(image, 0, 0, l, h);
  image.close && image.close();
  const url = toile.toDataURL('image/jpeg', qualite);
  return url.slice(url.indexOf(',') + 1);
}
