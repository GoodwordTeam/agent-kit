"""Evidence compaction on an rp-003-shaped page: lines older than 30 days roll up per month; recent lines, prose blocks, frontmatter untouched."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import deep as W  # noqa: E402

PAGE = """---
id: rp-003
title: Prose claims not verified against code
status: active
count: 32
---

## Problem
Prose claims code it does not match.

## Evidence
- https://github.com/x/y/pull/1882#discussion_r4031162378 (greptile-apps[bot] P2 pr 1882 2026-09-16)
- obs:1452 (observer:discovery 2026-07-28)
Prose block kept in place.
- obs:2675 (observer:discovery 2026-07-30)
- obs:5237 (observer:discovery pr 1401 2026-08-05)
**Event c44c74e6b80092b7 (2026-08-07):** Migration plan contains unsupported claims.
- obs:6409 (observer:discovery pr 1422 2026-08-07)
- obs:10781 (observer:discovery 2026-08-19)
- fc15f9ff2f305781 (user 2026-08-10)
- obs:19664 (observer:discovery 2026-09-16)

## Notes
- obs:1 (observer:discovery 2026-01-01)
"""
EXPECTED = """---
id: rp-003
title: Prose claims not verified against code
status: active
count: 32
---

## Problem
Prose claims code it does not match.

## Evidence
- https://github.com/x/y/pull/1882#discussion_r4031162378 (greptile-apps[bot] P2 pr 1882 2026-09-16)
- 2026-07: 2 events (obs 1452…2675)
Prose block kept in place.
- 2026-08: 3 events (obs 5237…6409; prs 1401, 1422)
**Event c44c74e6b80092b7 (2026-08-07):** Migration plan contains unsupported claims.
- obs:10781 (observer:discovery 2026-08-19)
- obs:19664 (observer:discovery 2026-09-16)

## Notes
- obs:1 (observer:discovery 2026-01-01)
"""


class DeepTest(unittest.TestCase):
    def test_compact(self):
        self.assertEqual(W.compact_evidence(PAGE, "2026-09-18"), EXPECTED)

    def test_idempotent(self):
        self.assertEqual(W.compact_evidence(EXPECTED, "2026-09-18"), EXPECTED)

    def test_single_event_month_is_singular(self):
        page = "---\nid: rp-x\n---\n\n## Evidence\n- obs:5 (observer:discovery pr 1401 2026-01-05)\n"
        self.assertEqual(W.compact_evidence(page, "2026-09-18"), "---\nid: rp-x\n---\n\n## Evidence\n- 2026-01: 1 event (obs 5; prs 1401)\n")

    def test_second_pass_merges_into_the_existing_month_line(self):
        page = "---\nid: x\n---\n\n## Evidence\n- obs:10 (u 2026-08-01)\n- obs:11 (u 2026-08-25)\n"
        week1 = W.compact_evidence(page, "2026-09-05")
        self.assertEqual(week1, "---\nid: x\n---\n\n## Evidence\n- 2026-08: 1 event (obs 10)\n- obs:11 (u 2026-08-25)\n")
        week2 = W.compact_evidence(week1, "2026-09-30")
        self.assertEqual(week2, "---\nid: x\n---\n\n## Evidence\n- 2026-08: 2 events (obs 10…11)\n")
        self.assertEqual(W.compact_evidence(week2, "2026-10-30"), week2)

    def test_no_evidence_section(self):
        self.assertEqual(W.compact_evidence("---\nid: x\n---\n## Problem\n- obs:1 (u 2020-01-01)\n", "2026-09-18"), "---\nid: x\n---\n## Problem\n- obs:1 (u 2020-01-01)\n")


if __name__ == "__main__":
    unittest.main()


class MergeTest(unittest.TestCase):
    """A merge keeps the dropped lesson's tags and statement and recomputes status; it never silently drops protection."""

    def setUp(self):
        import os, sys, tempfile
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
        import dcommon as D, consolidate as K
        self.D, self.K = D, K
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["DREAMD_LEDGER"] = self.tmp.name
        self.dream = D.ensure_dream(Path(self.tmp.name))
        K.apply(self.dream, {"lessons": [
            {"statement": "keeper about subagent reports", "scope": "repo", "evidence": ["Sa"], "confidence": 0.7, "tags": ["preference"]},
            {"statement": "dropped about extraction grounding", "scope": "repo", "evidence": ["Sb", "Sc"], "confidence": 0.8, "tags": ["security"]},
        ]}, {"Sa", "Sb", "Sc"}, {})

    def tearDown(self):
        import os
        os.environ.pop("DREAMD_LEDGER", None)
        self.tmp.cleanup()

    def test_merge_unions_tags_and_recomputes_status(self):
        merged, conflicts = W.apply_pairs(self.dream, {"merge": [["ls-001", "ls-002"]]}, today="2026-09-18")
        self.assertEqual((merged, conflicts), ([["ls-001", "ls-002"]], []))
        keep, _, _ = self.K.load_lessons(self.dream)["ls-001"]
        drop, dbody, _ = self.K.load_lessons(self.dream)["ls-002"]
        self.assertEqual(keep["tags"], ["preference", "security"])
        self.assertEqual(keep["evidence"], ["Sa", "Sb", "Sc"])
        self.assertEqual((keep["sessions"], keep["status"]), (3, "confirmed"))
        self.assertEqual((drop["status"], drop["superseded_by"]), ("superseded", "ls-001"))
        self.assertIn("dropped about extraction grounding", (self.dream / "lessons" / "ls-001.md").read_text())

    def test_contradiction_marks_both_conflict(self):
        W.apply_pairs(self.dream, {"contradict": [["ls-001", "ls-002"]]}, today="2026-09-18")
        self.assertEqual([m["status"] for m, _, _ in self.K.load_lessons(self.dream).values()], ["conflict", "conflict"])
