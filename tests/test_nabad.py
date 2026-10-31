"""End-to-end browser tests for Nabad (Selenium + unittest).

Original suite by Leen El Baba. Runs against the local Docker environment by default
(docker compose up, see docs/testing.md):

    pip install -r tests/requirements.txt
    python tests/test_nabad.py

At the start of the run a fresh account is signed up through the UI, verified with the link from the
Mailpit inbox and signed in with the emailed two-factor code. The run ends by deleting that account
through the UI. Anything that creates or changes data refuses to run against production.
"""

import json
import os
import re
import secrets
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, quote, urljoin, urlparse
from urllib.request import urlopen

from selenium import webdriver
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


BASE_URL = os.getenv("NABAD_BASE_URL", "http://localhost:3000").rstrip("/")
MAILPIT_API = os.getenv("NABAD_MAILPIT_API", "http://localhost:8025/api").rstrip("/")
WAIT_SECONDS = float(os.getenv("NABAD_WAIT_SECONDS", "20"))
ARTIFACTS_DIR = Path(os.getenv("NABAD_ARTIFACTS_DIR", Path(__file__).parent / "artifacts"))
# The live site. Tests that sign up, add or delete anything never run against it.
PRODUCTION_HOSTS = {"nabad-psi.vercel.app"}
TRUSTED_DEVICE_COOKIE = "trustedDevice"

VERIFY_SUBJECT = "Verify your Nabad email"
INVITE_SUBJECT = "invited you to their Nabad care circle"
CARE_ALERT_SUBJECT = "Care circle alert from"
CIRCLES_HEADING = "Circles I'm in"
CODE_SUBJECT = "Your Nabad verification code"
EXPORT_SUBJECT = "A copy of your Nabad data was downloaded"
# Where Chrome saves downloads (the data export). A new empty folder for each run.
DOWNLOAD_DIR = Path(tempfile.mkdtemp(prefix="nabad-downloads-"))


def is_production():
    return urlparse(BASE_URL).hostname in PRODUCTION_HOSTS


def refuse_production(action):
    if is_production():
        raise RuntimeError(
            f"Refusing to {action} against production ({BASE_URL}). These tests create and delete "
            "accounts and health data. Point NABAD_BASE_URL at a throwaway environment, such as "
            "http://localhost:3000 from `docker compose up` (see docs/testing.md)."
        )


def save_failure_artifacts(driver, name):
    """Screenshot and page URL of the browser at the moment something failed."""
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", name)[:150]
    try:
        url = driver.current_url
    except Exception as error:  # The browser itself may be what failed.
        url = f"(unavailable: {error})"
    (ARTIFACTS_DIR / f"{safe}.url.txt").write_text(url + "\n", encoding="utf-8")
    try:
        driver.save_screenshot(str(ARTIFACTS_DIR / f"{safe}.png"))
    except Exception as error:
        print(f"Could not save a screenshot for {name}: {error}", file=sys.stderr)
    print(f"\nFAILED {name} at {url} (screenshot in {ARTIFACTS_DIR})", file=sys.stderr)


class Mailpit:
    """The local inbox every email lands in (https://mailpit.axllent.org/docs/api-v1/)."""

    @staticmethod
    def get(path):
        try:
            with urlopen(f"{MAILPIT_API}{path}", timeout=10) as response:
                return json.load(response)
        except URLError as error:
            raise RuntimeError(
                f"Could not reach the Mailpit API at {MAILPIT_API} ({error}). Is `docker compose up` running?"
            ) from error

    @classmethod
    def messages(cls, to, subject):
        query = quote(f'to:"{to}" subject:"{subject}"')
        return cls.get(f"/v1/search?query={query}").get("messages") or []

    @classmethod
    def wait_for_text(cls, driver, to, subject, ignore_ids=()):
        """Text of the newest matching email that is not in ignore_ids, waiting until it arrives."""

        def newest(_):
            fresh = [m for m in cls.messages(to, subject) if m["ID"] not in ignore_ids]
            return fresh[0]["ID"] if fresh else False

        try:
            message_id = WebDriverWait(driver, WAIT_SECONDS, poll_frequency=0.5).until(newest)
        except TimeoutException:
            raise AssertionError(f'No "{subject}" email for {to} arrived in Mailpit') from None
        return cls.get(f"/v1/message/{message_id}")["Text"]


class RunAccount:
    """The account created for this run. Shared by every signed-in test."""

    name = "Selenium Tester"
    email = None
    password = None
    cookies = []
    deleted = False


DRIVER = None


def setUpModule():
    """One browser for the whole run, and (unless pointed at production) a fresh, signed-in account."""
    global DRIVER
    options = webdriver.ChromeOptions()
    if os.getenv("NABAD_HEADLESS", "1").lower() not in {"0", "false", "no"}:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--disable-notifications")
    options.add_argument("--lang=en-US")
    options.add_experimental_option("prefs", {
        "download.default_directory": str(DOWNLOAD_DIR),
        "download.prompt_for_download": False,
    })
    if os.getenv("CI"):
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
    DRIVER = webdriver.Chrome(options=options)
    DRIVER.set_page_load_timeout(30)

    if is_production():
        print(f"\n{BASE_URL} is production: only the read-only public tests will run.", file=sys.stderr)
        return
    try:
        AccountSetup().create_and_sign_in()
    except BaseException:
        save_failure_artifacts(DRIVER, "setUpModule_account_setup")
        DRIVER.quit()
        raise


def tearDownModule():
    if DRIVER is None:
        return
    try:
        # Normally the last test deletes the account. If it didn't run (a single test was picked, or it
        # failed before deleting), try once more so local runs don't pile up accounts.
        if RunAccount.email and not RunAccount.deleted:
            helper = NabadWebsiteTests()
            helper.ensure_signed_in()
            helper.delete_account_through_ui()
    except Exception as error:
        print(f"\nCould not delete the test account {RunAccount.email}: {error}", file=sys.stderr)
    finally:
        DRIVER.quit()


class NabadWebsiteTests(unittest.TestCase):
    """Shared helpers. The tests themselves are in the classes below."""

    # The run's one browser, started in setUpModule (after unittest has already created the test objects).
    @property
    def driver(self):
        return DRIVER

    @property
    def wait(self):
        # React re-renders often replace an element while a wait is looking at it; that just means "look again".
        return WebDriverWait(DRIVER, WAIT_SECONDS, ignored_exceptions=(StaleElementReferenceException,))

    def tearDown(self):
        if self.failed():
            save_failure_artifacts(self.driver, self.id())

    def failed(self):
        # Python 3.11+ records each error (subtests too) on the result as it happens, before tearDown.
        result = getattr(self._outcome, "result", None)
        problems = (getattr(result, "errors", []) or []) + (getattr(result, "failures", []) or [])
        return any(test is self or getattr(test, "test_case", None) is self for test, _ in problems)

    def url(self, path):
        return urljoin(f"{BASE_URL}/", path.lstrip("/"))

    def open(self, path):
        self.driver.get(self.url(path))

    def visible(self, locator):
        return self.wait.until(EC.visibility_of_element_located(locator))

    def clickable(self, locator):
        return self.wait.until(EC.element_to_be_clickable(locator))

    def click(self, locator):
        self.clickable(locator).click()

    def text(self, locator):
        return self.visible(locator).text

    def gone(self, locator):
        return self.wait.until(EC.invisibility_of_element_located(locator))

    def body_text(self):
        return self.driver.find_element(By.TAG_NAME, "body").text

    def wait_for_text(self, text, locator=(By.TAG_NAME, "body")):
        return self.wait.until(EC.text_to_be_present_in_element(locator, text))

    def wait_for_message(self, text, roles=("status", "alert")):
        """A status or alert message that contains text (there can be several on a page)."""
        return self.wait.until(lambda d: next((m for m in messages(d, roles) if text in m.text), False))

    def button(self, name):
        """A button by its accessible name: its aria-label, or else its visible text."""
        return (
            By.XPATH,
            f"//button[@aria-label={xpath_string(name)} or (not(@aria-label) and normalize-space()={xpath_string(name)})]",
        )

    def type_into(self, field_id, value):
        field = self.visible((By.ID, field_id))
        field.clear()
        field.send_keys(value)
        return field

    def set_date(self, field_id, iso_date):
        """Fill a date input (yyyy-mm-dd) the same way on every OS and locale, so React sees the change."""
        field = self.visible((By.ID, field_id))
        self.driver.execute_script(
            "const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "setter.call(arguments[0], arguments[1]);"
            "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));"
            "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            field,
            iso_date,
        )

    def submit_form_of(self, field_id):
        self.click((By.XPATH, f"//form[.//*[@id={xpath_string(field_id)}]]//button[@type='submit']"))

    def non_empty_message(self):
        def find_message(driver):
            found = messages(driver, roles=("status", "alert"))
            return found[0] if found else False

        return self.wait.until(find_message)

    def check_page(self, path, expected_title=None):
        start = time.perf_counter()
        self.open(path)
        elapsed = time.perf_counter() - start
        # Pages that need sign-in render nothing, not even their <title>, until the session check answers.
        try:
            self.wait.until(lambda d: d.title.strip())
        except TimeoutException:
            pass
        title = self.driver.title
        self.assertTrue(title.strip(), f"{path} has an empty page title")
        if expected_title:
            self.assertIn(expected_title.lower(), title.lower())
        print(f"\nPASS {path} | title={title!r} | navigation_time={elapsed:.2f}s")

    def assert_redirects_to_login(self, path):
        """Signed out, the page sends the visitor to /login?next=<path>, so they come back after signing in."""
        self.open(path)
        self.wait.until(EC.url_contains("/login"))
        current = urlparse(self.driver.current_url)
        self.assertEqual(current.path, "/login")
        self.assertEqual(parse_qs(current.query).get("next"), [path])

    # ---- Signing in and out ----

    def sign_out_of_browser(self):
        """Forget every cookie and saved setting, as a new visitor would arrive."""
        # A plain JSON page on the same site: an app page would still be calling the API, and each signed-in
        # response renews the session cookie, which could put it back right after it was deleted.
        self.open("/api/health")
        self.driver.delete_all_cookies()
        self.driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")

    def session_is_valid(self):
        self.open("/api/auth/me")
        return f'"email":"{RunAccount.email}"' in self.body_text().replace(" ", "")

    def save_session(self):
        # The trusted-device cookie only travels to /api/auth, so it is read from a page under that path.
        self.open("/api/auth/me")
        RunAccount.cookies = self.driver.get_cookies()

    def ensure_signed_in(self):
        """Reuse the run's session. If it has ended, sign in again on the remembered device (no new code)."""
        refuse_production("sign in with the test account")
        if not RunAccount.email or RunAccount.deleted:
            self.fail("The test account was not set up (see the setUpModule error above)")
        if self.session_is_valid():
            return
        self.driver.delete_all_cookies()
        for cookie in RunAccount.cookies:
            self.driver.add_cookie({key: cookie[key] for key in ("name", "value", "path", "secure", "httpOnly", "sameSite") if key in cookie})
        if self.session_is_valid():
            return
        self.log_in_with_password()
        if self.driver.find_elements(By.ID, "twoFactorCode"):
            self.fail(
                "Signing in asked for a new two-factor code although this device was remembered. "
                "Not requesting another one: each account gets at most 5 codes an hour."
            )
        self.wait.until(EC.url_contains("/dashboard"))
        self.save_session()

    def log_in_with_password(self):
        self.open("/login")
        self.type_into("email", RunAccount.email)
        self.type_into("password", RunAccount.password)
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.wait.until(lambda d: "/dashboard" in d.current_url or d.find_elements(By.ID, "twoFactorCode") or alert_text(d))
        problem = alert_text(self.driver)
        if problem:
            self.fail(f"Could not sign in with the test account: {problem}")

    def open_account_menu(self):
        self.click((By.CSS_SELECTOR, "button[aria-label='Account menu']"))
        return self.visible((By.ID, "account-menu"))

    def switch_profile(self, visible_text):
        select = Select(self.visible((By.ID, "profile-switcher-desktop")))
        select.select_by_visible_text(visible_text)

    def delete_account_through_ui(self):
        self.open("/profile")
        self.click(self.button("Delete my account"))
        self.visible((By.CSS_SELECTOR, "[role='dialog']"))
        self.type_into("deleteCredential", RunAccount.password)
        self.type_into("deleteConfirmText", "DELETE")
        self.click((By.XPATH, "//*[@role='dialog']//button[@type='submit']"))
        self.wait.until(EC.url_contains("deleted=1"))
        RunAccount.deleted = True


def xpath_string(value):
    """A string literal for XPath 1.0, which has no escape characters."""
    if "'" not in value:
        return f"'{value}'"
    if '"' not in value:
        return f'"{value}"'
    return "concat(" + ", \"'\", ".join(f"'{part}'" for part in value.split("'")) + ")"


# Next.js announces each page change to screen readers in a role="alert" region of its own; that is never a message.
ROUTE_ANNOUNCER_ID = "__next-route-announcer__"


def messages(driver, roles=("alert",)):
    selector = ", ".join(f"[role='{role}']:not(#{ROUTE_ANNOUNCER_ID})" for role in roles)
    found = []
    for element in driver.find_elements(By.CSS_SELECTOR, selector):
        try:
            if element.is_displayed() and element.text.strip():
                found.append(element)
        except StaleElementReferenceException:  # Re-rendered while we looked; the next poll sees the new one.
            continue
    return found


def alert_text(driver):
    found = messages(driver)
    return found[0].text.strip() if found else ""


class AccountSetup(NabadWebsiteTests):
    """Signs up, verifies the email and signs in with two-factor, all through the UI and Mailpit."""

    def create_and_sign_in(self):
        refuse_production("sign up a test account")
        Mailpit.get("/v1/info")  # Fails early, with a clear message, if Mailpit isn't reachable.
        RunAccount.email = f"selenium-{int(time.time())}-{secrets.token_hex(3)}@example.test"
        RunAccount.password = f"{secrets.token_urlsafe(18)} browser test"

        self.sign_out_of_browser()
        self.open("/signup")
        self.type_into("name", RunAccount.name)
        self.type_into("email", RunAccount.email)
        self.type_into("password", RunAccount.password)
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.wait.until(lambda d: "/onboarding" in d.current_url or alert_text(d))
        if alert_text(self.driver):
            raise AssertionError(f"Signup failed: {alert_text(self.driver)}")
        self.click(self.button("Skip"))
        self.wait.until(EC.url_contains("/dashboard"))

        # Verify the email with the link from the inbox (the path is kept; the host is this run's BASE_URL).
        email = Mailpit.wait_for_text(self.driver, RunAccount.email, VERIFY_SUBJECT)
        token = re.search(r"/verify-email\?token=([a-f0-9]{64})", email)
        if not token:
            raise AssertionError("The verification email has no verification link")
        self.open(f"/verify-email?token={token.group(1)}")
        self.wait_for_message("Your email is verified")

        # Sign out through the account menu, then sign in again: this time with the emailed 2FA code.
        self.open("/dashboard")
        self.open_account_menu()
        self.click((By.XPATH, "//*[@id='account-menu']//button[normalize-space()='Sign out']"))
        self.wait.until(EC.url_contains("/login"))

        earlier_codes = {m["ID"] for m in Mailpit.messages(RunAccount.email, CODE_SUBJECT)}
        self.log_in_with_password()
        self.visible((By.ID, "twoFactorCode"))
        email = Mailpit.wait_for_text(self.driver, RunAccount.email, CODE_SUBJECT, ignore_ids=earlier_codes)
        code = re.search(r"\b(\d{6})\b", email)
        if not code:
            raise AssertionError("The two-factor email has no 6-digit code")
        self.type_into("twoFactorCode", code.group(1))
        # Remembered for 30 days: later sign-ins in this run don't need (or use up) another code.
        remember = self.visible((By.XPATH, "//label[contains(., 'Remember this device')]//input[@type='checkbox']"))
        if not remember.is_selected():
            remember.click()
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.wait.until(lambda d: "/dashboard" in d.current_url or alert_text(d))
        if alert_text(self.driver):
            raise AssertionError(f"Two-factor sign-in failed: {alert_text(self.driver)}")
        self.save_session()
        if not any(c["name"] == TRUSTED_DEVICE_COOKIE for c in RunAccount.cookies):
            raise AssertionError("Signing in with 'Remember this device' did not set the trusted-device cookie")
        print(f"\nSigned up and signed in as {RunAccount.email}", file=sys.stderr)


class PublicPageTests(NabadWebsiteTests):
    """Signed-out visitors. Read-only, so these may also be pointed at production."""

    def setUp(self):
        self.sign_out_of_browser()

    def test_public_pages_have_titles(self):
        pages = (
            ("/", None),
            ("/login", "Log in"),
            ("/signup", "Sign up"),
            ("/forgot-password", "Reset"),
            ("/reset-password", "Password"),
            ("/verify-email", "Verify"),
        )
        for path, title in pages:
            with self.subTest(path=path):
                self.check_page(path, title)

    def test_unknown_page_shows_not_found(self):
        self.open("/this-page-should-not-exist-12345")
        self.wait_for_text("We couldn't find that page", (By.TAG_NAME, "h1"))
        self.assertIn("Page not found", self.driver.title)
        self.assertIn("404", self.driver.page_source)
        self.visible((By.LINK_TEXT, "Go to the home page"))

    def test_login_rejects_invalid_credentials(self):
        self.open("/login")
        self.type_into("email", "invalid-browser-test@example.invalid")
        self.type_into("password", "Definitely-not-a-real-password-123!")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        alert = self.non_empty_message()
        self.assertTrue(alert.text.strip())
        self.assertIn("/login", self.driver.current_url)

    def test_signup_validates_password_before_network_request(self):
        self.open("/signup")
        self.type_into("name", "Browser Test User")
        self.type_into("email", "browser-test@example.invalid")
        self.type_into("password", "weak")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.wait.until(alert_text)
        self.assertIn("/signup", self.driver.current_url)

    def test_public_forms_and_navigation(self):
        self.open("/forgot-password")
        self.type_into("email", "browser-test@example.invalid")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.assertTrue(self.non_empty_message().text.strip())

        self.open("/login?reason=inactivity&minutes=15")
        self.wait_for_message("15 minutes", roles=("status",))
        self.click((By.LINK_TEXT, "Sign up"))
        self.wait.until(EC.url_contains("/signup"))

    def test_signed_in_pages_require_authentication(self):
        for path in (
            "/onboarding",
            "/dashboard",
            "/symptoms",
            "/emergency-card",
            "/medications",
            "/my-health",
            "/water-and-sleep",
            "/profile",
            "/security",
        ):
            with self.subTest(path=path):
                self.assert_redirects_to_login(path)


class SignedInWorkflowTests(NabadWebsiteTests):
    """The run's own account, created in setUpModule. Never runs against production."""

    @classmethod
    def setUpClass(cls):
        refuse_production("run the signed-in workflow tests")

    def setUp(self):
        self.ensure_signed_in()

    def test_emergency_information_card_is_accessible_and_printable(self):
        self.open("/emergency-card")
        card = self.visible((By.CSS_SELECTOR, "article.emergency-card"))
        self.assertIn(RunAccount.name, card.text)
        for heading in ("Medical conditions", "Allergies", "Active medications", "Emergency contact"):
            self.assertIn(heading, card.text)
        self.driver.execute_script("window.originalCardPrint = window.print; window.print = () => { window.cardPrintRequested = true; };")
        try:
            self.click(self.button("Print emergency card"))
            self.assertTrue(self.driver.execute_script("return window.cardPrintRequested === true"))
            self.driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "print"})
            self.assertTrue(card.is_displayed())
            self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, ".emergency-card-controls").is_displayed())
            self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, ".site-header").is_displayed())
            self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, ".site-footer").is_displayed())
            self.assertIn("Based on saved health information", card.text)
        finally:
            self.driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": ""})
            self.driver.execute_script("window.print = window.originalCardPrint;")

    def submit_symptoms(self, description, dismiss_emergency=True):
        self.open("/symptoms")
        self.type_into("symptoms", description)
        self.submit_form_of("symptoms")
        heading = self.visible((By.ID, "urgency-heading"))
        if dismiss_emergency:
            if "Emergency" in heading.text:
                self.visible((By.CSS_SELECTOR, "dialog[open][role='alertdialog']"))
                self.click(self.button("Close alert"))
            # Existing workflows need the stored record; the emergency popup itself
            # intentionally appears before this save completes.
            self.visible((By.CSS_SELECTOR, ".symptoms-message"))
        return heading

    def test_emergency_popup_has_immediate_actions_and_keeps_guidance_after_dismissal(self):
        self.submit_symptoms("I have chest pain today", dismiss_emergency=False)
        popup = self.visible((By.CSS_SELECTOR, "dialog[open][role='alertdialog']"))
        self.assertIn("Emergency detected", popup.text)
        self.assertIn("Do not wait for symptoms to improve", popup.text)
        self.assertEqual(popup.get_attribute("aria-modal"), "true")
        self.assertEqual(popup.find_element(By.CSS_SELECTOR, "a").get_attribute("href"), "tel:140")
        self.assertTrue(self.driver.execute_script("return arguments[0].contains(document.activeElement)", popup))
        self.assertTrue(self.driver.execute_script("document.getElementById('symptoms').focus(); return arguments[0].contains(document.activeElement)", popup))
        self.click(self.button("Close alert"))
        self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog[open][role='alertdialog']")))
        self.assertIn("Emergency", self.visible((By.ID, "urgency-heading")).text)
        self.assertEqual(self.visible((By.LINK_TEXT, "Call 140 now")).get_attribute("href"), "tel:140")

        # A fresh emergency must alert again; Escape dismisses the modal accessibly.
        self.submit_symptoms("Chest pain again", dismiss_emergency=False)
        self.visible((By.CSS_SELECTOR, "dialog[open][role='alertdialog']"))
        self.driver.switch_to.active_element.send_keys(Keys.ESCAPE)
        self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog[open][role='alertdialog']")))
        self.assertIn("Emergency", self.visible((By.ID, "urgency-heading")).text)

    def medication_item(self, name, list_label="Your medications"):
        return (
            By.XPATH,
            f"//ul[@aria-label={xpath_string(list_label)}]/li[.//h3[normalize-space()={xpath_string(name)}]]",
        )

    def add_medication(self, name, dose="10", unit="mg", frequency="once a day"):
        self.wait.until(lambda d: d.find_elements(*self.button("Add medication")) or d.find_elements(By.ID, "new-name"))
        if not self.driver.find_elements(By.ID, "new-name"):
            self.click(self.button("Add medication"))
        self.type_into("new-name", name)
        self.type_into("new-dose", dose)
        self.type_into("new-unit", unit)
        self.type_into("new-frequency", frequency)
        self.submit_form_of("new-name")
        self.wait_for_message(f"{name} was added")

    def test_authenticated_dashboard_navigation(self):
        self.open("/dashboard")
        self.wait.until(lambda d: d.title.strip() and "Dashboard" in d.title)
        self.assertIn("Dashboard", self.driver.title)
        self.wait_for_text(f"Welcome, {RunAccount.name.split()[0]}", (By.TAG_NAME, "h1"))
        for locator, path in (
            ((By.CSS_SELECTOR, "a[aria-label='Type your symptoms']"), "/symptoms"),
            ((By.CSS_SELECTOR, "nav[aria-label='Main'] a[href='/my-health']"), "/my-health"),
            ((By.CSS_SELECTOR, "nav[aria-label='Main'] a[href='/medications']"), "/medications"),
            ((By.CSS_SELECTOR, "nav[aria-label='Main'] a[href='/water-and-sleep']"), "/water-and-sleep"),
        ):
            with self.subTest(path=path):
                self.open("/dashboard")
                self.click(locator)
                self.wait.until(EC.url_contains(path))
        with self.subTest(path="/profile"):
            self.open("/dashboard")
            self.open_account_menu()
            self.click((By.CSS_SELECTOR, "#account-menu a[href='/profile']"))
            self.wait.until(EC.url_contains("/profile"))

    def test_authenticated_symptoms_flow(self):
        self.submit_symptoms("A mild headache since yesterday")
        self.wait_for_text(f"Symptoms recorded for {RunAccount.name}", (By.CSS_SELECTOR, ".symptoms-message"))
        self.assertEqual(self.driver.find_element(By.ID, "symptoms").get_attribute("value"), "")

    def test_authenticated_safety_check_result_and_read_aloud_control(self):
        # The old /triage page is gone: /symptoms now saves the symptoms and shows the safety check result.
        heading = self.submit_symptoms("Mild headache and tiredness since this morning")
        self.assertTrue(heading.text.startswith("Urgency"), heading.text)
        result = self.visible((By.CSS_SELECTOR, "section[aria-labelledby='urgency-heading']"))
        self.assertIn("How soon:", result.text)
        self.assertIn("What to do:", result.text)
        read_aloud = result.find_element(By.XPATH, ".//button[@aria-pressed]")
        self.assertEqual(read_aloud.get_attribute("aria-pressed"), "false")
        self.assertEqual(read_aloud.text, "Read aloud")

    def test_authenticated_medication_crud_flow(self):
        name = f"Selenium test medicine {secrets.token_hex(3)}"
        self.open("/medications")
        self.add_medication(name)
        item = self.medication_item(name)
        self.assertIn("10 mg tablet · once a day", self.text(item))

        # Edit the dose.
        self.click(self.button(f"Edit {name}"))
        dose = self.visible((By.CSS_SELECTOR, "input[id^='edit-'][id$='-dose']"))
        dose.clear()
        dose.send_keys("20")
        self.submit_form_of(dose.get_attribute("id"))
        self.wait_for_message(f"Your changes to {name} were saved")
        self.assertIn("20 mg tablet · once a day", self.text(item))

        # Mark as discontinued.
        self.click(self.button(f"Mark as discontinued: {name}"))
        self.wait_for_message(f"{name} is marked as discontinued")
        self.wait_for_text("Discontinued", item)
        self.visible(self.button(f"Mark as active again: {name}"))

        # Delete, then reload: it must be gone from the server too.
        self.click(self.button(f"Delete {name}"))
        dialog = self.visible((By.CSS_SELECTOR, "[role='dialog']"))
        self.assertIn(f"Delete {name}?", dialog.text)
        self.click((By.XPATH, "//*[@role='dialog']//button[normalize-space()='Yes, delete']"))
        self.wait_for_message(f"{name} was deleted")
        self.gone(item)
        self.open("/medications")
        self.visible(self.button("Add medication"))
        self.assertNotIn(name, self.body_text())

    def test_authenticated_family_member_medications_are_separate(self):
        member = f"Selenium Child {secrets.token_hex(2)}"
        medicine = f"Child syrup {secrets.token_hex(3)}"
        self.addCleanup(self.switch_back_to_self)

        self.open("/profile")
        self.click(self.button("Add dependent"))
        self.type_into("dependentName", member)
        self.set_date("dependentDateOfBirth", "2016-04-12")
        Select(self.visible((By.ID, "dependentRelationship"))).select_by_value("child")
        self.submit_form_of("dependentName")
        self.wait_for_text(member, (By.CSS_SELECTOR, "section[aria-labelledby='linked-heading']"))

        # Act for the family member and add a medication to their list.
        self.switch_profile(f"{member} (child)")
        self.open("/medications")
        self.wait_for_text(f"Medications for {member}", (By.TAG_NAME, "h1"))
        self.add_medication(medicine, dose="5", unit="ml", frequency="twice a day")
        self.visible(self.medication_item(medicine, f"Medications for {member}"))

        # Back to the user's own list: the family member's medication is not there.
        self.switch_profile(f"{RunAccount.name} (you)")
        self.wait_for_text("My medications", (By.TAG_NAME, "h1"))
        self.visible(self.button("Add medication"))
        self.assertNotIn(medicine, self.body_text())
        self.open("/medications")
        self.visible(self.button("Add medication"))
        self.assertNotIn(medicine, self.body_text())

    def switch_back_to_self(self):
        self.driver.execute_script("window.localStorage.removeItem('nabad-active-profile-id');")

    def test_authenticated_health_and_wellbeing_persistence(self):
        self.open("/my-health")
        self.click(self.button("Add height"))
        self.type_into("height-value", "175")
        self.submit_form_of("height-value")
        basics = (By.CSS_SELECTOR, "ul[aria-label='Basics']")
        self.wait_for_text("175 cm", basics)
        self.open("/my-health")
        self.wait_for_text("175 cm", basics)

        self.open("/water-and-sleep")
        water = (By.CSS_SELECTOR, "section[aria-labelledby='water-heading']")
        count = (By.CSS_SELECTOR, "section[aria-labelledby='water-heading'] [role='status']")
        before = self.text(count)
        self.click(self.button("Glass (250 ml)"))
        self.wait.until(lambda d: d.find_element(*count).text != before)
        after_glass = self.text(count)
        self.wait_for_text("250 ml", (By.CSS_SELECTOR, "ul[aria-labelledby='drink-log-heading']"))
        self.click(self.button("Bottle (500 ml)"))
        self.wait.until(lambda d: d.find_element(*count).text != after_glass)
        self.click(self.button("Undo last drink"))
        self.wait.until(lambda d: d.find_element(*count).text == after_glass)

        self.click(self.button("Set a daily goal"))
        self.click((By.ID, "goal-type-atMost"))
        self.type_into("goal-amount", "1.5")
        self.click(self.button("Save goal"))
        self.wait_for_text("Daily limit: stay under 1.5 L a day", water)
        self.wait_for_text("of the 1.5 L limit", count)

        sleep = (By.CSS_SELECTOR, "section[aria-labelledby='sleep-heading']")
        self.set_date("sleep-bedtime", "23:30")
        self.set_date("sleep-wake", "07:00")
        self.click((By.ID, "sleep-quality-4"))
        self.submit_form_of("sleep-hours")
        self.wait_for_text("7.5 hours", sleep)
        self.wait_for_text("23:30 to 07:00", sleep)

        self.click(self.button("Show the summary"))
        summary = (By.CSS_SELECTOR, "section[aria-labelledby='doctor-heading']")
        self.wait_for_text("Fluids and sleep, day by day", summary)
        self.wait_for_text("Stay under 1.5 L a day", summary)
        self.visible(self.button("Print or save as PDF"))

    def test_authenticated_visit_prep_document_attachment_and_editing(self):
        filename = f"Selenium visit prep X-ray {secrets.token_hex(3)}.pdf"
        uploaded = self.driver.execute_async_script(
            "const done = arguments[arguments.length - 1];"
            "const filename = arguments[0];"
            "fetch('/api/medical-documents/?profileId=self', { method: 'POST', credentials: 'include',"
            "  headers: { 'Content-Type': 'application/json' },"
            "  body: JSON.stringify({ file: { filename, mimeType: 'application/pdf', data: 'c2VsZW5pdW0gZml4dHVyZQ==' },"
            "    documentType: 'imaging', documentDate: '2026-01-12' }) })"
            "  .then(async (r) => { const body = await r.json(); done(r.ok ? { id: body.document.id } : { error: body.error || `status ${r.status}` }); },"
            "    (e) => done({ error: String(e) }));",
            filename,
        )
        self.assertNotIn("error", uploaded, uploaded.get("error"))

        self.open("/visit-prep")
        self.click(self.button("Choose uploaded documents"))
        checkbox = (By.XPATH, f"//label[contains(., {xpath_string(filename)})]//input[@type='checkbox']")
        self.click(checkbox)
        attached = (By.CSS_SELECTOR, "section[aria-labelledby='visit-prep-attached-heading']")
        self.wait_for_text(filename, attached)
        download = self.visible((By.CSS_SELECTOR, f"section[aria-labelledby='visit-prep-attached-heading'] a[href*='{uploaded['id']}']"))
        self.assertIn("/api/medical-documents/", download.get_attribute("href"))

        self.click(self.button("Edit visit sheet"))
        note = "Ask the clinician to review this X-ray."
        self.type_into("visit-prep-notes", note)
        self.click(self.button("Save changes"))
        notes = (By.CSS_SELECTOR, "section[aria-labelledby='visit-prep-notes-heading']")
        self.wait_for_text(note, notes)
        self.visible(self.button("Print or save as PDF"))

        # Emulate the browser's print stylesheet and verify it leaves the actual summary visible.
        self.driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "print"})
        try:
            visible_summary = self.driver.execute_script(
                "const summary = document.querySelector('.visit-prep');"
                "const title = document.querySelector('.page-title');"
                "return Boolean(summary && title && getComputedStyle(summary).display !== 'none' "
                "  && summary.getBoundingClientRect().height > 0 && getComputedStyle(title).display !== 'none');"
            )
            self.assertTrue(visible_summary, "The print stylesheet hid the visit summary")
            printed_text = self.driver.execute_script("return document.querySelector('.visit-prep').innerText")
            self.assertIn(filename, printed_text)
            self.assertIn(note, printed_text)
            self.assertEqual(self.driver.execute_script("return getComputedStyle(document.querySelector('.visit-prep__actions')).display"), "none")
        finally:
            self.driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "screen"})

    def test_authenticated_provider_directory_contributions(self):
        # Local throwaway account only: feedback and correction persistence through the real UI.
        self.open("/providers/aubmc")
        self.wait_for_text("American University of Beirut Medical Center")
        self.clickable(self.button("Save visit feedback"))
        Select(self.visible((By.ID, "feedback-rating"))).select_by_value("4")
        self.set_date("feedback-date", time.strftime("%Y-%m-%d"))
        self.type_into("feedback-note", "SELENIUM-PROVIDER-NOTE")
        self.click(self.button("Save visit feedback"))
        self.wait_for_message("Your visit feedback was saved.")
        self.open("/providers/aubmc")
        self.clickable(self.button("Remove my feedback"))
        self.assertEqual(self.visible((By.ID, "feedback-note")).get_attribute("value"), "SELENIUM-PROVIDER-NOTE")
        self.click(self.button("Remove my feedback"))
        self.wait_for_message("Your feedback and its waiting report were removed.")
        self.type_into("correction-details", "SELENIUM: please verify this telephone.")
        self.click(self.button("Send correction report"))
        self.wait_for_message("Report saved for review.")
        self.wait_for_text("Status: Pending review")
        self.open("/providers/aubmc")
        self.click(self.button("Withdraw telephone report"))
        self.wait_for_message("Your report was withdrawn.")

    def test_authenticated_profile_and_security_pages(self):
        self.open("/profile")
        self.assertTrue(self.visible((By.CSS_SELECTOR, "h1")).text.strip())
        self.open("/security")
        self.wait.until(lambda d: "security" in d.title.lower())
        self.visible((By.TAG_NAME, "form"))

    def test_authenticated_notifications(self):
        # An appointment 5 minutes from now with a 15-minute reminder is due at once: the API's reminder job
        # (every minute) turns it into a notification. Saved through the API from this browser, in its time zone.
        error = self.driver.execute_async_script(
            "const done = arguments[arguments.length - 1];"
            "const at = new Date(Date.now() + 5 * 60000);"
            "const pad = (n) => String(n).padStart(2, '0');"
            "fetch('/api/appointments?profileId=self', { method: 'POST', credentials: 'include',"
            "  headers: { 'Content-Type': 'application/json' },"
            "  body: JSON.stringify({ title: 'Selenium check-up', hospital: 'Selenium Clinic', reminderMinutes: 15,"
            "    appointmentDate: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,"
            "    appointmentTime: `${pad(at.getHours())}:${pad(at.getMinutes())}`,"
            "    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })"
            "  .then((r) => done(r.ok ? null : `status ${r.status}`), (e) => done(String(e)));"
        )
        self.assertIsNone(error)

        self.check_page("/notifications", "Notifications · Nabad")
        # Wait for the real scheduled notification through the API, then ask the bell to refresh on focus instead
        # of waiting for its normal one-minute background poll.
        bell = (By.XPATH, "//header//button[starts-with(@aria-label, 'Notifications')]")
        reminder_created = self.driver.execute_async_script(
            "const done = arguments[arguments.length - 1];"
            "const deadline = Date.now() + 15000;"
            "const poll = () => fetch('/api/notifications?limit=50', { credentials: 'include' })"
            "  .then((r) => r.json())"
            "  .then((data) => {"
            "    if ((data.notifications || []).some((item) => item.message.includes('Selenium Clinic'))) return done(true);"
            "    if (Date.now() >= deadline) return done(false);"
            "    setTimeout(poll, 250);"
            "  }).catch(() => { if (Date.now() >= deadline) done(false); else setTimeout(poll, 250); });"
            "poll();"
        )
        self.assertTrue(reminder_created, "The reminder job did not create the Selenium Clinic notification within 15 seconds")
        self.driver.execute_script("window.dispatchEvent(new Event('focus'))")
        try:
            WebDriverWait(self.driver, 10, poll_frequency=0.25).until(
                lambda d: "unread" in (d.find_element(*bell).get_attribute("aria-label") or "")
            )
        except TimeoutException:
            self.fail("The notification bell did not refresh after the window regained focus")
        self.open("/notifications")
        reminder = self.visible((By.XPATH, "//ul[@aria-label='Notifications']/li[contains(., 'Selenium Clinic')]"))
        self.assertIn("Appointment reminder", reminder.text)
        self.assertNotIn("Selenium check-up", reminder.text)

        # The bell's panel lists it and can mark everything read.
        self.click(bell)
        panel = self.visible((By.ID, "notification-panel"))
        self.wait.until(lambda d: "Selenium Clinic" in d.find_element(By.ID, "notification-panel").text)
        self.assertTrue(panel.find_element(By.LINK_TEXT, "See all notifications").is_displayed())
        self.click((By.XPATH, "//*[@id='notification-panel']//button[normalize-space()='Mark all as read']"))
        self.wait.until(lambda d: d.find_element(*bell).get_attribute("aria-label") == "Notifications")

        # Preferences: safety-critical types are always on.
        self.open("/profile")
        reminders_box = self.visible((By.ID, "notify-appointment_reminder"))
        self.assertTrue(reminders_box.is_enabled())
        for type_id in ("notify-emergency_alert", "notify-caregiver_urgent"):
            box = self.driver.find_element(By.ID, type_id)
            self.assertTrue(box.is_selected())
            self.assertEqual(box.get_attribute("aria-disabled"), "true")
            box.click()
            self.assertTrue(box.is_selected())

    def test_authenticated_data_export(self):
        # "Download my data" on the profile page: confirm with the password, and the browser saves
        # nabad-data-YYYY-MM-DD.json, a valid JSON copy of this account. The account is emailed about it.
        self.check_page("/profile", "My profile · Nabad")
        self.click(self.button("Download my data"))
        self.type_into("dataExportCredential", RunAccount.password)
        self.click(self.button("Confirm and download"))
        message = self.wait_for_message("Your data was downloaded as nabad-data-").text
        file_name = re.search(r"nabad-data-\d{4}-\d{2}-\d{2}\.json", message).group(0)

        path = DOWNLOAD_DIR / file_name
        try:
            WebDriverWait(self.driver, WAIT_SECONDS, poll_frequency=0.5).until(
                lambda _: path.exists() and not list(DOWNLOAD_DIR.glob("*.crdownload"))
            )
        except TimeoutException:
            self.fail(f"{file_name} was not downloaded (found: {[p.name for p in DOWNLOAD_DIR.iterdir()]})")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(data["formatVersion"], 1)
        self.assertEqual(data["account"]["email"], RunAccount.email)
        self.assertEqual(data["profiles"][0]["profile"]["id"], "self")
        self.assertNotIn("passwordHash", path.read_text(encoding="utf-8"))
        path.unlink()

        text = Mailpit.wait_for_text(self.driver, RunAccount.email, EXPORT_SUBJECT)
        self.assertIn("If this wasn't you, change your password.", text)

    def fetch_json(self, method, path, body=None):
        """Calls the API from this browser (with its cookies) and returns the status."""
        return self.driver.execute_async_script(
            "const [method, path, body, done] = arguments;"
            "fetch(path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' },"
            "  body: body === null ? undefined : JSON.stringify(body) })"
            "  .then((r) => done(r.status), (e) => done(String(e)));",
            method, path, body,
        )

    def test_authenticated_care_circle_alert(self):
        # User A (this run's account) invites user B, B accepts from the Mailpit email by signing up, A runs an
        # emergency symptom check, and B's bell shows the alert: A's name and the level, never the symptoms.
        caregiver_email = f"selenium-care-{int(time.time())}-{secrets.token_hex(3)}@example.test"
        caregiver_password = f"{secrets.token_urlsafe(18)} quiet harbor lamp"
        phone = "+96170123456"
        self.assertEqual(self.fetch_json("PATCH", "/api/profile/me", {"phone": phone}), 200)

        self.check_page("/care-circle", "Care circle · Nabad")
        self.wait_for_text("They never see your symptoms.")
        self.type_into("care-circle-email", caregiver_email)
        self.click(self.button("Send invitation"))
        self.wait_for_message(f"Invitation sent to {caregiver_email}")
        self.visible((By.XPATH, f"//section[.//h2[normalize-space()='Waiting to accept']]//li[contains(., {xpath_string(caregiver_email)})]"))

        invitation = Mailpit.wait_for_text(self.driver, caregiver_email, INVITE_SUBJECT)
        link = re.search(r"/care-circle/accept\?token=([a-f0-9]{64})", invitation)
        self.assertIsNotNone(link, "The invitation email has no accept link")
        self.assertIn("never see symptoms or health details", invitation)
        accept_path = f"/care-circle/accept?token={link.group(1)}"

        # B is signed out: the accept page sends them to sign up with the invited email, and back.
        self.sign_out_of_browser()
        try:
            self.open(accept_path)
            self.wait_for_text(f"{RunAccount.name} invited you to their care circle.")
            self.click((By.LINK_TEXT, "Create an account"))
            self.wait.until(EC.url_contains("/signup"))
            self.assertEqual(self.visible((By.ID, "email")).get_attribute("value"), caregiver_email)
            self.type_into("name", "Selenium Caregiver")
            self.type_into("password", caregiver_password)
            self.click((By.CSS_SELECTOR, "button[type='submit']"))
            self.wait.until(EC.url_contains("/care-circle/accept"))
            self.click(self.button(f"Join {RunAccount.name}'s care circle"))
            self.wait_for_message(f"You're now in {RunAccount.name}'s care circle.")
            self.open("/api/auth/me")
            caregiver_cookies = self.driver.get_cookies()

            # A runs an emergency symptom check.
            self.ensure_signed_in()
            self.submit_symptoms("SELENIUM-PRIVATE-WORDS I can't breathe")
            self.wait_for_text("Emergency", (By.ID, "urgency-heading"))

            # B sees the alert in the bell, with a Call button, and gets the email.
            self.sign_out_of_browser()
            for cookie in caregiver_cookies:
                self.driver.add_cookie({key: cookie[key] for key in ("name", "value", "path", "secure", "httpOnly", "sameSite") if key in cookie})
            alert_email = Mailpit.wait_for_text(self.driver, caregiver_email, CARE_ALERT_SUBJECT)
            self.assertIn(f"{RunAccount.name}'s symptom check needs attention (emergency).", alert_email)
            self.assertNotIn("SELENIUM-PRIVATE-WORDS", alert_email)
            self.open("/dashboard")
            bell = (By.XPATH, "//header//button[starts-with(@aria-label, 'Notifications')]")
            self.wait.until(lambda d: "unread" in (d.find_element(*bell).get_attribute("aria-label") or ""))
            self.click(bell)
            self.wait.until(lambda d: "Care circle alert" in d.find_element(By.ID, "notification-panel").text)
            panel = self.driver.find_element(By.ID, "notification-panel")
            self.assertIn(f"{RunAccount.name}'s symptom check needs attention (emergency).", panel.text)
            self.assertNotIn("SELENIUM-PRIVATE-WORDS", panel.text)
            call = panel.find_element(By.CSS_SELECTOR, f"a[href='tel:{phone}']")
            self.assertIn("Call", call.text)
            self.open("/care-circle")
            self.visible((By.XPATH, f"//section[.//h2[normalize-space()={xpath_string(CIRCLES_HEADING)}]]//li[contains(., {xpath_string(RunAccount.name)})]"))
        finally:
            # B's account is removed (which also takes B out of A's care circle), and A signs back in.
            self.open("/api/health")
            if self.fetch_json("DELETE", "/api/profile/me", {"confirm": "DELETE", "password": caregiver_password}) not in (204, 401):
                print(f"\nCould not delete the caregiver account {caregiver_email}", file=sys.stderr)
            self.sign_out_of_browser()
            self.ensure_signed_in()
            # A was told that B joined: leave A's bell with nothing unread, as the other tests expect.
            self.fetch_json("POST", "/api/notifications/read-all")


class AccountDeletionTest(NabadWebsiteTests):
    """Runs last: deletes the run's account through the UI and checks it can no longer sign in."""

    @classmethod
    def setUpClass(cls):
        refuse_production("delete the test account")

    def test_delete_account_through_ui(self):
        self.ensure_signed_in()
        self.delete_account_through_ui()
        self.wait.until(EC.url_contains("deleted=1"))
        self.assertFalse(self.session_is_valid())

        self.open("/login")
        self.type_into("email", RunAccount.email)
        self.type_into("password", RunAccount.password)
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.wait_for_message("Invalid email or password", roles=("alert",))


def load_tests(loader, standard_tests, pattern):
    """Public pages first, then the signed-in workflows, and deleting the account last."""
    suite = unittest.TestSuite()
    for case in (PublicPageTests, SignedInWorkflowTests, AccountDeletionTest):
        suite.addTests(loader.loadTestsFromTestCase(case))
    return suite


if __name__ == "__main__":
    unittest.main(verbosity=2)
