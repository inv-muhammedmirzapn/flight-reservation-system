import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, ChevronDown } from 'lucide-react';

export default function PassengerSelector({
  label,
  adults,
  setAdults,
  childrenCount,
  setChildrenCount,
  infants,
  setInfants,
  variant,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const isTransparent = variant === 'transparent';

  // Close popup on click outside or scroll
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        // We also need to check if click is inside the portal, but for simplicity we can check if it's a passenger button
        if (!event.target.closest('.passenger-dropdown-panel')) {
          setIsOpen(false);
        }
      }
    }
    
    function handleScroll(event) {
      if (isOpen && !event.target.closest('.passenger-dropdown-panel')) {
         setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  // Format the input display value
  const getSummary = () => {
    const aVal = Number(adults) || 1;
    const cVal = Number(childrenCount) || 0;
    const iVal = Number(infants) || 0;

    const aText = aVal >= 10 ? '9+ Adults' : `${aVal} Adult${aVal > 1 ? 's' : ''}`;
    const cText = cVal === 0 ? '' : cVal >= 7 ? '6+ Children' : `${cVal} Child${cVal > 1 ? 'ren' : ''}`;
    const iText = iVal === 0 ? '' : iVal >= 7 ? '6+ Infants' : `${iVal} Infant${iVal > 1 ? 's' : ''}`;

    return [aText, cText, iText].filter(Boolean).join(', ');
  };

  const adultOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const childOptions = [0, 1, 2, 3, 4, 5, 6, 7];
  const infantOptions = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div ref={containerRef} className={`passenger-selector-container ${className}`} style={{ position: 'relative', width: '100%' }}>
      {label && !isTransparent && (
        <label style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 800,
          color: '#5e5e5e',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={getSummary()}
          readOnly
          onClick={toggleOpen}
          style={{
            width: '100%',
            padding: isTransparent ? '0 24px 0 0' : '12px 36px 12px 14px',
            background: isTransparent ? 'transparent' : 'rgba(255, 255, 255, 0.45)',
            border: isTransparent ? 'none' : '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: isTransparent ? 0 : 12,
            outline: 'none',
            fontSize: isTransparent ? '0.9375rem' : 14,
            fontWeight: 600,
            color: '#1a1c1d',
            cursor: 'pointer',
            backdropFilter: isTransparent ? 'none' : 'blur(8px)',
            WebkitBackdropFilter: isTransparent ? 'none' : 'blur(8px)',
            transition: 'all 0.2s',
            fontFamily: isTransparent ? 'Inter, sans-serif' : 'inherit',
          }}
          className="passenger-input-trigger"
        />
        <ChevronDown
          size={16}
          style={{
            position: 'absolute',
            right: isTransparent ? 0 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9e9488',
            pointerEvents: 'none',
          }}
        />
      </div>

      {isOpen && dropdownRect && createPortal(
        <div
          className="glass-card passenger-dropdown-panel"
          style={{
            position: 'absolute',
            top: dropdownRect.bottom + 8 + window.scrollY,
            left: dropdownRect.left + window.scrollX,
            zIndex: 99999,
            width: isTransparent ? 440 : Math.max(320, dropdownRect.width),
            padding: '24px',
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* ADULTS */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.02em' }}>ADULTS (12y +)</span>
              <span style={{ fontSize: 11, color: '#9e9488', marginTop: 1 }}>on the day of travel</span>
            </div>
            <div style={{
              display: 'flex',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              overflow: 'hidden',
              padding: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              {adultOptions.map(val => {
                const isSelected = adults === val;
                return (
                  <button
                    key={`adult-${val}`}
                    type="button"
                    onClick={() => setAdults(val)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: isSelected ? '#0084ff' : 'transparent',
                      color: isSelected ? '#ffffff' : '#4a5568',
                      fontWeight: 700,
                      fontSize: 13,
                      padding: '10px 0',
                      cursor: 'pointer',
                      borderRadius: 10,
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    {val === 10 ? '>9' : val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHILDREN & INFANTS in two-column row if wide enough, else stack */}
          <div style={{ display: 'flex', flexDirection: isTransparent ? 'row' : 'column', gap: 24 }}>
            {/* CHILDREN */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.02em' }}>CHILDREN (2y - 12y)</span>
                <span style={{ fontSize: 11, color: '#9e9488', marginTop: 1 }}>on the day of travel</span>
              </div>
              <div style={{
                display: 'flex',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                overflow: 'hidden',
                padding: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                {childOptions.map(val => {
                  const isSelected = childrenCount === val;
                  return (
                    <button
                      key={`child-${val}`}
                      type="button"
                      onClick={() => setChildrenCount(val)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: isSelected ? '#0084ff' : 'transparent',
                        color: isSelected ? '#ffffff' : '#4a5568',
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '10px 0',
                        cursor: 'pointer',
                        borderRadius: 10,
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      {val === 7 ? '>6' : val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* INFANTS */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.02em' }}>INFANTS (below 2y)</span>
                <span style={{ fontSize: 11, color: '#9e9488', marginTop: 1 }}>on the day of travel</span>
              </div>
              <div style={{
                display: 'flex',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                overflow: 'hidden',
                padding: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                {infantOptions.map(val => {
                  const isSelected = infants === val;
                  return (
                    <button
                      key={`infant-${val}`}
                      type="button"
                      onClick={() => setInfants(val)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: isSelected ? '#0084ff' : 'transparent',
                        color: isSelected ? '#ffffff' : '#4a5568',
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '10px 0',
                        cursor: 'pointer',
                        borderRadius: 10,
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      {val === 7 ? '>6' : val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
