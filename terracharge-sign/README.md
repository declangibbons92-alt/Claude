# TerraCharge Sign

An offline, installable iPhone web app (PWA) for signing TerraCharge Ltd venue hosting agreements on site.

No accounts, no server and no tracking. Customer details and signatures stay in the iPhone's memory while an agreement is open. The finished PDF only goes where you send it with the iOS share sheet.

## Agreement wording

`js/agreement.js` holds the **exact wording** of TerraCharge's *Unit Hosting Agreement*, copied from `TerraCharge_12_Month_Hosting_Agreement.pdf` (8 Oct 2026). It contains the Parties line and clauses 1–7: Purpose, Term (rolling), Exclusivity, Revenue Share, Ownership of Equipment, Payment Details and Ending the Agreement. There is no fixed 12-month term, even though the file name says "12 Month". The app inserts the venue name into the Parties line and 20% or 30% into Clause 4. Nothing else in the app contains contract wording.

If the wording ever changes: edit `js/agreement.js`, bump `version`, and bump `CACHE_VERSION` in `sw.js`.

## How it works

1. On the home screen, tap **20%** or **30%** to start that hosting agreement, then enter the venue name.
2. The full agreement appears as one scrolling page, with the venue and commission filled in.
3. The customer enters their full name, picks **Manager** or **Owner**, and taps **Tap to Sign**. The date is filled in automatically from the iPhone.
4. They sign on a full-screen white pad (**Clear / Cancel / Confirm**). The signature is cropped and placed in the signature box at its original proportions.
5. **Approve & Countersign**: you enter your approval passcode, and only then is the TerraCharge signature applied.
6. **Create PDF**: the PDF is built on the phone. You can preview every page and then tap **Save to Files**. This opens the iOS share sheet: choose *Save to Files* and pick a folder (e.g. iCloud Drive → TerraCharge Agreements). iOS remembers the last folder you used, so after the first time it's just a confirm tap. Web apps aren't allowed to save into Files without that tap.

### The PDF contains

One A4 page, laid out like the paper agreement:
- the header with the product photo
- the Parties line with the venue name
- clauses 1–7 with the agreed commission
- the "Signed on behalf of TerraCharge Ltd" and "The Venue" tables (venue name, name, position, signature and date)

A small reference line in the footer records:
- the agreement version
- the document reference
- the exact signing times and time zone

If a very long venue name would push it onto a second page, the layout tightens automatically so it stays on one page.

### TerraCharge signature security

Set it up once under **TerraCharge signature** on the home screen. The image and signatory details are encrypted on the device (AES-256-GCM, with the key derived from your 6–12 digit passcode using PBKDF2-SHA-256 at 310,000 iterations). Only the encrypted data is stored, in this app's local storage on this iPhone. After 5 wrong passcodes, there's an increasing lockout. This protects against casual misuse of an unlocked phone; it is not a substitute for keeping the phone itself locked.

> Deleting the app from the home screen, or clearing Safari website data, removes the stored signature. You'll just need to set it up again.

## Project structure

```
index.html            App shell (all screens)
css/app.css           Styling (black / white / green)
js/agreement.js       ← The ONLY place contract wording lives (exact text)
js/app.js             Screens and flow
js/signature-pad.js   Finger signature capture
js/pdf-builder.js     PDF layout (jsPDF, fully offline)
js/vault.js           Encrypted TerraCharge signature storage
sw.js                 Offline cache (service worker)
manifest.webmanifest  Home-screen install details
icons/unit.jpg        Product photo from the original agreement
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
- [ ] Name, Manager/Owner and Tap to Sign → sign → the signature appears in the box
- [ ] Approve & Countersign → a wrong passcode is rejected → the correct one applies the signature
- [ ] Create PDF → check every page → Save / Share PDF → Save to Files
- [ ] Turn on Airplane Mode, force-quit the app, reopen it from the icon and repeat the steps above

## Updating

After changing any file, bump `CACHE_VERSION` in `sw.js`. An installed app picks up the new version the next time it's opened online. Close and reopen it once more to see the change.

## Deployment (Cloudflare)

**Live at https://sign.terracharge.co.uk**, locked with Cloudflare Access. Only **contact@terracharge.co.uk** can log in, using a one-time code sent by email. The backup address `terracharge-sign.pages.dev` has the same lock.

- **Account:** Contact@terracharge.co.uk's Account (`d91a2b60929f91b9a131556eca5d8add`)
- **Pages project:** `terracharge-sign` (production branch `main`)
- **Access application:** "TerraCharge Sign" (30-day login), policy "TerraCharge owner only"

### Publishing an update

1. Make the change and bump `CACHE_VERSION` in `sw.js`.
2. Build the single-file bundle and upload it. This needs only an API token with **Cloudflare Pages: Edit**:

```bash
node deploy/build-worker.mjs /tmp/_worker.js
curl -X POST "https://api.cloudflare.com/client/v4/accounts/d91a2b60929f91b9a131556eca5d8add/pages/projects/terracharge-sign/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F 'manifest={}' -F 'branch=main' -F "_worker.js=@/tmp/_worker.js;type=application/javascript+module"
```

On a normal computer, `./deploy/deploy.sh` (wrangler) works too. To change who can log in, edit the policy in **Zero Trust → Access → Applications**, or run `deploy/setup-access.sh` on a fresh account.
