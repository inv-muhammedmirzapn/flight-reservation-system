import requests

response = requests.get('http://127.0.0.1:8000/flights/v2/seats/?flight_instance=8&page_size=2000', headers={'Authorization': 'Bearer test'})
print(response.status_code)
print(response.json())
