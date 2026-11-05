#!/usr/bin/env bash
# Publish TerraCharge Sign to Cloudflare Pages (project "terracharge-sign").
# Only the files the app needs are uploaded (no README/docs/deploy scripts).
#
# Requires: Node.js, a Cloudflare API token with "Cloudflare Pages: Edit".
#   CLOUDFLARE_API_TOKEN=...  ./deploy/deploy.sh
#
# Run ./deploy/setup-access.sh FIRST so the site is locked before anything is public.
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-d91a2b60929f91b9a131556eca5d8add}"
PROJECT="terracharge-sign"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"

cp -R "$APP_DIR/index.html" "$APP_DIR/manifest.webmanifest" "$APP_DIR/sw.js" "$APP_DIR/_headers" \
      "$APP_DIR/css" "$APP_DIR/js" "$APP_DIR/vendor" "$APP_DIR/icons" "$STAGE/"

CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" npx --yes wrangler@3.114.0 pages deploy "$STAGE" \
  --project-name "$PROJECT" --branch main --commit-dirty=true

echo "Published from $STAGE"
