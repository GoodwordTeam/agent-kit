"""Consolidation apply: hypothesis / confirmed (two sessions) / superseded lessons; review events land in a scratch review-learn ledger."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
from dcommon import C  # noqa: E402
import consolidate as K  # noqa: E402

RESP = {
    "lessons": [
        {"statement": "Read pieces per shipment, not per order", "scope": "repo", "evidence": ["obs:1"], "confidence": 0.6, "supersedes": [], "tags": []},
        {"statement": "Run api tests from the main worktree", "scope": "technology", "evidence": ["obs:2", "Ssb"], "confidence": 0.9, "supersedes": [], "tags": ["blocker"]},
        {"statement": "Read pieces and weights per shipment (R-number)", "scope": "repo", "evidence": ["obs:3"], "confidence": 0.8, "supersedes": ["ls-001"], "tags": []},
        {"statement": "no evidence lesson", "scope": "repo", "evidence": ["obs:404"], "confidence": 0.9, "supersedes": [], "tags": []},
    ],
    "review_events": [
        {"text": "PR body claimed 15 files, the diff had 16", "kind": "finding", "evidence": ["obs:2"], "files": ["docs/PR.md"]},
        {"text": "unsupported", "kind": "finding", "evidence": ["obs:404"], "files": []},
    ],
    "log": "one batch",
}
OBS_SESSION = {"obs:1": "sa", "obs:2": "sa", "obs:3": "sc"}
VALID = set(OBS_SESSION) | {"Ssa", "Ssb", "Ssc"}


class ConsolidateApplyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["DREAMD_LEDGER"] = str(Path(self.tmp.name) / "dream")
        os.environ["REVIEW_LEARN_LEDGER"] = str(Path(self.tmp.name) / "rp")
        self.dream = D.ensure_dream(Path(os.environ["DREAMD_LEDGER"]))
        self.repo = Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

    def tearDown(self):
        os.environ.pop("DREAMD_LEDGER", None)
        os.environ.pop("REVIEW_LEARN_LEDGER", None)
        self.tmp.cleanup()

    def test_apply(self):
        summary = K.apply(self.dream, RESP, VALID, OBS_SESSION, root=self.repo, run_id="nightly-test")
        self.assertEqual(summary, {"created": ["ls-001", "ls-002", "ls-003"], "dropped": 1, "superseded": ["ls-001"], "review_events": 1})
        les = {k: m for k, (m, _, _) in K.load_lessons(self.dream).items()}
        self.assertEqual((les["ls-001"]["status"], les["ls-001"]["valid_until"], les["ls-001"]["superseded_by"]), ("superseded", D.today(), "ls-003"))
        self.assertEqual((les["ls-002"]["status"], les["ls-002"]["sessions"], les["ls-002"]["tags"]), ("confirmed", 2, ["blocker"]))
        self.assertEqual((les["ls-003"]["status"], les["ls-003"]["supersedes"], les["ls-003"]["confidence"]), ("hypothesis", ["ls-001"], "0.80"))
        index = (self.dream / "lessons.md").read_text()
        self.assertIn("| ls-002 | confirmed | technology | 0.90 |", index)
        events = [json.loads(l) for l in (Path(os.environ["REVIEW_LEARN_LEDGER"]) / "raw" / "review-events.jsonl").read_text().splitlines()]
        self.assertEqual(len(events), 1)
        self.assertEqual((events[0]["source"], events[0]["kind"], events[0]["obs_id"], events[0]["path"]), ("dreamd", "finding", 2, "docs/PR.md"))
        self.assertTrue(events[0]["text"].startswith("PR body claimed 15 files, the diff had 16"))
        # idempotent forwarding: same text is deduped by hash
        self.assertEqual(K.forward_review_events(self.repo, RESP["review_events"], VALID, "again"), 0)

    def test_only_episodes_that_fit_the_prompt_are_marked_and_trusted(self):
        """Episodes cut by INPUT_CHARS must stay pending, and their ids must not pass the provenance gate."""
        import sqlite3
        import consolidate as K
        con = sqlite3.connect(":memory:")
        con.row_factory = sqlite3.Row
        con.executescript("create table observations(id integer primary key, memory_session_id text, type text, title text, subtitle text, facts text);")
        eps = [{"sid": f"s{i}", "platform": "claude", "started": i, "ended": i, "completed": False, "files_modified": [],
                "failure_signals": 0, "corrections": 0, "review_events": 0, "priority": 1 - i / 10, "tokens": 0,
                "request": "x" * 200} for i in range(4)]
        for i, e in enumerate(eps):
            con.execute("insert into observations values (?,?,?,?,?,?)", (i + 1, e["sid"], "discovery", "t" * 200, "s", "f" * 400))
        obs_by = {e["sid"]: K.fetch_obs(con, e["sid"]) for e in eps}
        orig = K.INPUT_CHARS
        K.INPUT_CHARS = 2000  # fits two episode blocks, cuts the rest
        try:
            prompt, included = K.build_prompt(self.dream, eps, [], obs_by)
        finally:
            K.INPUT_CHARS = orig
        self.assertEqual([e["sid"] for e in included], ["s0", "s1"])
        self.assertIn("s0", prompt)
        self.assertNotIn("S" + "s3", prompt)

    def test_stratify_and_pairs(self):
        eps = [
            {"sid": "f", "started": 1, "completed": False, "files_modified": ["a"], "failure_signals": 2, "corrections": 0, "priority": 0.5},
            {"sid": "ok", "started": 2, "completed": True, "files_modified": ["a", "b"], "failure_signals": 0, "corrections": 0, "priority": 0.3},
            {"sid": "n", "started": 3, "completed": False, "files_modified": ["z"], "failure_signals": 0, "corrections": 0, "priority": 0.2},
        ]
        chosen, failures = K.stratify(eps, batch=5)
        self.assertEqual([e["sid"] for e in chosen], ["f", "ok", "n"])
        self.assertEqual([(f["sid"], s["sid"]) for f, s in K.pair_failures(failures, eps)], [("f", "ok")])


if __name__ == "__main__":
    unittest.main()
