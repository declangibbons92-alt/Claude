// Stamp a new app version everywhere, so an iPhone can never mix old and new files.
//   node deploy/bump-version.mjs 10
// Updates: ?v= tags on every script/style/import, the service-worker cache name,
// and the version shown in the app's corner badge.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const v = process.argv[2];
if (!/^\d+$/.test(v || "")) {
  console.error("Usage: node deploy/bump-version.mjs <number>");
  process.exit(1);
}
const edit = (file, fn) => {
  const p = join(APP, file);
  const before = readFileSync(p, "utf8");
  const after = fn(before);
  writeFileSync(p, after);
  console.log(`${file}: ${before === after ? "unchanged" : "updated"}`);
};
// "x.js" / "x.js?v=9" / "x.css?v=9"  ->  "x.js?v=<v>"
const tag = (s) => s.replace(/((?:js|vendor|css)\/[\w.-]+\.(?:js|css)|\.\/[\w.-]+\.js)(\?v=\d+)?"/g, `$1?v=${v}"`);

edit("index.html", tag);
for (const f of ["app.js", "pdf-builder.js"]) edit(`js/${f}`, tag);
edit("sw.js", (s) => s.replace(/const CACHE_VERSION = "tc-sign-v\d+";/, `const CACHE_VERSION = "tc-sign-v${v}";`));
edit("js/diag.js", (s) => s.replace(/window\.TC_APP_VERSION = "v\d+";/, `window.TC_APP_VERSION = "v${v}";`));
