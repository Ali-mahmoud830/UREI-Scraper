import urllib.request
import json
import urllib.error

VERCEL = "https://urei-scraper.vercel.app"
HF = "https://ali-mahmoud-830-urei-scraper-api.hf.space"

# Login via Vercel
req = urllib.request.Request(f"{VERCEL}/api/auth/login",
                             data=json.dumps({"token": "154H-PHSP-6AIT-RC52"}).encode(),
                             headers={"Content-type": "application/json"})
with urllib.request.urlopen(req) as resp:
    cookies = resp.headers.get_all('Set-Cookie')
    cookie_str = cookies[0].split(';')[0]
    print("✅ Login OK, cookie set")

    # Test /api/proxy/alerts (monthly tier - should return empty array NOT 403)
    for endpoint in ["sessions", "alerts?user_email=xx758008@gmail.com"]:
        try:
            r = urllib.request.Request(f"{VERCEL}/api/proxy/{endpoint}", 
                                       headers={"Cookie": cookie_str})
            with urllib.request.urlopen(r) as s:
                data = json.loads(s.read().decode())
                print(f"✅ /proxy/{endpoint}: {s.status} → {list(data.keys())}")
        except urllib.error.HTTPError as e:
            print(f"❌ /proxy/{endpoint}: FAIL {e.code} → {e.read().decode()[:100]}")

# Test direct HF alerts endpoint
try:
    r = urllib.request.Request(f"{HF}/api/alerts?user_email=xx758008@gmail.com",
                               headers={"Authorization": "Bearer dummy"})
    with urllib.request.urlopen(r) as s:
        print(f"✅ HF /api/alerts: {s.read().decode()[:80]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HF /api/alerts: {e.code} → {body[:120]}")
    print("  X-Auth-Error:", e.headers.get("X-Auth-Error", "none"))
