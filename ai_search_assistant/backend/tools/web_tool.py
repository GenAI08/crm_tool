# =======================
# 4. web_tool.py (SerpAPI)
# =======================
from serpapi import GoogleSearch

def search_web(query: str) -> str:
    params = {
        "q": query,
        "api_key": "038b7330e59accc57a66717427e8335e449c97ee49b3256d77671c50c28f2e8f"
    }
    search = GoogleSearch(params)
    results = search.get_dict()
    return results['organic_results'][0]['snippet']