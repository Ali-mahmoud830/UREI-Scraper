import urllib.request
import json
import time

API = "https://ali-mahmoud-830-urei-scraper-api.hf.space"

def test_flow():
    # 1. Redeem token
    print("Redeeming token...")
    req = urllib.request.Request(f"{API}/api/auth/redeem", 
                                 data=json.dumps({"token": "8CSS-MY4Q-2Q6I-O8TP"}).encode(),
                                 headers={"Content-type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print("Redeem:", data)
            jwt = data.get("session_key")
            
            print("Checking Status...")
            status_req = urllib.request.Request(f"{API}/api/auth/status",
                                     headers={"Authorization": f"Bearer {jwt}"})
            try:
                with urllib.request.urlopen(status_req) as st_resp:
                    print("Status:", st_resp.read().decode())
            except urllib.error.HTTPError as e:
                print(f"Status FAIL {e.code}:", e.read().decode())
                print("Headers:", dict(e.headers))
    except urllib.error.HTTPError as e:
        print(f"Redeem FAIL {e.code}:", e.read().decode())

test_flow()

try:
    print("\nDumping Users Table...")
    req = urllib.request.Request(f"{API}/api/very_secret_debug_endpoint_xyz123")
    with urllib.request.urlopen(req) as r:
        print(r.read().decode()[:500] + "...")
except Exception as e:
    print("Users Dump Failed:", e)
