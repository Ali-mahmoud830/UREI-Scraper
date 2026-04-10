import urllib.request
import json
import os

key = "re_5bGR1xNQ_KWef5TtWfS8SvGAMaBTz68J3"

try:
    req = urllib.request.Request(
        "https://api.resend.com/domains",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode())
    domains = data.get("data", [])
    
    proppulse = next((d for d in domains if d["name"] == "proppulse.eg"), None)
    
    if proppulse:
        print(f"Domain ID: {proppulse['id']}")
        
        req2 = urllib.request.Request(
            f"https://api.resend.com/domains/{proppulse['id']}",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        )
        res2 = urllib.request.urlopen(req2)
        records = json.loads(res2.read().decode()).get("records", [])
        
        print("\n--- DNS RECORDS ---")
        for r in records:
            print(f"Type: {r['type']}")
            print(f"Name: {r['name']}")
            print(f"Value: {r['value']}")
            print("-------------------")
    else:
        print("Domain proppulse.eg not found in this Resend account.")
        print("Domains found:", [d["name"] for d in domains])
except Exception as e:
    print(f"Error: {e}")
