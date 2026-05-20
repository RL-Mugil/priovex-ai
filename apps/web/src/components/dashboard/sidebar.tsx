'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  FileText,
  CreditCard,
  Settings,
  Shield,
  Plus,
  Zap,
  Users,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton } from '@clerk/nextjs';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/searches', icon: Search, label: 'Searches' },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
  { href: '/dashboard/team', icon: Users, label: 'Team' },
  { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
  { href: '/dashboard/developer', icon: Code2, label: 'Developer' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function DashboardSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-200">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-slate-900 text-lg">PrioVex.AI</span>
      </div>

      {/* New Search CTA */}
      <div className="p-4">
        <Link
          href="/dashboard/search/new"
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Search
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon className={cn('w-4 h-4', isActive ? 'text-blue-600' : 'text-slate-400')} />
              {item.label}
            </Link>
          );
        })}

        {/* Admin link — shown only if isAdmin */}
        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith('/dashboard/admin')
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Shield className="w-4 h-4 text-slate-400" />
            Admin
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
