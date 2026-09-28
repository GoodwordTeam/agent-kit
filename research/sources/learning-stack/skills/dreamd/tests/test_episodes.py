"""Episodes from an in-memory claude-mem schema subset: fields and priority literals; second run appends nothing."""
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
import episodes as E  # noqa: E402

NOW = 1_800_000_000_000  # 2027-01-15T08:00:00Z
D_ = 86_400_000
H = 3_600_000
SCHEMA = """
create table sdk_sessions(id integer primary key, memory_session_id text, project text, platform_source text, started_at_epoch integer, completed_at_epoch integer);
create table observations(id integer primary key, memory_session_id text, project text, type text, title text, subtitle text, facts text,
  discovery_tokens integer, files_modified text, created_at text, created_at_epoch integer);
create table session_summaries(id integer primary key, memory_session_id text, project text, request text, completed text, next_steps text, created_at_epoch integer);
create table user_prompts(id integer primary key, session_db_id integer, prompt_text text);
create table tool_uses(id integer primary key, memory_session_id text, project text, tool_name text, tool_input text);
"""


def fixture():
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.executemany("insert into sdk_sessions values (?,?,?,?,?,?)", [
        (1, "s1", "app", "claude", NOW - 14 * D_ - H, NOW - 14 * D_),
        (2, "s2", "app/wt", "codex", NOW - H, NOW),
        (3, "s3", "app", "claude", NOW - 7 * H, None),          # stale active: counts as ended at its last observation
        (4, "s4", "app", "claude", NOW - 2 * H, None),          # still active: excluded
        (5, "s5", "other", "claude", NOW - D_, NOW - D_ + H),   # other project: excluded
    ])
    con.executemany("insert into observations values (?,?,?,?,?,?,?,?,?,?,?)", [
        (1, "s1", "app", "discovery", "t", None, None, 1000, '["a.ts"]', "x", NOW - 14 * D_ - H // 2),
        (2, "s1", "app", "review-finding", "t", None, None, 3000, '["b.ts"]', "x", NOW - 14 * D_),
        (3, "s2", "app/wt", "change", "t", None, None, 2000, '["a.ts","c.ts"]', "x", NOW - H // 2),
        (4, "s3", "app", "discovery", "t", None, None, 500, None, "x", NOW - 7 * H),
        (5, "s4", "app", "discovery", "t", None, None, 500, None, "x", NOW - H),
        (6, "s5", "other", "discovery", "t", None, None, 500, None, "x", NOW - D_),
    ])
    con.execute("insert into session_summaries values (1,'s1','app','fix the thing','done it','', ?)", (NOW - 14 * D_,))
    con.execute("insert into session_summaries values (2,'s2','app/wt','explore','','', ?)", (NOW,))
    con.executemany("insert into user_prompts values (?,?,?)", [(1, 1, "p"), (2, 1, "p"), (3, 2, "p")])
    con.executemany("insert into tool_uses values (?,?,?,?,?)", [
        (1, "s1", "app", "Edit", '{"file_path":"d.ts","old_string":"x"}'),   # only tool use records this file
        (2, "s1", "app", "Read", '{"file_path":"never-counted.ts"}'),        # reads are not edits
        (3, "s2", "app/wt", "Write", '{"file_path":"a.ts"}'),                # already in files_modified: no double count
    ])
    return con


EVENTS = [
    {"source": "user-correction", "kind": "correction", "ts": "2027-01-01T07:30:00Z"},   # inside s1's window
    {"source": "user-correction", "kind": "correction", "ts": "2027-01-10T07:30:00Z"},   # outside every window
    {"source": "claude-mem", "kind": "finding", "obs_id": 2, "ts": "2027-01-01T08:00:00Z"},
    {"source": "dreamd", "kind": "finding", "obs_id": 2, "ts": "2027-01-01T08:00:00Z"},  # our own output must not feed back in
]


class EpisodesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dream = Path(self.tmp.name)
        (self.dream / "episodes.jsonl").write_text("")

    def tearDown(self):
        self.tmp.cleanup()

    def test_build_and_priority(self):
        new = E.build(fixture(), self.dream, "app", EVENTS, now_ms=NOW)
        by = {e["sid"]: e for e in new}
        self.assertEqual(sorted(by), ["s1", "s2", "s3"])
        s1 = by["s1"]
        self.assertEqual((s1["platform"], s1["prompts"], s1["obs"], s1["tokens"], s1["files_modified"]), ("claude", 2, 2, 4000, ["a.ts", "b.ts", "d.ts"]))
        self.assertEqual(by["s2"]["files_modified"], ["a.ts", "c.ts"])
        self.assertEqual((s1["request"], s1["completed"], s1["failure_signals"], s1["corrections"], s1["review_events"]), ("fix the thing", True, 1, 1, 1))
        self.assertEqual((s1["started"], s1["ended"]), (NOW - 14 * D_ - H, NOW - 14 * D_))
        self.assertEqual(by["s3"]["ended"], NOW - 7 * H)
        self.assertFalse(by["s2"]["completed"])
        # 0.30*C + 0.20*F + 0.15*R + 0.10*T + 0.10*N + 0.15*A, hand-computed:
        # s1: C=1/3 F=1/5 R=1/5 T=1 N=1 A=e^-1        -> 0.1+0.04+0.03+0.1+0.1+0.055182 = 0.4252
        # s2: T=0.5 N=0.5 (a.ts seen in s1) A=1        -> 0.05+0.05+0.15 = 0.25
        # s3: T=0.125 N=0 A=e^(-(7/24)/14)=0.979382    -> 0.0125+0.146907 = 0.1594
        self.assertEqual((by["s1"]["priority"], by["s2"]["priority"], by["s3"]["priority"]), (0.4252, 0.25, 0.1594))
        rows = [json.loads(l) for l in (self.dream / "episodes.jsonl").read_text().splitlines()]
        self.assertEqual([r["sid"] for r in rows], ["s1", "s3", "s2"])  # written oldest first

    def test_second_run_appends_nothing(self):
        E.build(fixture(), self.dream, "app", EVENTS, now_ms=NOW)
        again = E.build(fixture(), self.dream, "app", EVENTS, now_ms=NOW)
        self.assertEqual(again, [])
        self.assertEqual(len((self.dream / "episodes.jsonl").read_text().splitlines()), 3)


if __name__ == "__main__":
    unittest.main()
