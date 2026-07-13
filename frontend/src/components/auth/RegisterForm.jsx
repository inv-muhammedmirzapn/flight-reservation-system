import { useState } from 'react';
import { authAPI } from '../../services/api';
import { Input } from '../ui/Input';

export function RegisterForm({ onSuccess }) {
  const [formData, setFormData] = useState({ username: '', password: '', email: '', first_name: '', last_name: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await authAPI.register(formData);
      onSuccess();
    } catch (err) {
      setMessage({ type: 'error', text: 'Registration failed: ' + err.message });
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface">Create Account</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Join AeroGlass for an elevated travel experience.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-body-md border ${message.type === 'error' ? 'bg-error-container text-on-error-container border-[#ffb4ab]' : 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="w-1/2"><Input id="first_name" label="First Name" required value={formData.first_name} onChange={handleChange} /></div>
          <div className="w-1/2"><Input id="last_name" label="Last Name" required value={formData.last_name} onChange={handleChange} /></div>
        </div>
        <Input id="email" label="Email Address" type="email" required value={formData.email} onChange={handleChange} />
        <Input id="username" label="Username" required value={formData.username} onChange={handleChange} />
        <Input id="password" label="Password" type="password" required value={formData.password} onChange={handleChange} />

        <button disabled={loading} className="w-full bg-primary-container text-on-surface font-bold py-3 rounded-xl mt-4 hover:bg-[#ffe140] transition-colors duration-300 shadow-[0px_8px_16px_rgba(255,215,0,0.2)] active:scale-95 flex items-center justify-center gap-2" type="submit">
          {loading ? 'Processing...' : 'Create Account'}
        </button>
      </form>
    </>
  );
}
