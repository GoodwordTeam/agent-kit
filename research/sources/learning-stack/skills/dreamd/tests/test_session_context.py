"""Injected block: bullet trimming order, and a hard cap when a section has no bullets left to drop."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
import session_context as SC  # noqa: E402

FULL = ("## Current state\n- state bullet [obs:1]\n## Decisions\n- decision bullet [obs:2]\n## Unresolved\n"
        "## Preferences & corrections\n- preference bullet [obs:3]\n## Environment gotchas\n"
        "## Completed ✅ (last 7 days)\n- completed one [obs:4]\n- completed two [obs:5]\n")


class TrimTest(unittest.TestCase):
    def test_under_cap_is_unchanged_in_content(self):
        out = SC.trim(FULL, 2500)
        for line in ("- state bullet [obs:1]", "- decision bullet [obs:2]", "- preference bullet [obs:3]", "- completed two [obs:5]"):
            self.assertIn(line, out)

    def test_completed_is_trimmed_before_preferences(self):
        out = SC.trim(FULL, 51)  # 51 tokens is exactly the block minus its two Completed bullets
        self.assertNotIn("- completed two", out)
        self.assertNotIn("- completed one", out)
        self.assertIn("- preference bullet [obs:3]", out)

    def test_prose_only_block_is_hard_cut_at_the_cap(self):
        prose = "## Current state\n" + "not a bullet, cannot be dropped by the bullet pass\n" * 40 + "## Decisions\n"
        out = SC.trim(prose, 50)
        self.assertLessEqual(D.tokens(out), 50)
        self.assertIn("(truncated at the dreamd token cap)", out)


if __name__ == "__main__":
    unittest.main()
