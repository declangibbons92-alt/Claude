/*
 * Builds the completed agreement PDF entirely on the device with jsPDF.
 * One A4 page, laid out like TerraCharge's paper Unit Hosting Agreement.
 * No network access is needed.
 */
import { AGREEMENT, fillTokens, segments } from "./agreement.js?v=10";
import { formatDateLong, formatTime, tzLabel } from "./util.js?v=10";

const DARK = [15, 23, 20]; // #0F1714
const GREEN = [61, 220, 78]; // #3DDC4E
const GREEN_TEXT = [37, 170, 55]; // slightly deeper green for small text on white
const INK = [28, 30, 29];
const GREY = [105, 110, 108];
const LIGHT = [245, 247, 246];
const RULE = [80, 84, 82];
const HAIR = [218, 222, 220];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 19; // margin (matches original)
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 18; // content must end above the footer

/**
 * @param {object} r
 *  { venue, share, reference, unitPhoto (dataURL|null),
 *    customer: { name, position, signature:{dataUrl,width,height}, signedAt: Date },
 *    terracharge: { signatoryName, position, signature, signedAt: Date } }
 * @returns {Blob}
 */
export function buildAgreementPdf(r) {
  // Always one page: if unusually long details (e.g. a very long venue name)
  // would overflow, lay it out again slightly more compactly.
  let doc;
  for (const k of [1, 0.94, 0.88, 0.82, 0.76]) {
    doc = layout(r, k);
    if (!doc.__overflow) break;
  }
  return doc.output("blob");
}

function layout(r, k) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const A = AGREEMENT;
  const C = A.company;
  const fill = (t) => fillTokens(t, { venue: r.venue, share: r.share });
  const tc = r.terracharge;
  const cu = r.customer;

  doc.setProperties({
    title: `${C.name} ${A.title} — ${r.venue}`,
    subject: `${A.title} v${A.version} — Ref ${r.reference}`,
    author: C.name,
    creator: "TerraCharge Sign (offline)",
    keywords: `TerraCharge, Unit Hosting Agreement, ${r.reference}`,
  });

  let y = 0;
  const font = (size, style = "normal", color = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lineH = (size) => size * 0.3528 * 1.5;

  function wordmark(x, baseline, size) {
    font(size, "bold", [255, 255, 255]);
    doc.text("TERRA", x, baseline);
    const w = doc.getTextWidth("TERRA");
    doc.setTextColor(...GREEN);
    doc.text("CHARGE", x + w, baseline);
  }

  /** Lay out mixed bold/normal text with wrapping. */
  function rich(segs, x, width, size, { color = INK, gap = 2 } = {}) {
    const words = [];
    for (const s of segs) for (const t of s.text.split(/(\s+)/)) if (t) words.push({ t, bold: s.bold, color: s.color || color });
    // Measure per character: jsPDF's getTextWidth applies kerning but text() doesn't,
    // which would make words overlap the following space.
    const measure = (w) => {
      doc.setFont("helvetica", w.bold ? "bold" : "normal");
      doc.setFontSize(size);
      let sum = 0;
      for (const ch of w.t) sum += doc.getTextWidth(ch);
      return sum;
    };
    const lines = [];
    let cur = [], cw = 0;
    for (const w of words) {
      const isSpace = /^\s+$/.test(w.t);
      if (isSpace && !cur.length) continue;
      const ww = measure(w);
      if (!isSpace && cw + ww > width && cur.length) {
        while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) cur.pop();
        lines.push(cur); cur = []; cw = 0;
      }
      cur.push({ ...w, w: ww }); cw += ww;
    }
    if (cur.length) lines.push(cur);
    const lh = lineH(size);
    for (const ln of lines) {
      let xx = x;
      for (const w of ln) {
        font(size, w.bold ? "bold" : "normal", w.color);
        if (!/^\s+$/.test(w.t)) doc.text(w.t, xx, y + lh * 0.72);
        xx += w.w;
      }
      y += lh;
    }
    y += gap;
  }

  // ---------------- Header block (as original) ----------------
  const HX = M, HY = 12, HW = CW, HH = 43 * Math.max(k, 0.9);
  doc.setFillColor(...DARK);
  doc.rect(HX, HY, HW, HH, "F");
  const hs = HH / 43;
  wordmark(HX + 6.5, HY + 9.5 * hs, 15);
  font(9.5, "italic", [215, 220, 218]);
  doc.text(A.tagline, HX + 6.5, HY + 15 * hs);
  font(21, "bold", [255, 255, 255]);
  doc.text(A.title, HX + 6.5, HY + 25.5 * hs);
  font(13, "bold", GREEN);
  doc.text(A.partiesLine, HX + 6.5, HY + 32.5 * hs);
  font(9.5, "normal", [235, 238, 237]);
  doc.text(A.descriptor, HX + 6.5, HY + 38.5 * hs);
  if (r.unitPhoto) {
    const ph = HH - 8, pw = ph * (306 / 365);
    doc.addImage(r.unitPhoto, "JPEG", HX + HW - 6.5 - pw, HY + 4, pw, ph, undefined, "FAST");
  }
  y = HY + HH + 6 * k;

  // ---------------- Parties + clauses 1–7 ----------------
  const BODY = 10 * Math.max(k, 0.85);
  rich([{ text: "Parties  ", bold: true, color: GREEN_TEXT }, ...segments(fill(A.parties))], M, CW, BODY, { gap: 2.6 * k });
  A.clauses.forEach((c, i) => {
    font(BODY + 1, "bold", GREEN_TEXT);
    doc.text(String(i + 1), M, y + lineH(BODY) * 0.72);
    rich([{ text: `${c.title}: `, bold: true }, ...segments(fill(c.text))], M + 7.5, CW - 7.5, BODY, { gap: 1.6 * k });
  });

  // ---------------- Signatures (as original: two tables) ----------------
  const LABEL_W = 42;
  const ROW = 8.2 * k;
  const SIG_ROW = 19 * k;
  const HEAD = 8.5 * Math.max(k, 0.85);

  function table(heading, rows) {
    const h = HEAD + rows.reduce((n, rw) => n + (rw.sig !== undefined ? SIG_ROW : ROW), 0);
    doc.setFillColor(...LIGHT);
    doc.rect(M, y, CW, h, "F");
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.25);
    doc.rect(M, y, CW, h, "S");
    doc.setFillColor(...DARK);
    doc.rect(M, y, CW, HEAD, "F");
    font(10.5, "bold", [255, 255, 255]);
    doc.text(heading, M + 4, y + HEAD / 2 + 1.4);
    y += HEAD;
    for (const rw of rows) {
      const rh = rw.sig !== undefined ? SIG_ROW : ROW;
      font(10, "bold", INK);
      doc.text(rw.label, M + 4, y + rh - 2.5);
      const vx = M + LABEL_W;
      if (rw.sig !== undefined) {
        // rectangular signature box; the signature keeps its proportions
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.3);
        doc.rect(vx + 1.5, y + 1.6, CW - LABEL_W - 3.5, rh - 3.2, "FD");
        if (rw.sig) placeContain(doc, rw.sig, vx + 3, y + 2.6, CW - LABEL_W - 6.5, rh - 5.2);
      } else {
        font(10.5, "normal", INK);
        doc.text(doc.splitTextToSize(rw.value || "", CW - LABEL_W - 6)[0] || "", vx + 2.5, y + rh - 2.5);
      }
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.line(vx, y + rh, M + CW, y + rh);
      y += rh;
    }
    y += 4 * k;
  }

  y += 0.5;
  font(13, "bold", INK);
  doc.text("Signatures", M, y + 4.5);
  y += 7;

  table(`Signed on behalf of ${C.name}`, [
    { label: "Name", value: tc.signatoryName },
    { label: "Signature", sig: tc.signature },
    { label: "Date", value: formatDateLong(tc.signedAt) },
  ]);
  table("The Venue", [
    { label: "Venue name", value: r.venue },
    { label: "Your name", value: cu.name },
    { label: "Position", value: cu.position },
    { label: "Signature", sig: cu.signature },
    { label: "Date", value: formatDateLong(cu.signedAt) },
  ]);

  doc.__overflow = y - 4 * k > BOTTOM;

  // ---------------- Footer (as original + small reference line) ----------------
  const contact = [C.name, `Company no. ${C.companyNumber}`, C.website, C.email, C.phone].join("  ·  ");
  font(8.5, "normal", GREY);
  doc.text(contact, PAGE_W / 2, PAGE_H - 12, { align: "center" });
  font(6.8, "normal", [150, 154, 152]);
  doc.text(
    `${A.title} v${A.version}  ·  Ref ${r.reference}  ·  Venue signed ${formatTime(cu.signedAt)}, ` +
      `TerraCharge signed ${formatTime(tc.signedAt)} on ${formatDateLong(cu.signedAt)} (${tzLabel(cu.signedAt)})`,
    PAGE_W / 2, PAGE_H - 7.5, { align: "center" }
  );

  return doc;
}

/** Place an image inside a box, preserving its aspect ratio and centring it. */
function placeContain(doc, img, x, y, w, h) {
  const ratio = img.width / img.height;
  let dw = w, dh = w / ratio;
  if (dh > h) { dh = h; dw = h * ratio; }
  doc.addImage(img.dataUrl, "PNG", x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, undefined, "FAST");
}
