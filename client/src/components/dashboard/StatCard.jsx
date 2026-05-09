export default function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-card flex items-start gap-4
                    hover:shadow-card-hover transition-shadow duration-200">
      <div className={`p-3 rounded-lg shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
        <p className="text-sm text-muted mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </div>
    </div>
  );
}
