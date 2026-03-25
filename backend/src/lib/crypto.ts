

import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHME = 'aes-256-gcm';

// Longueur du vecteur d'initialisation en octets.
// Un IV unique par chiffrement empeche deux memes plaintexts de produire le meme ciphertext.
const LONGUEUR_IV = 16;

// Convertit la cle hexadecimale du .env en Buffer 32 octets utilisable par Node.js crypto.
function obtenirCle(): Buffer {
  return Buffer.from(env.AES_ENCRYPTION_KEY, 'hex');
}

/**
 * Chiffre une valeur sensible avec AES-256-GCM.
 *
 * Le resultat est une chaine au format : iv:authTag:ciphertext
 * Les trois parties sont encodees en hexadecimal et separees par des deux-points.
 * Ce format permet de tout stocker dans un seul champ texte en base de donnees.
 *
 * Exemple d'usage : chiffrer le secret MFA avant de sauvegarder l'utilisateur.
 */
export function encrypt(valeur: string): string {
  const iv = crypto.randomBytes(LONGUEUR_IV);

  const cipher = crypto.createCipheriv(ALGORITHME, obtenirCle(), iv);

  const chiffre = Buffer.concat([
    cipher.update(valeur, 'utf8'),
    cipher.final(),
  ]);

  // Le tag d'authentification est genere apres cipher.final() — ordre obligatoire
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    chiffre.toString('hex'),
  ].join(':');
}

/**
 * Dechiffre une valeur produite par la fonction encrypt ci-dessus.
 * Lance une erreur si le format est invalide ou si les donnees ont ete modifiees.
 *
 * Exemple d'usage : lire le secret MFA pour verifier un code TOTP.
 */
export function decrypt(valeurChiffree: string): string {
  const parties = valeurChiffree.split(':');

  // On s'assure que les trois parties sont presentes avant de continuer
  if (parties.length !== 3) {
    throw new Error(
      'Format de valeur chiffree invalide. Attendu : iv:authTag:ciphertext'
    );
  }

  const [ivHex, authTagHex, chiffreHex] = parties;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const chiffre = Buffer.from(chiffreHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHME, obtenirCle(), iv);

  // Le tag est verifie automatiquement par Node.js lors du final()
  // Si les donnees ont ete altere en base, une erreur est lancee ici
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(chiffre),
    decipher.final(),
  ]).toString('utf8');
}