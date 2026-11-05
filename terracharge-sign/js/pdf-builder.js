/*
 * Builds the completed agreement PDF entirely on the device with jsPDF.
 * No network access is needed.
 */
import { AGREEMENT, fillTokens } from "./agreement.js";
import { formatDateLong, formatDateTimeFull } from "./util.js";

const BLACK = [11, 11, 11];
const GREEN = [34, 181, 94];
const GREEN_DARK = [21, 128, 61];
const GREY = [110, 110, 110];
const LIGHT = [244, 246, 245];
const RULE = [215, 220, 217];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // margin
const CW = PAGE_W - M * 2; // content width
const FOOTER_Y = PAGE_H - 10;
const BOTTOM = PAGE_H - 20; // last usable y

/**
 * @param {object} r record
 *  { venue, share, reference, textHash,
 *    customer: { name, accepted, signature:{dataUrl,width,height}, signedAt: Date },
 *    terracharge: { signatoryName, position, signature, signedAt: Date },
 *    generatedAt: Date }
 * @returns {Blob}
 */
export function buildAgreementPdf(r) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const A = AGREEMENT;
  const vals = { venue: r.venue, share: r.share };
  const fill = (t) => fillTokens(t, vals);

  doc.setProperties({
    title: `${A.company.name} ${A.title} — ${r.venue}`,
    subject: `${A.title} v${A.version} — Ref ${r.reference}`,
    author: A.company.name,
    creator: "TerraCharge Sign (offline PWA)",
    keywords: `TerraCharge, hosting agreement, ${r.reference}`,
  });

  let y = 0;

  const setText = (size, style = "normal", color = BLACK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const lineH = (size) => size * 0.3528 * 1.45; // pt -> mm with leading

  const newPage = () => {
    doc.addPage();
    drawRunningHeader();
    y = 30;
  };
  const ensure = (h) => {
    if (y + h > BOTTOM) newPage();
  };

  // Wrapped paragraph with page breaks; returns nothing, advances y.
  const paragraph = (text, { size = 10, style = "normal", color = BLACK, x = M, width = CW, gap = 2.2 } = {}) => {
    setText(size, style, color);
    const lines = doc.splitTextToSize(text, width);
    const lh = lineH(size);
    for (const ln of lines) {
      ensure(lh);
      doc.text(ln, x, y + lh * 0.75);
      y += lh;
    }
    y += gap;
  };

  function drawWordmark(x, baseline, size, onDark) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...(onDark ? [255, 255, 255] : BLACK));
    doc.text("TERRA", x, baseline);
    const w = doc.getTextWidth("TERRA");
    doc.setTextColor(...GREEN);
    doc.text("CHARGE", x + w, baseline);
    return w + doc.getTextWidth("CHARGE");
  }

  function drawBolt(x, y0, h, color) {
    // simple lightning bolt mark
    const s = h / 10;
    doc.setFillColor(...color);
    doc.lines(
      [[3.2 * s, -0.0], [-1.6 * s, 4 * s], [3 * s, 0], [-5.2 * s, 6 * s], [1.4 * s, -4.4 * s], [-2.6 * s, 0]],
      x + 2.4 * s, y0, [1, 1], "F", true
    );
  }

  function drawRunningHeader() {
    drawBolt(M, 10, 7, GREEN);
    drawWordmark(M + 7, 15.5, 11, false);
    setText(8, "normal", GREY);
    doc.text(`${A.title}  ·  ${r.venue}`, PAGE_W - M, 15.5, { align: "right" });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, 20, PAGE_W - M, 20);
  }

  // ---------- Page 1 masthead ----------
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PAGE_W, 40, "F");
  doc.setFillColor(...GREEN);
  doc.rect(0, 40, PAGE_W, 1.4, "F");
  drawBolt(M, 13, 13, GREEN);
  drawWordmark(M + 12, 23, 20, true);
  setText(8.5, "normal", [190, 190, 190]);
  doc.text(A.subtitle.toUpperCase(), M + 12, 30);

  setText(14, "bold", [255, 255, 255]);
  doc.text(A.title.toUpperCase(), PAGE_W - M, 21, { align: "right" });
  setText(8.5, "normal", [190, 190, 190]);
  doc.text(`Version ${A.version}   ·   Ref ${r.reference}`, PAGE_W - M, 28, { align: "right" });

  y = 50;

  // ---------- Particulars ----------
  const cells = [
    ["VENUE", r.venue],
    ["VENUE REVENUE SHARE", `${r.share}% of net rental revenue`],
    ["AGREEMENT DATE", formatDateLong(r.customer.signedAt)],
    ["TERM", "Rolling — no fixed term"],
  ];
  const cellW = CW / 2;
  const cellH = 17;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, cellH * 2, 2.5, 2.5, "F");
  doc.setFillColor(...GREEN);
  doc.rect(M, y, 1.4, cellH * 2, "F");
  cells.forEach(([k, v], i) => {
    const cx = M + 7 + (i % 2) * cellW;
    const cy = y + Math.floor(i / 2) * cellH;
    setText(7, "bold", GREY);
    doc.text(k, cx, cy + 6.5);
    setText(11, "bold", BLACK);
    const vv = doc.splitTextToSize(v, cellW - 12)[0];
    doc.text(vv, cx, cy + 12.5);
  });
  y += cellH * 2 + 9;

  // ---------- Parties / intro ----------
  A.intro.forEach((p) => paragraph(fill(p), { size: 10, gap: 2.6 }));
  y += 2;

  // ---------- Clauses ----------
  A.clauses.forEach((c, i) => {
    ensure(18);
    y += 2;
    setText(11.5, "bold", GREEN_DARK);
    doc.text(`${i + 1}.`, M, y + 4);
    setText(11.5, "bold", BLACK);
    doc.text(c.title, M + 8, y + 4);
    y += 8;
    c.paragraphs.forEach((p, j) => {
      const label = c.paragraphs.length > 1 ? `${i + 1}.${j + 1}` : "";
      if (label) {
        ensure(lineH(10));
        setText(9, "bold", GREY);
        doc.text(label, M + 8, y + lineH(10) * 0.75);
      }
      paragraph(fill(p), { x: M + (label ? 17 : 8), width: CW - (label ? 17 : 8), gap: 2.4 });
    });
  });

  // ---------- Acceptance ----------
  y += 3;
  const accLines = (() => {
    setText(10, "normal");
    return doc.splitTextToSize(fill(A.acceptanceStatement), CW - 16);
  })();
  const accH = accLines.length * lineH(10) + 10;
  ensure(accH + 4);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, accH, 2, 2, "S");
  // tick box
  doc.setFillColor(...GREEN);
  doc.roundedRect(M + 4, y + 4.5, 5, 5, 0.8, 0.8, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.lines([[1.2, 1.3], [2.4, -2.8]], M + 5.1, y + 7.2, [1, 1], "S");
  setText(10, "normal", BLACK);
  accLines.forEach((ln, k) => doc.text(ln, M + 12, y + 8.5 + k * lineH(10)));
  y += accH + 8;

  // ---------- Signatures ----------
  const SIG_BLOCK_H = 74;
  ensure(SIG_BLOCK_H);
  setText(12, "bold", BLACK);
  doc.text("Signatures", M, y + 4);
  y += 9;

  const colW = (CW - 8) / 2;
  const boxH = 34;
  const blocks = [
    {
      heading: `For and on behalf of ${r.venue}`,
      sig: r.customer.signature,
      lines: [
        ["Name", r.customer.name],
        ["Capacity", "Authorised signatory for the Venue"],
        ["Date", formatDateLong(r.customer.signedAt)],
      ],
    },
    {
      heading: `For and on behalf of ${A.company.name}`,
      sig: r.terracharge.signature,
      lines: [
        ["Name", r.terracharge.signatoryName],
        ["Position", r.terracharge.position || "Authorised signatory"],
        ["Date", formatDateLong(r.terracharge.signedAt)],
      ],
    },
  ];
  blocks.forEach((b, i) => {
    const x = M + i * (colW + 8);
    let yy = y;
    setText(8, "bold", GREY);
    doc.text(doc.splitTextToSize(b.heading.toUpperCase(), colW)[0], x, yy + 3);
    yy += 6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yy, colW, boxH, 1.5, 1.5, "FD");
    if (b.sig) placeContain(doc, b.sig, x + 3, yy + 3, colW - 6, boxH - 6);
    yy += boxH + 5;
    b.lines.forEach(([k, v]) => {
      setText(8, "bold", GREY);
      doc.text(k.toUpperCase(), x, yy);
      setText(9.5, "normal", BLACK);
      doc.text(doc.splitTextToSize(v, colW - 20)[0] || "", x + 19, yy);
      yy += 5.4;
    });
  });
  y += 6 + boxH + 5 + 5.4 * 3 + 6;

  // ---------- Signing record (audit) ----------
  const rows = [
    ["Agreement", `${A.title}, version ${A.version} (effective ${A.effectiveDate})`],
    ["Document reference", r.reference],
    ["Venue", r.venue],
    ["Agreed revenue share", `${r.share}% of net rental revenue`],
    ["Venue signatory", r.customer.name],
    ["Terms accepted", r.customer.accepted ? "Yes — signatory ticked the acceptance confirmation before signing" : "No"],
    ["Venue signed at", formatDateTimeFull(r.customer.signedAt)],
    ["Countersigned by", `${r.terracharge.signatoryName}${r.terracharge.position ? `, ${r.terracharge.position}` : ""} (${A.company.name})`],
    ["Countersigned at", formatDateTimeFull(r.terracharge.signedAt)],
    ["PDF generated at", formatDateTimeFull(r.generatedAt)],
    ["Method", "Signed by finger on TerraCharge's device; generated offline. No data sent to any server."],
    ["Terms fingerprint", `SHA-256 ${r.textHash}`],
  ];
  setText(9, "normal");
  const valW = CW - 52;
  const rowHeights = rows.map(([, v]) => Math.max(1, doc.splitTextToSize(v, valW).length) * lineH(9) + 2.4);
  const recH = rowHeights.reduce((a, b) => a + b, 0) + 16;
  ensure(Math.min(recH, BOTTOM - 30));
  if (y > 31) {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, y, PAGE_W - M, y);
  }
  y += 7;
  setText(12, "bold", BLACK);
  doc.text("Signing Record", M, y);
  y += 6;
  rows.forEach(([k, v], i) => {
    const h = rowHeights[i];
    ensure(h);
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.rect(M, y, CW, h, "F");
    }
    setText(8.5, "bold", GREY);
    doc.text(k, M + 3, y + lineH(9) * 0.75 + 1.2);
    const isHash = k === "Terms fingerprint";
    if (isHash) { doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(...BLACK); }
    else setText(9, "normal", BLACK);
    doc.splitTextToSize(v, valW).forEach((ln, j) => doc.text(ln, M + 49, y + lineH(9) * (0.75 + j) + 1.2));
    y += h;
  });

  // ---------- Footers / watermark on every page ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, FOOTER_Y - 4.5, PAGE_W - M, FOOTER_Y - 4.5);
    setText(7.5, "normal", GREY);
    const co = [A.company.name, A.company.companyNumber && `Company No. ${A.company.companyNumber}`, A.company.registeredAddress]
      .filter(Boolean).join("  ·  ");
    doc.text(`${co}  ·  ${A.title} v${A.version}  ·  Ref ${r.reference}`, M, FOOTER_Y);
    doc.text(`Page ${p} of ${total}`, PAGE_W - M, FOOTER_Y, { align: "right" });

    if (A.isPlaceholder) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.13 }));
      setText(40, "bold", [200, 30, 30]);
      const wm = "DRAFT – PLACEHOLDER TERMS";
      const ww = doc.getTextWidth(wm);
      const th = (35 * Math.PI) / 180; // rotate about the page centre
      doc.text(wm, PAGE_W / 2 - (ww / 2) * Math.cos(th), PAGE_H / 2 + (ww / 2) * Math.sin(th), { angle: 35 });
      doc.restoreGraphicsState();
    }
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
