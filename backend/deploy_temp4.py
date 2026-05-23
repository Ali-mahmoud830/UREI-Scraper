from huggingface_hub import HfApi
import sys
api = HfApi()
repo_id = "Ali-Mahmoud-830/UREI-Scraper-API"
hf_token = "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"
base = r"d:\projects\Scraper\backend\\"
files = ["main.py", "scraper.py"]
print("Deploying AI Semantic Search Logic...")
for f in files:
    print(f"  Uploading {f}...")
    api.upload_file(
        path_or_fileobj=base + f,
        path_in_repo=f,
        repo_id=repo_id,
        repo_type="space",
        token=hf_token,
        commit_message=f"feat: AI Semantic NLP Search Engine parsing & strict execution"
    )
print("SUCCESS.")
