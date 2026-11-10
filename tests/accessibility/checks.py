"""WCAG-tagged browser checks; reports omit HTML, text, labels and record IDs."""
import json
import os
import re
from pathlib import Path
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

AXE_SCRIPT = Path(__file__).parent / 'node_modules' / 'axe-core' / 'axe.min.js'
TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']


def audit(testcase, driver, state):
    if not AXE_SCRIPT.is_file():
        raise RuntimeError('Install the pinned audit engine: npm ci --prefix tests/accessibility --ignore-scripts')
    # Audit the loaded UI, not a mixture of loading/disabled and enabled states.
    # A loader React removes between finding it and checking it raises StaleElementReferenceException; the wait
    # then polls again, so it still only continues once no loader is displayed.
    WebDriverWait(driver, 20, ignored_exceptions=[StaleElementReferenceException]).until(lambda browser: not any(element.is_displayed() for element in browser.find_elements(By.CSS_SELECTOR, '.loader')))
    driver.execute_async_script("""
      const done=arguments[0]; document.fonts.ready.then(()=>Promise.all(
        document.getAnimations().filter(a=>a.effect && a.effect.getComputedTiming().endTime !== Infinity)
          .map(a=>a.finished.catch(()=>{}))
      )).then(done);
    """)
    driver.execute_script(AXE_SCRIPT.read_text())
    result = driver.execute_async_script("""
      const [tags, done] = arguments;
      axe.run(document, {runOnly:{type:'tag', values:tags}}).then(r => done({
        engine:r.testEngine.version,
        violations:r.violations.map(v=>({rule:v.id,impact:v.impact,count:v.nodes.length})),
        manualReview:r.incomplete.map(v=>({rule:v.id,count:v.nodes.length}))
      })).catch(()=>done({error:'Accessibility scan failed'}));
    """, TAGS)
    output = Path(os.getenv('NABAD_ARTIFACTS_DIR', Path(__file__).resolve().parents[1] / 'artifacts'))
    output.mkdir(parents=True, exist_ok=True)
    name = re.sub(r'[^a-zA-Z0-9_-]', '_', state)
    (output / f'axe-{name}.json').write_text(json.dumps({'state':state, **result}, indent=2))
    testcase.assertNotIn('error', result)
    testcase.assertEqual(result['violations'], [], f'Automated WCAG A/AA violations in {state}: {result["violations"]}. Manual review is still required.')
    return result
