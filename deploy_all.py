import subprocess
import os
from datetime import datetime

log_path = r"d:\projects\Scraper\deploy_log.txt"

def write_log(msg):
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(msg + "\n")
        
write_log(f"--- DEPLOYMENT STARTED at {datetime.now()} ---")

write_log("--- FRONTEND (Vercel) ---")
os.chdir(r"d:\projects\Scraper\frontend")
res = subprocess.run(["git", "add", "."], capture_output=True, text=True)
res = subprocess.run(["git", "commit", "-m", "feat: AI Semantic NLP Search UI"], capture_output=True, text=True)
write_log(f"Git Commit: {res.stdout}")
res = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
write_log(f"Git Push stdout: {res.stdout}")
write_log(f"Git Push stderr: {res.stderr}")

write_log("\n--- BACKEND (HuggingFace) ---")
os.chdir(r"d:\projects\Scraper\backend")
from huggingface_hub import HfApi
api = HfApi()
repo_id = "Ali-Mahmoud-830/UREI-Scraper-API"
hf_token = "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"
try:
    write_log("Uploading main.py...")
    api.upload_file(
        path_or_fileobj="main.py",
        path_in_repo="main.py",
        repo_id=repo_id,
        repo_type="space",
        token=hf_token,
        commit_message="feat: AI Semantic Search Parser"
    )
    write_log("Uploading scraper.py...")
    api.upload_file(
        path_or_fileobj="scraper.py",
        path_in_repo="scraper.py",
        repo_id=repo_id,
        repo_type="space",
        token=hf_token,
        commit_message="feat: AI Semantic Search Extractor"
    )
    write_log("Backend Upload Success!")
except Exception as e:
    write_log(f"Backend Upload Failed: {str(e)}")
