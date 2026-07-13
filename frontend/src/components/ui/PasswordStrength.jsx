export function getPasswordRules(password) {
  return [
    { label: 'At least 8 characters',           pass: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)',        pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)',        pass: /[a-z]/.test(password) },
    { label: 'One number (0-9)',                  pass: /[0-9]/.test(password) },
    { label: 'One special character (!@#$…)',     pass: /[!@#$%^&*()\,.?":{}|<>]/.test(password) },
  ];
}

const LEVELS = [
  { label: 'Very weak', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Weak',      color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Fair',      color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { label: 'Good',      color: '#eab308', bg: '#fefce8', border: '#fde68a' },
  { label: 'Strong',    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'Strong',    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
];

export function PasswordStrength({ password }) {
  if (!password) return null;

  const rules = getPasswordRules(password);
  const passed = rules.filter(r => r.pass).length;
  const { label, color, bg, border } = LEVELS[passed];

  return (
    <div className="pw-strength" style={{ background: bg, borderColor: border }}>
      {/* Bar */}
      <div className="pw-bar-row">
        <div className="pw-bars">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="pw-bar" style={{ background: i <= passed ? color : '#e5e7eb' }} />
          ))}
        </div>
        <span className="pw-label" style={{ color }}>{label}</span>
      </div>

      {/* Rules */}
      <div className="pw-rules">
        {rules.map(rule => (
          <div key={rule.label} className="pw-rule">
            <div className="pw-rule-dot" style={{ background: rule.pass ? '#22c55e' : '#e5e7eb' }}>
              {rule.pass ? (
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af' }} />
              )}
            </div>
            <span style={{ color: rule.pass ? '#15803d' : '#6b7280' }}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
