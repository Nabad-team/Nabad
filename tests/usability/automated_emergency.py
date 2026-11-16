"""Run five automated emergency scenarios against a disposable localhost app.

Uses the existing Selenium account setup/cleanup and browser assertions. Results
are software checks, never participant sessions or measures of human usability.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import time
import unittest
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_nabad as app
from emergency_study import GUARD, check

SCENARIOS = [
    ("A01", "Emergency alert and dismissal", "test_emergency_popup_has_immediate_actions_and_keeps_guidance_after_dismissal"),
    ("A02", "Contact location draft and denied permission", "test_emergency_location_share_prepares_a_draft_and_handles_denied_location"),
    ("A03", "Rules-only alert and saved contact", "test_rules_only_emergencies_show_140_and_saved_contact"),
    ("A04", "Emergency card and print layout", "test_emergency_information_card_is_accessible_and_printable"),
    ("A05", "Saved offline card, numbers, reload and removal", "test_offline_emergency_card_and_numbers_survive_network_loss"),
]


def local_url(value):
    url = urlsplit(value)
    return (url.scheme in {"http", "https"} and url.hostname in {"localhost", "127.0.0.1", "::1"}
            and not url.username and not url.password and not url.query and not url.fragment)


class Results(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.rows = []
        self.status = {}

    def startTest(self, test):
        self.started = time.perf_counter()
        super().startTest(test)

    def addSuccess(self, test):
        self.status.setdefault(test.id(), "PASS")
        super().addSuccess(test)

    def addFailure(self, test, err):
        self.status[test.id()] = "FAIL"
        super().addFailure(test, err)

    def addError(self, test, err):
        self.status[test.id()] = "ERROR"
        super().addError(test, err)

    def addSkip(self, test, reason):
        self.status[test.id()] = "SKIP"
        super().addSkip(test, reason)

    def addSubTest(self, test, subtest, err):
        if err is not None:
            self.status[test.id()] = "FAIL"
        super().addSubTest(test, subtest, err)

    def stopTest(self, test):
        scenario = next(item for item in SCENARIOS if item[2] == test._testMethodName)
        self.rows.append({"id": scenario[0], "scenario": scenario[1],
                          "status": self.status.get(test.id(), "ERROR"),
                          "script_duration_seconds": round(time.perf_counter() - self.started, 3)})
        super().stopTest(test)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=app.ARTIFACTS_DIR / "automated-emergency.json")
    args = parser.parse_args()
    if not all(local_url(url) for url in (app.BASE_URL, app.MAILPIT_API)):
        parser.error("Use a disposable localhost app and Mailpit inbox only.")

    original_setup = app.setUpModule

    def guarded_setup():
        original_setup()
        try:
            app.DRIVER.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": GUARD})
            check(app.DRIVER)
        except BaseException:
            app.tearDownModule()
            raise

    app.setUpModule = guarded_setup
    suite = unittest.TestSuite(app.SignedInWorkflowTests(method) for _, _, method in SCENARIOS)
    result = unittest.TextTestRunner(verbosity=2, resultclass=Results).run(suite)
    complete = (result.wasSuccessful() and not result.skipped and len(result.rows) == len(SCENARIOS)
                and all(row["status"] == "PASS" for row in result.rows))
    report = {"kind": "automated_browser_checks", "human_participants": 0,
              "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
              "revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "working_tree_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()),
              "expected_scenarios": len(SCENARIOS), "passed": complete,
              "fixture_or_test_errors": len(result.errors), "scenarios": result.rows,
              "limits": ["AI must be disabled in the disposable backend configuration.",
                         "Durations include scripted setup and assertions; they are not human time-to-help.",
                         "Offline case uses browser network emulation and the cached offline page.",
                         "Call/SMS activation is blocked; delivery and emergency response are not tested."]}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Automated report: {args.report}")
    return 0 if complete else 1


if __name__ == "__main__":
    sys.exit(main())
