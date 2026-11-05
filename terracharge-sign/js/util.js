export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const LOCALE = "en-GB";

export function formatDateLong(d) {
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(d) {
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** e.g. "GMT+00:00 (Europe/London)" based on the iPhone's own settings */
export function tzLabel(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  let zone = "";
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* ignore */ }
  return `GMT${sign}${hh}:${mm}${zone ? ` (${zone})` : ""}`;
}

export function formatDateTimeFull(d) {
  return `${formatDateLong(d)}, ${formatTime(d)} ${tzLabel(d)}`;
}

export function isoLocalDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function makeReference(d = new Date()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const rnd = crypto.getRandomValues(new Uint8Array(4));
  const code = [...rnd].map((b) => alphabet[b % alphabet.length]).join("");
  return `TC-${isoLocalDate(d).replaceAll("-", "")}-${code}`;
}

export function slug(s) {
  return String(s).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "Venue";
}

export function vibrate(ms = 10) {
  try { navigator.vibrate?.(ms); } catch { /* iOS ignores */ }
}
