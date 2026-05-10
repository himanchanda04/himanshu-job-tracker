import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { STATUS_STYLES } from '../../design/colors';

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'No Response', 'Discarded'];

export default function StatusSelect({ value, onChange, compact = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280;
    setPos({
      top: openUp ? rect.top + window.scrollY : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleScroll = () => setOpen(false);

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) updatePosition();
    setOpen(!open);
  };

  const handleSelect = (status) => {
    onChange(status);
    setOpen(false);
  };

  const current = STATUS_STYLES[value] || STATUS_STYLES.Applied;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={
          compact
            ? `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
               cursor-pointer transition-all hover:shadow-md disabled:opacity-50 ${current.badge}`
            : `w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border
               text-sm bg-white cursor-pointer transition-all hover:border-teal
               focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-50`
        }
      >
        <span className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: current.hex }}
          />
          {value}
        </span>
        <ChevronDown
          size={compact ? 12 : 16}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          className="fixed z-[9999] w-48 bg-white rounded-xl border border-border shadow-lg py-1"
          style={{
            top: pos.openUp ? undefined : pos.top - window.scrollY,
            bottom: pos.openUp ? window.innerHeight - (pos.top - window.scrollY) + 4 : undefined,
            left: pos.left - window.scrollX,
          }}
        >
          {STATUSES.map((status) => {
            const style = STATUS_STYLES[status];
            const isActive = status === value;
            return (
              <button
                key={status}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(status)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                           transition-colors cursor-pointer
                           ${isActive ? style.badge : 'hover:bg-slate-bg text-gray-700'}`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                  style={{ backgroundColor: style.hex }}
                />
                <span className="font-medium">{status}</span>
                {isActive && (
                  <span className="ml-auto text-xs opacity-60">current</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
