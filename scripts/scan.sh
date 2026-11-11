#!/usr/bin/env bash
# Security scan of the built site and its dependencies. Local only: nothing is sent to an external scanner.
# usage: bun run scan   (outputs land in scan-out/, overwritten each run)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/scan-out"
PORT=4322
BASE="http://127.0.0.1:$PORT"
CLAMDB=/var/tmp/clamav-db
YARA_DIR=/var/tmp/yara-rules
CHROME="${CHROME_PATH:-$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | tail -1)}"

rm -rf --one-file-system -- scan-out && mkdir -p scan-out
step() { printf '\n== %s ==\n' "$1"; }
# A scanner that finds something exits non-zero; the result is in its output file, not the exit code.
run() { local name="$1"; shift; step "$name"; "$@" >"$OUT/$name.txt" 2>&1; echo "exit $?" >>"$OUT/$name.txt"; tail -n 15 "$OUT/$name.txt"; }

step build
bun run build >"$OUT/build.txt" 2>&1 || { tail -30 "$OUT/build.txt"; echo "build failed"; exit 1; }

bunx astro preview --host 127.0.0.1 --port "$PORT" >"$OUT/preview.txt" 2>&1 &
PREVIEW=$!
trap 'kill "$PREVIEW" 2>/dev/null; wait "$PREVIEW" 2>/dev/null' EXIT
for _ in $(seq 1 60); do curl -fs "$BASE/" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fs "$BASE/" >/dev/null || { echo "preview did not start"; exit 1; }

run osv osv-scanner scan source -r --format table --x-exclude archive --x-exclude screenshots --x-exclude dist .
run grype grype dir:. --exclude './archive/**' --exclude './dist/**' --exclude './screenshots/**'
run retire bunx retire --path dist
run trivy trivy fs --scanners vuln,secret,misconfig --skip-dirs archive,screenshots,dist,node_modules .
run gitleaks gitleaks dir . --no-banner --redact -v --config scripts/gitleaks.toml
run semgrep semgrep scan --metrics off --config p/javascript --config p/typescript src scripts
run dist-grep python3 scripts/scan_dist.py dist
run clamav clamscan -r --database="$CLAMDB" dist/
[ -d "$YARA_DIR/signature-base" ] || git clone -q --depth 1 https://github.com/Neo23x0/signature-base "$YARA_DIR/signature-base"
run yara uv run --no-project python scripts/scan_yara.py "$YARA_DIR/signature-base/yara" dist
run runtime uv run --with playwright python scripts/scan_runtime.py "$BASE" "$OUT"

step lighthouse
for page in e/ e/writeups/checking-a-totative-release/; do
  name="lighthouse-$(echo "$page" | tr '/' '_')"
  CHROME_PATH="$CHROME" bunx lighthouse "$BASE/$page" --quiet --chrome-flags="--headless --no-sandbox" \
    --only-categories=best-practices,accessibility,performance --output=json --output-path="$OUT/$name.json" >"$OUT/$name.log" 2>&1
  python3 scripts/scan_lighthouse.py "$OUT/$name.json" | tee -a "$OUT/lighthouse.txt"
done

run nuclei nuclei -u "$BASE" -tags exposure,misconfig,tech,xss -silent -no-color

step done
echo "raw outputs in $OUT"
