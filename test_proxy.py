import urllib.request
import json
import urllib.error

VERCEL = "https://urei-scraper.vercel.app"

req = urllib.request.Request(f"{VERCEL}/api/auth/login", 
                             data=json.dumps({"token": "154H-PHSP-6AIT-RC52"}).encode(),
                             headers={"Content-type": "application/json"})
try:
    with urllib.request.urlopen(req) as resp:
        cookies = resp.headers.get_all('Set-Cookie')
        if cookies:
            cookie_str = cookies[0].split(';')[0]
            print("\nTesting Proxy Sessions endpoint...")
            status_req = urllib.request.Request(f"{VERCEL}/api/proxy/sessions",
                                                headers={"Cookie": cookie_str})
            try:
                with urllib.request.urlopen(status_req) as s_resp:
                    print("Proxy Sessions:", s_resp.status, s_resp.read().decode())
            except urllib.error.HTTPError as he:
                print("Proxy FAIL:", he.code, he.read().decode())
except urllib.error.HTTPError as e:
    print(f"FAIL {e.code}:", e.read().decode())
