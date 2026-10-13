import unittest
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = "https://nabad-psi.vercel.app"


class NabadWebsiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        options = webdriver.ChromeOptions()
        cls.driver = webdriver.Chrome(options=options)
        cls.driver.set_page_load_timeout(30)
        cls.wait = WebDriverWait(cls.driver, 10)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def check_page(self, path):
        url = urljoin(BASE_URL, path)
        start = time.perf_counter()

        self.driver.get(url)

        elapsed = time.perf_counter() - start
        title = self.driver.title
        self.assertTrue(
            title.strip(),
            f"{path} has an empty page title"
        )

        print(
            f"\nPASS {path} | "
            f"title={title!r} | "
            f"navigation_time={elapsed:.2f}s"
        )

    def test_homepage(self):
        self.check_page("/")

    def test_login_page(self):
        self.check_page("/login")

    def test_signup_page(self):
        self.check_page("/signup")

    def test_forgot_password_page(self):
        self.check_page("/forgot-password")

    def test_reset_password_page(self):
        self.check_page("/reset-password")

    def test_verify_email_page(self):
        self.check_page("/verify-email")

    def test_unknown_page(self):
        self.driver.get(
            urljoin(BASE_URL, "/this-page-should-not-exist-12345")
        )
        self.assertIn(
            "404",
            self.driver.page_source,
            "Expected the unknown URL to display a 404 page"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)