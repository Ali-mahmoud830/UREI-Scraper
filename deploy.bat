cd /d d:\projects\Scraper\frontend
git add .
git commit -m "feat: AI Semantic NLP Search Engine"
git push origin main

cd /d d:\projects\Scraper\backend
call venv\Scripts\activate.bat
python -c "from huggingface_hub import HfApi; api = HfApi(); api.upload_file('main.py', 'main.py', repo_id='Ali-Mahmoud-830/UREI-Scraper-API', repo_type='space', token='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', commit_message='feat: AI Parser'); api.upload_file('scraper.py', 'scraper.py', repo_id='Ali-Mahmoud-830/UREI-Scraper-API', repo_type='space', token='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', commit_message='feat: AI Extractor'); print('Backend deployed!')"
