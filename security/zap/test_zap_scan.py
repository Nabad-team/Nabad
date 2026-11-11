"""Unit tests for the ZAP scan driver: rules file, results table, target safety and the staging exclusions.
Run: python -m unittest discover -s security/zap -p "test_*.py"
"""
import re
import unittest
from pathlib import Path

import zap_scan as z

HERE = Path(__file__).resolve().parent


def alert(plugin, name, risk, confidence="Medium", url="http://frontend:3000/api/medications?profileId=self&q=secret"):
    return {"pluginId": plugin, "name": name, "risk": risk, "confidence": confidence, "url": url, "param": "q", "evidence": "secret-evidence"}


class RulesFileTests(unittest.TestCase):
    def test_the_committed_rules_file_and_exclusions_are_valid(self):
        z.load_rules((HERE / "rules.tsv").read_text(encoding="utf-8"))
        z.load_exclusions((HERE / "staging-exclude.txt").read_text(encoding="utf-8"))

    def test_parses_actions_and_scopes(self):
        rules = z.load_rules("# comment\n10038\tWARN\tpr\tCSP allows inline scripts until nonces land (SCRUM-1)\n")
        self.assertEqual(z.rule_for(rules, "10038", "pr")["action"], "WARN")
        self.assertIsNone(z.rule_for(rules, "10038", "staging"))

    def test_every_rule_needs_a_written_reason(self):
        with self.assertRaisesRegex(z.ScanError, "reason"):
            z.load_rules("10038\tIGNORE\tall\tfalse positive\n")
        with self.assertRaisesRegex(z.ScanError, "4 tab-separated"):
            z.load_rules("10038\tIGNORE\tall\n")

    def test_rejects_unknown_actions_scopes_and_ids(self):
        reason = "a reason that is long enough to count"
        for line, message in ((f"10038\tFAIL\tall\t{reason}", "action"), (f"10038\tWARN\tprod\t{reason}", "scope"),
                              (f"csp\tWARN\tall\t{reason}", "rule ID")):
            with self.assertRaisesRegex(z.ScanError, message):
                z.load_rules(line)

    def test_rejects_a_rule_listed_twice_for_the_same_scan(self):
        reason = "a reason that is long enough to count"
        with self.assertRaisesRegex(z.ScanError, "twice"):
            z.load_rules(f"10038\tWARN\tall\t{reason}\n10038\tIGNORE\tpr\t{reason}\n")
        z.load_rules(f"10038\tWARN\tpr\t{reason}\n10038\tIGNORE\tstaging\t{reason}\n")


class SummaryTests(unittest.TestCase):
    def test_alerts_of_one_scan_rule_stay_apart_and_rules_match_either_id(self):
        script = dict(alert("10055", "CSP: script-src unsafe-inline", "Medium"), alertRef="10055-5")
        style = dict(alert("10055", "CSP: style-src unsafe-inline", "Medium"), alertRef="10055-6")
        rows, failed = z.summarize([script, style], {}, "pr")
        self.assertEqual([r["rule_id"] for r in rows], ["10055-5", "10055-6"])
        reason = "a reason that is long enough to count"
        rows, failed = z.summarize([script, style], z.load_rules(f"10055-6\tWARN\tall\t{reason}\n"), "pr")
        self.assertEqual([r["result"] for r in rows], ["FAIL", "warn (rules.tsv)"])
        rows, failed = z.summarize([script, style], z.load_rules(f"10055\tWARN\tall\t{reason}\n"), "pr")
        self.assertFalse(failed)

    def test_high_and_medium_fail_low_and_informational_warn(self):
        rows, failed = z.summarize([alert("40018", "SQL Injection", "High"), alert("10020", "Missing Anti-clickjacking Header", "Medium"),
                                    alert("10037", "Server Leaks Information", "Low"), alert("10027", "Suspicious Comments", "Informational")], {}, "pr")
        self.assertTrue(failed)
        self.assertEqual([(r["rule_id"], r["result"]) for r in rows], [("40018", "FAIL"), ("10020", "FAIL"), ("10037", "warn"), ("10027", "warn")])

    def test_counts_per_rule_and_risk_and_skips_false_positives(self):
        rows, failed = z.summarize([alert("10038", "CSP", "Medium"), alert("10038", "CSP", "Medium"),
                                    alert("10038", "CSP", "Medium", confidence="False Positive")], {}, "pr")
        self.assertEqual([(r["rule_id"], r["count"]) for r in rows], [("10038", 2)])
        self.assertTrue(failed)

    def test_rules_file_downgrades_or_ignores_only_for_its_scope(self):
        rules = z.load_rules("10038\tWARN\tpr\tCSP allows inline scripts until nonces land (SCRUM-1)\n"
                             "10020\tIGNORE\tall\tframe-ancestors 'none' in the CSP already blocks framing\n")
        alerts = [alert("10038", "CSP", "Medium"), alert("10020", "Clickjacking", "Medium")]
        rows, failed = z.summarize(alerts, rules, "pr")
        self.assertFalse(failed)
        self.assertEqual({r["rule_id"]: r["result"] for r in rows}, {"10038": "warn (rules.tsv)", "10020": "ignored (rules.tsv)"})
        self.assertTrue(z.summarize(alerts, rules, "staging")[1])

    def test_table_shows_no_urls_parameters_or_evidence(self):
        rows, _ = z.summarize([alert("40018", "SQL Injection | <script>", "High")], {}, "pr")
        output = z.table(rows, "OWASP ZAP pr scan")
        self.assertIn("| 40018 | SQL Injection &lt;script&gt; | High | 1 | FAIL |", output)
        for leak in ("http://", "profileId", "secret", "frontend:3000"):
            self.assertNotIn(leak, output)

    def test_empty_scan_passes(self):
        rows, failed = z.summarize([], {}, "staging")
        self.assertFalse(failed)
        self.assertIn("No findings", z.table(rows, "t"))


class TargetTests(unittest.TestCase):
    def test_never_production(self):
        for mode in ("pr", "staging"):
            for url in ("https://nabad-psi.vercel.app", "https://nabad-backend-nhv5.onrender.com"):
                with self.assertRaisesRegex(z.ScanError, "production"):
                    z.check_target(mode, url)

    def test_pr_scan_only_targets_the_local_app(self):
        z.check_target("pr", "http://frontend:3000")
        z.check_target("pr", "http://localhost:3000")
        for url in ("https://nabad-staging.vercel.app", "https://example.com"):
            with self.assertRaises(z.ScanError):
                z.check_target("pr", url)

    def test_staging_scan_only_targets_staging(self):
        z.check_target("staging", "https://nabad-staging.vercel.app/")
        with self.assertRaises(z.ScanError):
            z.check_target("staging", "https://nabad-git-feature-nabad3.vercel.app")


class StagingExclusionTests(unittest.TestCase):
    patterns = [re.compile(p) for p in z.load_exclusions((HERE / "staging-exclude.txt").read_text(encoding="utf-8"))]

    def excluded(self, path):
        return any(p.fullmatch(z.STAGING_URL + path) for p in self.patterns)

    def test_every_endpoint_that_sends_email_or_calls_the_ai_is_excluded(self):
        for path in ("/api/auth/signup", "/api/auth/verify-email/resend", "/api/auth/forgot-password", "/api/auth/reset-password",
                     "/api/auth/login", "/api/auth/2fa/resend", "/api/auth/2fa/setup", "/api/care-circle/invites",
                     "/api/account/export", "/api/account/export/confirm", "/api/symptoms?profileId=self",
                     "/api/triage/ai-assess", "/api/triage/classify", "/api/reports/analyze", "/api/reports/chat", "/api/auth/google"):
            self.assertTrue(self.excluded(path), path)

    def test_public_pages_are_still_scanned(self):
        for path in ("/", "/login", "/signup", "/providers", "/contact", "/api/health/ready", "/api/providers"):
            self.assertFalse(self.excluded(path), path)


class ErrorTests(unittest.TestCase):
    def test_an_unreachable_zap_is_a_scan_error_without_the_api_key(self):
        with self.assertRaises(z.ScanError) as caught:
            z.Zap("http://127.0.0.1:9", "secret-api-key").call("core", "view", "version")
        self.assertNotIn("secret-api-key", str(caught.exception))

    def test_cannot_run_is_exit_2_not_the_findings_exit_1(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {"ZAP_API_KEY": ""}), mock.patch("sys.stderr"):
            self.assertEqual(z.main(["pr"]), 2)
        with mock.patch.dict(os.environ, {"ZAP_API_KEY": "k"}), mock.patch("sys.stderr"):
            self.assertEqual(z.main(["pr", "--target", "https://nabad-psi.vercel.app"]), 2)


class SignedInPassTests(unittest.TestCase):
    def test_session_ending_endpoints_are_excluded_while_signed_in(self):
        for path in ("/api/auth/logout", "/api/auth/reset-password", "/api/auth/2fa/setup", "/api/auth/2fa/enable",
                     "/api/auth/2fa/disable", "/api/auth/2fa/resend", "/api/auth/2fa/verify", "/api/profile/me",
                     "/api/profile/me?profileId=self"):
            self.assertTrue(z.signed_in_excluded(path), path)

    def test_everything_else_is_still_scanned_signed_in(self):
        for path in ("/api/auth/me", "/api/auth/session", "/api/profile/linked", "/api/profile/me/picture",
                     "/api/profile/emergency-contact", "/api/medications?profileId=self", "/dashboard", "/logout-help"):
            self.assertFalse(z.signed_in_excluded(path), path)
        self.assertFalse([p for p in z.API_GETS if z.signed_in_excluded(p)] == z.API_GETS)
        self.assertFalse([path for _, path, _ in z.API_WRITES_SIGNED_IN if z.signed_in_excluded(path)])


class SessionWatchTests(unittest.TestCase):
    """A tiny local app that accepts the session for the first N checks, then refuses it."""

    def serve(self, accept_first):
        import http.server
        import threading
        calls = {"n": 0}

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                calls["n"] += 1
                ok = calls["n"] <= accept_first and self.headers.get("Cookie") == "accessToken=abc"
                self.send_response(200 if ok else 401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}"

    def test_reports_a_session_that_stays_valid(self):
        with z.SessionWatch(self.serve(accept_first=100), "accessToken=abc", interval=0.05) as watch:
            import time
            time.sleep(0.3)
        valid, message = watch.outcome()
        self.assertTrue(valid)
        self.assertIn("valid for the whole signed-in pass", message)
        self.assertGreater(watch.checks, 2)

    def test_reports_when_the_session_was_lost(self):
        with z.SessionWatch(self.serve(accept_first=2), "accessToken=abc", interval=0.05) as watch:
            import time
            time.sleep(0.4)
        valid, message = watch.outcome()
        self.assertFalse(valid)
        self.assertRegex(message, r"session was lost \d+\.\d minutes into the signed-in pass \(HTTP 401\)")
        self.assertNotIn("127.0.0.1", message)

    def test_the_last_check_catches_a_session_lost_at_the_very_end(self):
        with z.SessionWatch(self.serve(accept_first=0), "accessToken=abc", interval=60) as watch:
            pass
        self.assertFalse(watch.outcome()[0])


class SeedTests(unittest.TestCase):
    def test_pages_come_from_the_frontend(self):
        pages = z.page_paths()
        for page in ("/", "/login", "/dashboard", "/medications", "/care-circle", "/offline.html"):
            self.assertIn(page, pages)
        self.assertFalse([p for p in pages if "[" in p or "/_" in p])

    def test_raw_request_carries_origin_and_json_body(self):
        raw = z.raw_request("POST", "http://frontend:3000/api/vitals?profileId=self", "http://localhost:3000", {"value": 70})
        self.assertTrue(raw.startswith("POST http://frontend:3000/api/vitals?profileId=self HTTP/1.1\r\nHost: frontend:3000\r\n"))
        self.assertIn("Origin: http://localhost:3000\r\n", raw)
        self.assertTrue(raw.endswith('\r\n\r\n{"value": 70}'))


if __name__ == "__main__":
    unittest.main()
