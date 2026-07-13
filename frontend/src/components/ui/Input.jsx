export function Input({ id, label, type = "text", error, ...props }) {
  return (
    <div className="field-group">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <input className="field-input" id={id} name={id} type={type} {...props} />
      {error && <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}
