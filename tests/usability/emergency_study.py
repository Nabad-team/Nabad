"""Launch a local study browser; never generates participant results or makes calls.

Uses the existing tests/requirements.txt dependency. Run --check headlessly to
verify the call/SMS guard, without an app server or any human participants.
"""
import argparse
import shutil
from urllib.parse import urlsplit
from selenium import webdriver

GUARD = r"""
window.__nabadStudyGuard = true;
window.__nabadStudyActions = [];
document.addEventListener('click', function(event) {
  const link = event.target.closest && event.target.closest('a[href]');
  const match = link && /^(tel|sms):/i.exec(link.getAttribute('href'));
  if (match) {
    event.preventDefault(); event.stopImmediatePropagation();
    window.__nabadStudyActions.push({kind:match[1].toLowerCase(), atMs:performance.now()});
  }
}, true);
"""

def check(driver):
    for _ in range(2):  # A fresh document must get the guard too.
        driver.get('data:text/html,<title>Study guard check</title><h1>Synthetic guard check</h1>')
        result = driver.execute_script("""
          if (window.__nabadStudyGuard !== true) return false;
          for (const scheme of ['tel','sms']) {
            const link = document.createElement('a');
            link.href = scheme + ':study-test'; document.body.append(link);
            if (link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))) return false;
          }
          return window.__nabadStudyActions.length === 2 &&
            window.__nabadStudyActions.map(x=>x.kind).join(',') === 'tel,sms' &&
            window.__nabadStudyActions.every(x=>Object.keys(x).sort().join(',') === 'atMs,kind');
        """)
        if result is not True:
            raise RuntimeError('Call/SMS guard check failed. Do not run participant tasks.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:3000')
    parser.add_argument('--check', action='store_true', help='Headless synthetic guard check only; not a user session')
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if url.scheme not in ('http', 'https') or url.hostname not in ('localhost', '127.0.0.1', '::1') or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        parser.error('Use a local disposable app origin only (no production, credentials, query or path).')
    options = webdriver.ChromeOptions()
    chromium = shutil.which('chromium')
    if chromium:
        options.binary_location = chromium
    if args.check:
        options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-notifications')
    options.add_argument('--window-size=1280,960')
    options.add_experimental_option('prefs', {'profile.default_content_setting_values.geolocation': 2})
    driver = webdriver.Chrome(options=options)
    try:
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': GUARD})
        check(driver)
        print('PASS: synthetic guard check across two documents. No participant session/results recorded.')
        if args.check:
            return
        driver.get(args.base_url.rstrip('/') + '/login')
        print('Use ONE tab. Calls/SMS links are intercepted; geolocation and notifications are disabled.')
        print('Use a synthetic account. Do not open external diallers or enable location. Timings/notes go in the study sheet.')
        while True:
            command = input('Facilitator: [check / offline / online / quit] ').strip().lower()
            if command == 'quit':
                break
            if command in ('offline', 'online'):
                driver.execute_cdp_cmd('Network.emulateNetworkConditions', {'offline': command == 'offline', 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
                print('Study browser network: ' + command)
            elif command == 'check':
                print('Guard ready:', driver.execute_script('return window.__nabadStudyGuard === true'))
                print('Blocked links on current page:', driver.execute_script('return (window.__nabadStudyActions || []).length'))
                print('Diagnostic only; not proof that a participant completed a task.')
            else:
                print('Unknown command. No action taken.')
    finally:
        driver.quit()

if __name__ == '__main__':
    main()
