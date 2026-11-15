import React from 'react';
import { AnimatedMenu } from '../../ui/AnimatedMenu';

interface MenuPanelProps {
  width?: string;
  onClose: () => void;
  origin?: 'tl' | 'tr';
  children: React.ReactNode;
}

/** Dropdown shell shared by every top-bar menu. */
export const MenuPanel: React.FC<MenuPanelProps> = ({
  width = 'w-56',
  onClose,
  origin = 'tl',
  children,
}) => (
  <AnimatedMenu
    open
    onClose={onClose}
    origin={origin}
    widthClass={width}
    // Keep open while moving across the gap into the panel; click-outside closes.
    closeOnLeave={false}
    className="top-full left-0 mt-1 z-[100]"
  >
    {children}
  </AnimatedMenu>
);
