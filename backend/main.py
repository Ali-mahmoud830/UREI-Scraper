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
from mail import send_license_email_async

app = FastAPI(title="UREI API (Stateless Execution Worker)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DBManager()

# Stateless Orchestrator
orchestrator = ScraperOrchestrator()

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
    if x_admin_password != os.environ.get("ADMIN_PASSWORD", "Eel$&$@@#162004"):
        raise HTTPException(status_code=401, detail="Unauthorized Admin")

def build_search_urls(city: str, property_type: str, sites: list[str] = ["all"], target_audience: str = "sellers"):
    if not city and ("all" in sites or not sites):
        return DEFAULT_SITES
    
    city_slug = city.strip().replace(" ", "-").lower() if city else "egypt"
    wanted_query = "مطلوب-" if target_audience == "buyers" else ""
    
    urls = []
    selected = set(sites) if "all" not in sites else {"dubizzle", "aqarmap", "propertyfinder", "bayut", "semsarmasr", "shofaqar", "realestate", "facebook"}
    
    if "facebook" in selected:
        buy_rent_keyword = "للبيع" if property_type == "sale" else "للايجار" if property_type == "rent" else "عقار"
        location_query = f'"{city}"' if city else '("التجمع الخامس" OR "الشيخ زايد" OR "العاصمة الادارية")'
        
        if target_audience == "buyers":
            keywords_list = ["مطلوب", "محتاج شقة", "عايز فيلا", "عايز اشتري", "رقم التواصل", "ابعتلي خاص"]
        else:
            keywords_list = ["شقة للبيع", "عقار للتمليك", "شقة لقطة", "فرصة", "بالتجمع", "مباشر من المالك"]
            
        chunk_size = 4
        for i in range(0, len(keywords_list), chunk_size):
            chunk = keywords_list[i:i + chunk_size]
            keyword_group = '("' + '" OR "'.join(chunk) + '")'
            raw_query = f'site:facebook.com {keyword_group} {location_query} "{buy_rent_keyword}"'
            urls.append(f"ddglite:{raw_query}")

    if property_type in ["sale", "both"]:
        if "dubizzle" in selected: urls.append(f"https://www.dubizzle.com.eg/properties/properties-for-sale/q-{wanted_query}{city_slug}/")
        if "aqarmap" in selected: urls.append(f"https://aqarmap.com.eg/en/for-sale/property-type/{city_slug}/")
        if "propertyfinder" in selected: urls.append(f"https://www.propertyfinder.eg/en/search?c=1&t=1&q={city_slug}")
        if "bayut" in selected: urls.append(f"https://www.bayut.eg/en/{city_slug}/properties-for-sale/")
        if "semsarmasr" in selected: urls.append(f"https://www.semsarmasr.com/en/properties-for-sale/{city_slug}")
        if "shofaqar" in selected: urls.append(f"https://shofaqar.com/properties-for-sale/{city_slug}")
        if "realestate" in selected: urls.append(f"https://realestate.eg/en/for-sale/{city_slug}")
        
    if property_type in ["rent", "both"]:
        if "dubizzle" in selected: urls.append(f"https://www.dubizzle.com.eg/properties/properties-for-rent/q-{wanted_query}{city_slug}/")
        if "aqarmap" in selected: urls.append(f"https://aqarmap.com.eg/en/for-rent/property-type/{city_slug}/")
        if "propertyfinder" in selected: urls.append(f"https://www.propertyfinder.eg/en/search?c=2&t=1&q={city_slug}")
        if "bayut" in selected: urls.append(f"https://www.bayut.eg/en/{city_slug}/properties-for-rent/")
        if "semsarmasr" in selected: urls.append(f"https://www.semsarmasr.com/en/properties-for-rent/{city_slug}")
        if "shofaqar" in selected: urls.append(f"https://shofaqar.com/properties-for-rent/{city_slug}")
        if "realestate" in selected: urls.append(f"https://realestate.eg/en/for-rent/{city_slug}")
    return urls

class RedeemRequest(BaseModel): token: str

@app.post("/api/auth/redeem")
async def redeem_token(req: RedeemRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    jwt_token = auth_agent.redeem_token(req.token, ip, user_agent)
    return {"status": "success", "session_key": jwt_token}

@app.get("/api/auth/status")
async def auth_status(user = Depends(auth_agent.get_current_user)):
    if not user:
        config = db.get_admin_config()
        return {"status": "success", "user": None, "trial_enabled": config.get("TRIAL_ENABLED", True), "free_limit": config.get("FREE_RESULT_LIMIT", 5)}
    return {"status": "success", "user": {"email": user.get('email'), "tier": user.get('tier'), "expires_at": user.get('expires_at')}}

class CreateTokenRequest(BaseModel):
    email: EmailStr
    tier: str
    days: int = 30

@app.post("/api/admin/tokens/create", dependencies=[Depends(verify_admin)])
async def admin_create_token(req: CreateTokenRequest):
    # Tier mapping has been dynamically augmented to support custom days
    auth_agent.token_expiry[req.tier] = req.days  
    token_code, expires_at = auth_agent.generate_license_token(req.tier, req.email)
    email_sent = await send_license_email_async(req.email, token_code, req.tier, expires_at)
    status_msg = "Token generated and email sent successfully" if email_sent else "Token generated but email delivery failed"
    return {"status": "success", "token": token_code, "expires_at": expires_at, "message": status_msg}

@app.get("/api/admin/users", dependencies=[Depends(verify_admin)])
async def admin_get_users():
    return {"status": "success", "data": db.get_all_users()}

@app.get("/api/admin/config", dependencies=[Depends(verify_admin)])
async def admin_get_config():
    return {"status": "success", "data": db.get_admin_config()}

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
    auth_agent.check_feature(user, "webhooks")
    return {"status": "success", "alerts": db.get_saved_searches(user_email)}


@app.post("/api/scraper/start")
async def start_scraper(req: SearchRequest, request: Request, background_tasks: BackgroundTasks, user = Depends(auth_agent.get_current_user)):
    try:
        ip_address = request.client.host if request.client else "unknown"
        limits = auth_agent.enforce_rate_limits(user, ip_address)
    except Exception as e:
        status_code = getattr(e, "status_code", 400)
        detail = getattr(e, "detail", str(e))
        raise HTTPException(status_code=status_code, detail=detail)

    session_id = db.create_session(
        city=req.city, property_type=req.property_type,
        time_filter=req.time_filter, target_audience=req.target_audience
    )
    actual_urls = build_search_urls(
        city=req.city, property_type=req.property_type, 
        sites=req.sites, target_audience=req.target_audience
    )
    background_tasks.add_task(
        orchestrator.start_scraper,
        req.city, req.property_type, req.time_filter, actual_urls,
        session_id, req.target_audience, limits.get("limit"), limits.get("ip_address"),
        req.min_price, req.max_price
    )
    
    return {"status": "success", "message": f"Scraper started.", "session_id": session_id}

@app.post("/api/scraper/stop")
async def stop_scraper():
    orchestrator.stop_scraper()
    return {"status": "success", "message": "Scraper stopped"}

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
        import random
        score = random.randint(5, 9)
        return {"status": "success", "score": score, "analysis": f"MOCK: The property at {req.location} listed for {req.price} shows promising signals. Configure GEMINI_API_KEY in the backend Vercel vars for real NLP outputs."}
        
    prompt = f"Act as an expert real estate investment analyst in Egypt. Evaluate this property at {req.location} asking for {req.price}. Description: {req.description[:500]}. Provide a strict 2-sentence analysis and prominently feature an 'Investment Score: X/10' somewhere."
    
    try:
        import aiohttp
        import re
        async with aiohttp.ClientSession() as session:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={gemini_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            async with session.post(url, json=payload, headers={'Content-Type': 'application/json'}) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=500, detail="Gemini API Error")
                data = await resp.json()
                text_response = data['candidates'][0]['content']['parts'][0]['text']
                score_match = re.search(r'(\d+)(?:\s*)?/(?:\s*)?10', text_response)
                score = score_match.group(1) if score_match else "7"
                return {"status": "success", "score": score, "analysis": text_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting UREI Stateless Worker Process...")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
