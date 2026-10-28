// Creates the admin login. Run once (and again to change the password):
//   node scripts/generate-admin.mjs [username]
// Prints the password ONCE: store it in a password manager. Only its scrypt hash goes into Vercel.
// Scan the otpauth link (or the QR made from it) with Google Authenticator / 1Password / Authy.
import { randomBytes, randomInt, scryptSync } from "node:crypto";

const username = process.argv[2] || "snapowner";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/O, 1/l/I)
const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const password = [group(), group(), group(), group()].join("-"); // ~110 bits

const N = 1 << 15;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 });
const passwordHash = `scrypt:${N}:${salt.toString("base64")}:${hash.toString("base64")}`; // no "$": .env files expand it

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0, value = 0, totpSecret = "";
for (const byte of randomBytes(20)) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) { totpSecret += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
if (bits > 0) totpSecret += B32[(value << (5 - bits)) & 31];

const otpauth = `otpauth://totp/DSLR%20Snap%20Admin:${encodeURIComponent(username)}?secret=${totpSecret}&issuer=DSLR%20Snap%20Admin&period=30&digits=6`;

console.log(`ADMIN_USERNAME=${username}
ADMIN_PASSWORD_HASH=${passwordHash}
ADMIN_TOTP_SECRET=${totpSecret}
ADMIN_SESSION_SECRET=${randomBytes(32).toString("base64url")}

# Not for Vercel:
# password (shown once): ${password}
# authenticator link:    ${otpauth}`);
