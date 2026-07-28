fetch('http://127.0.0.1:8000/api/auth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' })
})
.then(res => res.json())
.then(data => {
  const token = data.access;
  fetch('http://127.0.0.1:8000/api/flights/v2/flight-instances/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      flight: 1,
      date: "2026-07-29",
      aircraft: 1,
      status: "Scheduled",
      scheduled_departure: "2026-07-29T12:00:00+05:30",
      scheduled_arrival: "2026-07-30T12:00:00+05:30",
      boarding_gate: "G12",
      departure_terminal: "Terminal 2",
      arrival_terminal: "Terminal 3"
    })
  })
  .then(res => res.text())
  .then(text => console.log(text.substring(0, 1000))); // print first 1000 chars of HTML
});
