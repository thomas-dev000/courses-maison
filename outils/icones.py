"""Dessine icones/icone-192.png et icone-512.png (même dessin que icone.svg), sans bibliothèque.
Lancer depuis la racine du dépôt : python3 outils/icones.py"""
import struct, zlib, math

FOND = (0x0F, 0x13, 0x17)
AMBRE = (0xF2, 0xB5, 0x44)
TRAIT = (0x1B, 0x14, 0x04)
EPAIS = 18            # demi-épaisseur du trait, dans le repère 512
SEGMENTS = [((176, 208), (224, 112)), ((336, 208), (288, 112)),
            ((104, 208), (408, 208)), ((408, 208), (372, 392)), ((372, 392), (140, 392)), ((140, 392), (104, 208)),
            ((208, 264), (208, 336)), ((304, 264), (304, 336))]

def dans_carre_arrondi(x, y, r=112, n=512):
    cx = min(max(x, r), n - r)
    cy = min(max(y, r), n - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def distance(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def couleur(x, y):
    if not dans_carre_arrondi(x, y):
        return FOND
    if any(distance(x, y, a, b) <= EPAIS for a, b in SEGMENTS):
        return TRAIT
    return AMBRE

def png(taille, chemin, sur=3):
    lignes = bytearray()
    for j in range(taille):
        lignes.append(0)
        for i in range(taille):
            somme = [0, 0, 0]
            for sj in range(sur):
                for si in range(sur):
                    x = (i + (si + .5) / sur) * 512 / taille
                    y = (j + (sj + .5) / sur) * 512 / taille
                    c = couleur(x, y)
                    for k in range(3): somme[k] += c[k]
            lignes += bytes(round(s / (sur * sur)) for s in somme)
    def bloc(nom, donnees):
        return struct.pack('>I', len(donnees)) + nom + donnees + struct.pack('>I', zlib.crc32(nom + donnees) & 0xffffffff)
    entete = struct.pack('>IIBBBBB', taille, taille, 8, 2, 0, 0, 0)
    with open(chemin, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', entete) + bloc(b'IDAT', zlib.compress(bytes(lignes), 9)) + bloc(b'IEND', b''))

png(192, 'icones/icone-192.png')
png(512, 'icones/icone-512.png')
print('icones ecrites')
