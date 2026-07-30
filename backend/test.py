import urllib.request
import json
req = urllib.request.Request('http://localhost:8000/api/auth/token/', data=b'{"username": "mockuser", "password": "password123"}', headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access']
req2 = urllib.request.Request('http://localhost:8000/api/flights/v2/flight-instances/', headers={'Authorization': 'Bearer ' + token})
try:
    print(urllib.request.urlopen(req2).read().decode('utf-8'))
except Exception as e:
    print(e.read().decode('utf-8'))
