"""Reflect apply gates: over-cap, repeated lines, collapse keep the old memory; a valid response replaces it and bumps the watermark."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
import reflect as R  # noqa: E402

PREV = """## Current state
- old state line, still cited [obs:10]
## Decisions
## Unresolved
## Preferences & corrections
## Environment gotchas
## Completed ✅ (last 7 days)
"""
VALID = """## Current state
- new state replaces old [obs:20]
- invented evidence [obs:999]
- older memory id is still acceptable [obs:10]
## Decisions
## Unresolved
## Preferences & corrections
- never mention tools in commit messages [S4cdc376a-3b10]
## Environment gotchas
## Completed ✅ (last 7 days)
"""


class ReflectApplyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["DREAMD_LEDGER"] = self.tmp.name
        self.dream = D.ensure_dream(Path(self.tmp.name))
        (self.dream / "memory.md").write_text(PREV)

    def tearDown(self):
        os.environ.pop("DREAMD_LEDGER", None)
        self.tmp.cleanup()

    def assert_rejected(self, text, input_tokens, reason):
        ok, why, _ = R.apply(self.dream, text, {"obs:20"}, input_tokens, 20)
        self.assertFalse(ok)
        self.assertEqual(why, reason)
        self.assertEqual((self.dream / "memory.md").read_text(), PREV)
        self.assertNotIn("last_obs_id_reflected", D.state(self.dream))

    def test_over_cap_rejected(self):
        self.assert_rejected(VALID + "- filler [obs:20]\n" * 900, 20000, "over cap")

    def test_repeated_lines_rejected(self):
        self.assert_rejected(VALID + "- same line [obs:20]\n" * 3, 20000, "repeated lines")

    def test_collapse_rejected(self):
        (self.dream / "memory.md").write_text(PREV + "- lots of prior content [obs:10]\n" * 40)
        prev = (self.dream / "memory.md").read_text()
        ok, why, _ = R.apply(self.dream, "## Current state\n- x [obs:20]\n" + "\n".join(D.SECTIONS[1:]) + "\n", {"obs:20"}, 100, 20)
        self.assertEqual((ok, why), (False, "collapsed"))
        self.assertEqual((self.dream / "memory.md").read_text(), prev)

    def test_missing_section_rejected(self):
        self.assert_rejected("## Current state\n- x [obs:20]\n", 20000, "missing sections ['## Decisions', '## Unresolved', '## Preferences & corrections', '## Environment gotchas', '## Completed ✅ (last 7 days)']")

    def test_mostly_invented_evidence_is_rejected_not_written(self):
        gutted = ("## Current state\n- invented one [obs:901]\n- invented two [obs:902]\n- invented three [obs:903]\n"
                  "- real one [obs:20]\n" + "\n".join(D.SECTIONS[1:]) + "\n")
        ok, why, dropped = R.apply(self.dream, gutted, {"obs:20"}, 20000, 20)
        self.assertEqual((ok, why, dropped), (False, "provenance dropped 3/4 bullets", 3))
        self.assertEqual((self.dream / "memory.md").read_text(), PREV)
        self.assertNotIn("last_obs_id_reflected", D.state(self.dream))

    def test_rejection_marks_an_attempt_so_it_cannot_refire_every_tick(self):
        R.apply(self.dream, "not a memory at all", {"obs:20"}, 20000, 20)
        st = D.state(self.dream)
        self.assertGreater(st["last_reflect"], 0)
        self.assertNotIn("last_obs_id_reflected", st)

    def test_valid_replaces_and_bumps(self):
        ok, why, dropped = R.apply(self.dream, VALID, {"obs:20", "S4cdc376a-3b10"}, 20000, 20)
        self.assertEqual((ok, why, dropped), (True, None, 1))
        text = (self.dream / "memory.md").read_text()
        self.assertIn("- new state replaces old [obs:20]", text)
        self.assertIn("- older memory id is still acceptable [obs:10]", text)
        self.assertNotIn("obs:999", text)
        self.assertEqual(D.state(self.dream)["last_obs_id_reflected"], 20)
        runs = D.read_jsonl(self.dream / "runs.jsonl")
        self.assertEqual((runs[-1]["job"], runs[-1]["status"], runs[-1]["dropped_by_provenance"]), ("reflect", "ok", 1))


if __name__ == "__main__":
    unittest.main()
