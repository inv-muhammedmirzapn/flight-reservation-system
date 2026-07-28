import React, { useState, useRef, useEffect, useId } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';

export function Select({
  id,
  name,
  label,
  options = [],
  value,
  onChange,
  disabled = false,
  error,
  style = {},
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const uniqueId = useId();
  const selectId = id || uniqueId;
  const selectName = name || id;

  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value)) || (value === '' ? null : normalizedOptions[0]);

  // Compute dropdown position from the trigger button's bounding rect
  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(232, normalizedOptions.length * 38 + 12);
    let top = rect.bottom + 5;
    if (top + dropdownHeight > window.innerHeight) {
      if (rect.top - dropdownHeight - 5 > 0) {
        top = rect.top - dropdownHeight - 5;
      } else {
        top = Math.max(10, window.innerHeight - dropdownHeight - 10);
      }
    }
    setDropdownStyle({
      position: 'fixed',
      top: top,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current && !containerRef.current.contains(event.target)
      ) {
        // also check the portal'd dropdown
        const portal = document.getElementById(`${selectId}-listbox`);
        if (portal && portal.contains(event.target)) return;
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, selectId]);

  // Recompute position on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync highlightedIndex with selected value when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const idx = normalizedOptions.findIndex(opt => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, options]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (val) => {
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          id: selectId,
          name: selectName,
          value: val,
        }
      });
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
            handleSelect(normalizedOptions[highlightedIndex].value);
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => (prev + 1) % normalizedOptions.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;
      default:
        break;
    }
  };

  const triggerStyle = {
    width: '100%',
    background: disabled ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.65)',
    border: error
      ? '1.5px solid #b91c1c'
      : (isFocused && !disabled ? '1.5px solid #705d00' : '1.5px solid rgba(0,0,0,0.1)'),
    borderRadius: 10,
    padding: '9px 36px 9px 13px',
    fontSize: 14,
    fontWeight: 500,
    color: disabled ? '#a09888' : '#1a1c1d',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: error
      ? '0 0 0 3px rgba(185,28,28,0.1)'
      : (isFocused && !disabled ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none'),
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    ...style,
  };

  const dropdown = isOpen && ReactDOM.createPortal(
    <ul
      id={`${selectId}-listbox`}
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined}
      style={{
        ...dropdownStyle,
        background: 'rgba(255, 255, 255, 0.97)',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
        borderRadius: 12,
        maxHeight: 220,
        overflowY: 'auto',
        padding: '6px 0',
        margin: 0,
        listStyle: 'none',
      }}
    >
      {normalizedOptions.map((opt, index) => {
        const isSelected = opt.value === value;
        const isHighlighted = index === highlightedIndex;

        let itemBackground = 'transparent';
        let itemColor = '#1a1c1d';

        if (isSelected) {
          itemBackground = 'rgba(255, 215, 0, 0.15)';
          itemColor = '#705d00';
        }
        if (isHighlighted) {
          itemBackground = 'rgba(255, 215, 0, 0.3)';
        }

        return (
          <li
            key={opt.value}
            id={`${selectId}-opt-${index}`}
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => handleSelect(opt.value)}
            style={{
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: isSelected ? 600 : 500,
              color: itemColor,
              background: itemBackground,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              userSelect: 'none',
            }}
          >
            {opt.label}
          </li>
        );
      })}
    </ul>,
    document.body
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', width: '100%' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#5e5e5e',
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!isOpen) updateDropdownPosition();
            setIsOpen(prev => !prev);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${selectId}-listbox`}
          style={triggerStyle}
          {...props}
        >
          <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
          <ChevronDown
            size={14}
            style={{
              color: disabled ? '#b0a896' : '#5e5e5e',
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              marginLeft: 8,
              flexShrink: 0,
            }}
          />
        </button>

        {dropdown}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>
      )}
    </div>
  );
}
