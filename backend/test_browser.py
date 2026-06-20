import asyncio
import traceback
from scraper import GhostNavigator

async def test():
    nav = GhostNavigator()
    try:
        await nav.init_browser()
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
    finally:
        await nav.close()

asyncio.run(test())
