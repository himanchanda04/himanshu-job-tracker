import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Trash2, Settings,
  Menu, X, Briefcase, Download, LogOut, User,
} from 'lucide-react';
import { exportExcel } from '../../api/applications';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/applications', icon: FileText,        label: 'Applications' },
  { to: '/discarded',    icon: Trash2,          label: 'Discarded'    },
  { to: '/settings',     icon: Settings,        label: 'Settings'     },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
         ${isActive ? 'bg-teal text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const close = () => setOpen(false);

  const sidebarContent = (onNavClick) => (
    <>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavClick} />
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => exportExcel()}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm
                     text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Download size={18} />
          Export All to Excel
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm
                     text-white/70 hover:bg-white/10 hover:text-rose-300 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-bg font-sans overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-navy text-white shrink-0">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <Briefcase className="text-teal shrink-0" size={24} />
          <div className="leading-tight min-w-0">
            <p className="font-bold text-sm truncate">{user?.name || 'User'}</p>
            <p className="text-teal text-xs font-normal">Job Tracker</p>
          </div>
        </div>
        {sidebarContent(undefined)}
      </aside>

      {/* ── Mobile overlay ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-navy text-white
                    transform transition-transform duration-200 lg:hidden
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Briefcase className="text-teal" size={22} />
            <span className="font-bold text-sm">Job Tracker</span>
          </div>
          <button onClick={close} aria-label="Close menu">
            <X size={20} className="text-white/70" />
          </button>
        </div>
        {sidebarContent(close)}
      </aside>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-navy text-white sticky top-0 z-30 shrink-0">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-sm">{user?.name}'s Job Tracker</span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
