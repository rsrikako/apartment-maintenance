import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/flats', label: 'Flats' },
  { to: '/financials', label: 'Financials' },
  { to: '/profile', label: 'Profile' },
];

const Navbar: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 text-gray-800 px-4 py-2 flex items-center justify-between shadow-sm relative z-30">
      <div className="flex items-center gap-2">
        <span className="bg-blue-100 rounded-full p-2">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
          </svg>
        </span>
        <span className="font-extrabold text-xl tracking-tight">Apartment Manager</span>
      </div>
      <button
        className="md:hidden flex items-center px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className={`flex-col md:flex md:flex-row md:items-center md:static absolute top-full left-0 w-full md:w-auto bg-white md:bg-transparent z-20 transition-all duration-200 ${open ? 'flex' : 'hidden'}`}>
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`block px-4 py-2 md:py-0 md:px-4 rounded md:rounded-none hover:bg-blue-50 transition-all ${location.pathname.startsWith(item.to) ? 'bg-blue-100 font-bold text-blue-700' : ''}`}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
