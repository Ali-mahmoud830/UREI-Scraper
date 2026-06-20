import os
from database import DBManager

db = DBManager()

print("Fetching all users...")
try:
    users = db.get_all_users()
    for u in users:
        print(f"User: {u.get('email')} | Token: {u.get('token_code')} | IP: {u.get('ip_address')}")
        print(f"Session Key: {u.get('session_key')}")
        print("-" * 40)
except Exception as e:
    print("Error:", e)
