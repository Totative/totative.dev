"""Scan a directory with every rule file YARA-X can compile.

usage: scan_yara.py RULES_DIR TARGET_DIR
Prints each match, then how many rule files compiled and how many were skipped.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

EXTERNALS = ["filename", "filepath", "extension", "filetype", "owner"]


def define_args() -> list[str]:
    values = {"filename": '"index.html"', "filepath": '"dist/index.html"', "extension": '".html"', "filetype": '"HTML"', "owner": '""'}
    out: list[str] = []
    for name in EXTERNALS:
        out += ["--define", f"{name}={values[name]}"]
    return out


def main() -> int:
    rules_dir, target = Path(sys.argv[1]), sys.argv[2]
    files = sorted(rules_dir.glob("*.yar")) + sorted(rules_dir.glob("*.yara"))
    ok: list[Path] = []
    skipped: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        probe = Path(tmp) / "probe.txt"
        probe.write_text("probe\n")
        for f in files:
            r = subprocess.run(["yr", "scan", *define_args(), str(f), str(probe)], capture_output=True, text=True)
            if r.returncode == 0:
                ok.append(f)
            else:
                skipped.append(f.name)
    cmd = ["yr", "scan", "-r", *define_args()]
    for f in ok:
        cmd.append(f"{f.stem}:{f}")
    cmd.append(target)
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout.strip() or "(no matches)")
    errors = [line for line in r.stderr.splitlines() if line.startswith("error")]
    warnings = sum(1 for line in r.stderr.splitlines() if line.startswith("warning"))
    print("\n".join(errors))
    print(f"({warnings} rule-style warnings suppressed)")
    print(f"\n== yara-x: {len(ok)} rule files compiled, {len(skipped)} skipped of {len(files)}; scan exit {r.returncode} ==")
    print("skipped: " + ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
