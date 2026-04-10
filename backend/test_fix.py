import requests
import time

API = "http://localhost:8080"
headers = {"x-admin-password": "Eel$&$@@#162004"}

time.sleep(2) # Give uvicorn a moment to start

# 1. Test Admin Config Fetch
try:
    r = requests.get(f"{API}/api/admin/config", headers=headers)
    print("GET /api/admin/config ->", r.status_code, r.text)
except Exception as e:
    print("Failed GET:", e)

# 2. Test Admin Config Update
try:
    r = requests.post(f"{API}/api/admin/config", headers=headers, json={"key": "FREE_RESULT_LIMIT", "value": 10})
    print("POST /api/admin/config ->", r.status_code, r.text)
except Exception as e:
    print("Failed POST:", e)

# 3. Test Scraper Limit Trial
try:
    r = requests.post(f"{API}/api/scraper/start", json={"city": "Cairo", "property_type": "both", "sites": ["all"], "target_audience": "sellers"})
    print("POST /api/scraper/start (No Auth) ->", r.status_code, r.text)
except Exception as e:
    print("Failed POST Scraper:", e)
