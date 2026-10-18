#!/usr/bin/env python3
"""Fail if a server-side secret (or an unlicensed Cesium ion token) is in the public Pages artifact.

Usage: check-public-secrets.py <dir>
Prints file, kind and a short sha256 fingerprint ONLY, never the value.
Env: CESIUM_ION_COMMERCIAL=true allows a Cesium ion token (only when ion is licensed).
See docs/SECRETS.md.
"""
import base64, hashlib, json, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "_deploy"
ALLOW_ION = os.environ.get("CESIUM_ION_COMMERCIAL", "").strip().lower() == "true"
TEXT_EXT = (".js", ".mjs", ".html", ".json", ".txt", ".css", ".map", ".xml", ".webmanifest")
# Only the intake-only website key may ship (js/lead-config.js, see its header).
PUBLIC_OVA_FILES = {"js/lead-config.js"}

PATTERNS = {
    "supabase secret key": re.compile(r"\bsb_secret_[A-Za-z0-9_\-]{20,}"),
    "stripe secret/restricted key": re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}"),
    "stripe webhook secret": re.compile(r"\bwhsec_[A-Za-z0-9]{16,}"),
    "google api key": re.compile(r"\bAIza[0-9A-Za-z_\-]{35}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
    "github token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36}"),
    "resend api key": re.compile(r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}"),
    "twilio api key": re.compile(r"\bSK[0-9a-f]{32}\b"),
    "overwatch api key": re.compile(r"\bova_(?:live|test)_[A-Za-z0-9_]{16,}"),
}
JWT = re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")


def fp(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()[:8]


def jwt_kind(tok: str):
    try:
        p = tok.split(".")[1]
        p += "=" * (-len(p) % 4)
        d = json.loads(base64.urlsafe_b64decode(p))
    except Exception:
        return None
    if d.get("role") == "service_role":
        return "supabase service_role JWT"
    if "jti" in d and "id" in d and "role" not in d and not ALLOW_ION:
        return "cesium ion token (ion not licensed for this build)"
    return None  # anon / publishable-equivalent JWTs are public by design


def main() -> int:
    hits = []
    for dp, _, files in os.walk(ROOT):
        for name in files:
            if not name.endswith(TEXT_EXT):
                continue
            path = os.path.join(dp, name)
            rel = os.path.relpath(path, ROOT)
            try:
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
            except OSError:
                continue
            for kind, rx in PATTERNS.items():
                for m in rx.finditer(text):
                    if kind == "overwatch api key" and rel in PUBLIC_OVA_FILES:
                        continue
                    hits.append((rel, kind, fp(m.group(0))))
            for m in JWT.finditer(text):
                k = jwt_kind(m.group(0))
                if k:
                    hits.append((rel, k, fp(m.group(0))))
    for rel, kind, f in sorted(set(hits)):
        print(f"::error file={rel}::{kind} in public artifact (fp={f})")
    if hits:
        print(f"{len(set(hits))} secret finding(s) in {ROOT}. Remove them from the build and rotate. See docs/SECRETS.md.")
        return 1
    print(f"No server-side secrets in {ROOT}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
