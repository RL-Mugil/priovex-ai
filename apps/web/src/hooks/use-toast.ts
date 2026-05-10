'use client';

import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(options: Omit<Toast, 'id'> & { duration?: number }) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, ...options }];
  notify();

  if (options.duration !== 0) {
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      notify();
    }, options.duration ?? 4000);
  }
}

export function useToast() {
  const [state, setState] = useState<Toast[]>(toasts);

  const subscribe = useCallback((cb: (t: Toast[]) => void) => {
    listeners.push(cb);
    return () => { listeners = listeners.filter((l) => l !== cb); };
  }, []);

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  useState(() => {
    const unsub = subscribe(setState);
    return unsub;
  });

  return { toasts: state, dismiss };
}
