export function Navbar({ onSignIn, onJoin, onHome }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <button className="navbar-logo" onClick={onHome} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          AeroGlass
        </button>
        <div className="navbar-actions">
          <button onClick={onSignIn} className="navbar-link">Sign In</button>
          <button onClick={onJoin} className="navbar-cta">Join Club</button>
        </div>
      </div>
    </nav>
  );
}
