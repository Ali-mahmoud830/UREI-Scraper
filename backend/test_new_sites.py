import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        print("Testing Bayut...")
        try:
            await page.goto("https://www.bayut.eg/en/properties-for-sale/cairo/")
            await asyncio.sleep(5)
            
            links = await page.query_selector_all('a[href*="/property/"], a[href*="-unit-"]')
            found_url = None
            for link in links:
                href = await link.get_attribute('href')
                if href and len(href) > 20:
                    found_url = "https://www.bayut.eg" + href if href.startswith('/') else href
                    break
                    
            if found_url:
                print(f"Testing Bayut URL: {found_url}")
                await page.goto(found_url)
                await asyncio.sleep(5)
                html = await page.content()
                with open("bayut_dump.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("Dumped bayut_dump.html")
            else:
                print("No links found on Bayut")
        except Exception as e:
            print(f"Bayut error: {e}")
            
        print("\nTesting Elbayt...")
        try:
            await page.goto("https://elbayt.com/en")
            await asyncio.sleep(5)
            links = await page.query_selector_all('a[href*="/property/"], a[href*="/en/property/"]')
            found_url = None
            for link in links:
                href = await link.get_attribute('href')
                if href and len(href) > 15:
                    found_url = "https://elbayt.com" + href if href.startswith('/') else href
                    break
                    
            if found_url:
                print(f"Testing Elbayt URL: {found_url}")
                await page.goto(found_url)
                await asyncio.sleep(5)
                html = await page.content()
                with open("elbayt_dump.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("Dumped elbayt_dump.html")
            else:
                print("No links found on Elbayt")
        except Exception as e:
            print(f"Elbayt error: {e}")

        await browser.close()

asyncio.run(main())
