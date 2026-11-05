# TerraCharge Sign

An offline, installable iPhone web app (PWA) for signing TerraCharge Ltd venue hosting agreements on site.

No accounts, no server and no tracking. Customer details and signatures stay in the iPhone's memory while an agreement is open. The finished PDF only goes where you send it with the iOS share sheet.

## ⚠️ Before real use: add the exact agreement wording

The original paper agreement PDF wasn't available when this was built. `js/agreement.js` holds **placeholder** wording that follows the agreed structure: 7 clauses, a rolling agreement, termination on notice and no fixed 12-month term. While `isPlaceholder: true` is set:

- the app shows a "Draft terms" banner, and
- every PDF page carries a **DRAFT – PLACEHOLDER TERMS** watermark.

To finalise:

1. Paste the exact clause wording into `js/agreement.js`. Use `{{VENUE}}` and `{{SHARE}}` where the venue name and percentage go.
2. Fill in the `company` details (company number, address).
3. Set `isPlaceholder: false`, set `version` (e.g. `"1.0"`) and `effectiveDate`.
4. Bump `CACHE_VERSION` in `sw.js` (e.g. `tc-sign-v2`) so installed iPhones update.

## How it works

1. **New Agreement**: enter the venue name and choose 20% or 30%.
2. The full agreement appears as one scrolling page, with the venue and commission filled in.
3. The customer enters their full name, ticks the acceptance box and taps **Tap to Sign**. The date is filled in automatically from the iPhone.
4. They sign on a full-screen white pad (**Clear / Cancel / Confirm**). The signature is cropped and placed in the signature box at its original proportions.
5. **Approve & Countersign**: you enter your approval passcode, and only then is the TerraCharge signature applied.
6. **Create PDF**: the PDF is built on the phone. You can preview every page and then tap **Save / Share PDF**, which opens the iOS share sheet (→ *Save to Files*, AirDrop, Mail, etc.).

### The PDF contains

The full agreement, the venue particulars, the agreed commission and both signatures with names and dates. It ends with a **Signing Record** that shows:

- the agreement version
- the document reference
- the signer's name
- confirmation that the terms were accepted
- the venue and TerraCharge signing date/time, with time zone
- when the PDF was generated
- a SHA-256 fingerprint of the exact terms that were signed

### TerraCharge signature security

Set it up once under **TerraCharge signature** on the home screen. The image and signatory details are encrypted on the device (AES-256-GCM, with the key derived from your 6–12 digit passcode using PBKDF2-SHA-256 at 310,000 iterations). Only the encrypted data is stored, in this app's local storage on this iPhone. After 5 wrong passcodes, there's an increasing lockout. This protects against casual misuse of an unlocked phone; it is not a substitute for keeping the phone itself locked.

> Deleting the app from the home screen, or clearing Safari website data, removes the stored signature. You'll just need to set it up again.

## Project structure

```
index.html            App shell (all screens)
css/app.css           Styling (black / white / green)
js/agreement.js       ← The ONLY place contract wording lives
js/app.js             Screens and flow
js/signature-pad.js   Finger signature capture
js/pdf-builder.js     PDF layout (jsPDF, fully offline)
js/vault.js           Encrypted TerraCharge signature storage
sw.js                 Offline cache (service worker)
manifest.webmanifest  Home-screen install details
vendor/               jsPDF 2.5.2 and pdf.js 3.11.174 (bundled, MIT / Apache-2.0)
_headers              Security headers for Cloudflare Pages
```

There's no build step. It's plain static files.

## Preview and test

### On a computer (quickest)

```bash
cd terracharge-sign
python3 -m http.server 8080
# open http://localhost:8080 — use Safari/Chrome dev tools' iPhone mode
```

### On your iPhone

The iPhone needs to open the app over **HTTPS**. iOS only allows offline mode, home-screen install and the encrypted signature storage on secure (HTTPS) sites. Plain `http://192.168.x.x` from your Mac will show the screens, but setting up the TerraCharge signature and offline mode won't work. There are two private options:

**A. Temporary tunnel from your Mac (no account needed).**

```bash
brew install cloudflared
cd terracharge-sign && python3 -m http.server 8080
cloudflared tunnel --url http://localhost:8080
```

Open the printed `https://….trycloudflare.com` address in Safari on the iPhone. The address is random and unlisted, and it stops working when you press Ctrl-C. Note that anyone who has the link could open it while it runs. Because the link changes each time, the home-screen install only works while the tunnel is up. Use this for testing, not daily use.

**B. Cloudflare Pages + Cloudflare Access (the permanent setup, when you approve).** Create a Pages project with the `terracharge-sign` folder as the output directory (no build command). Then protect it with Cloudflare Access so that only your email can open it. This gives a stable HTTPS address for daily use.

### Install on the home screen

In **Safari**, open the address → **Share** → **Add to Home Screen**. Open it once from the icon while you have signal so that everything is cached. After that it works in airplane mode.

### Test checklist

- [ ] Home → TerraCharge signature: set up your signature and passcode
- [ ] New Agreement → venue name, 20% / 30% → the agreement shows the correct values
- [ ] Name, tick box and Tap to Sign → sign → the signature appears in the box
- [ ] Approve & Countersign → a wrong passcode is rejected → the correct one applies the signature
- [ ] Create PDF → check every page → Save / Share PDF → Save to Files
- [ ] Turn on Airplane Mode, force-quit the app, reopen it from the icon and repeat the steps above

## Updating

After changing any file, bump `CACHE_VERSION` in `sw.js`. An installed app picks up the new version the next time it's opened online. Close and reopen it once more to see the change.
