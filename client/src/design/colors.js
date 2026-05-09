// ─── Single source of truth for all colours in the app ───────────────────────
// To change the app's look: edit this file only.
// Tailwind config and component classes reference these values.

export const BRAND = {
  navy:       '#1E3A5F',   // primary — sidebar, headers, nav, primary buttons
  teal:       '#00BFA5',   // accent  — active states, CTA buttons, links
  amber:      '#F59E0B',   // warning — no-response status
  emerald:    '#10B981',   // success — interview status
  rose:       '#F43F5E',   // danger  — rejected / delete actions
  slateBackground: '#F1F5F9', // page background
  card:       '#FFFFFF',   // card surface
  border:     '#E2E8F0',   // dividers and input borders
  muted:      '#64748B',   // secondary text, placeholder icons
};

// Tailwind classes + hex used by StatusBadge and charts
export const STATUS_STYLES = {
  Applied:       { badge: 'bg-blue-100 text-blue-700',     hex: '#3B82F6' },
  Interview:     { badge: 'bg-emerald-100 text-emerald-700', hex: '#10B981' },
  Offer:         { badge: 'bg-teal-100 text-teal-700',     hex: '#00BFA5' },
  Rejected:      { badge: 'bg-rose-100 text-rose-700',     hex: '#F43F5E' },
  'No Response': { badge: 'bg-amber-100 text-amber-700',   hex: '#F59E0B' },
  Discarded:     { badge: 'bg-slate-100 text-slate-500',   hex: '#94A3B8' },
};

// ARGB hex values used by ExcelJS for row fill colours (server/routes/export.js)
export const EXCEL_STATUS_COLORS = {
  Applied:       'FFBFDBFE',
  Interview:     'FFD1FAE5',
  Offer:         'FFCCFBF1',
  Rejected:      'FFFECDD3',
  'No Response': 'FFFEF3C7',
  Discarded:     'FFF1F5F9',
};

// KPI stat card icon background colours (Tailwind class strings)
export const STAT_CARD_COLORS = {
  total:       'bg-navy',
  interview:   'bg-emerald-500',
  offer:       'bg-teal',
  rejected:    'bg-rose-500',
  no_response: 'bg-amber-400',
  discarded:   'bg-slate-400',
};
