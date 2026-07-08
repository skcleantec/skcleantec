"""Chrome WebDriver — 텔레CRM 숨고 브릿지"""
from __future__ import annotations

import logging
import threading
from typing import Optional

from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.webdriver import WebDriver as ChromeWebDriver
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)

_CHROME_START_TIMEOUT = 90


class BrowserManager:
    def __init__(self, headless: bool = False):
        self.driver: Optional[ChromeWebDriver] = None
        self.headless = headless
        self.wait: Optional[WebDriverWait] = None

    def start(self) -> bool:
        try:
            options = Options()
            if self.headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1400,900')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option('excludeSwitches', ['enable-automation'])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--disable-notifications')
            options.add_argument('--lang=ko-KR')

            holder: dict = {'driver': None, 'error': None}

            def worker():
                try:
                    holder['driver'] = ChromeWebDriver(options=options)
                except Exception as e:
                    holder['error'] = e

            t = threading.Thread(target=worker, daemon=True)
            t.start()
            t.join(timeout=_CHROME_START_TIMEOUT)

            if t.is_alive() or holder['error'] or not holder['driver']:
                logger.error('chrome start failed: %s', holder.get('error'))
                return False

            self.driver = holder['driver']
            self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
            })
            self.wait = WebDriverWait(self.driver, 10)
            return True
        except Exception as e:
            logger.error('browser start: %s', e)
            return False

    def arrange_right_half(self, bounds: dict | None = None) -> bool:
        if not self.driver:
            return False
        from automation.window_layout import arrange_soomgo_right_half
        return arrange_soomgo_right_half(self.driver, bounds)

    def stop(self):
        if not self.driver:
            return
        try:
            self.driver.quit()
        except Exception:
            pass
        finally:
            self.driver = None
            self.wait = None

    def is_running(self) -> bool:
        if not self.driver:
            return False
        try:
            _ = self.driver.current_url
            return True
        except Exception:
            return False
