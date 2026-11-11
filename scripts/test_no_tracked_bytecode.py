import subprocess
import unittest


class TestNoTrackedBytecode(unittest.TestCase):
    def test_no_pyc_or_pycache(self) -> None:
        out = subprocess.check_output(["git", "ls-files", "-z"], text=True)
        tracked = [p for p in out.split("\0") if p]
        bad = [
            p
            for p in tracked
            if p.endswith(".pyc")
            or "/__pycache__/" in p
            or p.startswith("__pycache__/")
        ]
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main()
