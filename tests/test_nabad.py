import os
import time
import unittest
from urllib.parse import urljoin

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


BASE_URL = os.getenv("NABAD_BASE_URL", "https://nabad-psi.vercel.app").rstrip("/")
TEST_EMAIL = os.getenv("NABAD_TEST_EMAIL")
TEST_PASSWORD = os.getenv("NABAD_TEST_PASSWORD")


class NabadWebsiteTests(unittest.TestCase):
    """Browser smoke and workflow tests for the public and signed-in site."""

    @classmethod
    def setUpClass(cls):
        options = webdriver.ChromeOptions()
        if os.getenv("NABAD_HEADLESS", "1").lower() not in {"0", "false", "no"}:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1200")
        options.add_argument("--disable-notifications")
        cls.driver = webdriver.Chrome(options=options)
        cls.driver.set_page_load_timeout(30)
        cls.wait = WebDriverWait(cls.driver, 15)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "driver"):
            cls.driver.quit()

    def setUp(self):
        self.driver.delete_all_cookies()

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

    def non_empty_message(self):
        def find_message(driver):
            for element in driver.find_elements(
                By.CSS_SELECTOR, "[role='status'], [role='alert']"
            ):
                if element.is_displayed() and element.text.strip():
                    return element
            return False

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

    def login(self):
        """Sign in using explicitly supplied test credentials."""
        if not TEST_EMAIL or not TEST_PASSWORD:
            self.skipTest(
                "Set NABAD_TEST_EMAIL and NABAD_TEST_PASSWORD to run authenticated workflows"
            )
        self.open("/login")
        self.visible((By.ID, "email")).send_keys(TEST_EMAIL)
        self.visible((By.ID, "password")).send_keys(TEST_PASSWORD)
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        try:
            self.wait.until(EC.url_contains("/dashboard"))
        except TimeoutException:
            if self.driver.find_elements(By.ID, "twoFactorCode"):
                self.skipTest(
                    "The configured account requires two-factor verification; "
                    "provide an account with a test-device exemption"
                )
            error = self.driver.find_elements(By.CSS_SELECTOR, "[role='alert']")
            detail = error[0].text if error else self.driver.current_url
            self.fail(f"Could not sign in with the configured test account: {detail}")

    def assert_redirects_to_login(self, path):
        self.open(path)
        self.wait.until(EC.url_contains("/login"))
        self.assertIn("/login", self.driver.current_url)

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
        self.assertIn("404", self.driver.page_source)
        self.assertIn("Page not found", self.driver.page_source)

    def test_login_rejects_invalid_credentials(self):
        self.open("/login")
        self.visible((By.ID, "email")).send_keys("invalid-browser-test@example.invalid")
        self.visible((By.ID, "password")).send_keys("Definitely-not-a-real-password-123!")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        alert = self.non_empty_message()
        self.assertTrue(alert.text.strip())
        self.assertIn("/login", self.driver.current_url)

    def test_signup_validates_password_before_network_request(self):
        self.open("/signup")
        self.visible((By.ID, "name")).send_keys("Browser Test User")
        self.visible((By.ID, "email")).send_keys("browser-test@example.invalid")
        self.visible((By.ID, "password")).send_keys("weak")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        alert = self.visible((By.CSS_SELECTOR, "[role='alert']"))
        self.assertTrue(alert.text.strip())
        self.assertIn("/signup", self.driver.current_url)

    def test_public_forms_and_navigation(self):
        self.open("/forgot-password")
        email = self.visible((By.ID, "email"))
        email.send_keys("browser-test@example.invalid")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        self.assertTrue(self.non_empty_message().text.strip())

        self.open("/login?reason=inactivity&minutes=15")
        self.assertIn("15 minutes", self.text((By.CSS_SELECTOR, "[role='status']")))
        self.click((By.LINK_TEXT, "Sign up"))
        self.wait.until(EC.url_contains("/signup"))

    def test_signed_in_pages_require_authentication(self):
        for path in (
            "/onboarding",
            "/dashboard",
            "/triage",
            "/medications",
            "/my-health",
            "/water-and-sleep",
            "/profile",
            "/security",
        ):
            with self.subTest(path=path):
                self.assert_redirects_to_login(path)

    def test_signed_out_symptom_route_does_not_expose_private_form(self):
        self.open("/symptoms")
        body = self.driver.find_element(By.TAG_NAME, "body").text
        self.assertNotIn("Symptoms", body)
        self.assertIn("No active profile selected", body)

    def test_authenticated_dashboard_navigation(self):
        self.login()
        self.assertIn("Dashboard", self.driver.title)
        for label, path in (
            ("Type your symptoms", "/symptoms"),
            ("Open safety check", "/triage"),
            ("Open medications", "/medications"),
            ("Open my profile", "/profile"),
        ):
            with self.subTest(path=path):
                self.open("/dashboard")
                self.click((By.CSS_SELECTOR, f"a[href='{path}']"))
                self.wait.until(EC.url_contains(path))

    def test_authenticated_symptoms_flow(self):
        self.login()
        self.open("/symptoms")
        symptoms = self.visible((By.ID, "symptoms"))
        symptoms.send_keys("A mild headache since yesterday")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        status_or_alert = self.visible(
            (By.CSS_SELECTOR, "[role='status'], [role='alert'], .urgency")
        )
        self.assertTrue(status_or_alert.text.strip())
        self.assertTrue(
            self.driver.find_elements(By.ID, "symptoms") == []
            or self.driver.find_element(By.ID, "symptoms").get_attribute("value") == ""
        )

    def test_authenticated_triage_flow_and_read_aloud_control(self):
        self.login()
        self.open("/triage")
        self.visible((By.ID, "triage-symptoms")).send_keys(
            "Mild headache and tiredness"
        )
        Select(self.visible((By.ID, "triage-country"))).select_by_value("LB")
        self.click((By.CSS_SELECTOR, "button[type='submit']"))
        result = self.visible((By.ID, "triage-result-heading"))
        self.assertIn("Safety check result", result.text)
        self.assertTrue(
            self.driver.find_elements(By.CSS_SELECTOR, "button[aria-pressed]")
        )

    def test_authenticated_medication_crud_flow(self):
        self.login()
        self.open("/medications")
        self.click((By.XPATH, "//button[contains(., 'Add medication')]"))
        medication_name = f"Selenium test medicine {int(time.time())}"
        self.visible((By.ID, "new-name")).send_keys(medication_name)
        self.visible((By.ID, "new-dose")).send_keys("10")
        self.visible((By.ID, "new-unit")).send_keys("mg")
        self.visible((By.ID, "new-frequency")).send_keys("once a day")
        self.click((By.XPATH, "//form[@aria-labelledby='new-heading']//button[@type='submit']"))
        self.visible((By.XPATH, f"//*[contains(text(), '{medication_name}')]"))

        medication_item = (
            By.XPATH,
            f"//li[contains(@class, 'medication') and .//*[contains(text(), '{medication_name}')]]",
        )
        self.click(
            (
                By.XPATH,
                f"{medication_item[1]}//button[contains(@aria-label, 'Edit')]",
            )
        )
        dose = self.visible((By.CSS_SELECTOR, "input[id^='edit-'][id$='-dose']"))
        dose.clear()
        dose.send_keys("20")
        self.click(
            (
                By.XPATH,
                "//form[contains(@aria-labelledby, 'edit-')]//button[@type='submit']",
            )
        )
        self.visible((By.XPATH, f"//*[contains(text(), '{medication_name}') and contains(., '20 mg')]"))

    def test_authenticated_health_and_wellbeing_persistence(self):
        self.login()
        self.open("/my-health")
        self.click((By.CSS_SELECTOR, "button[aria-label='Add height']"))
        self.visible((By.ID, "height-value")).send_keys("175")
        self.click((By.XPATH, "//li[contains(@class, 'health-item--editing')]//button[@type='submit']"))
        self.visible((By.XPATH, "//*[contains(text(), '175')]"))

        self.open("/water-and-sleep")
        before = self.text((By.CSS_SELECTOR, ".tracker__count"))
        self.click((By.CSS_SELECTOR, "button[aria-label='Add a glass']"))
        after = self.text((By.CSS_SELECTOR, ".tracker__count"))
        self.assertNotEqual(before, after)

        self.click((By.XPATH, "//button[contains(., 'Set a daily goal')]"))
        self.visible((By.ID, "water-target")).send_keys("8")
        self.click((By.XPATH, "//button[contains(., 'Save goal')]"))
        self.visible((By.XPATH, "//*[contains(text(), 'Daily goal')]"))

    def test_authenticated_profile_and_security_pages(self):
        self.login()
        self.open("/profile")
        self.assertTrue(self.visible((By.CSS_SELECTOR, "h1")).text.strip())
        self.open("/security")
        self.assertIn("security", self.driver.title.lower())
        self.assertTrue(self.driver.find_elements(By.TAG_NAME, "form"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
