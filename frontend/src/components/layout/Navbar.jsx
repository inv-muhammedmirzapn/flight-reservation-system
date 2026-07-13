import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../store/authSlice';
import { Plane, LogOut, ShieldAlert } from 'lucide-react';

export function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, profile } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plane className="w-5 h-5 -rotate-45" />
          AeroGlass
        </Link>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              {isAdmin ? (
                <span className="navbar-badge navbar-badge-admin">
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin
                </span>
              ) : (
                <span className="navbar-badge">Customer</span>
              )}
              <span className="navbar-greeting">Hello, {profile?.username || 'User'}</span>
              <button onClick={handleLogout} className="navbar-link">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Sign In</Link>
              <Link to="/register" className="navbar-cta">Join Club</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}