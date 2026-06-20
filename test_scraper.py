import asyncio
from loguru import logger
from backend.scraper import ScraperOrchestrator
from backend.database import DBManager

async def test_facebook_scrape():
    logger.info("Initializing Orchestrator")
    orchestrator = ScraperOrchestrator()
    await orchestrator.navigator.init_browser()
    
    logger.info("Testing DDG Facebook Search")
    # Using a fake session ID and None limits
    gained = await orchestrator._scrape_duckduckgo_lite_browser(
        query='site:facebook.com "شقة للبيع" ("التجمع الخامس") "للبيع"',
        session_id="test_session",
        search_limit=5,
        leads_found_count=0,
        ip_address=None
    )
    logger.info(f"Test completed. Gained leads: {gained}")
    await orchestrator.navigator.close()

if __name__ == "__main__":
    asyncio.run(test_facebook_scrape())
