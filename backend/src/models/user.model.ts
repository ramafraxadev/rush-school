// backend/src/models/user.model.ts

import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

// Types des roles possibles pour un utilisateur sur la plateforme
export type RoleUtilisateur =
  | 'superadmin'
  | 'directeur'
  | 'formateur'
  | 'apprenant';

// Statuts possibles d'un compte utilisateur
export type StatutUtilisateur = 'actif' | 'suspendu' | 'en_attente';

// Forme complete d'un document utilisateur tel qu'il est stocke en base
export interface IUser {
  _id: mongoose.Types.ObjectId;

  // Null autorise uniquement pour les superadmins
  organization_id: mongoose.Types.ObjectId | null;

  email: string;

  // Toujours un hash bcrypt, jamais le mot de passe en clair
  password_hash: string;

  role: RoleUtilisateur;
  statut: StatutUtilisateur;
  email_verifie: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  mfa_active: boolean;

  // Stocke chiffre avec AES-256 via lib/crypto.ts, jamais en clair en base
  mfa_secret: string | null;

  // Tableau de 8 hashes bcrypt a usage unique pour recuperer le compte si MFA perdu
  mfa_codes_secours: string[];

  // Blocage du compte apres 5 tentatives de connexion echouees
  tentatives_echouees: number;
  bloque_jusqu_au: Date | null;
  derniere_connexion: Date | null;

  // Token de reinitialisation mot de passe, valable 1 heure
  reset_password_token: string | null;
  reset_password_expires: Date | null;

  // Suppression logique obligatoire pour le RGPD, jamais de suppression physique
  supprime_le: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// Methodes disponibles sur chaque document utilisateur
export interface IUserMethodes {
  verifierMotDePasse(motDePasse: string): Promise<boolean>;
  estBloque(): boolean;
  incrementerTentativesEchouees(): Promise<void>;
  reinitialiserTentatives(): Promise<void>;
}

export type IUserDocument = IUser & IUserMethodes & mongoose.Document;

const userSchema = new Schema<IUserDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },

    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, "L'email ne peut pas depasser 255 caracteres"],
      match: [/^\S+@\S+\.\S+$/, 'Format email invalide'],
    },

    // Ce champ n'est jamais retourne par un find() standard grace a select: false.
    // Pour le recuperer, il faut explicitement ecrire .select('+password_hash')
    password_hash: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: ['superadmin', 'directeur', 'formateur', 'apprenant'],
        message: 'Role invalide : {VALUE}',
      },
      required: [true, 'Le role est obligatoire'],
    },

    statut: {
      type: String,
      enum: ['actif', 'suspendu', 'en_attente'],
      default: 'en_attente',
    },

    email_verifie: {
      type: Boolean,
      default: false,
    },

    email_verification_token: {
      type: String,
      default: null,
      select: false,
    },

    email_verification_expires: {
      type: Date,
      default: null,
      select: false,
    },

    mfa_active: {
      type: Boolean,
      default: false,
    },

    mfa_secret: {
      type: String,
      default: null,
      select: false,
    },

    mfa_codes_secours: {
      type: [String],
      default: [],
      select: false,
    },

    tentatives_echouees: {
      type: Number,
      default: 0,
      min: 0,
    },

    bloque_jusqu_au: {
      type: Date,
      default: null,
    },

    derniere_connexion: {
      type: Date,
      default: null,
    },

    reset_password_token: {
      type: String,
      default: null,
      select: false,
    },

    reset_password_expires: {
      type: Date,
      default: null,
      select: false,
    },

    supprime_le: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },

    toJSON: {
      // On caste ret en Partial<IUser> pour que TypeScript connaisse les champs.
      // Partial est utilise car les champs en select:false peuvent etre absents de l'objet.
      transform(_doc, ret: Partial<IUser>) {
        delete ret.password_hash;
        delete ret.mfa_secret;
        delete ret.mfa_codes_secours;
        delete ret.email_verification_token;
        delete ret.email_verification_expires;
        delete ret.reset_password_token;
        delete ret.reset_password_expires;
        return ret;
      },
    },
  }
);

// Index pour accelerer les recherches par organisation dans l'architecture multi-tenant
userSchema.index({ organization_id: 1, statut: 1 });

// Index pour accelerer le filtre global de soft delete sur tous les find()
userSchema.index({ supprime_le: 1 });

// TTL index : MongoDB supprime automatiquement les tokens de verification expires
userSchema.index({ email_verification_expires: 1 }, { expireAfterSeconds: 0 });

// Comparaison du mot de passe fourni avec le hash stocke en base
userSchema.methods.verifierMotDePasse = async function (
  this: IUserDocument,
  motDePasse: string
): Promise<boolean> {
  return bcrypt.compare(motDePasse, this.password_hash);
};

// Verifie si le compte est actuellement bloque
userSchema.methods.estBloque = function (this: IUserDocument): boolean {
  if (!this.bloque_jusqu_au) return false;
  return this.bloque_jusqu_au > new Date();
};

// Ajoute 1 au compteur d'echecs et bloque le compte 15 minutes apres 5 tentatives
userSchema.methods.incrementerTentativesEchouees = async function (
  this: IUserDocument
): Promise<void> {
  this.tentatives_echouees += 1;

  if (this.tentatives_echouees >= 5) {
    const quinzeMinutes = 15 * 60 * 1000;
    this.bloque_jusqu_au = new Date(Date.now() + quinzeMinutes);
  }

  await this.save();
};

// Remet le compteur a zero apres une connexion reussie
userSchema.methods.reinitialiserTentatives = async function (
  this: IUserDocument
): Promise<void> {
  this.tentatives_echouees = 0;
  this.bloque_jusqu_au = null;
  this.derniere_connexion = new Date();
  await this.save();
};

// Hash automatique du mot de passe si le champ a ete modifie.
// Le service passe le mot de passe en clair, ce middleware le hash avant la sauvegarde.
// Ne jamais hasher le mot de passe ailleurs dans le projet.
userSchema.pre('save', async function () {
  if (!this.isModified('password_hash')) return;
  this.password_hash = await bcrypt.hash(this.password_hash, env.BCRYPT_COST);
});

// Filtre global qui exclut les utilisateurs supprimes de toutes les requetes find.
// On utilise 'find' en chaine de caracteres au lieu de /^find/ en regex
// pour eviter le conflit de surcharge de types dans Mongoose avec this et next ensemble.
userSchema.pre('find', function () {
  this.where({ supprime_le: null });
});

userSchema.pre('findOne', function () {
  this.where({ supprime_le: null });
});

userSchema.pre('findOneAndUpdate', function () {
  this.where({ supprime_le: null });
});

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>(
  'User',
  userSchema
);