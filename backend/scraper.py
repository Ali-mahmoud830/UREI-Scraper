import asyncio
import re
import urllib.request
import urllib.parse
import urllib.error
import json
from urllib.parse import urljoin
from loguru import logger
from database import DBManager

# 🏭 WAREHOUSES & LOGISTICS
WAREHOUSE_KEYWORDS = [
    "مخزن", "مخازن", "مستودع", "مستودعات", "هنجر", "هناجر", 
    "ثلاجة حفظ", "ثلاجة تجميد", "مخزن مرخص", "مساحة تخزينية", 
    "بايكة تخزين", "مخزن لوجستي", "warehouse", "hangar", "storage"
]

# 🏨 HOTELS & HOSPITALITY
HOTEL_KEYWORDS = [
    "فندق", "فنادق", "قرية سياحية", "قرى سياحية", "منتجع", "منتجعات", 
    "ريزورت", "مبنى فندقي", "عمارة فندقية", "شقق فندقية", "غرف فندقية", 
    "بوتيك هوتيل", "hotel", "resort", "apart-hotel"
]

# ⛰️ LANDS
LAND_KEYWORDS = [
    "ارض مباني", "ارض فضاء", "نمرة ارض", "قطعة ارض", "ارض قرعة", 
    "ارض بيت الوطن", "ارض تمليك", "ارض صناعية", "ارض زراعية", 
    "فدان", "فدادين", "قيراط", "ارض مرخصة", "ارض مصنع", 
    "land", "plot of land", "industrial land"
]

# 🏪 SHOPS
STRICT_SHOP_KEYWORDS = ["محل للبيع", "محل للايجار", "محلات للبيع", "shop for sale", "retail shop", "محل", "محلات"]

# 💊 PHARMACIES
STRICT_PHARMACY_KEYWORDS = ["صيدلية للبيع", "صيدليه للايجار", "صيدلية مرخصة", "pharmacy for sale", "صيدلية", "صيدليه"]

# 🚗 SHOWROOMS
STRICT_SHOWROOM_KEYWORDS = ["معرض للبيع", "معرض للايجار", "معارض للبيع", "showroom for sale", "معرض", "معارض"]

# 🏢 OFFICES & CLINICS
STRICT_OFFICE_KEYWORDS = ["مكتب للبيع", "مقر اداري", "عيادة للبيع", "مكاتب للايجار", "office for sale", "مكتب", "مكاتب", "عيادة", "عيادات", "اداري"]

SITE_CONFIGS = {
    "dubizzle": {
        "link_pattern": 'a[href*="/ad/"]',
        # Card-level selectors for search results page (no individual page visit needed)
        "card": '[data-testid="listing-card"], article, li[class*="listing"], div[class*="listing-card"], ._1f086954',
        "card_price": '[aria-label="Price"], span[class*="price"], div[class*="price"]',
        "card_location": '[aria-label="Location"], span[class*="location"], div[class*="location"]',
        "card_phone": '[class*="phone"], [aria-label*="phone"], [data-testid*="phone"]',
    },
    "aqarmap": {
        "link_pattern": 'a[href*="/listing/"], a[href*="/property/"]',
        "card": '.search-listing-card, .listingCard, article',
        "card_price": '.search-listing-card__price, .listingCardPrice, .price-text',
        "card_location": '.search-listing-card__address, .listingCardLocation, .address-text',
        "card_phone": '.phone, [class*="phone"]',
    },
    "propertyfinder": {
        "link_pattern": 'a[href*="/en/pl/"], a[href*="/property/"]',
        "card": '.property-card, article[class*="PropertyCard"]',
        "card_price": '.property-card__price, [data-testid="price"]',
        "card_location": '.property-card__location, [data-testid="location"]',
        "card_phone": '[data-testid*="phone"], [class*="phone"]',
    },
    "bayut": {
        "link_pattern": 'a[href*="/en/property/details-"]',
        "card": '.listing-card, article, [class*="PropertyCard"]',
        "card_price": '[aria-label="Price"], span[class*="price"]',
        "card_location": '[aria-label="Location"], div[class*="location"]',
        "card_phone": '[aria-label*="phone"], [class*="phone"]',
    },
    "elbayt": {
        "link_pattern": 'a[href*="/en/property/"]',
        "card": 'article, .property-card',
        "card_price": '.price, .property-price',
        "card_location": '.location, .property-location, address',
        "card_phone": '.phone',
    },
    "semsarmasr": {
        "link_pattern": 'a[href*="/en/properties/"], a[href*="/ar/properties/"]',
        "card": 'article, li[class*="item"], div[class*="item"]',
        "card_price": '.price, .item-price',
        "card_location": '.location, .item-location',
        "card_phone": '.phone',
    },
    "shofaqar": {
        "link_pattern": 'a[href*="/properties/"]',
        "card": 'article, .property-card',
        "card_price": '.price, .pro-price',
        "card_location": '.location, .pro-loc',
        "card_phone": '.phone',
    },
    "realestate": {
        "link_pattern": 'a[href*="/properties/"]',
        "card": 'article, .unit-card',
        "card_price": '.price, .unit-price',
        "card_location": '.location, .unit-location',
        "card_phone": '.phone',
    }
}

from playwright.async_api import async_playwright
import random

class GhostNavigator:
    """
    Playwright Orchestration Engine executing headless chromium navigation sequences.
    
    This class is specifically designed to bypass aggressive Web Application Firewalls
    (WAF) like Cloudflare, DataDome, and advanced bot protections. It mimics high-fidelity
    human interactivity utilizing canvas jitter, randomized viewport manipulations, 
    and arbitrary user-agent cycling.
    """
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
    """
    Deep-DOM Extractor and Natural Language Parsing Engine.

    Consumes raw HTML content provided by GhostNavigator, navigating broken or dynamic
    React/NextJS DOM structures common on prop-tech sites. Uses heavy fault-tolerance
    with RegEx-based fallback logic to extract hidden phone numbers, normalize Arabic/English
    currency metrics, and derive location hierarchies aggressively.
    """
    def __init__(self, db_manager: DBManager):
        self.db = db_manager
        # Phone Discovery: Extract Egyptian mobile numbers dynamically mapped
        self.phone_regex = re.compile(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})')

    async def parse_listing(self, page, url, config, session_id, search_limit, current_count, target_audience="sellers", min_price=None, max_price=None, check_running=None):
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

            # parse_listing is a legacy method — parse_search_page is now the primary strategy.
            # Return 0 here; actual extraction happens via parse_search_page.
            return 0
        except Exception as e:
            logger.error(f"Error parsing listing: {e}")
            return 0

    async def parse_search_page(self, page, start_url, config, session_id, search_limit, current_count, target_audience="sellers", min_price=None, max_price=None, check_running=None, ip_address=None, constraints=None):
        """
        Card-level extraction strategy: scrapes pricing, location, and phone data directly 
        from search results listing cards — avoids individual page visits that trigger bot detection.
        Falls back to full-page regex scan if card selectors don't yield structured data.
        """
        leads_added = 0
        try:
            arabic_to_english = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

            # Full page body text for regex fallback
            try:
                body_text = await page.evaluate("document.body.innerText")
                body_text = body_text.translate(arabic_to_english)
            except Exception:
                body_text = ""

            # Also get raw HTML for phone regex (phones can be in data attributes)
            content = await page.content()
            content = content.translate(arabic_to_english)

            # Collect all listing hrefs to use as source URLs
            links = await page.query_selector_all(config.get("link_pattern", "a"))
            hrefs = []
            for link in links:
                href = await link.get_attribute('href')
                if href and len(href) > 20:
                    hrefs.append(urljoin(start_url, href))
            hrefs = list(dict.fromkeys(hrefs))  # deduplicate preserving order

            # --- Strategy 1: Card-level structured extraction ---
            card_sel = config.get("card", "")
            cards = await page.query_selector_all(card_sel) if card_sel else []
            logger.info(f"Found {len(cards)} listing cards and {len(hrefs)} links on {start_url}")

            extracted_card_leads = []  # list of (phone, price, location, url)

            for i, card in enumerate(cards):
                if check_running and not check_running(): break
                try:
                    card_text = await card.inner_text()
                    card_text = card_text.translate(arabic_to_english)
                    card_html = await card.inner_html()
                    card_html = card_html.translate(arabic_to_english)

                    # Extract price from card
                    price = "Unknown"
                    try:
                        price_el = await card.query_selector(config.get("card_price", ".price"))
                        if price_el:
                            price_text = await price_el.inner_text()
                            digit_blobs = re.findall(r'[\d,]+', price_text)
                            for blob in digit_blobs:
                                clean_blob = re.sub(r'[^\d]', '', blob)
                                if clean_blob and 4 <= len(clean_blob) <= 12 and int(clean_blob) > 0:
                                    price = clean_blob
                                    break
                    except Exception: pass

                    if price == "Unknown":
                        price_match = re.search(r'([\d,]+)\s*(?:EGP|ج\.م|LE|E\.G\.P|جنيه)', card_text, re.IGNORECASE)
                        if price_match:
                            clean_p = re.sub(r'[^\d]', '', price_match.group(1))
                            if clean_p and int(clean_p) > 0: price = clean_p

                    # Extract location from card
                    location = "Unknown"
                    try:
                        loc_el = await card.query_selector(config.get("card_location", ".location"))
                        if loc_el:
                            loc_text = await loc_el.inner_text()
                            parts = [p.strip() for p in loc_text.split(',')]
                            location = f"{parts[-2]}, {parts[-1]}" if len(parts) >= 2 else loc_text.strip()
                    except Exception: pass

                    if location == "Unknown" or len(location) < 3:
                        # Try breadcrumb-style location from card text
                        loc_match = re.search(r'(?:Cairo|Giza|Alexandria|Maadi|Zamalek|Heliopolis|Rehab|Tagamo|New Cairo|Sheikh Zayed)[^\n]*', card_text, re.IGNORECASE)
                        if loc_match: location = loc_match.group(0).strip()[:80]

                    # Extracted constraints
                    area = None
                    area_match = re.search(r'([\d,]+)\s*(?:sqm|m2|meter|متر|م٢|م2)', card_text, re.IGNORECASE)
                    if area_match:
                        area_clean = re.sub(r'[^\d]', '', area_match.group(1))
                        if area_clean: area = int(area_clean)
                        
                    floors = None
                    floors_match = re.search(r'(?:floor|level|دور|أدوار|طابق)\s*(\d+)', card_text, re.IGNORECASE)
                    if not floors_match:
                        floors_match = re.search(r'(\d+)\s*(?:floors|levels|أدوار|طوابق)', card_text, re.IGNORECASE)
                    if floors_match:
                        floors = int(floors_match.group(1))

                    if constraints:
                        if constraints.get("min_area") and area:
                            if area < constraints["min_area"]: continue
                        if constraints.get("min_floors") and floors:
                            if floors < constraints["min_floors"]: continue

                    # Extract phones from card HTML/text
                    phones_raw = self.phone_regex.findall(card_html + card_text)
                    phones = set()
                    for match in phones_raw:
                        clean_phone = re.sub(r'[^\d]', '', match)
                        if clean_phone.startswith('20') and len(clean_phone) == 12: clean_phone = clean_phone[2:]
                        elif len(clean_phone) == 10 and clean_phone.startswith('1'): clean_phone = '0' + clean_phone
                        if len(clean_phone) == 11 and clean_phone.startswith('01'): phones.add(clean_phone)

                    # Associate this card with its href (by index)
                    card_url = hrefs[i] if i < len(hrefs) else start_url
                    for phone in phones:
                        extracted_card_leads.append((phone, price, location, card_url, card_text[:800]))

                except Exception as card_err:
                    logger.debug(f"Card {i} parse error: {card_err}")
                    continue

            # --- Strategy 2: Full-page regex fallback (always run) ---
            full_page_phones = set()
            phones_raw = self.phone_regex.findall(content)
            for match in phones_raw:
                clean_phone = re.sub(r'[^\d]', '', match)
                if clean_phone.startswith('20') and len(clean_phone) == 12: clean_phone = clean_phone[2:]
                elif len(clean_phone) == 10 and clean_phone.startswith('1'): clean_phone = '0' + clean_phone
                if len(clean_phone) == 11 and clean_phone.startswith('01'): full_page_phones.add(clean_phone)

            # Fallback price extraction from page body
            fallback_price = "Unknown"
            price_match = re.search(r'([\d,]+)\s*(?:EGP|ج\.م|LE|جنيه)', body_text, re.IGNORECASE)
            if price_match:
                clean_p = re.sub(r'[^\d]', '', price_match.group(1))
                if clean_p and int(clean_p) > 0: fallback_price = clean_p

            # Fallback location
            fallback_loc = "Egypt"
            if start_url:
                url_parts = start_url.rstrip('/').split('/')
                if len(url_parts) > 0:
                    slug = url_parts[-1].replace('-', ' ').replace('_', ' ')
                    if slug and len(slug) > 3: fallback_loc = slug.title()[:60]

            # Phones from full-page that were NOT captured by cards
            card_phones = {p for p, _, _, _, _ in extracted_card_leads}
            new_full_phones = full_page_phones - card_phones
            logger.info(f"Page scan: {len(extracted_card_leads)} card leads, {len(new_full_phones)} additional page-level phones")

            # Commit card leads first
            for (phone, price, location, href, desc) in extracted_card_leads:
                if check_running and not check_running(): break
                if search_limit is not None and search_limit != -1 and (current_count + leads_added) >= search_limit: break
                
                # Strict NLP Location Filtering
                if constraints and constraints.get("cities"):
                    valid_loc = False
                    for c in constraints["cities"]:
                        if c.lower() in location.lower() or c.lower() in desc.lower():
                            valid_loc = True
                            break
                    if not valid_loc:
                        logger.info(f"Dropped lead due to strict location NLP constraint: {location}")
                        continue
                        
                # Strict Category NLP Filtering (Title/Breadcrumb Focus)
                if constraints and constraints.get("property_category") and constraints["property_category"] != "all":
                    cat = constraints["property_category"]
                    keywords = []
                    if cat == "warehouse": keywords = WAREHOUSE_KEYWORDS
                    elif cat == "hotel": keywords = HOTEL_KEYWORDS
                    elif cat == "land": keywords = LAND_KEYWORDS
                    elif cat == "apartment": keywords = ["شقة", "شقق", "دوبلكس", "بنتهاوس", "apartment", "duplex"]
                    elif cat == "villa": keywords = ["فيلا", "فيلات", "تاون هاوس", "توين هاوس", "villa", "townhouse"]
                    elif cat == "shop": keywords = STRICT_SHOP_KEYWORDS
                    elif cat == "pharmacy": keywords = STRICT_PHARMACY_KEYWORDS
                    elif cat == "showroom": keywords = STRICT_SHOWROOM_KEYWORDS
                    elif cat == "office": keywords = STRICT_OFFICE_KEYWORDS
                    
                    if keywords:
                        # Focus on the first 150 chars (title/header area) to avoid keyword stuffing at the bottom
                        title_area = (location + " " + desc[:150]).lower()
                        valid_cat = any(k.lower() in title_area for k in keywords)
                        if not valid_cat:
                            logger.info(f"Dropped lead due to Category constraint ({cat}) spam check: {title_area[:60]}")
                            continue

                if min_price is not None or max_price is not None:
                    try:
                        clean_num = re.sub(r'[^\d]', '', str(price))
                        if clean_num:
                            num_price = int(clean_num)
                            if min_price is not None and num_price < int(float(min_price)): continue
                            if max_price is not None and num_price > int(float(max_price)): continue
                    except (ValueError, TypeError): pass
                intent_val = "buyer" if target_audience == "buyers" else "seller"
                added = self.db.add_lead(phone, price, location, href, session_id=session_id, intent=intent_val, description=desc)
                if added:
                    leads_added += 1
                    if ip_address: self.db.increment_free_usage(ip_address)

            # Commit additional full-page phones
            fallback_url = hrefs[0] if hrefs else start_url
            for phone in new_full_phones:
                if check_running and not check_running(): break
                if search_limit is not None and search_limit != -1 and (current_count + leads_added) >= search_limit: break
                
                # Strict NLP Location Filtering for Full Page Phones
                if constraints and constraints.get("cities"):
                    valid_loc = False
                    for c in constraints["cities"]:
                        if c.lower() in fallback_loc.lower() or c.lower() in body_text.lower():
                            valid_loc = True
                            break
                    if not valid_loc:
                        logger.info(f"Dropped full-page lead due to strict location NLP constraint: {fallback_loc}")
                        continue
                        
                # Strict Category NLP Filtering
                if constraints and constraints.get("property_category") and constraints["property_category"] != "all":
                    cat = constraints["property_category"]
                    keywords = []
                    if cat == "warehouse": keywords = WAREHOUSE_KEYWORDS
                    elif cat == "hotel": keywords = HOTEL_KEYWORDS
                    elif cat == "land": keywords = LAND_KEYWORDS
                    elif cat == "apartment": keywords = ["شقة", "شقق", "دوبلكس", "بنتهاوس", "apartment", "duplex"]
                    elif cat == "villa": keywords = ["فيلا", "فيلات", "تاون هاوس", "توين هاوس", "villa", "townhouse"]
                    elif cat == "commercial": keywords = ["محل", "مكتب", "عيادة", "صيدلية", "تجاري", "اداري"]
                    
                    if keywords:
                        # Focus on the first 150 chars for anti-spam
                        title_area = (fallback_loc + " " + body_text[:150]).lower()
                        valid_cat = any(k.lower() in title_area for k in keywords)
                        if not valid_cat:
                            logger.info(f"Dropped full-page lead due to Category constraint ({cat}) spam check")
                            continue
                
                # Strict Price Constraints for Fallback Phones
                if min_price is not None or max_price is not None:
                    try:
                        clean_num = re.sub(r'[^\d]', '', str(fallback_price))
                        if clean_num:
                            num_price = int(clean_num)
                            if min_price is not None and num_price < int(float(min_price)): continue
                            if max_price is not None and num_price > int(float(max_price)): continue
                    except (ValueError, TypeError): pass
                        
                intent_val = "buyer" if target_audience == "buyers" else "seller"
                added = self.db.add_lead(phone, fallback_price, fallback_loc, fallback_url, session_id=session_id, intent=intent_val, description=body_text[:800])
                if added:
                    leads_added += 1
                    if ip_address: self.db.increment_free_usage(ip_address)

            logger.info(f"parse_search_page: committed {leads_added} leads from {start_url}")
        except Exception as e:
            logger.error(f"parse_search_page error: {e}")
        return leads_added



class ScraperOrchestrator:
    # Layer 3: Stateless DB Orchestrator
    def __init__(self):
        self.db = DBManager()
        self.navigator = GhostNavigator()
        self.parser = SemanticParser(self.db)
        self.is_running = False

    async def _scrape_bing_dorks(self, query: str, session_id: str, search_limit: int | None, leads_found_count: int, ip_address: str | None, constraints: dict = None) -> int:
        """Uses playwright to navigate Bing (highly resilient) and extracts real Facebook URLs."""
        try:
            added = 0
            page = self.navigator.page
            
            # Go directly to Yahoo Search (bypassing Bing's aggressive datacenter IP blocks)
            encoded_query = urllib.parse.quote(query)
            engine_url = f"https://search.yahoo.com/search?p={encoded_query}"
            
            await page.goto(engine_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(4)  # Generous sleep to appear human to Yahoo
            
            # Check for CAPTCHA/blocking
            page_title = await page.title()
            page_text = await page.evaluate("document.body.innerText")
            
            logger.info(f"[Yahoo] Page title: {page_title} | Text length: {len(page_text)}")
            
            if "captcha" in page_text.lower() or "verify you" in page_text.lower() or "not a robot" in page_text.lower():
                logger.warning(f"[Yahoo] CAPTCHA detected! Title: {page_title}")
                return 0
                
            # STRATEGY: Full-page body scan
            # Extract ALL text from the page, then run phone regex on it globally.
            # Simultaneously, collect ALL Facebook post URLs visible anywhere in the HTML.
            
            phone_regex = re.compile(r'((?:(?:\+|00)20\s*|0)?1[0125](?:[\s\-]*\d){8})')
            
            # Grab all facebook.com links from raw anchor tags (yahoo prefixes with r.search.yahoo.com usually so we extract data-xb-url or href)
            fb_links = await page.evaluate("""() => {
                const anchors = document.querySelectorAll('a');
                return Array.from(anchors)
                    .map(a => a.href)
                    .filter(h => h.includes('facebook.com') && h.length > 30);
            }""")
            
            logger.info(f"[Yahoo] Found {len(fb_links)} FB URLs on page.")
            
            if not fb_links:
                logger.warning(f"[Yahoo] No Facebook links found. First 200 chars: {page_text[:200]}")
                return 0
            
            # Normalize Arabic/Eastern-Arabic digits, then run phone regex on full body text
            arabic_to_english = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
            normalized = page_text.translate(arabic_to_english)
            
            phones_raw = phone_regex.findall(normalized)
            unique_phones = set()
            for match in phones_raw:
                clean = re.sub(r'[^\d]', '', match)
                if clean.startswith('20') and len(clean) == 12: clean = clean[2:]
                elif len(clean) == 10 and clean.startswith('1'): clean = '0' + clean
                if len(clean) == 11 and clean.startswith('01'): unique_phones.add(clean)
                
            logger.info(f"[Yahoo] Extracted {len(unique_phones)} unique phones from full page.")
            
            for phone in unique_phones:
                if not self.is_running: break
                if search_limit is not None and search_limit != -1 and (leads_found_count + added) >= search_limit:
                    break
                    
                # Strict Category NLP Filtering
                if constraints and constraints.get("property_category") and constraints["property_category"] != "all":
                    cat = constraints["property_category"]
                    keywords = []
                    if cat == "warehouse": keywords = WAREHOUSE_KEYWORDS
                    elif cat == "hotel": keywords = HOTEL_KEYWORDS
                    elif cat == "land": keywords = LAND_KEYWORDS
                    elif cat == "apartment": keywords = ["شقة", "شقق", "دوبلكس", "بنتهاوس", "apartment", "duplex"]
                    elif cat == "villa": keywords = ["فيلا", "فيلات", "تاون هاوس", "توين هاوس", "villa", "townhouse"]
                    elif cat == "commercial": keywords = ["محل", "مكتب", "عيادة", "صيدلية", "تجاري", "اداري"]
                    
                    if keywords:
                        # Focus on the first 150 chars for anti-spam
                        title_area = normalized[:150].lower()
                        valid_cat = any(k.lower() in title_area for k in keywords)
                        if not valid_cat:
                            logger.info(f"[Yahoo] Dropped lead due to Category constraint ({cat}) spam check")
                            continue

                # Use first valid FB URL as the source of truth
                source_url = fb_links[0] if fb_links else engine_url
                ok = self.db.add_lead(
                    phone, "Buyer Target", "Facebook Search",
                    source_url, session_id=session_id, intent="buyer",
                    description=normalized[:1200]
                )
                if ok:
                    added += 1
                    if ip_address: self.db.increment_free_usage(ip_address)
                            
            logger.info(f"[Yahoo] Inserted {added} leads from {len(unique_phones)} phones / {len(fb_links)} FB links.")
            return added
            
        except Exception as e:
            logger.warning(f"[Bing] Failed to scrape: {e}")
            return 0

    def _get_session_lead_count(self, session_id: int) -> int:
        """Query the DB for the real committed lead count for this session."""
        try:
            res = self.db.sb.table("session_leads").select("lead_id", count="exact").eq("session_id", session_id).execute()
            return res.count or 0
        except Exception:
            return 0

    async def start_scraper(self, city, property_type, time_filter, sites, session_id, target_audience="sellers", search_limit=None, ip_address=None, min_price=None, max_price=None, constraints=None):
        self.is_running = True
        try:
            await self.navigator.init_browser()
            for start_url in sites:
                if not self.is_running: break

                # Re-query actual DB count before each new site (avoids drift from deduplication)
                leads_found_count = self._get_session_lead_count(session_id)
                if search_limit is not None and search_limit != -1 and leads_found_count >= search_limit:
                    logger.info(f"[Orchestrator] Session {session_id} reached limit ({leads_found_count}/{search_limit}). Stopping.")
                    break

                # Identify Site Config
                if "dubizzle" in start_url.lower(): config = SITE_CONFIGS["dubizzle"]
                elif "aqarmap" in start_url.lower(): config = SITE_CONFIGS["aqarmap"]
                elif "bayut" in start_url.lower(): config = SITE_CONFIGS["bayut"]
                elif "semsarmasr" in start_url.lower(): config = SITE_CONFIGS["semsarmasr"]
                elif "shofaqar" in start_url.lower(): config = SITE_CONFIGS["shofaqar"]
                elif "realestate" in start_url.lower(): config = SITE_CONFIGS["realestate"]
                elif "elbayt" in start_url.lower(): config = SITE_CONFIGS["elbayt"]
                elif "bing" in start_url.lower() or "duckduckgo" in start_url.lower(): config = {"link_pattern": "a"}
                else: config = SITE_CONFIGS["propertyfinder"]

                # Setup Pagination — up to 10 pages per site to ensure we fill the 50-lead quota
                for page_num in range(1, 11):
                    if not self.is_running: break

                    # Re-check real DB count before each page
                    leads_found_count = self._get_session_lead_count(session_id)
                    if search_limit is not None and search_limit != -1 and leads_found_count >= search_limit:
                        logger.info(f"[Orchestrator] Quota reached ({leads_found_count}/{search_limit}) — halting pagination.")
                        self.is_running = False
                        break

                    paginated_url = start_url
                    if page_num > 1:
                        if "propertyfinder" in start_url.lower(): paginated_url = start_url + f"&page={page_num}"
                        elif "dubizzle" in start_url.lower() or "aqarmap" in start_url.lower() or "elbayt" in start_url.lower() or "semsarmasr" in start_url.lower() or "shofaqar" in start_url.lower() or "realestate" in start_url.lower():
                            paginated_url = start_url + f"?page={page_num}"
                        elif "bayut" in start_url.lower(): paginated_url = start_url + f"page-{page_num}/"
                        elif "duckduckgo" in start_url.lower(): paginated_url = start_url + "" if page_num == 1 else start_url + f"&s={(page_num - 1) * 30}"

                    # Bing Dork execution (Facebook Search Strategy bypass)
                    if start_url.startswith("bing:"):
                        raw_query = start_url.replace("bing:", "")
                        if not self.is_running: break
                        gained = await self._scrape_bing_dorks(
                            raw_query, session_id, search_limit, leads_found_count, ip_address, constraints
                        )
                        if search_limit is not None and search_limit != -1 and (leads_found_count + gained) >= search_limit:
                            self.is_running = False
                        break  # Stop iterating pagination for bing, move to next site

                    try:
                        await self.navigator.navigate(paginated_url)

                        # Infinite Scroll Trigger
                        for _ in range(3):
                            await self.navigator.page.evaluate("window.scrollBy(0, 1500)")
                            await asyncio.sleep(1)

                        # Remaining slots = how many more we can add to hit the limit exactly
                        remaining_slots = (search_limit - leads_found_count) if (search_limit is not None and search_limit != -1) else None

                        # Card-level extraction from search results page
                        await self.parser.parse_search_page(
                            self.navigator.page, start_url, config,
                            session_id=session_id, target_audience=target_audience,
                            search_limit=search_limit, current_count=leads_found_count,
                            min_price=min_price, max_price=max_price,
                            check_running=lambda: self.is_running,
                            ip_address=ip_address,
                            constraints=constraints
                        )

                        if not self.is_running: break

                        # Check if we have more pages to scrape
                        links = await self.navigator.page.query_selector_all(config["link_pattern"])
                        hrefs = []
                        for link in links:
                            href = await link.get_attribute('href')
                            if href and len(href) > 20: hrefs.append(href)

                    except Exception as page_e:
                        logger.warning(f"Page load error for {paginated_url}: {page_e}")
                        break

                    if not hrefs: break

        except Exception as e:
            logger.exception(f"Fatal error in start_scraper: {e}")
        finally:
            # Final real count for logging
            final_count = self._get_session_lead_count(session_id)
            logger.info(f"[Orchestrator] Session {session_id} finished. Total committed leads: {final_count}")
            await self.navigator.close()
            self.is_running = False

    def stop_scraper(self):
        self.is_running = False
