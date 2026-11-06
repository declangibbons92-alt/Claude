import { AGREEMENT } from "./agreement.js";
import { SignaturePad } from "./signature-pad.js";
import { buildAgreementPdf } from "./pdf-builder.js";
import { getTcSignature, saveTcSignature, deleteTcSignature } from "./signature-store.js";
import { $, $$, on, escapeHtml, formatDateLong, isoLocalDate, makeReference, slug, vibrate } from "./util.js";

/* ------------------------------------------------------------------ */
/* State — held in memory only. Customer details and signatures are    */
/* never written to storage or sent anywhere.                          */
/* ------------------------------------------------------------------ */
let state;
function freshState() {
  return {
    venue: "",
    share: null,
    reference: null,
    customer: { name: "", position: "", signature: null, signedAt: null },
    tc: null,
    pdf: null, // { blob, name }
    saved: false,
  };
}
state = freshState();

/* ------------------------------ Navigation ------------------------------ */
let current = "home";
function show(name) {
  $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
  current = name;
  if (name === "home") refreshHome();
  if (name === "settings") renderSettings();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const act = a.dataset.action;
  if (act === "new") startNew(Number(a.dataset.share));
  else if (act === "home") goHome();
  else if (act === "settings") { settingsReturn = "home"; show("settings"); }
  else if (act === "details") show("details");
  else if (act === "agreement") show("agreement");
  else if (act === "finish") finish();
});

function goHome() {
  if (current === "settings" && settingsReturn === "agreement") return show("agreement");
  if (state.customer.signature && !state.saved) {
    if (!confirm("Leave this agreement? The signature collected so far will be discarded.")) return;
    state = freshState();
  }
  show("home");
}

/* ------------------------------ Toast / busy ------------------------------ */
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function busy(on, text = "Working…") {
  $("#busyText").textContent = text;
  $("#busy").hidden = !on;
}

/* ------------------------------ Home ------------------------------ */
function refreshHome() {
  const el = $("#homeStatus");
  const parts = [];
  if (AGREEMENT.isPlaceholder) parts.push("Draft terms — not for real signings");
  if (!getTcSignature()) parts.push("TerraCharge signature not set up");
  el.textContent = parts.length ? parts.join(" · ") : `Agreement v${AGREEMENT.version} · Ready`;
  el.classList.toggle("warn", parts.length > 0);
}

/* ------------------------------ Details ------------------------------ */
// The revenue share is chosen on the home screen (20% / 30% cards).
let pendingShare = null;
let keepVenueName = false; // set when "Change" is tapped on the details screen

function startNew(share) {
  state = freshState();
  pendingShare = share;
  if (!keepVenueName) $("#venueName").value = "";
  keepVenueName = false;
  $("#shareChipPct").textContent = `${share}%`;
  $("#detailsTitle").textContent = `${share}% Agreement`;
  $("#signerName").value = "";
  setPosition("");
  updateDetailsButton();
  vibrate();
  show("details");
  if (!$("#venueName").value) setTimeout(() => $("#venueName").focus(), 260);
}

on("#venueName", "input", updateDetailsButton);
on("#venueName", "keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
on("#changeShare", "click", () => {
  keepVenueName = true;
  show("home");
});

function selectedShare() {
  return pendingShare;
}
function updateDetailsButton() {
  $("#toAgreement").disabled = !($("#venueName").value.trim().length >= 2 && selectedShare());
}

on("#toAgreement", "click", () => {
  const venue = $("#venueName").value.trim().replace(/\s+/g, " ");
  const share = selectedShare();
  // If the terms changed after signing, the signatures no longer apply.
  if (state.customer.signature && (venue !== state.venue || share !== state.share)) {
    state.customer.signature = null;
    state.customer.signedAt = null;
    state.tc = null;
    state.pdf = null;
    toast("Details changed — please sign again.");
  }
  state.venue = venue;
  state.share = share;
  state.reference ||= makeReference();
  renderAgreement();
  show("agreement");
  $("#agreementScroll").scrollTop = 0;
});

/* ------------------------------ Agreement ------------------------------ */
/** Escape, apply **bold** markup, and highlight the inserted venue/commission. */
function fillHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replaceAll("{{VENUE}}", `<mark class="fill">${escapeHtml(state.venue)}</mark>`)
    .replaceAll("{{SHARE}}", `<mark class="fill">${state.share}%</mark>`);
}

function renderAgreement() {
  const A = AGREEMENT;
  $("#draftBanner").hidden = !A.isPlaceholder;
  const clauses = A.clauses
    .map((c, i) => `<li><span class="n">${i + 1}</span><p><strong>${escapeHtml(c.title)}:</strong> ${fillHtml(c.text)}</p></li>`)
    .join("");

  $("#docBody").innerHTML = `
    <header class="doc__head">
      <div class="doc__headtext">
        <div class="doc__brand">TERRA<span>CHARGE</span></div>
        <div class="doc__tagline">${escapeHtml(A.tagline)}</div>
        <div class="doc__title">${escapeHtml(A.title)}</div>
        <div class="doc__parties">${escapeHtml(A.partiesLine)}</div>
        <div class="doc__meta">${escapeHtml(A.descriptor)}</div>
      </div>
      <img class="doc__photo" src="icons/unit.jpg" alt="TerraCharge power bank station" />
    </header>
    <div class="doc__ref">Agreement v${escapeHtml(A.version)} · Ref ${escapeHtml(state.reference)}</div>
    <div class="doc__body">
      <p class="doc__partiesline"><b class="g">Parties</b> ${fillHtml(A.parties)}</p>
      <ol class="doc__clauses">${clauses}</ol>
    </div>
    <footer class="doc__foot">${[A.company.name, `Company no. ${A.company.companyNumber}`, A.company.website, A.company.email, A.company.phone].map(escapeHtml).join(" · ")}</footer>`;

  $("#signerName").value = state.customer.name;
  setPosition(state.customer.position);
  refreshSignState();
}

function signDate() {
  return state.customer.signedAt || new Date();
}

function refreshSignState() {
  const c = state.customer;
  c.name = $("#signerName").value.trim().replace(/\s+/g, " ");
  const ready = c.name.length >= 3 && c.name.includes(" ") && !!c.position;

  $("#signDate").textContent = formatDateLong(signDate());

  // Customer signature box
  const box = $("#customerSigBox");
  box.dataset.empty = String(!c.signature);
  if (c.signature) $("#customerSigImg").src = c.signature.dataUrl;
  $("#customerSigRedo").hidden = !c.signature;
  $("#tapToSign").hidden = !!c.signature;
  $("#tapToSign").disabled = !ready;
  $("#signHint").hidden = !!c.signature;
  $("#signHint").textContent = !c.name
    ? "Enter your full name and position to sign."
    : !c.name.includes(" ") || c.name.length < 3
      ? "Please enter your full name (first and last)."
      : !c.position
        ? "Select Manager or Owner."
        : "Ready to sign.";

  // If the customer's name or position changes after TerraCharge approved, approval is void.
  if (state.tc && (c.name !== state.tc.approvedName || c.position !== state.tc.approvedPosition || !c.signature)) {
    state.tc = null;
    state.pdf = null;
  }

  const customerDone = !!c.signature && ready;
  $("#tcSection").hidden = !customerDone;
  const tbox = $("#tcSigBox");
  tbox.dataset.empty = String(!state.tc);
  if (state.tc) $("#tcSigImg").src = state.tc.signature.dataUrl;
  const info = getTcSignature();
  $("#tcMeta").textContent = state.tc
    ? `Signed by ${state.tc.signatoryName} on ${formatDateLong(state.tc.signedAt)}`
    : info
      ? `Signed by ${info.signatoryName}.`
      : "No TerraCharge signature is set up on this iPhone yet.";
  $("#approveBtn").hidden = !!state.tc;
  $("#approveBtn").innerHTML = info
    ? `<svg class="i"><use href="#pen"/></svg> Add TerraCharge signature`
    : `<svg class="i"><use href="#gear"/></svg> Set up TerraCharge signature`;
  $("#generateBtn").hidden = !state.tc;
}

on("#signerName", "input", refreshSignState);
on("#signerName", "keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
function setPosition(pos) {
  state.customer.position = pos;
  $$("[data-position]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.position === pos)));
}
$$("[data-position]").forEach((b) =>
  b.addEventListener("click", () => { setPosition(b.dataset.position); vibrate(); refreshSignState(); })
);

on("#tapToSign", "click", () => {
  openPad({
    title: "Venue signature",
    sub: `${state.customer.name} · ${state.venue}`,
    onConfirm: (sig) => {
      state.customer.signature = sig;
      state.customer.signedAt = new Date();
      state.pdf = null;
      refreshSignState();
      setTimeout(() => $("#tcSection").scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      toast("Signature added");
    },
  });
});
on("#customerSigRedo", "click", () => {
  state.customer.signature = null;
  state.customer.signedAt = null;
  state.tc = null;
  refreshSignState();
  $("#tapToSign").click();
});

/* ------------------------------ Signature pad ------------------------------ */
let pad = null;
let padOpts = null;
function openPad(opts) {
  padOpts = opts;
  $("#sigpadTitle").textContent = opts.title;
  $("#sigpadSub").textContent = opts.sub || "";
  $("#sigpad").hidden = false;
  document.activeElement?.blur?.();
  if (!pad) {
    pad = new SignaturePad($("#sigCanvas"));
    pad.onChange = () => {
      $("#sigConfirm").disabled = pad.isEmpty();
      $("#sigGhost").hidden = pad.strokes.length > 0;
    };
  }
  requestAnimationFrame(() => { pad.resize(); pad.clear(); });
}
function closePad() {
  $("#sigpad").hidden = true;
  padOpts = null;
}
on("#sigClear", "click", () => pad.clear());
on("#sigCancel", "click", closePad);
on("#sigConfirm", "click", () => {
  const sig = pad.export();
  if (!sig) return;
  const cb = padOpts.onConfirm;
  closePad();
  vibrate(20);
  cb(sig);
});

/* ------------------------------ TerraCharge approval ------------------------------ */
let settingsReturn = "home";
on("#approveBtn", "click", () => {
  const v = getTcSignature();
  if (!v) {
    settingsReturn = "agreement";
    show("settings");
    return;
  }
  state.tc = {
    signatoryName: v.signatoryName,
    position: v.position,
    signature: v.signature,
    signedAt: new Date(),
    approvedName: state.customer.name,
    approvedPosition: state.customer.position,
  };
  vibrate(20);
  refreshSignState();
  setTimeout(() => $("#generateBtn").scrollIntoView({ behavior: "smooth", block: "center" }), 120);
});

/* ------------------------------ PDF ------------------------------ */
let unitPhotoCache;
async function loadUnitPhoto() {
  if (unitPhotoCache !== undefined) return unitPhotoCache;
  try {
    const blob = await (await fetch("icons/unit.jpg")).blob();
    unitPhotoCache = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch {
    unitPhotoCache = null; // PDF still builds without the photo
  }
  return unitPhotoCache;
}

on("#generateBtn", "click", generatePdf);

async function generatePdf() {
  if (!window.jspdf) return toast("PDF engine not loaded — reopen the app.");
  busy(true, "Creating PDF…");
  try {
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    const record = {
      venue: state.venue,
      share: state.share,
      reference: state.reference,
      unitPhoto: await loadUnitPhoto(),
      customer: { ...state.customer },
      terracharge: state.tc,
      generatedAt: new Date(),
    };
    const blob = buildAgreementPdf(record);
    const name = `TerraCharge-Unit-Hosting-Agreement-${slug(state.venue)}-${isoLocalDate(state.customer.signedAt)}.pdf`;
    state.pdf = { blob, name };
    state.saved = false;
    resetSaveUi();
    busy(true, "Preparing preview…");
    await renderPreview(blob);
    show("preview");
    $("#pdfPages").scrollTop = 0;
  } catch (err) {
    console.error(err);
    toast("Could not create the PDF. Please try again.");
  } finally {
    busy(false);
  }
}

async function renderPreview(blob) {
  const host = $("#pdfPages");
  host.innerHTML = "";
  const lib = window.pdfjsLib;
  if (!lib) {
    host.innerHTML = `<p class="pad muted">Preview unavailable. Use “Save / Share PDF” to open it.</p>`;
    return;
  }
  lib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await lib.getDocument({ data, isEvalSupported: false }).promise;
  const cssW = Math.min(host.clientWidth || window.innerWidth, 820) - 20;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (cssW * dpr) / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.setAttribute("aria-label", `Page ${i} of ${pdf.numPages}`);
    host.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  }
  pdf.destroy();
}

on("#shareBtn", "click", async () => {
  if (!state.pdf) return;
  const file = new File([state.pdf.blob], state.pdf.name, { type: "application/pdf" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: state.pdf.name });
      markSaved();
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return; // user closed the share sheet
    console.warn("share failed, falling back to download", err);
  }
  // Fallback (desktop browsers / older iOS): download the file.
  const url = URL.createObjectURL(state.pdf.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.pdf.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  markSaved();
});

function markSaved() {
  state.saved = true;
  $("#saveHint").textContent = "Saved. Tap Finish to start the next agreement.";
  $("#saveHint").classList.add("ok");
  $("#shareBtn").classList.replace("btn--green", "btn--outline");
  $("#shareBtn").lastChild.textContent = " Save again";
  $("#doneBtn").classList.replace("btn--outline", "btn--green");
  $("#doneBtn").textContent = "Finish";
}

function resetSaveUi() {
  $("#saveHint").innerHTML = "Tap <b>Save to Files</b>, then choose <b>Save to Files</b> and your agreements folder. Your iPhone remembers the folder next time.";
  $("#saveHint").classList.remove("ok");
  $("#shareBtn").classList.replace("btn--outline", "btn--green");
  $("#shareBtn").lastChild.textContent = " Save to Files";
  $("#doneBtn").classList.replace("btn--green", "btn--outline");
  $("#doneBtn").textContent = "Done";
}

function finish() {
  if (!state.saved && !confirm("You haven't saved or shared this PDF yet. Finish anyway? It will be discarded.")) return;
  state = freshState();
  $("#pdfPages").innerHTML = "";
  show("home");
}

/* ------------------------------ Settings (TerraCharge signature) ------------------------------ */
let setupSig = null;
function renderSettings() {
  const info = getTcSignature();
  $("#vaultExisting").hidden = !info;
  $("#vaultForm").hidden = !!info;
  $("#vaultError").hidden = true;
  if (info) {
    $("#vaultExistingText").textContent = `${info.signatoryName} · saved ${formatDateLong(new Date(info.createdAt))}`;
    $("#vaultExistingImg").src = info.signature.dataUrl;
  } else {
    setupSig = null;
    $("#tcSetupBox").dataset.empty = "true";
  }
  $("#aboutText").textContent =
    `App ${window.TC_APP_VERSION || "?"} · Agreement version ${AGREEMENT.version}${AGREEMENT.isPlaceholder ? " (DRAFT placeholder terms)" : ""}. ` +
    "Customer details and signatures are kept in memory only while an agreement is open, and are never sent to any server.";
}

function drawTcSignature(e) {
  e?.preventDefault?.();
  openPad({
    title: "TerraCharge signature",
    sub: $("#tcName").value.trim(),
    onConfirm: (sig) => {
      setupSig = sig;
      $("#tcSetupImg").src = sig.dataUrl;
      $("#tcSetupBox").dataset.empty = "false";
      $("#tcDrawBtn").lastChild.textContent = " Draw again";
    },
  });
}
on("#tcSetupBox", "click", drawTcSignature);
on("#tcDrawBtn", "click", drawTcSignature);

on("#vaultReplace", "click", () => {
  if (!confirm("Replace the stored TerraCharge signature?")) return;
  $("#vaultExisting").hidden = true;
  $("#vaultForm").hidden = false;
  setupSig = null;
  $("#tcSetupBox").dataset.empty = "true";
});
on("#vaultDelete", "click", () => {
  if (!confirm("Delete the stored TerraCharge signature from this iPhone?")) return;
  deleteTcSignature();
  toast("Signature deleted");
  renderSettings();
});

on("#vaultForm", "submit", (e) => {
  e.preventDefault();
  const err = (m) => { $("#vaultError").textContent = m; $("#vaultError").hidden = false; };
  const name = $("#tcName").value.trim();
  const position = $("#tcPosition").value.trim();
  if (name.length < 3) return err("Enter your full name.");
  if (!setupSig) return err("Tap the box and draw your signature.");
  try {
    saveTcSignature({ signatoryName: name, position, signature: setupSig });
  } catch (ex) {
    console.error(ex);
    return err("Could not save the signature on this iPhone. Please try again.");
  }
  toast("TerraCharge signature saved");
  if (settingsReturn === "agreement") {
    settingsReturn = "home";
    show("agreement");
    refreshSignState();
  } else renderSettings();
});

/* ------------------------------ Misc ------------------------------ */
// Keep the auto-filled date correct if the app is left open past midnight.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && current === "agreement") refreshSignState();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW registration failed", e));
}

refreshHome();
window.TC_APP_READY = true;
