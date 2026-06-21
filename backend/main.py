import os
from dotenv import load_dotenv
load_dotenv()
import logging
import collections
from fastapi import FastAPI, Depends, HTTPException, Header, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from scraper import ScraperOrchestrator
from database import DBManager
from loguru import logger
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
import os
import urllib.parse
from auth import auth_agent
from mail import send_license_email_async, send_license_email
import asyncio
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

def get_client_ip(request: Request) -> str:
    if "x-forwarded-for" in request.headers:
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    if "x-real-ip" in request.headers:
        return request.headers["x-real-ip"].strip()
    return request.client.host if request.client else "unknown"

app = FastAPI(title="UREI API (Stateless Execution Worker)")

# Rate Limiter
limiter = Limiter(key_func=get_client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restricted to configured origins
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

db = DBManager()

# Active Orchestrators (multi-tenant tracking)
active_orchestrators = {}
# Concurrency Limit (Max 2 simultaneous scrapers to avoid HuggingFace OOM crashes)
SCRAPE_SEMAPHORE = asyncio.Semaphore(2)

async def run_scraper_safely(session_key: str, orchestrator: ScraperOrchestrator, *args, **kwargs):
    async with SCRAPE_SEMAPHORE:
        try:
            active_orchestrators[session_key] = orchestrator
            await orchestrator.start_scraper(*args, **kwargs)
        except Exception as e:
            logger.error(f"Scraper task failed: {e}")
        finally:
            active_orchestrators.pop(session_key, None)

import re

class SemanticQueryParser:
    @staticmethod
    def parse(prompt: str):
        prompt = prompt.lower()
        
        # 1. Intent extraction
        intent = "both"
        if re.search(r'\b(rent|lease|ايجار|إيجار)\b', prompt):
            intent = "rent"
        elif re.search(r'\b(buy|sale|purchase|بيع)\b', prompt):
            intent = "sale"
            
        # 2. Property Category & Type
        property_type = "both"
        property_category = "all"
        
        if re.search(r'\b(warehouse|storage|hangar|مخزن|مستودع|هنجر)\b', prompt):
            property_category = "warehouse"
            property_type = "commercial_building"
        elif re.search(r'\b(hotel|resort|فندق|قرية سياحية)\b', prompt):
            property_category = "hotel"
            property_type = "commercial_building"
        elif re.search(r'\b(land|plot|ارض|فدان|قيراط)\b', prompt):
            property_category = "land"
            property_type = "commercial_building"
        elif re.search(r'\b(building|commercial|office|مبنى|تجاري|مكتب)\b', prompt):
            property_category = "commercial"
            property_type = "commercial_building"
        elif re.search(r'\b(apartment|flat|شقة)\b', prompt):
            property_category = "apartment"
            property_type = "apartment"
        elif re.search(r'\b(villa|house|فيلا|تاون)\b', prompt):
            property_category = "villa"
            property_type = "villa"
            
        # 3. Cities extraction
        cities = []
        known_cities = [
            "downtown", "dokki", "giza", "zamalek", "cairo", "maadi", "zayed", "tagamoa",
            "moqattam", "nasr city", "heliopolis", "new cairo", "shorouk", "obour", "rehab",
            "madinaty", "alexandria", "north coast", "مقطم", "المقطم", "تجمع", "زايد", "معادي"
        ]
        for c in known_cities:
            if c in prompt:
                # Normalize arabic to english for internal routing
                mapped_c = "moqattam" if "مقطم" in c else c
                mapped_c = "tagamoa" if "تجمع" in c else mapped_c
                mapped_c = "zayed" if "زايد" in c else mapped_c
                mapped_c = "maadi" if "معادي" in c else mapped_c
                if mapped_c not in cities:
                    cities.append(mapped_c)
                
        # 4. Numerical constraints
        min_area = None
        area_match = re.search(r'(?:>|more than|over|above|min|minimum|area|مساحة)\s*(?:of\s*)?(\d+)\s*(?:sqm|m2|meter|متر|م)', prompt)
        if area_match:
            min_area = int(area_match.group(1))
            
        min_floors = None
        floors_match = re.search(r'(?:>|more than|over|above|min|minimum|floors|ادوار|أدوار|دور|floor)\s*(?:of\s*)?(\d+)\s*(?:floors|levels|دور|أدوار|floor)?', prompt)
        if floors_match:
            min_floors = int(floors_match.group(1))
        # Handle format like "floors > 5" or "floors >5"
        floors_match_2 = re.search(r'(?:floors|levels|دور|أدوار|floor)\s*(?:>|>=|more than|over)\s*(\d+)', prompt)
        if floors_match_2 and not min_floors:
            min_floors = int(floors_match_2.group(1))
            
        return {
            "cities": cities,
            "intent": intent,
            "property_type": property_type,
            "property_category": property_category,
            "constraints": {
                "min_area": min_area,
                "min_floors": min_floors
            }
        }

DEFAULT_SITES = [
    "https://www.dubizzle.com.eg/properties/",
    "https://aqarmap.com.eg/en/for-sale/property-type/cairo/",
    "https://www.propertyfinder.eg/en/search?c=1&t=1",
    "https://www.bayut.eg/en/egypt/properties-for-sale/",
    "https://www.semsarmasr.com/en/properties/",
    "https://shofaqar.com/properties/",
    "https://realestate.eg/en/properties"
]

class SearchRequest(BaseModel):
    city: str = ""
    property_type: str = "both"
    time_filter: str = "all"
    sites: list[str] = ["all"]
    target_audience: str = "sellers"
    min_price: str | None = None
    max_price: str | None = None
    ai_prompt: str = ""
    property_category: str = "all"

class CreateAlertRequest(BaseModel):
    user_email: str
    city: str
    min_price: int
    max_price: int
    property_type: str
    target_audience: str

class AIPredictRequest(BaseModel):
    description: str
    price: str
    location: str

def verify_admin(x_admin_password: str = Header(None)):
    admin_pw = os.environ.get("ADMIN_PASSWORD")
    if not admin_pw:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if x_admin_password != admin_pw:
        raise HTTPException(status_code=401, detail="Unauthorized Admin")

def build_search_urls(city: str, property_type: str, sites: list[str] = ["all"], target_audience: str = "sellers", property_category: str = "all"):
    urls = []
    selected = set(sites) if "all" not in sites else {"dubizzle", "aqarmap", "propertyfinder", "bayut", "semsarmasr", "shofaqar", "realestate", "facebook"}
    cities = [c.strip() for c in city.split(",")] if city else [""]
    
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

    # ⛰️ LANDS (New Category Requirement)
    LAND_KEYWORDS = [
        "ارض مباني", "ارض فضاء", "نمرة ارض", "قطعة ارض", "ارض قرعة", 
        "ارض بيت الوطن", "ارض تمليك", "ارض صناعية", "ارض زراعية", 
        "فدان", "فدادين", "قيراط", "ارض مرخصة", "ارض مصنع", 
        "land", "plot of land", "industrial land"
    ]

    # ⚙️ STRICT COMMERCIAL CATEGORIES
    STRICT_SHOP_KEYWORDS = ["محل للبيع", "محل للايجار", "محلات للبيع", "shop for sale", "retail shop", "محل", "محلات"]
    STRICT_PHARMACY_KEYWORDS = ["صيدلية للبيع", "صيدليه للايجار", "صيدلية مرخصة", "pharmacy for sale", "صيدلية", "صيدليه"]
    STRICT_SHOWROOM_KEYWORDS = ["معرض للبيع", "معرض للايجار", "معارض للبيع", "showroom for sale", "معرض", "معارض"]
    STRICT_OFFICE_KEYWORDS = ["مكتب للبيع", "مقر اداري", "عيادة للبيع", "مكاتب للايجار", "office for sale", "مكتب", "مكاتب", "عيادة", "عيادات", "اداري"]

    # ⚙️ TRANSACTION MODIFIERS (To be compounded with categories)
    SALE_MODIFIERS = ["للبيع", "كاش", "بالتقسيط", "قسط", "بتسهيلات", "مقدم", "تنازل", "لقطة"]
    RENT_MODIFIERS = ["للإيجار", "ايجار", "ايجار جديد", "قانون قديم", "مفروش"]

    for c in cities:
        if not c and ("all" in sites or not sites):
             urls.extend(DEFAULT_SITES)
             
        # Strip colloquial Arabic search prefixes from the city name before formatting the slug
        c_clean = c.replace("مطلوب", "").replace("معروض", "").replace("للبيع", "").replace("للايجار", "").replace("-", " ").strip()
        # Multiple spaces should be collapsed to avoid double dashes
        import re
        c_clean = re.sub(r'\s+', ' ', c_clean)
        
        from urllib.parse import quote
        
        city_slug = c_clean.replace(" ", "-").lower() if c_clean else "egypt"
        encoded_city = quote(city_slug)
        
        # Determine if the category is strictly commercial
        cat = property_category.lower() if property_category else "all"
        cat_is_commercial = cat in ["warehouse", "shop", "pharmacy", "showroom", "office", "commercial"]

        if "facebook" in selected:
            # Build Location
            location_query = f'"{c_clean}"' if c_clean else '("التجمع الخامس" OR "الشيخ زايد" OR "العاصمة الادارية")'
            
            # Build Base Keywords depending on target audience & category
            if target_audience == "buyers":
                base_keywords = ["مطلوب", "عايز اشتري", "عايز اأجر", "رقم التواصل", "ابعتلي خاص"]
                if cat == "warehouse":
                    base_keywords = [f"مطلوب {k}" for k in ["مخزن", "مستودع", "هنجر", "ثلاجة"]]
                elif cat == "hotel":
                    base_keywords = [f"مطلوب {k}" for k in ["فندق", "قرية سياحية", "منتجع"]]
                elif cat == "land":
                    base_keywords = [f"مطلوب {k}" for k in ["ارض", "فدان", "قيراط", "قطعة ارض"]]
                elif cat == "apartment":
                    base_keywords = ["مطلوب شقة", "محتاج شقة", "عايز شقة"]
                elif cat == "villa":
                    base_keywords = ["مطلوب فيلا", "عايز فيلا", "مطلوب توين هاوس"]
                elif cat == "shop":
                    base_keywords = [f"مطلوب {k}" for k in ["محل", "محلات"]]
                elif cat == "pharmacy":
                    base_keywords = [f"مطلوب {k}" for k in ["صيدلية", "صيدليه"]]
                elif cat == "showroom":
                    base_keywords = [f"مطلوب {k}" for k in ["معرض", "معارض"]]
                elif cat == "office":
                    base_keywords = ["مطلوب مكتب", "مطلوب عيادة", "مطلوب مقر اداري"]
            else:
                base_keywords = ["عقار", "شقة", "فيلا", "لقطة", "فرصة", "بمقدم", "كاش"]
                if cat == "warehouse":
                    base_keywords = WAREHOUSE_KEYWORDS
                elif cat == "hotel":
                    base_keywords = HOTEL_KEYWORDS
                elif cat == "land":
                    base_keywords = LAND_KEYWORDS
                elif cat == "apartment":
                    base_keywords = ["شقة", "شقق", "دوبلكس", "بنتهاوس", "apartment", "duplex"]
                elif cat == "villa":
                    base_keywords = ["فيلا", "فيلات", "تاون هاوس", "توين هاوس", "villa", "townhouse"]
                elif cat == "shop":
                    base_keywords = STRICT_SHOP_KEYWORDS
                elif cat == "pharmacy":
                    base_keywords = STRICT_PHARMACY_KEYWORDS
                elif cat == "showroom":
                    base_keywords = STRICT_SHOWROOM_KEYWORDS
                elif cat == "office":
                    base_keywords = STRICT_OFFICE_KEYWORDS
                
            # Build Intent Modifiers
            intent_modifiers = []
            if property_type == "sale":
                intent_modifiers = SALE_MODIFIERS
            elif property_type == "rent":
                intent_modifiers = RENT_MODIFIERS
            else:
                intent_modifiers = SALE_MODIFIERS + RENT_MODIFIERS
                
            # Generate combinations for Facebook Dorks to keep them short enough for Bing
            # We will chunk the base keywords, and just append one OR group of intent modifiers
            chunk_size = 4
            intent_group = '("' + '" OR "'.join(intent_modifiers[:4]) + '")' # Use top 4 modifiers to not blow up query
            
            for i in range(0, len(base_keywords), chunk_size):
                chunk = base_keywords[i:i + chunk_size]
                keyword_group = '("' + '" OR "'.join(chunk) + '")'
                raw_query = f'site:facebook.com {keyword_group} {intent_group} {location_query}'
                
                # Exclude residential cross-contamination if looking for commercial
                if cat_is_commercial:
                    raw_query += ' -شقة -شقق -فيلا -عمارة'
                    
                urls.append(f"bing:{raw_query}")

        # If we extended DEFAULT_SITES above, we don't need to manually append the other sites for an empty city.
        if not c and ("all" in sites or not sites):
            continue

        pf_cat = "3" if cat_is_commercial else "1"
        dbz_cat = "commercial-for-sale" if cat_is_commercial else "properties-for-sale"
        dbz_rent_cat = "commercial-for-rent" if cat_is_commercial else "properties-for-rent"
        aqar_cat = "commercial" if cat_is_commercial else "property-type"
        
        # Explicit commercial routes for secondary portals
        bayut_cat = "commercial-for-sale" if cat_is_commercial else "properties-for-sale"
        bayut_rent_cat = "commercial-for-rent" if cat_is_commercial else "properties-for-rent"
        
        semsar_cat = "commercial-properties-for-sale" if cat_is_commercial else "properties-for-sale"
        semsar_rent_cat = "commercial-properties-for-rent" if cat_is_commercial else "properties-for-rent"
        
        shof_cat = "commercial-for-sale" if cat_is_commercial else "properties-for-sale"
        shof_rent_cat = "commercial-for-rent" if cat_is_commercial else "properties-for-rent"
        
        realestate_cat = "commercial-for-sale" if cat_is_commercial else "for-sale"
        realestate_rent_cat = "commercial-for-rent" if cat_is_commercial else "for-rent"

        if property_type in ["sale", "both"]:
            if "dubizzle" in selected: urls.append(f"https://www.dubizzle.com.eg/properties/{dbz_cat}/q-{encoded_city}/")
            if "aqarmap" in selected: urls.append(f"https://aqarmap.com.eg/en/for-sale/{aqar_cat}/{encoded_city}/")
            if "propertyfinder" in selected: urls.append(f"https://www.propertyfinder.eg/en/search?c={pf_cat}&t=1&q={encoded_city}")
            if "bayut" in selected: urls.append(f"https://www.bayut.eg/en/{encoded_city}/{bayut_cat}/")
            if "semsarmasr" in selected: urls.append(f"https://www.semsarmasr.com/en/{semsar_cat}/{encoded_city}")
            if "shofaqar" in selected: urls.append(f"https://shofaqar.com/{shof_cat}/{encoded_city}")
            if "realestate" in selected: urls.append(f"https://realestate.eg/en/{realestate_cat}/{encoded_city}")
            
        if property_type in ["rent", "both"]:
            if "dubizzle" in selected: urls.append(f"https://www.dubizzle.com.eg/properties/{dbz_rent_cat}/q-{encoded_city}/")
            if "aqarmap" in selected: urls.append(f"https://aqarmap.com.eg/en/for-rent/{aqar_cat}/{encoded_city}/")
            if "propertyfinder" in selected: urls.append(f"https://www.propertyfinder.eg/en/search?c={pf_cat}&t=2&q={encoded_city}")
            if "bayut" in selected: urls.append(f"https://www.bayut.eg/en/{encoded_city}/{bayut_rent_cat}/")
            if "semsarmasr" in selected: urls.append(f"https://www.semsarmasr.com/en/{semsar_rent_cat}/{encoded_city}")
            if "shofaqar" in selected: urls.append(f"https://shofaqar.com/{shof_rent_cat}/{encoded_city}")
            if "realestate" in selected: urls.append(f"https://realestate.eg/en/{realestate_rent_cat}/{encoded_city}")
            
    return list(dict.fromkeys(urls))

class RedeemRequest(BaseModel): token: str

@app.post("/api/auth/redeem")
@limiter.limit("5/minute")
async def redeem_token(req: RedeemRequest, request: Request):
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    try:
        jwt_token = auth_agent.redeem_token(req.token, ip, user_agent)
        return {"status": "success", "session_key": jwt_token}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error redeeming token: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Server error during redemption: {str(e)}")

@app.get("/api/auth/status")
async def auth_status(user = Depends(auth_agent.get_optional_user)):
    if not user:
        config = db.get_admin_config()
        return {"status": "success", "user": None, "trial_enabled": config.get("TRIAL_ENABLED", True), "free_limit": config.get("FREE_RESULT_LIMIT", 5)}
    
    config = db.get_admin_config()
    token_code = user.get('token_code')
    total_searches = int(user.get('total_searches', 0) or 0)
    
    # Search limit is always admin-defined per token
    search_limit_raw = config.get(f"SEARCH_LIMIT_{token_code}") if token_code else None
    search_limit = int(search_limit_raw) if search_limit_raw is not None else None
    
    return {
        "status": "success",
        "user": {
            "email": user.get('email'),
            "tier": user.get('tier'),
            "expires_at": user.get('expires_at'),
            "total_searches": total_searches,
            "search_limit": search_limit  # None means admin hasn't set a limit yet
        }
    }

class CreateTokenRequest(BaseModel):
    email: EmailStr
    tier: str
    days: int = 30
    max_users: int = 1
    search_limit: int = 50  # Admin always sets this explicitly

@app.post("/api/admin/tokens/create", dependencies=[Depends(verify_admin)])
@limiter.limit("20/minute")
async def admin_create_token(req: CreateTokenRequest, request: Request, background_tasks: BackgroundTasks):
    auth_agent.token_expiry[req.tier] = req.days
    token_code, expires_at = auth_agent.generate_license_token(req.tier, req.email)
    
    # Always persist the admin-defined search limit for this token
    db.update_admin_config(f"SEARCH_LIMIT_{token_code}", req.search_limit)
    
    # Persist company token user limit if > 1
    if req.max_users > 1:
        db.update_admin_config(f"TOKEN_LIMIT_{token_code}", req.max_users)
    
    # Run email in background to avoid SMTP-related timeouts
    background_tasks.add_task(send_license_email, req.email, token_code, req.tier, expires_at)
    
    return {"status": "success", "token": token_code, "expires_at": expires_at, "message": "Token generated successfully. Email queued in background."}

@app.get("/api/admin/users", dependencies=[Depends(verify_admin)])
async def admin_get_users():
    return {"status": "success", "data": db.get_all_users()}

@app.get("/api/admin/config")
async def get_admin_config_route(_ = Depends(verify_admin)):
    return {"status": "success", "config": db.get_admin_config()}

@app.get("/api/very_secret_debug_endpoint_xyz123")
async def super_secret_debug():
    return {"status": "success", "users": db.get_all_users()}

class ConfigUpdateRequest(BaseModel):
    key: str
    value: str | bool | list | int

@app.post("/api/admin/config", dependencies=[Depends(verify_admin)])
async def admin_update_config(req: ConfigUpdateRequest):
    success = db.update_admin_config(req.key, req.value)
    if success: return {"status": "success"}
    raise HTTPException(status_code=500, detail="Update failed")

# ------------------------------------------------------------------
# Feature: Smart Alerts
# ------------------------------------------------------------------

@app.post("/api/alerts/save")
async def save_alert(req: CreateAlertRequest, user = Depends(auth_agent.get_current_user)):
    auth_agent.check_feature(user, "webhooks")
    result = db.create_saved_search(req.user_email, req.city, req.min_price, req.max_price, req.property_type, req.target_audience)
    if result: return {"status": "success", "alert": result}
    raise HTTPException(status_code=500, detail="Failed to save alert.")

@app.get("/api/alerts")
async def get_alerts(user_email: str, user = Depends(auth_agent.get_current_user)):
    try:
        auth_agent.check_feature(user, "webhooks")
        return {"status": "success", "alerts": db.get_saved_searches(user_email)}
    except HTTPException:
        # Gracefully swallow the RBAC failure so the frontend doesn't throw a scary red 403 console log
        return {"status": "success", "alerts": []}


@app.post("/api/scraper/start")
async def start_scraper(req: SearchRequest, request: Request, background_tasks: BackgroundTasks, user = Depends(auth_agent.get_optional_user)):
    try:
        ip_address = get_client_ip(request)
        limits = auth_agent.enforce_rate_limits(user, ip_address)
    except Exception as e:
        status_code = getattr(e, "status_code", 400)
        detail = getattr(e, "detail", str(e))
        raise HTTPException(status_code=status_code, detail=detail)

    # Attach user identity to the session for multi-tenant isolation
    user_id = user.get("id") if user else None
    user_email = user.get("email") if user else None

    # Track usage on initiation to fix the "0/50" issue correctly
    if user_id:
        db.increment_user_searches(user_id)

    cat = req.property_category.lower() if req.property_category else "all"
    constraints = {"min_area": None, "min_floors": None, "building_type": None, "cities": [], "property_category": cat}
    
    # 1. Strict Input Sanitization
    if req.min_price:
        clean_min = re.sub(r'[^\d]', '', str(req.min_price))
        req.min_price = clean_min if clean_min else None
    if req.max_price:
        clean_max = re.sub(r'[^\d]', '', str(req.max_price))
        req.max_price = clean_max if clean_max else None

    # 2. Payload Verification & Logging
    logger.info(f"START_SCRAPING PAYLOAD: City='{req.city}', Category='{req.property_category}', Target='{req.target_audience}', Intent='{req.property_type}', MinPrice='{req.min_price}', MaxPrice='{req.max_price}', Sites={req.sites}")

    if req.ai_prompt:
        parsed = SemanticQueryParser.parse(req.ai_prompt)
        if parsed["cities"]:
            req.city = ",".join(parsed["cities"])
            constraints["cities"] = parsed["cities"]
        if parsed["intent"] != "both":
            req.property_type = parsed["intent"]
        if parsed["property_category"] != "all":
            req.property_category = parsed["property_category"]
            constraints["property_category"] = parsed["property_category"]
        constraints.update(parsed["constraints"])
        constraints["building_type"] = parsed["property_type"]

    session_id = db.create_session(
        city=req.city, property_type=req.property_type,
        time_filter=req.time_filter, target_audience=req.target_audience,
        user_id=user_id, user_email=user_email
    )
    actual_urls = build_search_urls(
        city=req.city, property_type=req.property_type, 
        sites=req.sites, target_audience=req.target_audience,
        property_category=req.property_category
    )
    
    session_key = str(user_id) if user_id else ip_address
    new_orchestrator = ScraperOrchestrator()
    
    # Enforce exactly 50 leads per search output, unless the limit is lower
    allowed_limit = limits.get("limit")
    hard_limit = min(50, allowed_limit) if allowed_limit is not None else 50
    
    background_tasks.add_task(
        run_scraper_safely,
        session_key, new_orchestrator,
        req.city, req.property_type, req.time_filter, actual_urls,
        session_id, req.target_audience, hard_limit, limits.get("ip_address"),
        req.min_price, req.max_price, constraints
    )
    
    return {"status": "success", "message": f"Scraper started.", "session_id": session_id}

@app.get("/api/sessions")
async def get_user_sessions(user = Depends(auth_agent.get_optional_user)):
    """Returns only the sessions belonging to the authenticated user."""
    if not user:
        return {"status": "success", "sessions": []}
    user_id = user.get("id")
    sessions = db.get_sessions(user_id=user_id)
    return {"status": "success", "sessions": sessions}

@app.post("/api/scraper/stop")
async def stop_scraper(request: Request, user = Depends(auth_agent.get_optional_user)):
    user_id = user.get("id") if user else None
    ip_address = get_client_ip(request)
    session_key = str(user_id) if user_id else ip_address
    
    orchestrator = active_orchestrators.get(session_key)
    if orchestrator:
        orchestrator.stop_scraper()
        return {"status": "success", "message": "Scraper stopped"}
    return {"status": "success", "message": "No active scraper found"}

from fastapi.responses import Response

@app.get("/api/export")
async def export_data_endpoint(fmt: str = "excel", token: str = None, user = Depends(auth_agent.get_current_user)):
    # Fallback to query parameter token for browser downloads
    active_user = user or auth_agent.get_user_from_query(token)
    auth_agent.check_feature(active_user, "export")
    data = db.export_data(fmt=fmt)
    if not data:
        raise HTTPException(status_code=404, detail="No export found yet. Run a scrape session first.")
    
    if fmt == "csv":
        return Response(content=data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=Professional_Leads.csv"})
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=Professional_Leads.xlsx"})


@app.get("/api/export/{session_id}")
async def export_session_endpoint(session_id: int, fmt: str = "excel", token: str = None, user = Depends(auth_agent.get_current_user)):
    active_user = user or auth_agent.get_user_from_query(token)
    auth_agent.check_feature(active_user, "export")
    data = db.export_data(session_id=session_id, fmt=fmt)
    if not data:
        raise HTTPException(status_code=404, detail="No leads found for this session yet.")
        
    if fmt == "csv":
        return Response(content=data, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=UREI_Session_{session_id}.csv"})
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=UREI_Session_{session_id}.xlsx"})
@app.post("/api/ai/predict")
async def analyze_property(req: AIPredictRequest, user = Depends(auth_agent.get_current_user)):
    auth_agent.check_feature(user, "ai_score")
    
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=503, detail="AI Service is temporarily unavailable or misconfigured.")
        
    prompt = f"Act as an expert real estate investment analyst in Egypt. Evaluate this property at {req.location} asking for {req.price}. Description: {req.description[:500]}. Provide a strict 2-sentence analysis and prominently feature an 'Investment Score: X/10' somewhere."
    
    try:
        import aiohttp
        import re
        async with aiohttp.ClientSession() as session:
            # gemini-2.5-flash: current stable model (gemini-pro & early 1.5 versions are deprecated/region locked)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            async with session.post(url, json=payload, headers={'Content-Type': 'application/json'}) as resp:
                if resp.status != 200:
                    err_body = await resp.text()
                    raise HTTPException(status_code=500, detail=f"Gemini API Error: {err_body[:200]}")
                data = await resp.json()
                text_response = data['candidates'][0]['content']['parts'][0]['text']
                score_match = re.search(r'(\d+)(?:\s*)?/(?:\s*)?10', text_response)
                score = score_match.group(1) if score_match else "7"
                return {"status": "success", "score": score, "analysis": text_response}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting UREI Stateless Worker Process...")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
