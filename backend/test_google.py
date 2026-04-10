import asyncio
from playwright.async_api import async_playwright
import urllib.parse
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Test original Google Dork 
        raw_query = 'site:facebook.com ("مطلوب" OR "محتاج شقة") ("التجمع الخامس") "عقار"'
        safe_query = urllib.parse.quote(raw_query)
        url = f'https://www.google.com/search?q={safe_query}'
        
        print(f"Navigating to {url}")
        await page.goto(url)
        await asyncio.sleep(3)
        
        text = await page.evaluate("document.body.innerText")
        print("--- EXTRACTED TEXT (First 500 chars) ---")
        print(text[:500])
        
        phones_raw = re.findall(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})', text)
        print("FOUND PHONES:", phones_raw)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
