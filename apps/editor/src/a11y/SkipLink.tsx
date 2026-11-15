import React from 'react';

type SkipLinkProps = {
  href: string;
  children: React.ReactNode;
};

/** Visually hidden until focused — first tab stop for keyboard / SR users. */
export const SkipLink: React.FC<SkipLinkProps> = ({ href, children }) => (
  <a href={href} className="skip-link">
    {children}
  </a>
);
