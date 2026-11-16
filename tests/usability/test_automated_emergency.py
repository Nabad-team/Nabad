"""Regression checks for report accounting; no app or browser needed."""
import io
import unittest

from automated_emergency import Results, SCENARIOS, local_url


class ReportTests(unittest.TestCase):
    def run_scenario(self, body):
        method = SCENARIOS[0][2]
        case = type('SyntheticCase', (unittest.TestCase,), {method: body})
        return unittest.TextTestRunner(stream=io.StringIO(), resultclass=Results).run(case(method))

    def test_success_is_pass(self):
        result = self.run_scenario(lambda test: test.assertTrue(True))
        self.assertEqual(result.rows[0]['status'], 'PASS')
        self.assertGreaterEqual(result.rows[0]['script_duration_seconds'], 0)

    def test_failed_subtest_cannot_be_reported_as_pass(self):
        def body(test):
            with test.subTest(case='synthetic'):
                test.assertTrue(False)
        result = self.run_scenario(body)
        self.assertFalse(result.wasSuccessful())
        self.assertEqual(result.rows[0]['status'], 'FAIL')

    def test_error_and_skip_are_not_pass(self):
        def error(test):
            raise RuntimeError('synthetic')
        def skip(test):
            test.skipTest('synthetic')
        self.assertEqual(self.run_scenario(error).rows[0]['status'], 'ERROR')
        self.assertEqual(self.run_scenario(skip).rows[0]['status'], 'SKIP')

    def test_only_local_disposable_services_are_allowed(self):
        for url in ('http://localhost:3000', 'http://127.0.0.1:8025/api', 'http://[::1]:3000'):
            self.assertTrue(local_url(url))
        for url in ('https://nabad-psi.vercel.app', 'http://localhost.evil.test',
                    'http://user:pass@localhost', 'file:///tmp/app', 'http://localhost?token=example'):
            self.assertFalse(local_url(url))


if __name__ == '__main__':
    unittest.main()
