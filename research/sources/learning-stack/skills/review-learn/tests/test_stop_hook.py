"""Stop-hook gates: plugin cache, stop_hook_active, non-git cwd, 10-minute debounce, detach exactly once."""
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import common as C  # noqa: E402
import stop_hook as H  # noqa: E402


class StopHookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        self.ledger = Path(self.tmp.name) / "ledger"
        os.environ["REVIEW_LEARN_LEDGER"] = str(self.ledger)

    def tearDown(self):
        os.environ.pop("REVIEW_LEARN_LEDGER", None)
        self.tmp.cleanup()

    def run_hook(self, payload, argv=("stop_hook.py",)):
        with mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), mock.patch.object(sys, "argv", list(argv)), \
             mock.patch.object(H, "detach") as popen:
            H.main()
        return popen

    def test_gates_skip_without_detaching(self):
        for payload in ({"cwd": "/x/plugins/cache/y"}, {"cwd": str(self.repo), "stop_hook_active": True}):
            self.assertEqual(self.run_hook(payload).call_count, 0, payload)
        os.environ.pop("REVIEW_LEARN_LEDGER")  # real resolution: a non-git cwd has no ledger
        self.assertEqual(self.run_hook({"cwd": self.tmp.name}).call_count, 0)

    def test_detaches_once_then_debounces(self):
        first = self.run_hook({"cwd": str(self.repo)})
        self.assertEqual(first.call_count, 1)
        args = first.call_args[0][0]
        self.assertEqual(args[1:2], [H.__file__])
        self.assertEqual(first.call_args[0][1], self.ledger / "raw" / ".pipeline.log")
        self.assertEqual(args[2:], ["--sync", "--source", "claude", "--cwd", str(self.repo)])
        self.assertTrue((self.ledger / "raw" / ".last_run").exists())
        second = self.run_hook({"cwd": str(self.repo)})
        self.assertEqual(second.call_count, 0)
        old = time.time() - 601
        os.utime(self.ledger / "raw" / ".last_run", (old, old))
        third = self.run_hook({"cwd": str(self.repo)}, argv=("stop_hook.py", "--source", "codex"))
        self.assertEqual(third.call_count, 1)
        self.assertEqual(third.call_args[0][0][3:5], ["--source", "codex"])

    def test_lock_blocks_concurrent_maintain(self):
        C.ensure_ledger(self.ledger)
        held = C.try_lock(self.ledger)
        self.assertIsNotNone(held)
        self.assertIsNone(C.try_lock(self.ledger))
        held.close()
        self.assertIsNotNone(C.try_lock(self.ledger))


if __name__ == "__main__":
    unittest.main()
