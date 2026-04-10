import asyncio
import re
import urllib.request
import urllib.parse
import urllib.error
import json
from urllib.parse import urljoin
from loguru import logger
from database import DBManager

SITE_CONFIGS = {
    "dubizzle": {
        "price": '.price, [aria-label="Price"], ._1075545d, span.lheight24',
        "location": '.location, [aria-label="Location"], ._1075545d.e6c84807',
        "link_pattern": 'a[href*="/ad/"]'
    },
    "aqarmap": {
        "price": '.search-listing-card__price, .listingCardPrice, .price-text',
        "location": '.search-listing-card__address, .listingCardLocation, .address-text',
        "link_pattern": 'a[href*="/listing/"], a[href*="/property/"]'
    },
    "propertyfinder": {
        "price": '.property-card__price, [data-testid="price"], .css-1nvp5x8',
        "location": '.property-card__location, [data-testid="location"], .css-1ytdxrz',
        "link_pattern": 'a[href*="/en/pl/"], a[href*="/property/"], a[href*="/properties/"]'
    },
    "bayut": {
        "price": '.price, [aria-label="Price"], .f343d9ce, span[aria-label="Price"]',
        "location": '.location, [aria-label="Location"], ._1f0f1758',
        "link_pattern": 'a[href*="/en/property/details-"]'
    },
    "elbayt": {
        "price": '.price, .property-price',
        "location": '.location, .property-location, address',
        "link_pattern": 'a[href*="/en/property/"]'
    },
    "semsarmasr": {
        "price": '.price, .item-price',
        "location": '.location, .item-location',
        "link_pattern": 'a[href*="/en/properties/"], a[href*="/ar/properties/"]'
    },
    "shofaqar": {
        "price": '.price, .pro-price',
        "location": '.location, .pro-loc',
        "link_pattern": 'a[href*="/properties/"]'
    },
    "realestate": {
        "price": '.price, .unit-price',
        "location": '.location, .unit-location',
        "link_pattern": 'a[href*="/properties/"]'
    }
}

from playwright.async_api import async_playwright
import random

class GhostNavigator:
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None

    async def init_browser(self):
        logger.info("Initializing Ghost Navigator...")
        self.playwright = await async_playwright().start()
        # Launch using chromium, simulating stealth to bypass Cloudflare/Datadome
        self.browser = await self.playwright.chromium.launch(
            headless=True, 
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
        )
        
        # Stealth Fingerprinting: Random User-Agents, Viewports
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        ]
        
        self.context = await self.browser.new_context(
            user_agent=random.choice(user_agents),
            viewport={'width': random.randint(1366, 1920), 'height': random.randint(768, 1080)},
            java_script_enabled=True,
            bypass_csp=True
        )
        
        await self.context.add_cookies([{
            "name": "CONSENT", 
            "value": "YES+cb.20230531-04-p0.en+FX+908", 
            "domain": ".google.com", 
            "path": "/"
        }])
        
        self.page = await self.context.new_page()
        # Canvas Jittering simulation
        await self.page.add_init_script("""
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type) {
                return originalGetContext.apply(this, arguments);
            };
        """)

    async def navigate(self, url):
        logger.info(f"Navigating to: {url}")
        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(random.uniform(2, 4)) # Human-like delay
        except Exception as e:
            logger.error(f"Navigation timeout/error for {url}: {e}")

    async def close(self):
        logger.info("Closing Ghost Navigator.")
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()


class SemanticParser:
    def __init__(self, db_manager: DBManager):
        self.db = db_manager
        # Phone Discovery: Extract Egyptian mobile numbers dynamically mapped
        self.phone_regex = re.compile(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})')

    async def parse_listing(self, page, url, config, session_id, search_limit, current_count, target_audience="sellers", min_price=None, max_price=None):
        if not config:
            config = SITE_CONFIGS["dubizzle"]
            
        try:
            try:
                await page.wait_for_selector(f'body', timeout=15000)
                await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"Timeout for selector on {url}")

            # Target "Show Phone Number" button securely
            try:
                await page.evaluate("window.scrollBy(0, 500)")
                await asyncio.sleep(1)
                buttons = await page.query_selector_all('button, a, div[role="button"]')
                for btn in buttons:
                    text = await btn.inner_text()
                    if text and any(kw in text.lower() for kw in ['show', 'phone', 'call', 'رقم', 'أظهر', 'contact']):
                        await btn.scroll_into_view_if_needed()
                        await btn.click(timeout=5000)
                        await asyncio.sleep(2)
            except Exception:
                pass

            content = await page.content()

            # Smart Parsing: Detect "Price" and "Location"
            price = "Unknown"
            body_text = "Unknown"
            try:
                body_text = await page.evaluate("document.body.innerText")
            except Exception:
                body_text = content
                
            arabic_to_english = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
            body_text = body_text.translate(arabic_to_english)
            content = content.translate(arabic_to_english)
                
            try:
                search_selector = config["price"] + ', .price, [data-testid="price"], .property-price, h2.price, .listing-price'
                price_element = await page.query_selector(search_selector)
                if price_element:
                    price_text = await price_element.inner_text()
                    digit_blobs = re.findall(r'[\d,]+', price_text)
                    for blob in digit_blobs:
                        clean_blob = re.sub(r'[^\d]', '', blob)
                        if clean_blob and 4 <= len(clean_blob) <= 12 and int(clean_blob) > 0:
                            price = clean_blob
                            break
            except Exception: pass
                
            if price == "Unknown" or not price:
                price_match = re.search(r'([\d,]+)\s*(?:EGP|ج\.م|LE|E\.G\.P|جنيه)', body_text, flags=re.IGNORECASE)
                if price_match:
                    clean_p = re.sub(r'[^\d]', '', price_match.group(1))
                    if clean_p and int(clean_p) > 0: 
                        price = clean_p
                else:
                    fallback_prices = re.findall(r'(?:price|السعر|كاش)[\s\S]{0,40}?([\d,]{5,15})', body_text, flags=re.IGNORECASE)
                    if fallback_prices:
                        clean_p = re.sub(r'[^\d]', '', fallback_prices[0])
                        if clean_p and int(clean_p) > 0:
                            price = clean_p
            
            location = "Unknown"
            try:
                location_element = await page.query_selector(config["location"])
                if location_element:
                    loc_text = await location_element.inner_text()
                    parts = [p.strip() for p in loc_text.split(',')]
                    if len(parts) >= 2:
                        location = f"{parts[-2]}, {parts[-1]}"
                    else:
                        location = loc_text.strip()
            except Exception: pass

            if location == "Unknown":
                try:
                    fallback_loc = await page.query_selector('.location, .address, address, [data-testid="location"], .property-location, .listing-location')
                    if fallback_loc: location = (await fallback_loc.inner_text()).replace('\n', ', ').strip()
                except Exception: pass
            
            if location == "Unknown":
                try:
                    bc_el = await page.query_selector('nav[aria-label="breadcrumb"], .breadcrumb, ul.breadcrumb')
                    if bc_el:
                        bc_text = await bc_el.inner_text()
                        parts = [p.strip() for p in re.split(r'[>›/\n]+', bc_text) if p.strip()]
                        if len(parts) >= 2: location = f"{parts[-2]}, {parts[-1]}"
                        elif parts: location = parts[-1]
                except Exception: pass

            if location == "Unknown" or len(location) < 3:
                try:
                    title = await page.title()
                    if title: location = title.split('|')[0].strip()[:60]
                except Exception: pass

            phones_raw = self.phone_regex.findall(content)
            phones = []
            for match in phones_raw:
                clean_phone = re.sub(r'[^\d]', '', match)
                if clean_phone.startswith('20') and len(clean_phone) == 12: clean_phone = clean_phone[2:]
                elif len(clean_phone) == 10 and clean_phone.startswith('1'): clean_phone = "0" + clean_phone
                if len(clean_phone) == 11 and clean_phone.startswith('01'): phones.append(clean_phone)
            
            if price == "Unknown" or location == "Unknown" or not phones:
                logger.warning(f"Skipping {url}: Missing required data.")
                return 0
                
            if min_price is not None or max_price is not None:
                try:
                    num_price = int(price)
                    if min_price is not None and num_price < int(float(min_price)): return 0
                    if max_price is not None and num_price > int(float(max_price)): return 0
                except (ValueError, TypeError):
                    return 0
                    
            leads_added = 0
            if phones:
                unique_phones = list(set(phones))
                for phone in unique_phones:
                    # Enforce strict cutoff at the unit level if limit exists
                    if search_limit is not None and search_limit != -1 and (current_count + leads_added) >= search_limit:
                        break
                        
                    intent_val = "buyer" if target_audience == "buyers" else "seller"
                    added = self.db.add_lead(phone, price.strip() if price else "", location.strip() if location else "", url, session_id=session_id, intent=intent_val)
                    if added:
                        leads_added += 1
            return leads_added
        except Exception as e:
            logger.error(f"Error parsing listing: {e}")
            return 0


class ScraperOrchestrator:
    # Layer 3: Stateless DB Orchestrator
    def __init__(self):
        self.db = DBManager()
        self.navigator = GhostNavigator()
        self.parser = SemanticParser(self.db)
        self.is_running = False

    async def _scrape_duckduckgo_lite_browser(self, query: str, session_id: str, search_limit: int | None, leads_found_count: int, ip_address: str | None) -> int:
        """Uses playwright to navigate DuckDuckGo Lite (No JS = No CAPTCHA) and extracts real Facebook URLs."""
        try:
            added = 0
            page = self.navigator.page
            
            # Go directly to DDG Lite
            await page.goto("https://lite.duckduckgo.com/lite/", wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(1.5)
            
            # Fill the search form and submit
            await page.fill("input[name='q']", query)
            await asyncio.sleep(1)
            await page.click("input[type='submit']")
            await page.wait_for_selector("table", timeout=15000)
            await asyncio.sleep(2)
            
            # Lite layout groups results in tables. We grab all rows.
            rows = await page.query_selector_all("tr")
            phone_regex = re.compile(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})')
            
            current_url = ""
            for row in rows:
                if search_limit is not None and search_limit != -1 and (leads_found_count + added) >= search_limit:
                    break
                    
                html_content = await row.inner_html()
                
                # Check if it's a title row (contains the actual link)
                link_elem = await row.query_selector("a.result-url") or await row.query_selector(".result-snippet")
                if link_elem:
                    href = await link_elem.get_attribute("href")
                    if href and "duckduckgo" not in href:
                        current_url = href
                
                # Check if it's a snippet row (contains the text)
                snippet_elem = await row.query_selector(".result-snippet")
                if snippet_elem and current_url:
                    text = await snippet_elem.inner_text()
                    text = text.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
                    phones_raw = phone_regex.findall(text)
                    
                    unique_phones = set()
                    for match in phones_raw:
                        clean = re.sub(r'[^\d]', '', match)
                        if clean.startswith('20') and len(clean) == 12: clean = clean[2:]
                        elif len(clean) == 10 and clean.startswith('1'): clean = '0' + clean
                        if len(clean) == 11 and clean.startswith('01'): unique_phones.add(clean)
                        
                    for phone in unique_phones:
                        ok = self.db.add_lead(phone, "Buyer Target", "Facebook Search", current_url, session_id=session_id, intent="buyer")
                        if ok:
                            added += 1
                            if ip_address: self.db.increment_free_usage(ip_address)
                    
                    if phones_raw:
                        current_url = "" # Reset for next result

            logger.info(f"[DDG Lite] Found {added} phones from Facebook Dork.")
            return added
            
        except Exception as e:
            logger.warning(f"[DDG Lite] Failed to scrape: {e}")
            return 0

    async def start_scraper(self, city, property_type, time_filter, sites, session_id, target_audience="sellers", search_limit=None, ip_address=None, min_price=None, max_price=None):
        self.is_running = True
        leads_found_count = 0
        try:
            await self.navigator.init_browser()
            for start_url in sites:
                if not self.is_running: break
                    
                # Identify Site Config
                if "dubizzle" in start_url.lower(): config = SITE_CONFIGS["dubizzle"]
                elif "aqarmap" in start_url.lower(): config = SITE_CONFIGS["aqarmap"]
                elif "bayut" in start_url.lower(): config = SITE_CONFIGS["bayut"]
                elif "semsarmasr" in start_url.lower(): config = SITE_CONFIGS["semsarmasr"]
                elif "shofaqar" in start_url.lower(): config = SITE_CONFIGS["shofaqar"]
                elif "realestate" in start_url.lower(): config = SITE_CONFIGS["realestate"]
                elif "elbayt" in start_url.lower(): config = SITE_CONFIGS["elbayt"]
                elif "duckduckgo" in start_url.lower(): config = {"link_pattern": "a"}
                else: config = SITE_CONFIGS["propertyfinder"]
                    
                # Setup Pagination
                for page_num in range(1, 6): # Reduced to max 5 pages for lighter load
                    if not self.is_running: break
                        
                    paginated_url = start_url
                    if page_num > 1:
                        if "propertyfinder" in start_url.lower(): paginated_url = start_url + f"&page={page_num}"
                        elif "dubizzle" in start_url.lower() or "aqarmap" in start_url.lower() or "elbayt" in start_url.lower() or "semsarmasr" in start_url.lower() or "shofaqar" in start_url.lower() or "realestate" in start_url.lower():
                            paginated_url = start_url + f"?page={page_num}"
                        elif "bayut" in start_url.lower(): paginated_url = start_url + f"page-{page_num}/"
                        elif "duckduckgo" in start_url.lower(): paginated_url = start_url + "" if page_num == 1 else start_url + f"&s={(page_num - 1) * 30}"
                            
                    # DuckDuckGo Lite Dork execution (Facebook Search Strategy bypass)
                    if start_url.startswith("ddglite:"):
                        raw_query = start_url.replace("ddglite:", "")
                        if not self.is_running: break
                        gained = await self._scrape_duckduckgo_lite_browser(
                            raw_query, session_id, search_limit, leads_found_count, ip_address
                        )
                        leads_found_count += gained
                        if search_limit is not None and search_limit != -1 and leads_found_count >= search_limit:
                            self.is_running = False
                        
                        # Stop iterating pagination/normal workflow, move to next site immediately 
                        break
                        
                    try:
                        await self.navigator.navigate(paginated_url)

                        # Infinite Scroll Trigger
                        for _ in range(3):
                            await self.navigator.page.evaluate("window.scrollBy(0, 1500)")
                            await asyncio.sleep(1)
                        
                        links = await self.navigator.page.query_selector_all(config["link_pattern"])
                        hrefs = []
                        for link in links:
                            href = await link.get_attribute('href')
                            if href and len(href) > 20: hrefs.append(urljoin(start_url, href))
                                
                        hrefs = list(set(hrefs)) 
                    except Exception as page_e:
                        break 
                        
                    if not hrefs: break

                    for i, href in enumerate(hrefs):
                        if not self.is_running: break
                        try:
                            # Direct check bypass - reduces redundant loads
                            existing = self.db.sb.table("leads").select("id").eq("url", href).limit(1).execute()
                            if existing.data: continue
                        except Exception: pass
                                
                        new_page = await self.navigator.context.new_page()
                        try:
                            await new_page.goto(href, wait_until="domcontentloaded", timeout=45000)
                            await asyncio.sleep(random.uniform(1.5, 3.5))
                            added_count = await self.parser.parse_listing(
                                new_page, href, config, 
                                session_id=session_id, target_audience=target_audience,
                                search_limit=search_limit, current_count=leads_found_count,
                                min_price=min_price, max_price=max_price
                            )
                            if added_count:
                                leads_found_count += added_count
                                if ip_address:
                                    for _ in range(added_count): self.db.increment_free_usage(ip_address)
                        except Exception: pass
                        finally: await new_page.close()
                            
                        if search_limit is not None and search_limit != -1 and leads_found_count >= search_limit:
                            self.is_running = False
                            break
                        await asyncio.sleep(random.uniform(1.5, 3.0))
                
        except Exception: pass
        finally:
            await self.navigator.close()
            self.is_running = False

    def stop_scraper(self):
        self.is_running = False
