import urllib.request
import json

url = "http://127.0.0.1:8000/api/flights/?source=SYD&destination=JFK&date=2026-09-04"
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        print(f"Keys in data: {list(data.keys())}")
        
        actual_data = data.get('data') if isinstance(data, dict) and 'data' in data else data
        
        if isinstance(actual_data, dict):
            print(f"Total results: {actual_data.get('count')}")
            print(f"Route optimization: {json.dumps(actual_data.get('route_optimization', {}), indent=2)}")
        else:
            print("actual_data is not a dict:", type(actual_data))
            
except Exception as e:
    print(f"Error: {e}")
