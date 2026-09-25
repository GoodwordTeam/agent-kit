"""Installer unit tests: hook merge, unit rendering, path derivation, idempotency, uninstall. No network, no model calls."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import install as I  # noqa: E402


class HookMergeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "settings.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_adds_once_and_is_idempotent(self):
        doc = {}
        self.assertTrue(I.add_hook(doc, "SessionStart", "python3 /s/a.py", matcher="startup|resume|clear|compact"))
        self.assertFalse(I.add_hook(doc, "SessionStart", "python3 /s/a.py", matcher="startup|resume|clear|compact"))
        self.assertEqual(doc, {"hooks": {"SessionStart": [
            {"hooks": [{"type": "command", "command": "python3 /s/a.py", "timeout": 10}], "matcher": "startup|resume|clear|compact"}]}})

    def test_leaves_foreign_entries_alone(self):
        doc = {"hooks": {"SessionStart": [{"hooks": [{"type": "command", "command": "echo other"}]}]}}
        I.add_hook(doc, "SessionStart", "python3 /s/a.py")
        self.assertEqual([h["command"] for e in doc["hooks"]["SessionStart"] for h in e["hooks"]], ["echo other", "python3 /s/a.py"])

    def test_duplicate_preexisting_entry_is_not_multiplied(self):
        doc = {"hooks": {"SessionStart": [
            {"hooks": [{"type": "command", "command": "python3 /s/a.py"}]},
            {"hooks": [{"type": "command", "command": "python3 /s/a.py"}]}]}}
        self.assertFalse(I.add_hook(doc, "SessionStart", "python3 /s/a.py"))
        self.assertEqual(len(doc["hooks"]["SessionStart"]), 2)

    def test_drop_removes_only_ours_and_keeps_shared_entries(self):
        doc = {"hooks": {"SessionStart": [
            {"hooks": [{"type": "command", "command": "python3 /s/a.py"}]},
            {"hooks": [{"type": "command", "command": "echo other"}, {"type": "command", "command": "python3 /s/b.py"}]}]}}
        removed = I.drop_hooks(doc, {"python3 /s/a.py", "python3 /s/b.py"})
        self.assertEqual(removed, 2)
        self.assertEqual([h["command"] for e in doc["hooks"]["SessionStart"] for h in e["hooks"]], ["echo other"])

    def test_write_json_backs_up_the_previous_file(self):
        self.path.write_text('{"a": 1}')
        I.write_json(self.path, {"a": 2})
        self.assertEqual(json.loads(self.path.read_text()), {"a": 2})
        self.assertEqual(json.loads(self.path.with_suffix(".json.bak").read_text()), {"a": 1})


class PathTest(unittest.TestCase):
    def test_config_dir_follows_the_environment(self):
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": "/somewhere/else"}):
            self.assertEqual(I.config_dir(), Path("/somewhere/else"))
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(I.config_dir(), Path.home() / ".claude")

    def test_ledger_folder_matches_the_claude_code_convention(self):
        self.assertEqual(I.ledger_folder("/Users/bob/my_app"), "-Users-bob-my-app")

    def test_hook_commands_all_point_at_the_fixed_skills_root(self):
        cmds = I.hook_commands()
        flat = cmds["session_start"] + [cmds["claude_stop"], cmds["codex_stop"], cmds["codex_prompt"]]
        self.assertTrue(all(str(I.SKILLS_ROOT) in c for c in flat), flat)
        self.assertEqual(len(I.owned_commands()), 6)


class UnitRenderTest(unittest.TestCase):
    def render(self, system):
        with mock.patch.object(I.platform, "system", return_value=system), \
             mock.patch.object(I.shutil, "which", return_value="/usr/bin/systemctl"), \
             mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": "/cfg", "PATH": "/bin", "USER": "bob"}), \
             mock.patch.object(I.sys, "executable", "/py/bin/python3"), \
             mock.patch.object(I, "SKILLS_ROOT", Path("/skills")):
            return I.unit_text(), I.unit_paths()

    def test_launchd_plist(self):
        text, (label, path) = self.render("Darwin")
        self.assertEqual(label, "com.bob.dreamd")
        self.assertEqual(path, Path.home() / "Library/LaunchAgents/com.bob.dreamd.plist")
        for fragment in ("<string>/py/bin/python3</string>", "<string>/skills/dreamd/scripts/tick.py</string>",
                         "<integer>900</integer>", "<string>/cfg</string>", "<string>/cfg/dreamd/tick.log</string>"):
            self.assertIn(fragment, text)
        self.assertNotIn("$", text)

    def test_systemd_service(self):
        text, (label, path) = self.render("Linux")
        self.assertEqual(path, Path.home() / ".config/systemd/user/dreamd-tick.service")
        self.assertIn("ExecStart=/py/bin/python3 /skills/dreamd/scripts/tick.py", text)
        self.assertIn("Environment=CLAUDE_CONFIG_DIR=/cfg", text)
        self.assertNotIn("ProtectHome", text)  # would break reading the claude-mem db
        self.assertNotIn("$", text)

    def test_systemd_timer_interval(self):
        with mock.patch.object(I, "TICK_INTERVAL_S", 900):
            timer = I.render("systemd.timer.tmpl", minutes=15, unit="dreamd-tick.service")
        self.assertIn("OnUnitActiveSec=15min", timer)
        self.assertIn("Unit=dreamd-tick.service", timer)


class BundleTest(unittest.TestCase):
    def test_excludes_caches_and_locks(self):
        for bad in ("a/__pycache__/x.pyc", "b/x.pyc", "raw/.lock", ".DS_Store", "dreamd/.omc/state/s.json", "dreamd/.git/HEAD",
                    "skill-index/.context/run.tar.gz", "review-learn.bak-1758000000/SKILL.md"):
            self.assertTrue(I.skip(Path(bad)), bad)
        for good in ("dreamd/SKILL.md", "dreamd/scripts/tick.py"):
            self.assertFalse(I.skip(Path(good)), good)


if __name__ == "__main__":
    unittest.main()
