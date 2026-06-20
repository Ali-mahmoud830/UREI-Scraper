import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()
        try:
            print("Navigating to DDG Lite...")
            resp = await page.goto("https://lite.duckduckgo.com/lite/", wait_until="domcontentloaded", timeout=30000)
            print("Response:", resp.status)
            
            # Save screenshot to see what's blocking it
            await page.screenshot(path="ddg_lite.png")
            print("Screenshot saved.")
            
            content = await page.content()
            q_input = await page.query_selector("input[name='q']")
            print("Found input q?", q_input is not None)
            
        except Exception as e:
            print("Error:", e)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
