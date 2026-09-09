#!/usr/bin/env bash
# eNFA QUALITY - print correctly signed ANON_KEY and SERVICE_ROLE_KEY for the
# JWT_SECRET already present in backend/.env, and verify the existing keys.
#
# Usage:
#   cd /apps/webapplications/NFA_Approval/Quality
#   ./scripts/generate-keys.sh
#
# Nothing is written automatically: copy the printed values into backend/.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${BACKEND_DIR:-}" ]]; then
  if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
    BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
  else
    BACKEND_DIR="/apps/webapplications/NFA_Approval/Quality/backend"
  fi
fi

ENV_FILE="$BACKEND_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }

read_env() {
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" \
    | tail -n1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
          -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

JWT_SECRET="$(read_env JWT_SECRET)"
CUR_ANON="$(read_env ANON_KEY)"
CUR_SERVICE="$(read_env SERVICE_ROLE_KEY)"

[[ -n "$JWT_SECRET" ]] || { echo "JWT_SECRET is empty in $ENV_FILE"; exit 1; }
if (( ${#JWT_SECRET} < 40 )); then
  echo "JWT_SECRET is shorter than 40 characters. Generate a new one with:"
  echo "  openssl rand -hex 32"
  exit 1
fi

JWT_SECRET="$JWT_SECRET" CUR_ANON="$CUR_ANON" CUR_SERVICE="$CUR_SERVICE" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time

secret = os.environ["JWT_SECRET"].encode()

def b64(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b"=")

def seg(obj) -> bytes:
    return b64(json.dumps(obj, separators=(",", ":")).encode())

def sign(header: bytes, payload: bytes) -> bytes:
    return b64(hmac.new(secret, header + b"." + payload, hashlib.sha256).digest())

def valid(token: str) -> bool:
    try:
        header, payload, signature = token.split(".")
    except ValueError:
        return False
    return hmac.compare_digest(
        sign(header.encode(), payload.encode()).decode(), signature
    )

print("Checking the keys currently in backend/.env")
for label, token in (("ANON_KEY", os.environ["CUR_ANON"]),
                     ("SERVICE_ROLE_KEY", os.environ["CUR_SERVICE"])):
    if not token:
        print(f"  {label:<16} missing")
    elif valid(token):
        print(f"  {label:<16} OK - matches JWT_SECRET")
    else:
        print(f"  {label:<16} INVALID - does not match JWT_SECRET, replace it")

now = int(time.time())
print("\nCopy these lines into backend/.env (replace the existing lines):\n")
for role in ("anon", "service_role"):
    header = seg({"alg": "HS256", "typ": "JWT"})
    payload = seg({
        "role": role,
        "iss": "supabase",
        "ref": "enfa-quality",
        "iat": now,
        "exp": now + 10 * 365 * 24 * 3600,
    })
    token = (header + b"." + payload + b"." + sign(header, payload)).decode()
    name = "ANON_KEY" if role == "anon" else "SERVICE_ROLE_KEY"
    print(f"{name}={token}\n")
PY

cat <<'TXT'
After editing backend/.env:

  1. cd /apps/webapplications/NFA_Approval/Quality
     ./scripts/fix-db-roles.sh        # applies the new values to the containers

  2. The application build also embeds the anon key. Update
     frontend/.env -> VITE_SUPABASE_PUBLISHABLE_KEY (and SUPABASE_PUBLISHABLE_KEY)
     with the SAME new ANON_KEY, then rebuild and redeploy dist/.
TXT
