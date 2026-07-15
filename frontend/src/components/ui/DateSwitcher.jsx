import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DateSwitcher({ activeDate, onDateChange }) {
  // If activeDate is not set, default to today's date
  const todayStr = new Date().toISOString().split('T')[0];
  const current = activeDate || todayStr;

  const currentDateObj = new Date(current);

  const prevDateObj = new Date(currentDateObj);
  prevDateObj.setDate(currentDateObj.getDate() - 1);
  const prevStr = prevDateObj.toISOString().split('T')[0];

  const nextDateObj = new Date(currentDateObj);
  nextDateObj.setDate(currentDateObj.getDate() + 1);
  const nextStr = nextDateObj.toISOString().split('T')[0];

  const formatCenter = (dObj) => {
    // e.g. "15 Jul 2026"
    return dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatSide = (dObj) => {
    // e.g. "14 Jul"
    return dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginBottom: 24,
      width: '100%'
    }}>
      <style>{`
        .switcher-card {
          background: rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Plus Jakarta Sans', Inter, sans-serif;
          color: #5e5e5e;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .switcher-card:hover {
          background: rgba(255, 255, 255, 0.65);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(112, 93, 0, 0.05);
          color: #1a1c1d;
        }
        .switcher-card.active {
          background: rgba(255, 255, 255, 0.85);
          border: 2px solid #ffd700;
          color: #1a1c1d;
          font-weight: 800;
          transform: none !important;
          box-shadow: 0 4px 16px rgba(255, 215, 0, 0.15);
          cursor: default;
        }
      `}</style>

      {/* Prev Date */}
      <button
        type="button"
        className="switcher-card"
        onClick={() => onDateChange(prevStr)}
      >
        <ChevronLeft size={16} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{formatSide(prevDateObj)}</span>
      </button>

      {/* Current Date */}
      <div className="switcher-card active">
        <span style={{ fontSize: 14 }}>{formatCenter(currentDateObj)}</span>
      </div>

      {/* Next Date */}
      <button
        type="button"
        className="switcher-card"
        onClick={() => onDateChange(nextStr)}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{formatSide(nextDateObj)}</span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
