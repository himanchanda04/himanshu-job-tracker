import { STATUS_STYLES } from '../../design/colors';

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  const cls   = typeof style === 'object' ? style.badge : style;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                      text-xs font-semibold whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}
