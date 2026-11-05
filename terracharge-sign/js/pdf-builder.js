/*
 * Builds the completed agreement PDF entirely on the device with jsPDF.
 * Layout mirrors TerraCharge's paper Unit Hosting Agreement.
 * No network access is needed.
 */
import { AGREEMENT, fillTokens, segments } from "./agreement.js";
import { formatDateLong, formatDateTimeFull } from "./util.js";

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
const BOTTOM = PAGE_H - 19;

/**
 * @param {object} r
 *  { venue, share, reference, textHash, unitPhoto (dataURL|null),
 *    customer: { name, accepted, signature:{dataUrl,width,height}, signedAt: Date },
 *    terracharge: { signatoryName, position, signature, signedAt: Date },
 *    generatedAt: Date }
 * @returns {Blob}
 */
export function buildAgreementPdf(r) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const A = AGREEMENT;
  const C = A.company;
  const vals = { venue: r.venue, share: r.share };
  const fill = (t) => fillTokens(t, vals);

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

  const newPage = () => {
    doc.addPage();
    runningHeader();
    y = 28;
  };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };

  function wordmark(x, baseline, size, onDark) {
    font(size, "bold", onDark ? [255, 255, 255] : DARK);
    doc.text("TERRA", x, baseline);
    const w = doc.getTextWidth("TERRA");
    doc.setTextColor(...(onDark ? GREEN : GREEN_TEXT));
    doc.text("CHARGE", x + w, baseline);
  }

  function runningHeader() {
    wordmark(M, 15, 11, false);
    font(8, "normal", GREY);
    doc.text(`${A.title}  ·  ${r.venue}`, PAGE_W - M, 15, { align: "right" });
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(M, 19, PAGE_W - M, 19);
  }

  /** Lay out mixed bold/normal text with wrapping and page breaks. */
  function rich(segs, x, width, size, { color = INK, gap = 2.6 } = {}) {
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
      ensure(lh);
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
  const HX = M, HY = 12, HW = CW, HH = 43;
  doc.setFillColor(...DARK);
  doc.rect(HX, HY, HW, HH, "F");
  wordmark(HX + 6.5, HY + 9.5, 15, true);
  font(9.5, "italic", [215, 220, 218]);
  doc.text(A.tagline, HX + 6.5, HY + 15);
  font(21, "bold", [255, 255, 255]);
  doc.text(A.title, HX + 6.5, HY + 25.5);
  font(13, "bold", GREEN);
  doc.text(A.partiesLine, HX + 6.5, HY + 32.5);
  font(9.5, "normal", [235, 238, 237]);
  doc.text(A.descriptor, HX + 6.5, HY + 38.5);
  if (r.unitPhoto) {
    const ph = 35, pw = ph * (306 / 365);
    doc.addImage(r.unitPhoto, "JPEG", HX + HW - 6.5 - pw, HY + 4, pw, ph, undefined, "FAST");
  }
  font(7.5, "normal", GREY);
  doc.text(`Agreement v${A.version}   ·   Ref ${r.reference}`, PAGE_W - M, HY + HH + 4.5, { align: "right" });
  y = HY + HH + 7;

  // ---------------- Parties ----------------
  const BODY = 10;
  rich(
    [{ text: "Parties  ", bold: true, color: GREEN_TEXT }, ...segments(fill(A.parties))],
    M, CW, BODY, { gap: 2.6 }
  );

  // ---------------- Clauses 1–7 ----------------
  A.clauses.forEach((c, i) => {
    ensure(lineH(BODY) * 2);
    font(BODY + 1, "bold", GREEN_TEXT);
    doc.text(String(i + 1), M, y + lineH(BODY) * 0.72);
    rich([{ text: `${c.title}: `, bold: true }, ...segments(fill(c.text))], M + 7.5, CW - 7.5, BODY, { gap: 1.6 });
  });

  // ---------------- Signatures (as original: two tables) ----------------
  y += 0.5;
  const LABEL_W = 42;
  const ROW = 8.2;
  const SIG_ROW = 20;

  function table(heading, rows) {
    const h = 8.5 + rows.reduce((n, rw) => n + (rw.sig !== undefined ? SIG_ROW : ROW), 0);
    ensure(h + 4);
    doc.setFillColor(...LIGHT);
    doc.rect(M, y, CW, h, "F");
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.25);
    doc.rect(M, y, CW, h, "S");
    doc.setFillColor(...DARK);
    doc.rect(M, y, CW, 8.5, "F");
    font(10.5, "bold", [255, 255, 255]);
    doc.text(heading, M + 4, y + 5.8);
    y += 8.5;
    for (const rw of rows) {
      const rh = rw.sig !== undefined ? SIG_ROW : ROW;
      font(10, "bold", INK);
      doc.text(rw.label, M + 4, y + rh - 2.6);
      const vx = M + LABEL_W;
      if (rw.sig !== undefined) {
        // rectangular signature box; signature keeps its proportions
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.3);
        doc.rect(vx + 1.5, y + 1.8, CW - LABEL_W - 3.5, rh - 3.6, "FD");
        if (rw.sig) placeContain(doc, rw.sig, vx + 3, y + 2.8, CW - LABEL_W - 6.5, rh - 5.6);
      } else {
        font(10.5, "normal", INK);
        doc.text(doc.splitTextToSize(rw.value || "", CW - LABEL_W - 6)[0] || "", vx + 2.5, y + rh - 2.6);
      }
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.line(vx, y + rh, M + CW, y + rh);
      y += rh;
    }
    y += 4;
  }

  ensure(8 + 8.5 + ROW * 2 + SIG_ROW);
  font(13, "bold", INK);
  doc.text("Signatures", M, y + 4.5);
  y += 7;

  const tc = r.terracharge;
  table(`Signed on behalf of ${C.name}`, [
    { label: "Name", value: tc.signatoryName + (tc.position ? `, ${tc.position}` : "") },
    { label: "Signature", sig: tc.signature },
    { label: "Date", value: formatDateLong(tc.signedAt) },
  ]);
  table("The Venue", [
    { label: "Venue name", value: r.venue },
    { label: "Your name", value: r.customer.name },
    { label: "Signature", sig: r.customer.signature },
    { label: "Date", value: formatDateLong(r.customer.signedAt) },
  ]);

  // ---------------- Signing record ----------------
  const recRows = [
    ["Agreement", `${A.title}, version ${A.version}`],
    ["Document reference", r.reference],
    ["Venue", r.venue],
    ["Agreed revenue share", `${r.share}% of the revenue generated by the Unit (Clause 4)`],
    ["Venue signatory", r.customer.name],
    ["Terms accepted", r.customer.accepted ? `Yes — before signing, the signatory ticked: “${fill(A.acceptanceStatement)}”` : "No"],
    ["Venue signed at", formatDateTimeFull(r.customer.signedAt)],
    ["Countersigned by", `${tc.signatoryName}${tc.position ? `, ${tc.position}` : ""}, on behalf of ${C.name}`],
    ["Countersigned at", formatDateTimeFull(tc.signedAt)],
    ["PDF generated at", formatDateTimeFull(r.generatedAt)],
    ["Method", "Signed by finger on TerraCharge’s device and generated offline. No data was sent to any server."],
    ["Terms fingerprint", `SHA-256 ${r.textHash}`],
  ];
  const valX = M + 46, valW = CW - 49;
  font(9, "normal");
  const heights = recRows.map(([, v]) => doc.splitTextToSize(v, valW).length * lineH(9) + 2.6);
  const recH = heights.reduce((a, b) => a + b, 0) + 12;
  if (y + recH > BOTTOM) newPage(); else y += 2;
  font(13, "bold", INK);
  doc.text("Signing Record", M, y + 4.5);
  font(8.5, "normal", GREY);
  doc.text("Electronic signature audit details", PAGE_W - M, y + 4.5, { align: "right" });
  y += 8;
  recRows.forEach(([k, v], i) => {
    const h = heights[i];
    ensure(h);
    if (i % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(M, y, CW, h, "F"); }
    font(8.5, "bold", GREY);
    doc.text(k, M + 3, y + lineH(9) * 0.72 + 1.3);
    if (k === "Terms fingerprint") { doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(...INK); }
    else font(9, "normal", INK);
    doc.splitTextToSize(v, valW).forEach((ln, j) => doc.text(ln, valX, y + lineH(9) * (0.72 + j) + 1.3));
    y += h;
  });

  // ---------------- Footer on every page (as original + page numbers) ----------------
  const total = doc.getNumberOfPages();
  const contact = [C.name, `Company no. ${C.companyNumber}`, C.website, C.email, C.phone].join("  ·  ");
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    font(8.5, "normal", GREY);
    doc.text(contact, PAGE_W / 2, PAGE_H - 13, { align: "center" });
    font(7, "normal", [150, 154, 152]);
    doc.text(`${A.title} v${A.version}  ·  Ref ${r.reference}  ·  Page ${p} of ${total}`, PAGE_W / 2, PAGE_H - 8.5, { align: "center" });
  }

  return doc.output("blob");
}

/** Place an image inside a box, preserving its aspect ratio and centring it. */
function placeContain(doc, img, x, y, w, h) {
  const ratio = img.width / img.height;
  let dw = w, dh = w / ratio;
  if (dh > h) { dh = h; dw = h * ratio; }
  doc.addImage(img.dataUrl, "PNG", x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, undefined, "FAST");
}
