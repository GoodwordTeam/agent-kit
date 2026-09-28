"""Project discovery from claude-mem tool use: stat-only root resolution, worktree and cache skips, newest cwd wins."""
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402

SCHEMA = "create table tool_uses(project text, cwd text, created_at_epoch integer);"


class DiscoverTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name).resolve() / "myrepo"  # macOS /var -> /private/var
        (self.repo / "packages" / "api").mkdir(parents=True)
        (self.repo / ".git").mkdir()
        self.worktree = Path(self.tmp.name).resolve() / "wt"
        self.worktree.mkdir()
        (self.worktree / ".git").write_text("gitdir: /elsewhere\n")  # linked worktree: a file, not a directory
        self.registry = Path(self.tmp.name).resolve() / "projects.json"

    def tearDown(self):
        self.tmp.cleanup()

    def db(self, rows):
        con = sqlite3.connect(":memory:")
        con.row_factory = sqlite3.Row
        con.executescript(SCHEMA)
        con.executemany("insert into tool_uses values (?,?,?)", rows)
        return con

    def test_resolves_subdir_to_root_and_strips_worktree_suffix(self):
        con = self.db([("myrepo/some-branch", str(self.repo / "packages" / "api"), D.now_ms())])
        reg = D.discover_projects(con, registry=self.registry)
        self.assertEqual(reg, {D.C.project_folder_name(self.repo): {"root": str(self.repo), "mem_project": "myrepo",
                                                                    "last_seen": reg[D.C.project_folder_name(self.repo)]["last_seen"]}})

    def test_skips_plugin_cache_tmp_and_linked_worktrees(self):
        con = self.db([("x", "/Users/x/.claude/plugins/cache/thing", D.now_ms()),
                       ("y", "/private/tmp/scratch", D.now_ms()),
                       ("z", str(self.worktree), D.now_ms())])
        self.assertEqual(D.discover_projects(con, registry=self.registry), {})

    def test_old_rows_outside_the_window_are_ignored(self):
        con = self.db([("myrepo", str(self.repo), D.now_ms() - 20 * 86400 * 1000)])
        self.assertEqual(D.discover_projects(con, days=14, registry=self.registry), {})

    def test_root_of_never_opens_a_file(self):
        self.assertEqual(D.root_of(self.repo / "packages" / "api"), self.repo)
        self.assertIsNone(D.root_of(self.worktree))


if __name__ == "__main__":
    unittest.main()
