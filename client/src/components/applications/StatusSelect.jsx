import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { STATUS_STYLES } from '../../design/colors';

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'No Response', 'Discarded'];

/**
 * Custom colour-coded status dropdown.
 * Each option shows its status colour as a dot + tinted background on hover.
 * Works both inside forms and as an inline quick-change in tables.
 *
 * Props:
 *   value       — current status string
 *   onChange     — (newStatus: string) => void
 *   compact     — if true, renders a smaller pill-style trigger (for inline table use)
 *   disabled    — disables interaction
 */
export default function StatusSelect({ value, onChange, compact = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const current = STATUS_STYLES[value] || STATUS_STYLES.Applied;

  const handleSelect = (status) => {
    onChange(status);
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
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

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-48 bg-white rounded-xl border border-border shadow-lg
                     py-1 animate-in fade-in slide-in-from-top-1"
          role="listbox"
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
        </div>
      )}
    </div>
  );
}
