import React from 'react';

export interface PanelEmptyAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  icon?: React.ReactNode;
}

interface PanelEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional feature chips shown even when empty (teaches the panel). */
  features?: string[];
  actions?: PanelEmptyAction[];
  children?: React.ReactNode;
}

/** Shared empty state for inspector panels — CTA-first, darkroom chrome. */
export const PanelEmptyState: React.FC<PanelEmptyStateProps> = ({
  icon,
  title,
  description,
  features,
  actions,
  children,
}) => (
  <div className="panel-empty">
    <div className="panel-empty__mark" aria-hidden>
      {icon}
    </div>
    <h3 className="panel-empty__title font-display">{title}</h3>
    <p className="panel-empty__desc">{description}</p>
    {features && features.length > 0 && (
      <ul className="panel-empty__features" aria-label="Available tools">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    )}
    {actions && actions.length > 0 && (
      <div className="panel-empty__actions">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className={
              a.primary
                ? 'panel-empty__btn panel-empty__btn--primary'
                : 'panel-empty__btn panel-empty__btn--ghost'
            }
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    )}
    {children}
  </div>
);
