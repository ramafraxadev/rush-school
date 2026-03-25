// backend/src/server.ts
import mongoose from 'mongoose';
import app from './app';
import { env } from "./config/env"; 

async function demarrer() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(' MongoDB connecté');

  app.listen(env.PORT,"0.0.0.0", () => {
    console.log(`Serveur démarré sur http://localhost:${env.PORT}`);
  });
}

demarrer().catch((err) => {
  console.error('❌ Erreur au démarrage :', err);
  process.exit(1);
});