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
5. **Add TerraCharge signature**: one tap adds your saved signature.
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

### Your TerraCharge signature

You draw it once under **TerraCharge signature** on the home screen. It is saved in this app's storage on this iPhone only (never sent anywhere) and added to each agreement with one tap. You can replace or delete it on the same screen.

> Deleting the app from the home screen, or clearing Safari website data, removes the saved signature. You'll just need to draw it again.

## Project structure

```
index.html            App shell (all screens)
css/app.css           Styling (black / white / green)
js/agreement.js       ← The ONLY place contract wording lives (exact text)
js/app.js             Screens and flow
js/signature-pad.js   Finger signature capture
js/pdf-builder.js     PDF layout (jsPDF, fully offline)
js/signature-store.js Saved TerraCharge signature (on this device only)
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

The iPhone needs to open the app over **HTTPS**. iOS only allows offline mode and home-screen install on secure (HTTPS) sites. Plain `http://192.168.x.x` from your Mac will show the screens, but offline mode won't work. There are two private options:

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

- [ ] Home → TerraCharge signature: draw and save your signature
- [ ] New Agreement → venue name, 20% / 30% → the agreement shows the correct values
- [ ] Name, Manager/Owner and Tap to Sign → sign → the signature appears in the box
- [ ] Add TerraCharge signature → your saved signature appears
- [ ] Create PDF → check every page → Save / Share PDF → Save to Files
- [ ] Turn on Airplane Mode, force-quit the app, reopen it from the icon and repeat the steps above

## Updating

After changing any file, run `node deploy/bump-version.mjs <next number>`. An installed app picks up the new version the next time it's opened online. The small version number in the bottom-right corner shows which version is running, and it turns red if something failed.

## Deployment (Cloudflare)

**Live at https://sign.terracharge.co.uk**, locked with Cloudflare Access. Only **contact@terracharge.co.uk** can log in, using a one-time code sent by email. The backup address `terracharge-sign.pages.dev` has the same lock.

- **Account:** Contact@terracharge.co.uk's Account (`d91a2b60929f91b9a131556eca5d8add`)
- **Pages project:** `terracharge-sign` (production branch `main`)
- **Access application:** "TerraCharge Sign" (30-day login), policy "TerraCharge owner only"

### Publishing an update

1. Make the change, then stamp a new version everywhere: `node deploy/bump-version.mjs <next number>`. This updates every file's `?v=` tag, the offline cache name and the corner badge, so an iPhone can never mix old and new files. Open apps pick up the update by themselves, and never mid-signing.
2. Build the single-file bundle and upload it. This needs only an API token with **Cloudflare Pages: Edit**:

```bash
node deploy/build-worker.mjs /tmp/_worker.js
curl -X POST "https://api.cloudflare.com/client/v4/accounts/d91a2b60929f91b9a131556eca5d8add/pages/projects/terracharge-sign/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F 'manifest={}' -F 'branch=main' -F "_worker.js=@/tmp/_worker.js;type=application/javascript+module"
```

On a normal computer, `./deploy/deploy.sh` (wrangler) works too. To change who can log in, edit the policy in **Zero Trust → Access → Applications**, or run `deploy/setup-access.sh` on a fresh account.
