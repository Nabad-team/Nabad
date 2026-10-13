```python
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


class NabadWebsiteTests(unittest.TestCase):

    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.maximize_window()

    def test_homepage_loads(self):
        self.driver.get("https://nabad-psi.vercel.app")

        wait = WebDriverWait(self.driver, 15)
        body = wait.until(
            lambda driver: driver.find_element(By.TAG_NAME, "body")
        )

        self.assertTrue(self.driver.title.strip(),
                        "The page should have a title.")

        self.assertTrue(body.text.strip(),
                        "The page should display content.")

    def tearDown(self):
        self.driver.quit()


if __name__ == "__main__":
    unittest.main()
```
