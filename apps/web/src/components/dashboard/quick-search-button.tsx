import Link from 'next/link';
import { Plus } from 'lucide-react';

export function QuickSearchButton() {
  return (
    <Link
      href="/dashboard/search/new"
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
    >
      <Plus className="w-4 h-4" />
      New Search
    </Link>
  );
}
