import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
import re

def test_bing():
    query = "site:facebook.com cairo 0100"
    url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'})
    try:
        html = urllib.request.urlopen(req).read().decode()
        soup = BeautifulSoup(html, 'html.parser')
        results = soup.find_all('li', class_='b_algo')
        print(f"✅ Bing SUCCESS! Found {len(results)} results")
        for res in results[:2]:
            link = res.find('a')
            desc = res.find('p')
            print("Link:", link.get('href') if link else None)
            print("Desc:", desc.text[:100] if desc else None)
    except Exception as e:
        print("❌ Bing Failed:", e)

if __name__ == "__main__":
    test_bing()
