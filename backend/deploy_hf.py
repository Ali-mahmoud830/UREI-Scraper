from huggingface_hub import HfApi
import sys

api = HfApi()
repo_id = "Ali-Mahmoud-830/UREI-Scraper-API"
hf_token = "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"

files = ["main.py", "scraper.py", "requirements.txt"]
print("Uploading to Hugging Face Spaces...")

for f in files:
    print(f"Uploading {f}...")
    api.upload_file(
        path_or_fileobj=f,
        path_in_repo=f,
        repo_id=repo_id,
        repo_type="space",
        token=hf_token,
        commit_message="feat: add AI semantic search query engine"
    )

print("Hugging Face upload complete!")
