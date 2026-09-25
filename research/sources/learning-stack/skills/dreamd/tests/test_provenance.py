"""Provenance gate: bullets with a valid id, an unknown id, no id -> kept 1, dropped 2; non-bullet lines pass through."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402


class ProvenanceTest(unittest.TestCase):
    def test_gate(self):
        lines = ["## Decisions", "- keep sonnet as default [obs:120, obs:121]", "- unknown evidence [obs:999]", "- no evidence at all", ""]
        kept, dropped = D.provenance_gate(lines, {"obs:120", "S4cdc37"})
        self.assertEqual(kept, ["## Decisions", "- keep sonnet as default [obs:120, obs:121]", ""])
        self.assertEqual(dropped, 2)

    def test_cited_ids(self):
        self.assertEqual(D.cited_ids("x [obs:12, S4cdc376a-3b10] obs:7"), {"obs:12", "S4cdc376a-3b10", "obs:7"})
        self.assertEqual(D.cited_ids("Sonnet said Something"), set())


if __name__ == "__main__":
    unittest.main()
