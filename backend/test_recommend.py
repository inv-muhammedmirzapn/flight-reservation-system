import urllib.request
import json

url = "http://127.0.0.1:8000/api/flights/route-optimization/recommend/?source=SYD&destination=JFK&date=2026-09-04"
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        print("Success:", data)
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
