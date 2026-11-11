#!/usr/bin/env python3
"""OWASP ZAP security scans for Nabad. See docs/security-scanning.md.

Two modes:

  pr       The pull request scan. ZAP (security/zap/compose.zap.yml) scans the local Docker Compose app at
           http://frontend:3000: spider, passive scan and active scan, first signed out, then signed in as a fresh
           test user. Never anything but the local app.
  staging  The weekly scan of https://nabad-staging.vercel.app: spider and passive scan only, rate-limited, with
           every endpoint that sends email or calls the AI excluded (staging-exclude.txt). Never production.

The log only ever shows a summary table (rule ID, name, risk, count, result): no URLs, parameters or evidence,
because the repository and its workflow logs are public. A full report is written only locally, with --report.

Exit codes: 0 no failing findings, 1 High or Medium findings not handled in rules.tsv, 2 the scan could not run.
Standard library only, so it runs on the CI runner's Python without installing anything.
"""
import argparse
import http.client
import json
import os
import re
import secrets
import sys
import threading
import time
from collections import OrderedDict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
RULES_FILE = HERE / "rules.tsv"
STAGING_EXCLUDE_FILE = HERE / "staging-exclude.txt"

STAGING_URL = "https://nabad-staging.vercel.app"
# Hosts no scan may ever touch.
PRODUCTION_HOSTS = {"nabad-psi.vercel.app", "nabad-backend-nhv5.onrender.com"}
# The PR scan only runs against the throwaway local app.
LOCAL_HOSTS = {"frontend", "localhost", "127.0.0.1", "backend"}

RISKS = ["High", "Medium", "Low", "Informational"]
FAILING_RISKS = {"High", "Medium"}
ACTIONS = {"IGNORE", "WARN"}
SCOPES = {"all", "pr", "staging"}
VERIFY_SUBJECT = "Verify your Nabad email"

# Signed-in pass: endpoints that would end the scan's session, delete the test user or change how it signs in.
# Neither the spider nor the active scan requests them while signed in; they are still scanned signed out, where
# they can't affect the session. Logging out and a password reset bump the user's authVersion, which ends every
# session at once. There is no separate change-password endpoint: passwords only change through the reset flow.
SIGNED_IN_EXCLUDE = [
    r".*/api/auth/logout.*",          # sign out: ends every session of the user
    r".*/api/auth/reset-password.*",  # password change: ends every session
    r".*/api/auth/2fa/.*",            # 2FA settings: setup, enable, disable, resend and verify
    r".*/api/profile/me([?#].*)?",    # DELETE deletes the account; PATCH shares the URL, so both are skipped
]
# How often the session watcher checks the test user's session during the signed-in pass.
SESSION_CHECK_SECONDS = 20

# Profile-scoped API reads, seeded so the signed-in pass covers them even where no page links to them.
API_GETS = [
    "/api/health", "/api/health/ready", "/api/auth/me", "/api/auth/session", "/api/profile/me", "/api/profile/linked",
    "/api/profile/emergency-contact", "/api/medications?profileId=self", "/api/medications/overview",
    "/api/medications/adherence?profileId=self", "/api/appointments?profileId=self", "/api/symptoms?profileId=self",
    "/api/vitals?profileId=self", "/api/wellbeing/today?profileId=self", "/api/wellbeing/history?profileId=self",
    "/api/health-profile?profileId=self", "/api/notifications", "/api/notifications/unread-count",
    "/api/notifications/preferences", "/api/care-circle", "/api/emergency-card?profileId=self",
    "/api/medical-documents?profileId=self", "/api/visit-prep?profileId=self", "/api/visit-prep-shares?profileId=self",
    "/api/providers", "/api/providers/favorites", "/api/reports/conversations?profileId=self",
]

# Writes with a plausible body, so the active scan has JSON parameters to test. Synthetic data only.
API_WRITES_SIGNED_OUT = [
    ("POST", "/api/auth/login", {"email": "nobody@example.test", "password": "not-the-password-123"}),
    ("POST", "/api/auth/verify-email", {"token": "0" * 64}),
    ("POST", "/api/auth/forgot-password", {"email": "nobody@example.test"}),
]
API_WRITES_SIGNED_IN = [
    ("POST", "/api/medications?profileId=self", {"name": "ZAP test medicine", "dosage": "5 mg", "startDate": "2026-01-01", "times": ["08:00"]}),
    ("POST", "/api/appointments?profileId=self", {"title": "ZAP visit", "hospital": "Synthetic hospital", "appointmentDate": "2026-12-01", "appointmentTime": "10:00", "reminderMinutes": 0}),
    ("POST", "/api/vitals?profileId=self", {"type": "heartRate", "value": 70}),
    ("POST", "/api/symptoms?profileId=self", {"symptoms": "mild headache"}),
    ("POST", "/api/triage/classify", {"symptoms": "mild headache"}),
    ("POST", "/api/search", {"query": "zap", "profileId": "self"}),
    ("POST", "/api/health-profile/facts?profileId=self", {"type": "condition", "label": "Synthetic condition"}),
    ("PUT", "/api/wellbeing/water/goal?profileId=self", {"goal": 8}),
    ("PUT", "/api/visit-prep?profileId=self", {"notes": "Synthetic note"}),
    ("POST", "/api/profile/emergency-contact", {"name": "Synthetic Contact", "phone": "+96170000000", "relationship": "friend"}),
]


class ScanError(Exception):
    """The scan could not run. Messages never contain URLs with parameters or secrets."""


# ---- Rules file -------------------------------------------------------------------------------------------------

def load_rules(text):
    """rules.tsv: rule_id <TAB> action <TAB> scope <TAB> reason. Every rule needs a written reason."""
    rules = {}
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip("\r")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 4:
            raise ScanError(f"rules.tsv line {number}: expected 4 tab-separated columns: rule_id, action, scope, reason")
        rule_id, action, scope, reason = (part.strip() for part in parts)
        if not re.fullmatch(r"\d+(-\d+)?", rule_id):
            raise ScanError(f"rules.tsv line {number}: rule ID must be ZAP's rule ID, such as 10055 or 10055-5")
        if action not in ACTIONS:
            raise ScanError(f"rules.tsv line {number}: action must be one of {sorted(ACTIONS)}")
        if scope not in SCOPES:
            raise ScanError(f"rules.tsv line {number}: scope must be one of {sorted(SCOPES)}")
        if len(reason) < 20:
            raise ScanError(f"rules.tsv line {number}: write the reason out (at least 20 characters)")
        clashes = SCOPES if scope == "all" else {scope, "all"}
        if any((rule_id, other) in rules for other in clashes):
            raise ScanError(f"rules.tsv line {number}: rule {rule_id} is listed twice for the same scan")
        rules[(rule_id, scope)] = {"action": action, "reason": reason}
    return rules


def rule_for(rules, rule_id, mode):
    """An entry for the exact alert (10055-5) wins over one for the whole scan rule (10055)."""
    base = rule_id.split("-", 1)[0]
    for key in dict.fromkeys((rule_id, base)):
        found = rules.get((key, mode)) or rules.get((key, "all"))
        if found:
            return found
    return None


# ---- Results ----------------------------------------------------------------------------------------------------

def summarize(alerts, rules, mode):
    """Count alerts per (rule, risk) and decide each row's result. Only IDs, names, risks and counts survive."""
    counts = OrderedDict()
    for alert in alerts:
        if alert.get("confidence") == "False Positive":
            continue
        risk = alert.get("risk")
        if risk not in RISKS:
            continue
        # alertRef tells apart alerts of one scan rule, e.g. 10055-5 (script-src) and 10055-6 (style-src).
        key = (str(alert.get("alertRef") or alert.get("pluginId", "")), risk)
        if key not in counts:
            counts[key] = {"rule_id": key[0], "name": str(alert.get("name") or alert.get("alert") or ""), "risk": risk, "count": 0}
        counts[key]["count"] += 1
    rows = []
    for row in counts.values():
        rule = rule_for(rules, row["rule_id"], mode)
        if rule and rule["action"] == "IGNORE":
            row["result"] = "ignored (rules.tsv)"
        elif rule and rule["action"] == "WARN":
            row["result"] = "warn (rules.tsv)"
        elif row["risk"] in FAILING_RISKS:
            row["result"] = "FAIL"
        else:
            row["result"] = "warn"
        rows.append(row)
    rows.sort(key=lambda r: (RISKS.index(r["risk"]), r["rule_id"]))
    return rows, any(r["result"] == "FAIL" for r in rows)


def table(rows, title):
    # Rule names come from ZAP; keep each to one plain table cell (no pipes, newlines or HTML in the step summary).
    clean = lambda value: re.sub(r"[|\s]+", " ", str(value)).strip().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    lines = [f"### {title}", "", "| Rule ID | Name | Risk | Count | Result |", "|---|---|---|---|---|"]
    lines += [f"| {r['rule_id']} | {clean(r['name'])} | {r['risk']} | {r['count']} | {r['result']} |" for r in rows]
    if not rows:
        lines.append("| - | No findings | - | 0 | pass |")
    lines += ["", "High and Medium fail the scan; Low and Informational are warnings. Exceptions are in security/zap/rules.tsv. "
              "Run the scan locally for full details (docs/security-scanning.md)."]
    return "\n".join(lines)


# ---- Target safety ----------------------------------------------------------------------------------------------

def check_target(mode, url):
    host = (urlparse(url).hostname or "").lower()
    if host in PRODUCTION_HOSTS:
        raise ScanError("Refusing to scan production.")
    if mode == "pr" and host not in LOCAL_HOSTS:
        raise ScanError("The PR scan only runs against the local Docker Compose app (for example http://frontend:3000).")
    if mode == "staging" and url.rstrip("/") != STAGING_URL:
        raise ScanError(f"The staging scan only runs against {STAGING_URL}.")


def load_exclusions(text):
    """staging-exclude.txt: one regex per line, '#' comments. Each regex needs a reason comment on the line above."""
    patterns = []
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            re.compile(line)
            patterns.append(line)
    return patterns


# ---- ZAP API ----------------------------------------------------------------------------------------------------

class Zap:
    def __init__(self, base, key):
        self.base = base.rstrip("/")
        self.key = key

    def call(self, component, kind, name, **params):
        url = f"{self.base}/JSON/{component}/{kind}/{name}/"
        if params:
            url += "?" + urlencode({k: ("true" if v is True else "false" if v is False else v) for k, v in params.items()})
        try:
            with urlopen(Request(url, headers={"X-ZAP-API-Key": self.key}), timeout=300) as response:
                return json.load(response)
        except HTTPError as error:
            detail = ""
            try:
                detail = json.load(error).get("message", "")
            except Exception:
                pass
            raise ScanError(f"ZAP API {component}/{name} failed: HTTP {error.code} {detail}".strip()) from None
        except (URLError, OSError, http.client.HTTPException):
            # Includes ZAP dropping connections while it starts.
            raise ScanError(f"Could not reach the ZAP API for {component}/{name}. Is the zap service running?") from None

    def try_call(self, component, kind, name, **params):
        """For clean-up of a previous run in the same ZAP (rules and contexts survive a restart): missing is fine."""
        try:
            return self.call(component, kind, name, **params)
        except ScanError:
            return None

    def new_context(self, name):
        self.try_call("context", "action", "removeContext", contextName=name)
        return self.call("context", "action", "newContext", contextName=name)["contextId"]

    def wait_until_up(self, seconds=180):
        deadline = time.time() + seconds
        while time.time() < deadline:
            try:
                return self.call("core", "view", "version")["version"]
            except ScanError:
                time.sleep(3)
        raise ScanError("ZAP did not start in time.")

    def wait(self, component, scan_id, label):
        while True:
            status = int(self.call(component, "view", "status", scanId=scan_id)["status"])
            if status >= 100:
                print(f"  {label}: done", flush=True)
                return
            time.sleep(5)

    def wait_for_passive(self):
        while int(self.call("pscan", "view", "recordsToScan")["recordsToScan"]) > 0:
            time.sleep(3)

    def alerts(self):
        found, start = [], 0
        while True:
            page = self.call("alert", "view", "alerts", start=start, count=5000)["alerts"]
            found += page
            if len(page) < 5000:
                return found
            start += 5000

    def send(self, raw):
        return self.call("core", "action", "sendRequest", request=raw, followRedirects=False)

    def set_header(self, description, header, value):
        """Adds or replaces a request header on everything ZAP sends (spider, active scan, sendRequest)."""
        self.try_call("replacer", "action", "removeRule", description=description)
        self.call("replacer", "action", "addRule", description=description, enabled=True, matchType="REQ_HEADER",
                  matchRegex=False, matchString=header, replacement=value)


def raw_request(method, url, origin=None, body=None):
    parsed = urlparse(url)
    target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    lines = [f"{method} {parsed.scheme}://{parsed.netloc}{target} HTTP/1.1", f"Host: {parsed.netloc}",
             "Accept: application/json, text/html"]
    data = ""
    if origin:
        lines.append(f"Origin: {origin}")
    if body is not None:
        data = json.dumps(body)
        lines += ["Content-Type: application/json", f"Content-Length: {len(data.encode())}"]
    return "\r\n".join(lines) + "\r\n\r\n" + data


def page_paths():
    """Every page in frontend/pages, so new pages are scanned without editing this file."""
    pages_dir = REPO / "frontend" / "pages"
    paths = set()
    for file in pages_dir.rglob("*.js"):
        rel = file.relative_to(pages_dir).with_suffix("").as_posix()
        if any(part.startswith(("_", "[")) for part in rel.split("/")) or rel in {"404", "500"}:
            continue
        rel = re.sub(r"(^|/)index$", "", rel)
        paths.add("/" + rel)
    return sorted(paths) + ["/offline.html"]


# ---- Test user (PR scan only) -------------------------------------------------------------------------------------

def http_json(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    request = Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urlopen(request, timeout=30) as response:
            return response.status, response.headers, json.loads(response.read() or b"{}")
    except HTTPError as error:
        return error.code, error.headers, {}


def create_test_user(app_url, mailpit_api, origin):
    """Signs up a synthetic user, verifies the email through Mailpit and returns the session cookie header."""
    email = f"zap-{secrets.token_hex(4)}@example.test"
    # Random, and free of words from the name or email, which the password policy refuses.
    password = "Nb1-" + secrets.token_hex(16)
    status, _, _ = http_json("POST", f"{app_url}/api/auth/signup", {"name": "ZAP Scanner", "email": email, "password": password}, {"Origin": origin})
    if status != 201:
        raise ScanError(f"Could not sign up the scan's test user (HTTP {status}).")
    token = None
    for _ in range(40):
        query = quote(f'to:"{email}" subject:"{VERIFY_SUBJECT}"')
        with urlopen(f"{mailpit_api}/v1/search?query={query}", timeout=10) as response:
            messages = json.load(response).get("messages") or []
        if messages:
            with urlopen(f"{mailpit_api}/v1/message/{messages[0]['ID']}", timeout=10) as response:
                match = re.search(r"\b[a-f0-9]{64}\b", json.load(response)["Text"])
            token = match and match.group(0)
            break
        time.sleep(0.5)
    if not token:
        raise ScanError("The verification email for the scan's test user did not arrive in Mailpit.")
    status, _, _ = http_json("POST", f"{app_url}/api/auth/verify-email", {"token": token}, {"Origin": origin})
    if status != 200:
        raise ScanError(f"Could not verify the scan's test user (HTTP {status}).")
    status, headers, body = http_json("POST", f"{app_url}/api/auth/login", {"email": email, "password": password}, {"Origin": origin})
    if status != 200 or body.get("twoFactorRequired"):
        raise ScanError(f"Could not sign in the scan's test user (HTTP {status}). Is TWO_FACTOR_ON_SIGNUP off for the scan?")
    cookies = [c.split(";", 1)[0] for c in headers.get_all("Set-Cookie") or []]
    session = [c for c in cookies if c.startswith("accessToken=")]
    if not session:
        raise ScanError("Signing in returned no session cookie.")
    return "; ".join(cookies)


class SessionWatch:
    """Checks the test user's session every SESSION_CHECK_SECONDS during the signed-in pass, straight from this
    machine rather than through ZAP, and remembers when it was first refused. Reports only the outcome."""

    def __init__(self, app_url, cookie, interval=SESSION_CHECK_SECONDS):
        self.url = f"{app_url}/api/auth/me"
        self.cookie = cookie
        self.interval = interval
        self.started = time.time()
        self.checks = 0
        self.lost_after = None
        self.lost_status = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def check(self):
        try:
            status, _, _ = http_json("GET", self.url, headers={"Cookie": self.cookie})
        except OSError:
            return  # The app being briefly unreachable is not a lost session.
        self.checks += 1
        if status != 200 and self.lost_after is None:
            self.lost_after = time.time() - self.started
            self.lost_status = status

    def _run(self):
        while not self._stop.wait(self.interval):
            self.check()

    def __enter__(self):
        self.started = time.time()
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        self._thread.join()
        self.check()  # One last check at the very end of the pass.

    def outcome(self):
        if self.lost_after is None:
            return True, f"session valid for the whole signed-in pass (checked {self.checks} times)"
        return False, f"session was lost {self.lost_after / 60:.1f} minutes into the signed-in pass (HTTP {self.lost_status})"


# ---- Scans ------------------------------------------------------------------------------------------------------

def spider(zap, target, context, minutes, seeds):
    for path in seeds:
        try:
            zap.call("core", "action", "accessUrl", url=target + path, followRedirects=False)
        except ScanError:
            pass  # A seed the app answers with an error is still in the site tree; nothing to do.
    zap.call("spider", "action", "setOptionMaxDuration", Integer=minutes)
    scan_id = zap.call("spider", "action", "scan", url=target, contextName=context, recurse=True)["scan"]
    zap.wait("spider", scan_id, "spider")
    zap.wait_for_passive()


def active_scan(zap, target, context_id, label):
    scan_id = zap.call("ascan", "action", "scan", url=target, recurse=True, inScopeOnly=True, contextId=context_id)["scan"]
    zap.wait("ascan", scan_id, f"active scan ({label})")
    zap.wait_for_passive()


def run_pr(zap, args):
    target = args.target.rstrip("/")
    context = "nabad-pr"
    context_id = zap.new_context(context)
    zap.call("context", "action", "includeInContext", contextName=context, regex=re.escape(target) + ".*")
    zap.call("spider", "action", "setOptionThreadCount", Integer=4)
    zap.call("ascan", "action", "setOptionThreadPerHost", Integer=4)
    zap.call("ascan", "action", "setOptionMaxScanDurationInMins", Integer=args.active_minutes)
    zap.call("ascan", "action", "setOptionMaxRuleDurationInMins", Integer=max(1, args.active_minutes // 4))
    # The API only accepts writes from CLIENT_ORIGIN, as a browser on the app would send it.
    zap.set_header("nabad-origin", "Origin", args.origin)
    pages = page_paths()
    # Created first, so a broken sign-up fails the job in seconds rather than after the signed-out pass.
    cookie = create_test_user(args.app_url.rstrip("/"), args.mailpit_api.rstrip("/"), args.origin)

    print("Signed out: spider, passive and active scan", flush=True)
    for method, path, body in API_WRITES_SIGNED_OUT:
        zap.send(raw_request(method, target + path, args.origin, body))
    spider(zap, target, context, args.spider_minutes, pages + API_GETS)
    active_scan(zap, target, context_id, "signed out")

    print("Signed in: spider, passive and active scan", flush=True)
    zap.set_header("nabad-session", "Cookie", cookie)
    check = zap.send(raw_request("GET", target + "/api/auth/me"))
    if " 200 " not in check["sendRequest"][0]["responseHeader"].split("\r\n", 1)[0] + " ":
        raise ScanError("The scan's session cookie is not accepted, so the signed-in pass would scan nothing.")
    for regex in SIGNED_IN_EXCLUDE:
        zap.call("context", "action", "excludeFromContext", contextName=context, regex=regex)
        zap.call("spider", "action", "excludeFromScan", regex=regex)
        zap.call("ascan", "action", "excludeFromScan", regex=regex)
        zap.call("core", "action", "excludeFromProxy", regex=regex)
    with SessionWatch(args.app_url.rstrip("/"), cookie) as watch:
        for method, path, body in API_WRITES_SIGNED_IN:
            zap.send(raw_request(method, target + path, args.origin, body))
        spider(zap, target, context, args.spider_minutes, pages + [p for p in API_GETS if not signed_in_excluded(p)])
        active_scan(zap, target, context_id, "signed in")
    valid, message = watch.outcome()
    print(f"  {message}", flush=True)
    if not valid:
        raise ScanError(f"The {message}, so part of the signed-in pass ran signed out (docs/security-scanning.md).")


def signed_in_excluded(path):
    return any(re.fullmatch(pattern, "http://app" + path) for pattern in SIGNED_IN_EXCLUDE)


def run_staging(zap, args):
    target = STAGING_URL
    host = urlparse(target).hostname
    # Low request rate for the shared free staging services. No rate limit, no scan.
    zap.try_call("network", "action", "removeRateLimitRule", description="nabad-staging")
    zap.call("network", "action", "addRateLimitRule", description="nabad-staging", enabled=True, matchRegex=False,
             matchString=host, requestsPerSecond=args.requests_per_second, groupBy="rule")
    context = "nabad-staging"
    zap.new_context(context)
    zap.call("context", "action", "includeInContext", contextName=context, regex=re.escape(target) + ".*")
    for regex in load_exclusions(STAGING_EXCLUDE_FILE.read_text(encoding="utf-8")):
        zap.call("context", "action", "excludeFromContext", contextName=context, regex=regex)
        zap.call("spider", "action", "excludeFromScan", regex=regex)
        zap.call("core", "action", "excludeFromProxy", regex=regex)
    # Passive only: the spider only follows links with GET and never submits forms.
    zap.call("spider", "action", "setOptionPostForm", Boolean=False)
    zap.call("spider", "action", "setOptionProcessForm", Boolean=False)
    zap.call("spider", "action", "setOptionThreadCount", Integer=1)
    zap.call("spider", "action", "setOptionMaxDepth", Integer=5)
    public = ["/", "/login", "/signup", "/forgot-password", "/providers", "/contact", "/privacy", "/terms", "/offline.html"]
    print("Staging: spider and passive scan (rate-limited, no active scan)", flush=True)
    spider(zap, target, context, args.spider_minutes, public)


def write_local_report(zap, name):
    if os.getenv("CI"):
        raise ScanError("Full reports are local only: they are never written in CI (the logs are public).")
    for template, suffix in (("traditional-html", "html"), ("traditional-json", "json")):
        zap.call("reports", "action", "generate", title="Nabad ZAP scan", template=template, reportDir="/zap/wrk",
                 reportFileName=f"{name}.{suffix}")
    print(f"Full report: security/zap/reports/{name}.html and .json (git-ignored; don't share them publicly).")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["pr", "staging"])
    parser.add_argument("--zap", default="http://localhost:8090", help="ZAP API (default: %(default)s)")
    parser.add_argument("--target", default="http://frontend:3000", help="pr: the app as ZAP sees it (default: %(default)s)")
    parser.add_argument("--app-url", default="http://localhost:3000", help="pr: the app from this machine, to create the test user")
    parser.add_argument("--mailpit-api", default="http://localhost:8025/api", help="pr: Mailpit's API, to verify the test user")
    parser.add_argument("--origin", default="http://localhost:3000", help="pr: the app's CLIENT_ORIGIN")
    parser.add_argument("--spider-minutes", type=int, default=5)
    parser.add_argument("--active-minutes", type=int, default=10, help="pr: limit per active scan pass")
    parser.add_argument("--requests-per-second", type=int, default=2, help="staging: rate limit")
    parser.add_argument("--report", metavar="NAME", help="local only: also write a full HTML and JSON report")
    args = parser.parse_args(argv)

    try:
        key = os.environ.get("ZAP_API_KEY") or ""
        if not key:
            raise ScanError("Set ZAP_API_KEY (the same value the zap service was started with).")
        rules = load_rules(RULES_FILE.read_text(encoding="utf-8"))
        check_target(args.mode, STAGING_URL if args.mode == "staging" else args.target)
        zap = Zap(args.zap, key)
        print(f"ZAP {zap.wait_until_up()}", flush=True)
        # A fresh session: no site tree or alerts left over from an earlier scan in the same ZAP.
        zap.call("core", "action", "newSession", overwrite=True)
        (run_pr if args.mode == "pr" else run_staging)(zap, args)
        rows, failed = summarize(zap.alerts(), rules, args.mode)
        if args.report:
            write_local_report(zap, args.report)
    except ScanError as error:
        print(f"ZAP scan could not run: {error}", file=sys.stderr)
        return 2
    except Exception as error:  # Exit 2, never 1 (findings), and no traceback that could echo request details.
        print(f"ZAP scan could not run: unexpected {type(error).__name__}", file=sys.stderr)
        return 2

    output = table(rows, f"OWASP ZAP {args.mode} scan")
    print("\n" + output)
    summary_file = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a", encoding="utf-8") as handle:
            handle.write(output + "\n")
    if failed:
        print("\nHigh or Medium findings: fix them, or add them to security/zap/rules.tsv with a written reason.", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
