import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000").transform(Number).pipe(z.number().min(1).max(65535)),
  MONGODB_URI: z.string().min(1, "MONGODB_URI est obligatoire"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET doit faire au moins 32 caractères"),
  AES_ENCRYPTION_KEY: z.string().length(64, "AES_ENCRYPTION_KEY doit être une chaîne hexadécimale de 64 caractères"),
  BCRYPT_COST: z.string().default("12").transform(Number).pipe(z.number().min(10).max(14)),
  FRONTEND_URL: z.string().url("FRONTEND_URL doit être une URL valide").default("http://localhost:3002"),
});

const resultat = envSchema.safeParse(process.env);

if (!resultat.success) {
  console.error("Variables d'environnement invalides ou manquantes :");
  console.error(resultat.error.format());
  process.exit(1);
}

export const env = resultat.data;
