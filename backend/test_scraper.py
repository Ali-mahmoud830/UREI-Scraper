import asyncio
from playwright.async_api import async_playwright
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        print("Navigating to Bayut...")
        await page.goto("https://www.bayut.eg/en/cairo/properties-for-sale/")
        await asyncio.sleep(6)
        
        # Test 1: Finding links
        links = await page.query_selector_all('a[href*="/en/property/details-"]')
        found_url = None
        for link in links:
            href = await link.get_attribute('href')
            if href and len(href) > 20:
                found_url = "https://www.bayut.eg" + href if href.startswith('/') else href
                break
        
        if not found_url:
            print("No ad link found on Bayut.")
            await browser.close()
            return

        print(f"Testing URL: {found_url}")
        await page.goto(found_url, wait_until="domcontentloaded")
        await page.wait_for_selector('body', timeout=15000)
        await asyncio.sleep(3)
        
        # Test 1: tel links
        tels = await page.query_selector_all('a[href^="tel:"]')
        print(f"Found {len(tels)} tel links.")
        for t in tels:
            print("Tel:", await t.get_attribute("href"))
            
        # Test 2: Button clicks
        buttons = await page.query_selector_all('button, a, div[role="button"]')
        for btn in buttons:
            text = (await btn.inner_text() or "").strip()
            aria = (await btn.get_attribute("aria-label") or "").strip()
            title = (await btn.get_attribute("title") or "").strip()
            combined = f"{text} {aria} {title}".lower()
            if any(kw in combined for kw in ['show', 'phone', 'call', 'رقم', 'أظهر', 'contact']):
                print(f"Found target button. Text='{text}', Aria='{aria}', Title='{title}'")
                try:
                    await btn.scroll_into_view_if_needed()
                    await btn.click(force=True, timeout=5000)
                    print("Clicked successfully, waiting 2s...")
                    await asyncio.sleep(3)
                except Exception as e:
                    print(f"Click failed: {e}")

        # Test 3: Regex match
        content = await page.content()
        regex = re.compile(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})')
        phones_raw = regex.findall(content)
        phones = []
        for match in phones_raw:
            clean_phone = re.sub(r'[^\d]', '', match)
            if clean_phone.startswith('20') and len(clean_phone) == 12:
                clean_phone = clean_phone[2:]
            elif len(clean_phone) == 10 and clean_phone.startswith('1'):
                clean_phone = "0" + clean_phone
            
            if len(clean_phone) == 11 and clean_phone.startswith('01'):
                phones.append(clean_phone)
                
        print(f"Tested clean phone extractions: {list(set(phones))}")
        
        await browser.close()

asyncio.run(main())
