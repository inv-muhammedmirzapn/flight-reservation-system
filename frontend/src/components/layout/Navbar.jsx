export function Navbar({ setIsLogin }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <span className="navbar-logo">AeroGlass</span>
        <div className="navbar-actions">
          <button onClick={() => setIsLogin(true)} className="navbar-link">Sign In</button>
          <button onClick={() => setIsLogin(false)} className="navbar-cta">Join Club</button>
        </div>
      </div>
    </nav>
  );
}
