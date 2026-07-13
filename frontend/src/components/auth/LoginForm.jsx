import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../../store/authSlice';
import { Input } from '../ui/Input';
import { AlertCircle } from 'lucide-react';

export function LoginForm() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      setLocalError('Please enter both username and password.');
      return;
    }
    dispatch(loginUser(formData));
  };

  return (
    <>
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface">Welcome Back</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Sign in to continue your journey.</p>
      </div>

      {(localError || error) && (
        <div className="p-4 rounded-xl text-xs font-bold border bg-rose-50 border-rose-200 text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{localError || error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="username" label="Username" required value={formData.username} onChange={handleChange} />
        <Input id="password" label="Password" type="password" required value={formData.password} onChange={handleChange} />

        <button 
          disabled={loading} 
          className="w-full bg-primary-container text-on-surface font-bold py-3 rounded-xl mt-4 hover:bg-[#ffe140] transition-colors duration-300 shadow-[0px_8px_16px_rgba(255,215,0,0.2)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer" 
          type="submit"
        >
          {loading ? 'Processing...' : 'Sign In'}
        </button>
      </form>
    </>
  );
}
