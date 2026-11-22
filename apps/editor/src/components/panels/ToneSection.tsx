import React, { useState } from 'react';
import { ChevronDown } from 'pulsoicon-react';

interface ToneSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Collapsible section for Tone panel — keeps long adjustment lists scannable. */
export const ToneSection: React.FC<ToneSectionProps> = ({
  id,
  title,
  icon,
  badge,
  defaultOpen = true,
  actions,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `tone-section-${id}`;

  return (
    <section className={`tone-section${open ? ' is-open' : ''}`}>
      <div className="tone-section__head">
        <button
          type="button"
          className="tone-section__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={14} className="tone-section__chevron" aria-hidden />
          {icon}
          <span className="tone-section__title font-display">{title}</span>
          {badge ? <span className="px-chip text-[var(--text-faint)]">{badge}</span> : null}
        </button>
        {actions ? <div className="tone-section__actions">{actions}</div> : null}
      </div>
      {open ? (
        <div id={panelId} className="tone-section__body">
          {children}
        </div>
      ) : null}
    </section>
  );
};
