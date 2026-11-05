#!/usr/bin/env bash
# Lock TerraCharge Sign behind Cloudflare Access so only the listed emails can open it.
# Protects both sign.terracharge.co.uk and the backup terracharge-sign.pages.dev address.
#
# Requires: Zero Trust enabled on the account (dashboard -> Zero Trust -> Free plan),
# and an API token with "Access: Apps and Policies: Edit".
#   CLOUDFLARE_API_TOKEN=...  ALLOWED_EMAILS="a@example.com,b@example.com"  ./deploy/setup-access.sh
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-d91a2b60929f91b9a131556eca5d8add}"
API="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps"
AUTH=()
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
: "${ALLOWED_EMAILS:?Set ALLOWED_EMAILS to a comma-separated list}"

INCLUDE=$(python3 -c "import json,os; print(json.dumps([{'email': {'email': e.strip()}} for e in os.environ['ALLOWED_EMAILS'].split(',') if e.strip()]))")

BODY=$(cat <<JSON
{
  "name": "TerraCharge Sign",
  "type": "self_hosted",
  "domain": "sign.terracharge.co.uk",
  "self_hosted_domains": ["sign.terracharge.co.uk", "terracharge-sign.pages.dev", "*.terracharge-sign.pages.dev"],
  "session_duration": "720h",
  "app_launcher_visible": false,
  "policies": [
    { "name": "TerraCharge owner only", "decision": "allow", "precedence": 1, "include": $INCLUDE }
  ]
}
JSON
)

curl -sS -X POST "$API" "${AUTH[@]}" -H "Content-Type: application/json" -d "$BODY" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('success:', d['success'], d.get('errors')); r=d.get('result') or {}; print('app:', r.get('id'), r.get('self_hosted_domains'), 'policies:', len(r.get('policies') or []))"
