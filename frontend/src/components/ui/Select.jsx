import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
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
  placeholder = 'Select...',
  style = {},
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const uniqueId = useId();
  const selectId = id || uniqueId;
  const selectName = name || id;

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find(opt => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Options filtered by user typing in the main input
  const filteredOptions = useMemo(() => {
    if (!isOpen || !searchQuery.trim()) return normalizedOptions;
    const term = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(opt =>
      String(opt.label).toLowerCase().includes(term) ||
      String(opt.value).toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchQuery, isOpen]);

  // Compute position of dropdown below input bar
  const updateDropdownPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(240, filteredOptions.length * 38 + 10);
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        const listbox = document.getElementById(`${selectId}-listbox`);
        if (listbox && listbox.contains(event.target)) return;
        setIsOpen(false);
        setSearchQuery('');
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
  }, [isOpen, filteredOptions.length]);

  const handleSelect = (val) => {
    if (disabled) return;
    setIsOpen(false);
    setSearchQuery('');
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

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (!isOpen) {
      updateDropdownPosition();
      setIsOpen(true);
      setSearchQuery('');
      const idx = normalizedOptions.findIndex(opt => String(opt.value) === String(value));
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        if (isOpen) {
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightedIndex].value);
          }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          updateDropdownPosition();
        } else if (filteredOptions.length > 0) {
          setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          updateDropdownPosition();
        } else if (filteredOptions.length > 0) {
          setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
        }
        break;
      default:
        break;
    }
  };

  // What text is displayed inside the input element
  const displayValue = isOpen ? searchQuery : (selectedOption ? selectedOption.label : '');

  const inputStyle = {
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
    cursor: disabled ? 'not-allowed' : 'text',
    boxShadow: error
      ? '0 0 0 3px rgba(185,28,28,0.1)'
      : (isFocused && !disabled ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none'),
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    boxSizing: 'border-box',
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
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)',
        borderRadius: 12,
        maxHeight: 230,
        overflowY: 'auto',
        padding: '4px 0',
        margin: 0,
        listStyle: 'none',
      }}
    >
      {filteredOptions.length === 0 ? (
        <li style={{ padding: '12px 14px', fontSize: 13, color: '#888', textAlign: 'center' }}>
          No matching options
        </li>
      ) : (
        filteredOptions.map((opt, index) => {
          const isSelected = String(opt.value) === String(value);
          const isHighlighted = index === highlightedIndex;

          let itemBackground = 'transparent';
          let itemColor = '#1a1c1d';

          if (isSelected) {
            itemBackground = 'rgba(255, 215, 0, 0.18)';
            itemColor = '#705d00';
          }
          if (isHighlighted) {
            itemBackground = 'rgba(255, 215, 0, 0.35)';
          }

          return (
            <li
              key={opt.value}
              id={`${selectId}-opt-${index}`}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt.value);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                padding: '9px 14px',
                fontSize: 13.5,
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
        })
      )}
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
        <input
          ref={inputRef}
          id={selectId}
          type="text"
          disabled={disabled}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${selectId}-listbox`}
          style={inputStyle}
          autoComplete="off"
          {...props}
        />
        <ChevronDown
          size={14}
          onClick={() => {
            if (!disabled) {
              if (isOpen) {
                setIsOpen(false);
              } else {
                inputRef.current?.focus();
              }
            }
          }}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
            color: disabled ? '#b0a896' : '#5e5e5e',
            transition: 'transform 0.2s',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        />

        {dropdown}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>
      )}
    </div>
  );
}
