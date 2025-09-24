import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type RowActionItem = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
};

/**
 * Minimal three-dots row menu that matches the existing subtle, soft UI.
 */
const RowActionsMenu: React.FC<{ items: RowActionItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Mais ações"
        style={{
          padding: '0.5rem',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          color: '#64748b'
        }}
      >
        <MoreHorizontal style={{ width: '1rem', height: '1rem' }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            minWidth: '180px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px -8px rgba(0,0,0,0.15)',
            padding: '0.25rem',
            zIndex: 30
          }}
        >
          {items.map((it, idx) => (
            <button
              key={idx}
              role="menuitem"
              disabled={it.disabled}
              title={it.title || it.label}
              onClick={() => { setOpen(false); it.onClick(); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textAlign: 'left',
                padding: '0.5rem 0.625rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                color: it.disabled ? '#94a3b8' : '#334155'
              }}
              onMouseEnter={(e) => {
                if (!it.disabled) (e.currentTarget.style.backgroundColor = '#f8fafc');
              }}
              onMouseLeave={(e) => {
                if (!it.disabled) (e.currentTarget.style.backgroundColor = 'transparent');
              }}
            >
              {it.icon}
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RowActionsMenu;
