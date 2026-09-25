"""Scheduler decisions from a fake clock/state; lock held -> exits without running."""
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
import tick as T  # noqa: E402

NOON = datetime(2026, 9, 18, 12, 0)
NIGHT = datetime(2026, 9, 18, 2, 10)
MS = lambda dt: int(dt.timestamp() * 1000)  # noqa: E731


class DecideTest(unittest.TestCase):
    def fresh(self):
        return {"last_reflect": MS(NOON) - 3600_000, "last_nightly": "2026-09-17", "last_weekly": MS(NOON)}

    def test_idle_and_tokens_reflect(self):
        self.assertEqual(T.decide(self.fresh(), NOON, idle_s=600, new_tokens=30000, new_obs=40, unconsolidated=0), ["reflect"])

    def test_busy_no_reflect(self):
        self.assertEqual(T.decide(self.fresh(), NOON, idle_s=30, new_tokens=30000, new_obs=40, unconsolidated=0), [])

    def test_six_hour_gap_reflects_on_any_observation(self):
        st = self.fresh()
        st["last_reflect"] = MS(NOON) - 7 * 3600_000
        self.assertEqual(T.decide(st, NOON, idle_s=30, new_tokens=100, new_obs=1, unconsolidated=0), ["reflect"])

    def test_nightly_at_0210_with_new_episode(self):
        self.assertEqual(T.decide(self.fresh(), NIGHT, idle_s=60, new_tokens=0, new_obs=0, unconsolidated=1), ["nightly"])

    def test_nightly_not_twice_a_day(self):
        st = self.fresh()
        st["last_nightly"] = "2026-09-18"
        self.assertEqual(T.decide(st, NIGHT, idle_s=60, new_tokens=0, new_obs=0, unconsolidated=1), [])

    def test_backlog_nightly_any_hour_when_idle(self):
        st = self.fresh()
        st["last_nightly"] = "2026-09-18"
        self.assertEqual(T.decide(st, NOON, idle_s=600, new_tokens=0, new_obs=0, unconsolidated=25), ["nightly"])

    def test_weekly_when_idle_and_stale(self):
        st = self.fresh()
        st["last_weekly"] = MS(NOON) - 8 * 86400_000
        self.assertEqual(T.decide(st, NOON, idle_s=600, new_tokens=0, new_obs=0, unconsolidated=0), ["weekly"])

    def test_muted_runs_nothing(self):
        st = self.fresh()
        st.update(muted=True, last_weekly=0)
        self.assertEqual(T.decide(st, NIGHT, idle_s=9999, new_tokens=99999, new_obs=9, unconsolidated=30), [])

    def test_force(self):
        self.assertEqual(T.decide({"muted": True}, NOON, 0, 0, 0, 0, force_job="all"), ["reflect", "nightly", "weekly"])
        self.assertEqual(T.decide({}, NOON, 0, 0, 0, 0, force_job="nightly"), ["nightly"])

    def test_force_without_a_job_forces_all(self):
        with mock.patch.object(T, "decide", wraps=T.decide) as spy, mock.patch.object(T.D, "ensure_dream"), \
             mock.patch.object(T.E, "build", return_value=[]), mock.patch.object(T.D, "state", return_value={}), \
             mock.patch.object(T.D, "last_activity_ms", return_value=1), mock.patch.object(T.D, "new_tokens_since", return_value=(0, 0)), \
             mock.patch.object(T.D, "read_jsonl", return_value=[]), mock.patch.object(T.C, "load_events", return_value=[]), \
             mock.patch.object(T.R, "reflect", return_value="r"), mock.patch.object(T.K, "consolidate", return_value="n"), \
             mock.patch.object(T.W, "deep", return_value="w"):
            T.run_project(None, Path("/repo"), "repo", job=None, force=True)
        self.assertEqual(spy.call_args.args[-1], "all")


class LockTest(unittest.TestCase):
    def test_lock_held_exits(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(D, "DREAMD_DIR", Path(tmp)):
            held = D.try_lock(Path(tmp) / ".lock")
            out = io.StringIO()
            with redirect_stdout(out), mock.patch.object(D, "mem", side_effect=AssertionError("must not open the db")):
                self.assertEqual(T.main(["tick.py"]), 0)
            self.assertIn("another run holds the lock", out.getvalue())
            held.close()


if __name__ == "__main__":
    unittest.main()


if __name__ == "__main__":
    unittest.main()
