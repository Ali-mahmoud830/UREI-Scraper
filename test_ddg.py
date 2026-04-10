import urllib.request
import urllib.parse
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

raw_query = 'site:facebook.com ("مطلوب" OR "محتاج شقة") "عقار"'
safe_query = urllib.parse.quote(raw_query)
url = f'https://html.duckduckgo.com/html/?q={safe_query}'

req = urllib.request.Request(
    url, 
    data=None, 
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
)

try:
    response = urllib.request.urlopen(req, context=ctx)
    html = response.read().decode('utf-8')
    print("--- SUCCESS ---")
    print(f"Length of response: {len(html)}")
    
    # Check if snippets exist
    snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
    print(f"Found {len(snippets)} snippets")
    if snippets:
        print("First snippet:", snippets[0][:200])
except Exception as e:
    print(f"Error: {e}")
