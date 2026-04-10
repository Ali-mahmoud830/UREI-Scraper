import codecs
path = r"d:\projects\Scraper\frontend\components\Dashboard.tsx"
with codecs.open(path, "r", "utf-8") as f:
    text = f.read()

text = text.replace('"ws://localhost:8000/ws"', '`${WS_BASE}/ws`')
text = text.replace('ws://localhost:8000', '${WS_BASE}')
text = text.replace('"http://localhost:8000/api/search_history"', '`${API_BASE}/api/search_history`')
text = text.replace('"http://localhost:8000/api/stats"', '`${API_BASE}/api/stats`')
text = text.replace('"http://localhost:8000/api/analytics"', '`${API_BASE}/api/analytics`')
text = text.replace('"http://localhost:8000/api/leads"', '`${API_BASE}/api/leads`')
text = text.replace('"http://localhost:8000/api/scraper/stop"', '`${API_BASE}/api/scraper/stop`')
text = text.replace('"http://localhost:8000/api/scraper/start"', '`${API_BASE}/api/scraper/start`')
text = text.replace('"http://localhost:8000/api/export"', '`${API_BASE}/api/export`')
text = text.replace('http://localhost:8000/api/', '${API_BASE}/api/')

with codecs.open(path, "w", "utf-8") as f:
    f.write(text)
