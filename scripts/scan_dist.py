"""Grep dist/ for constructs that script-security heuristics flag.

usage: scan_dist.py DIST_DIR
Prints file:line:column and a trimmed excerpt for every hit; exit status is always 0.
"""
import re
import sys
from pathlib import Path

PATTERNS: dict[str, re.Pattern[str]] = {
    "eval(": re.compile(r"(?<![\w$.])eval\s*\("),
    "new Function": re.compile(r"new\s+Function\s*\("),
    "Function(": re.compile(r"(?<![\w$.])Function\s*\(\s*['\"`]"),
    "setTimeout/setInterval with string": re.compile(r"set(?:Timeout|Interval)\s*\(\s*['\"`]"),
    "document.write": re.compile(r"document\s*\.\s*write(?:ln)?\s*\("),
    "innerHTML/outerHTML/insertAdjacentHTML": re.compile(r"\.(?:innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML\s*\("),
    "inline event handler attribute": re.compile(r"""<[a-zA-Z][^>]*\s(on[a-z]+)\s*=\s*["']""", re.I),
    "javascript: URL": re.compile(r"""(?:href|src|action)\s*=\s*["']?\s*javascript:""", re.I),
    "WebAssembly": re.compile(r"WebAssembly"),
    "atob/btoa/fromCharCode": re.compile(r"\b(?:atob|btoa)\s*\(|String\.fromCharCode"),
    "base64 blob (>=120 chars)": re.compile(r"[A-Za-z0-9+/]{120,}={0,2}"),
    "hex blob (>=64 hex digits)": re.compile(r"(?:0x)?[0-9a-fA-F]{64,}"),
    "\\x escape run": re.compile(r"(?:\\x[0-9a-fA-F]{2}){8,}"),
    "unicode escape run": re.compile(r"(?:\\u[0-9a-fA-F]{4}){8,}"),
    "external URL": re.compile(r"""(?:src|href|url\()\s*=?\s*["']?https?://(?!totative\.dev|github\.com/Totative|www\.w3\.org)[^\s"')>]+"""),
}
TEXT_SUFFIXES = {".html", ".js", ".css", ".svg", ".json", ".txt", ".xml", ".mjs"}


def main() -> int:
    root = Path(sys.argv[1])
    counts: dict[str, int] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
            continue
        text = path.read_text(errors="replace")
        for label, pattern in PATTERNS.items():
            for m in pattern.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                col = m.start() - (text.rfind("\n", 0, m.start()) + 1) + 1
                excerpt = m.group(0)[:90].replace("\n", " ")
                print(f"{label}\t{path}:{line}:{col}\t{excerpt}")
                counts[label] = counts.get(label, 0) + 1
    print("\n== counts ==")
    for label in PATTERNS:
        print(f"{counts.get(label, 0):4d}  {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
