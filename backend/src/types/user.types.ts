
import { Types } from 'mongoose';

export type UserRole = 'superadmin' | 'directeur' | 'formateur' | 'apprenant';
export type UserStatut = 'actif' | 'suspendu' | 'en_attente';

export interface IUser {
  _id: Types.ObjectId;
  organization_id: Types.ObjectId | null;
  email: string;
  password_hash: string;
  role: UserRole;
  statut: UserStatut;
  email_verifie: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  mfa_active: boolean;
  mfa_secret: string | null;
  mfa_codes_secours: string[];
  tentatives_echouees: number;
  bloque_jusqu_au: Date | null;
  derniere_connexion: Date | null;
  reset_password_token: string | null;
  reset_password_expires: Date | null;
  supprime_le: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  verifierMotDePasse(motDePasse: string): Promise<boolean>;
  estBloque(): boolean;
  incrementerTentativesEchouees(): Promise<void>;
  reinitialiserTentatives(): Promise<void>;
}

export type IUserDocument = IUser & IUserMethods;