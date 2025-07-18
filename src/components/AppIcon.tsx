import React from 'react';

const AppIcon: React.FC<{ className?: string }> = ({ className = "w-7 h-7 text-blue-600" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
  </svg>
);

export default AppIcon;
