import React, { useEffect, useRef } from 'react';

export type MenuOrigin = 'tl' | 'tr' | 'left' | 'bl' | 'br';

interface AnimatedMenuProps {
  open: boolean;
  onClose?: () => void;
  /** Close when pointer leaves the panel (desktop menus). */
  closeOnLeave?: boolean;
  origin?: MenuOrigin;
  widthClass?: string;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
  children: React.ReactNode;
}

const ORIGIN_CLASS: Record<MenuOrigin, string> = {
  tl: 'menu-flyout--tl',
  tr: 'menu-flyout--tr',
  left: 'menu-flyout--left',
  bl: 'menu-flyout--bl',
  br: 'menu-flyout--br',
};

/** Polished animated dropdown / flyout used across the editor chrome. */
export const AnimatedMenu: React.FC<AnimatedMenuProps> = ({
  open,
  onClose,
  closeOnLeave = true,
  origin = 'tl',
  widthClass = 'w-56',
  className = '',
  style,
  role = 'menu',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onPointer = (e: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        // Allow trigger buttons that live as siblings — close only on outside chrome
        const root = el.parentElement;
        if (root && e.target instanceof Node && root.contains(e.target)) return;
        onClose();
      }
    };
    // Defer so the opening click doesn't immediately close
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role={role}
      style={style}
      className={`menu-flyout menu-flyout--stagger ${ORIGIN_CLASS[origin]} ${widthClass} ${className}`}
      onMouseLeave={closeOnLeave ? onClose : undefined}
    >
      <div className="menu-flyout-sheen" aria-hidden />
      {children}
    </div>
  );
};

interface MenuItemProps {
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
  active?: boolean;
  children: React.ReactNode;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  onClick,
  disabled,
  danger,
  hint,
  active,
  children,
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    className={`menu-item ${danger ? 'menu-item--danger' : ''} ${active ? 'menu-item--active' : ''}`}
  >
    <span className="menu-item-label">{children}</span>
    {hint ? <span className="menu-item-hint">{hint}</span> : null}
  </button>
);

export const MenuSep: React.FC = () => <div className="menu-sep" role="separator" />;

export const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="menu-label">{children}</div>
);
