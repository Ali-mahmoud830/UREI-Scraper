import requests
import time
import sys

API = "http://localhost:8000"
headers = {"x-admin-password": "Eel$&$@@#162004"}
success = True

def run_tests():
    global success
    time.sleep(3) # wait for uvicorn to boot up
    print("Beginning tests...")

    # 1. Config Get
    res = requests.get(f"{API}/api/admin/config", headers=headers)
    if res.status_code != 200:
        print(f"FAILED GET /api/admin/config -> {res.status_code} {res.text}")
        success = False
    else:
        print("PASS: GET /api/admin/config ->", res.json())

    # 2. Config Post
    res = requests.post(f"{API}/api/admin/config", headers=headers, json={"key": "TRIAL_ENABLED", "value": False})
    if res.status_code != 200:
        print(f"FAILED POST /api/admin/config -> {res.status_code} {res.text}")
        success = False
    else:
        print("PASS: POST /api/admin/config toggle ->", res.json())

    # 3. Start Scraper
    res = requests.post(f"{API}/api/scraper/start", json={"city": "Cairo", "property_type": "both", "sites": ["all"], "target_audience": "sellers"})
    if res.status_code != 200:
        print(f"FAILED POST /api/scraper/start -> {res.status_code} {res.text}")
        success = False
    else:
        print("PASS: POST /api/scraper/start ->", res.json())
        
    if success:
        print("ALL TESTS PASSED WITH 200 OK.")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
