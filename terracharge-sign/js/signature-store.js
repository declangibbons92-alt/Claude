/*
 * TerraCharge signature store.
 *
 * Your signature (image + name + position) is drawn once and kept in this
 * app's storage on this iPhone only. It is added to an agreement when you tap
 * "Add TerraCharge signature". Nothing is ever sent to a server.
 */
const KEY = "tc.signature.v1";

// Remove data from the earlier passcode-protected version, if any.
try {
  localStorage.removeItem("tc.vault.v1");
  localStorage.removeItem("tc.vault.lock");
} catch { /* storage unavailable */ }

/** @returns {{signatoryName, position, signature:{dataUrl,width,height}, createdAt} | null} */
export function getTcSignature() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && s.signature && s.signature.dataUrl ? s : null;
  } catch {
    return null;
  }
}

export function saveTcSignature({ signatoryName, position, signature }) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ signatoryName, position, signature, createdAt: new Date().toISOString() })
  );
  // Ask iOS to keep this data even when storage is low (best effort).
  try { navigator.storage?.persist?.(); } catch { /* optional */ }
}

export function deleteTcSignature() {
  localStorage.removeItem(KEY);
}
