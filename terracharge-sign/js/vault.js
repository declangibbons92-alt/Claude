/*
 * TerraCharge authorised-signature vault.
 *
 * The TerraCharge signature (image + signatory name/position) is encrypted on
 * the device with AES-256-GCM using a key derived from the owner's passcode
 * (PBKDF2-SHA-256, 310,000 iterations, random salt). Only the ciphertext is
 * stored in this browser's local storage. Nothing is ever sent to a server.
 *
 * The signature can only be applied to an agreement after the passcode is
 * entered at the moment of approval.
 */
const KEY = "tc.vault.v1";
const LOCK_KEY = "tc.vault.lock";
const ITERATIONS = 310_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function cryptoAvailable() {
  return !!(window.crypto && crypto.subtle && window.isSecureContext);
}

async function deriveKey(passcode, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/** Public, non-sensitive info for display: { signatoryName, position, createdAt } or null */
export function vaultInfo() {
  const s = readStore();
  return s ? { signatoryName: s.signatoryName, position: s.position, createdAt: s.createdAt } : null;
}

export async function saveVault({ signatoryName, position, signature, passcode }) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt, ITERATIONS);
  const payload = enc.encode(JSON.stringify({ signatoryName, position, signature }));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  localStorage.setItem(
    KEY,
    JSON.stringify({
      v: 1,
      signatoryName,
      position,
      createdAt: new Date().toISOString(),
      iterations: ITERATIONS,
      salt: b64(salt),
      iv: b64(iv),
      ct: b64(ct),
    })
  );
  localStorage.removeItem(LOCK_KEY);
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}

export function deleteVault() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LOCK_KEY);
}

function lockState() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || '{"fails":0,"until":0}');
  } catch {
    return { fails: 0, until: 0 };
  }
}

/** Seconds remaining before another attempt is allowed (0 = allowed now). */
export function lockoutRemaining() {
  return Math.max(0, Math.ceil((lockState().until - Date.now()) / 1000));
}

/**
 * Decrypt the stored signature. Throws Error("WRONG_PASSCODE") or
 * Error("LOCKED:<seconds>") on failure. Escalating lockout after 5 fails.
 */
export async function unlockVault(passcode) {
  const s = readStore();
  if (!s) throw new Error("NO_VAULT");
  const wait = lockoutRemaining();
  if (wait > 0) throw new Error(`LOCKED:${wait}`);
  try {
    const key = await deriveKey(passcode, unb64(s.salt), s.iterations);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, key, unb64(s.ct));
    localStorage.removeItem(LOCK_KEY);
    return JSON.parse(dec.decode(pt));
  } catch {
    const st = lockState();
    st.fails += 1;
    if (st.fails >= 5) st.until = Date.now() + Math.min(30 * 2 ** (st.fails - 5), 3600) * 1000;
    localStorage.setItem(LOCK_KEY, JSON.stringify(st));
    throw new Error("WRONG_PASSCODE");
  }
}

export async function sha256Hex(text) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
