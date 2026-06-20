import urllib.request
import json
import urllib.error

VERCEL = "https://urei-scraper.vercel.app"

# Send login to Vercel
req = urllib.request.Request(f"{VERCEL}/api/auth/login", 
                             data=json.dumps({"token": "154H-PHSP-6AIT-RC52"}).encode(),
                             headers={"Content-type": "application/json"})
try:
    with urllib.request.urlopen(req) as resp:
        print("Vercel Login Response:", resp.status, resp.read().decode())
        cookies = resp.headers.get_all('Set-Cookie')
        print("Vercel Set-Cookies:", cookies)
        
        if cookies:
            cookie_str = cookies[0].split(';')[0]
            print("\nSending auth status check to Vercel with cookie:", cookie_str)
            status_req = urllib.request.Request(f"{VERCEL}/api/auth/status",
                                                headers={"Cookie": cookie_str})
            with urllib.request.urlopen(status_req) as s_resp:
                print("Vercel Status:", s_resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"FAIL {e.code}:", e.read().decode())
