// Creates the key pair that signs booth licences. Run once:  node scripts/generate-licence-keys.mjs
// - LICENCE_PRIVATE_KEY goes into Vercel (Production + Preview). Never commit it or put it in the app.
// - MAIN_VITE_LICENCE_PUBLIC_KEY goes into the app's .env (repo root) before `npm run build` / `dist:win`.
// Changing keys later signs every booth out, so keep the private key safe (e.g. a password manager).
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
console.log(`LICENCE_PRIVATE_KEY=${privateKey.export({ format: "der", type: "pkcs8" }).toString("base64")}`);
console.log(`MAIN_VITE_LICENCE_PUBLIC_KEY=${publicKey.export({ format: "der", type: "spki" }).toString("base64")}`);
