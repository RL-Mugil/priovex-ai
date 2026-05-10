'use client';

import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-3 bg-white border rounded-xl p-4 shadow-lg',
            toast.variant === 'destructive' ? 'border-red-200 bg-red-50' : 'border-slate-200'
          )}
        >
          <div className="flex-1">
            {toast.title && (
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            )}
            {toast.description && (
              <p className="text-sm text-slate-600 mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
