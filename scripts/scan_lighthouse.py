"""Print category scores and failed best-practices audits from a Lighthouse JSON report."""
import json
import sys


def main() -> int:
    with open(sys.argv[1]) as f:
        report = json.load(f)
    scores = {k: round((v["score"] or 0) * 100) for k, v in report["categories"].items()}
    print(f"{report['finalDisplayedUrl']}  {scores}")
    refs = report["categories"]["best-practices"]["auditRefs"]
    for ref in refs:
        audit = report["audits"][ref["id"]]
        if audit["score"] is not None and audit["score"] < 1 and audit["scoreDisplayMode"] in ("binary", "numeric"):
            print(f"  FAIL best-practices {audit['id']}: {audit['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
