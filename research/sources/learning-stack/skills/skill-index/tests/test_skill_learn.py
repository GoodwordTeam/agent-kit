import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import skill_learn as SL  # noqa: E402
import skill_index as SI  # noqa: E402

CAND = {"name": "Greptile Re-Review", "description": "Re-request a Greptile review at the current head. Use when the user says re-review or greptile.",
        "scope": "global", "intent": "Get a fresh bot review after pushing fixes.",
        "steps": ["gh pr comment $PR --body '@greptileai review'", "poll gh pr checks until fresh"],
        "guardrails": ["never mention the AI assistant in the comment"],
        "evidence": [{"session": "aaaa1111", "quote": "ask greptile to re-review"}, {"session": "bbbb2222", "quote": "re-trigger greptile"}, {"session": "cccc3333", "quote": "greptile is stale, rerun"}],
        "confidence": "high"}


class SkillLearnTest(unittest.TestCase):
    def test_write_candidate_renders_skill_and_registry(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(SI, "GLOBAL_INDEX", Path(d)), mock.patch.object(SI, "project_root", lambda cwd=None: None):
            reg = {"candidates": {}, "rejected": [], "seen_sessions": {}}
            name = SL.write_candidate(CAND, "/nonexistent", reg)
            text = (Path(d) / "candidates" / name / "SKILL.md").read_text()
        self.assertEqual(name, "greptile-re-review")
        self.assertTrue(text.startswith("---\nname: greptile-re-review\ndescription: Re-request a Greptile review at the current head. Use when the user says re-review or greptile.\n---\n"))
        self.assertIn("## Steps\n1. gh pr comment $PR --body '@greptileai review'\n2. poll gh pr checks until fresh\n", text)
        self.assertIn("## Guardrails (from corrections)\n- never mention the AI assistant in the comment\n", text)
        self.assertIn("- session `aaaa1111`: “ask greptile to re-review”", text)
        self.assertEqual(reg["candidates"]["greptile-re-review"]["scope"], "global")
        self.assertEqual(reg["candidates"]["greptile-re-review"]["evidence"], 3)

    def test_promote_counts_distinct_sessions_that_read_the_skill(self):
        with tempfile.TemporaryDirectory() as d:
            db = Path(d) / "mem.db"
            con = sqlite3.connect(db)
            con.execute("create table observations (memory_session_id text, files_read text)")
            rows = [("s1", '["/idx/candidates/foo/SKILL.md"]'), ("s1", '["/idx/candidates/foo/SKILL.md"]'), ("s2", '["/idx/candidates/foo/SKILL.md","/other"]'), ("s3", '["/idx/candidates/bar/SKILL.md"]')]
            con.executemany("insert into observations values (?,?)", rows); con.commit(); con.close()
            with mock.patch.object(SL, "MEM_DB", db):
                self.assertEqual(SL.uses("/idx/candidates/foo/SKILL.md"), 2)
                self.assertEqual(SL.uses("/idx/candidates/bar/SKILL.md"), 1)
                self.assertEqual(SL.uses("/idx/candidates/none/SKILL.md"), 0)


if __name__ == "__main__":
    unittest.main()
