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
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, quote, urljoin, urlparse
from urllib.request import urlopen

from selenium import webdriver
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.common.by import By
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
CODE_SUBJECT = "Your Nabad verification code"


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

    def submit_symptoms(self, description):
        self.open("/symptoms")
        self.type_into("symptoms", description)
        self.submit_form_of("symptoms")
        return self.visible((By.ID, "urgency-heading"))

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
        count = (By.CSS_SELECTOR, "section[aria-labelledby='water-heading'] [role='status']")
        before = self.text(count)
        self.click(self.button("Add a glass"))
        self.wait.until(lambda d: d.find_element(*count).text != before)

        self.click(self.button("Set a daily goal"))
        self.type_into("water-target", "8")
        self.click(self.button("Save goal"))
        self.wait_for_text("Daily goal: 8 glasses", (By.CSS_SELECTOR, "section[aria-labelledby='water-heading']"))

    def test_authenticated_profile_and_security_pages(self):
        self.open("/profile")
        self.assertTrue(self.visible((By.CSS_SELECTOR, "h1")).text.strip())
        self.open("/security")
        self.wait.until(lambda d: "security" in d.title.lower())
        self.visible((By.TAG_NAME, "form"))


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
