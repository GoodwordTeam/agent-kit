"""Promotion thresholds, the promoted_count baseline, skill-candidate rules, and a byte-identical rollback."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import common as C  # noqa: E402
import propose as P  # noqa: E402
import maintain as M  # noqa: E402


def page(pid, count, status="active", promoted_to="", promoted_count="", fix="Do the one thing."):
    return (f"---\nid: {pid}\ntitle: T {pid}\nstatus: {status}\ncount: {count}\nfirst_seen: 2026-09-01\nlast_seen: 2026-09-10\n"
            f"sources: [github, claude-mem]\nprs: [1, 2]\nreviewers: [a]\npromoted_to: {promoted_to}\nteam_target: \npromoted_count: {promoted_count}\n---\n\n"
            f"## Problem\nP {pid}\n\n## Root cause\nR\n\n## Fix\n{fix}\n\n## Evidence\n- e\n")


class ProposeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ledger = Path(self.tmp.name) / "ledger"
        os.environ["REVIEW_LEARN_LEDGER"] = str(self.ledger)
        C.ensure_ledger(self.ledger)
        self.cands = Path(self.tmp.name) / "candidates"
        self._p = mock.patch.object(P, "skill_candidates_dir", lambda ledger: self.cands)
        self._p.start()

    def tearDown(self):
        self._p.stop()
        os.environ.pop("REVIEW_LEARN_LEDGER", None)
        self.tmp.cleanup()

    def write(self, pid, **kw):
        (self.ledger / "patterns" / f"{pid}.md").write_text(page(pid, **kw))

    def test_threshold_three_not_two_and_candidates_never_promote(self):
        self.write("rp-001", count=3)
        self.write("rp-002", count=2)
        self.write("rp-003", count=5, status="candidate")
        out = P.propose(".", threshold=3)
        self.assertEqual(out, "promoted rp-001 to guardrails")
        self.assertEqual((self.ledger / "guardrails.md").read_text(), "- [rp-001] Do the one thing.\n")
        meta, _, _ = C.load_patterns(self.ledger)["rp-001"]
        self.assertEqual((meta["promoted_to"], meta["promoted_count"]), ("guardrails", 3))

    def test_legacy_promotion_gets_baseline_without_emitting_a_skill(self):
        self.write("rp-001", count=26, promoted_to="guardrails")  # seeded before promoted_count existed
        self.assertEqual(P.propose(".", threshold=3), "nothing to promote")
        meta, _, _ = C.load_patterns(self.ledger)["rp-001"]
        self.assertEqual(meta["promoted_count"], 26)
        self.assertFalse(self.cands.exists())

    def test_skill_candidate_on_recurrence_after_promotion_or_multistep_fix(self):
        self.write("rp-001", count=5, promoted_to="guardrails", promoted_count=3)                 # +2 since promotion
        self.write("rp-002", count=3, promoted_to="guardrails", promoted_count=3, fix="1. a\n2. b")  # procedure
        self.write("rp-003", count=4, promoted_to="guardrails", promoted_count=3)                 # +1: not yet
        out = P.propose(".", threshold=3)
        self.assertIn("skill candidates rp-001-t-rp-001,rp-002-t-rp-002", out)
        self.assertTrue((self.cands / "rp-001-t-rp-001" / "SKILL.md").exists())
        self.assertFalse((self.cands / "rp-003-t-rp-003").exists())
        text = (self.cands / "rp-002-t-rp-002" / "SKILL.md").read_text()
        self.assertIn("## Procedure\n1. a\n2. b\n", text)
        self.assertIn("fix is a multi-step procedure", text)
        # second run is idempotent
        self.assertEqual(P.propose(".", threshold=3), "nothing to promote")

    def test_rollback_restores_guardrails_byte_for_byte(self):
        self.write("rp-001", count=3)
        P.propose(".", threshold=3)
        before = (self.ledger / "guardrails.md").read_bytes()
        self.write("rp-002", count=3)
        P.propose(".", threshold=3)
        self.assertNotEqual((self.ledger / "guardrails.md").read_bytes(), before)
        self.assertTrue(P.rollback(".").startswith("reverted 'propose: guardrails +rp-002'"))
        self.assertEqual((self.ledger / "guardrails.md").read_bytes(), before)
        log = subprocess.run(["git", "log", "--format=%s", "-1"], cwd=self.ledger, capture_output=True, text=True).stdout
        self.assertTrue(log.startswith('Revert "propose: guardrails +rp-002'))

    def test_retire_removes_bullet_keeps_page(self):
        self.write("rp-001", count=3)
        P.propose(".", threshold=3)
        P.retire(".", "rp-001")
        self.assertEqual((self.ledger / "guardrails.md").read_text(), "")
        meta, _, _ = C.load_patterns(self.ledger)["rp-001"]
        self.assertEqual(meta["status"], "retired")


class IngestDedupeTest(unittest.TestCase):
    def test_append_events_twice_adds_once(self):
        with tempfile.TemporaryDirectory() as d:
            ledger = Path(d)
            C.ensure_ledger(ledger)
            ev = [{"hash": "a", "x": 1}, {"hash": "b", "x": 2}]
            self.assertEqual(len(C.append_events(ledger, ev)), 2)
            self.assertEqual(C.append_events(ledger, ev + [{"hash": "c"}]), [{"hash": "c"}])
            self.assertEqual([e["hash"] for e in C.load_events(ledger)], ["a", "b", "c"])


if __name__ == "__main__":
    unittest.main()
