import { useState } from 'react';
import './index.css'; // Assume basic reset/styling

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Registration successful! You can now log in.' });
        setIsLogin(true); // switch to login view
      } else {
        setMessage({ type: 'error', text: 'Registration failed: ' + JSON.stringify(data) });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message });
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Successfully logged in! Token acquired.' });
        console.log("Access Token:", data.access);
      } else {
        setMessage({ type: 'error', text: 'Login failed: ' + JSON.stringify(data) });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message });
    }
    setLoading(false);
  };

  return (
    <div className="app-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Log in to manage your flights' : 'Join our flight reservation system'}</p>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="auth-form">
          {!isLogin && (
            <div className="name-group">
              <div className="input-group">
                <label>First Name</label>
                <input 
                  type="text" 
                  name="first_name"
                  placeholder="John" 
                  value={formData.first_name} 
                  onChange={handleChange} 
                />
              </div>
              <div className="input-group">
                <label>Last Name</label>
                <input 
                  type="text" 
                  name="last_name"
                  placeholder="Doe" 
                  value={formData.last_name} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Username *</label>
            <input 
              type="text" 
              name="username"
              placeholder="johndoe123" 
              required
              value={formData.username} 
              onChange={handleChange} 
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <label>Email Address</label>
              <input 
                type="email" 
                name="email"
                placeholder="john@example.com" 
                value={formData.email} 
                onChange={handleChange} 
              />
            </div>
          )}

          <div className="input-group">
            <label>Password *</label>
            <input 
              type="password" 
              name="password"
              placeholder="••••••••" 
              required
              value={formData.password} 
              onChange={handleChange} 
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Register')}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => setIsLogin(!isLogin)} className="toggle-link">
              {isLogin ? 'Register here' : 'Log in here'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
