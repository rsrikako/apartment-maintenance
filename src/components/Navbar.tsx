import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" /></svg>
    ),
  },
  {
    to: '/flats',
    label: 'Flats',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 10V6a2 2 0 012-2h2a2 2 0 012 2v4m0 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm6 0h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4zm0 0V6a2 2 0 012-2h2a2 2 0 012 2v4" /></svg>
    ),
  },
  {
    to: '/activities',
    label: 'Activities',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" /></svg>
    ),
  },
  {
    to: '/financials',
    label: 'Financials',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 8v8m8-8a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1112 21a9 9 0 01-6.879-3.196zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    ),
  },
];

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <>
      {/* Top Navbar for desktop */}
      <nav className="bg-white border-b border-gray-200 text-gray-800 px-4 py-2 items-center justify-between shadow-sm relative z-30 hidden md:flex">
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 rounded-full p-2">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
            </svg>
          </span>
          <span className="font-extrabold text-xl tracking-tight">Apartment Manager</span>
        </div>
        <div className="flex flex-row items-center gap-2">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-4 py-2 rounded hover:bg-blue-50 transition-all ${location.pathname.startsWith(item.to) ? 'bg-blue-100 font-bold text-blue-700' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Navbar for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow md:hidden flex justify-around items-center h-16">
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${location.pathname.startsWith(item.to) ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            {item.icon}
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
