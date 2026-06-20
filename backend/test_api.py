import requests

payload = {
    "city": "cairo",
    "property_type": "both",
    "time_filter": "all",
    "sites": ["semsarmasr", "shofaqar", "realestate"]
}

try:
    resp = requests.post("http://localhost:8000/api/scraper/start", json=payload)
    print("START RESPONSE:", resp.json())
except Exception as e:
    print("START FAILED:", e)

import time
time.sleep(2)

try:
    stop = requests.post("http://localhost:8000/api/scraper/stop")
    print("STOP RESPONSE:", stop.json())
except Exception as e:
    print("STOP FAILED:", e)
