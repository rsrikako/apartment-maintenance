import React from 'react';
import AppIcon from '../components/AppIcon';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: 'Flats & Residents',
    desc: 'Manage all flats, owners, and tenants in one place. Assign roles, update details, and keep your community organized.',
    icon: (
      <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h2a2 2 0 012 2v14M13 21V3a2 2 0 012-2h2a2 2 0 012 2v18M9 21h6" /></svg>
    ),
  },
  {
    title: 'Activities & Maintenance',
    desc: 'Schedule, track, and mark maintenance activities. Never miss a task and keep your apartment running smoothly.',
    icon: (
      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
    ),
  },
  {
    title: 'Financials & Payments',
    desc: 'Track dues, payments, and expenses. Transparent financial management for your community.',
    icon: (
      <svg className="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 8v8m8-8h-8" /></svg>
    ),
  },
  {
    title: 'Community Notices',
    desc: 'Send and receive important notices instantly. Keep everyone in the loop with real-time updates.',
    icon: (
      <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75" /></svg>
    ),
  },
];

const steps = [
  {
    title: 'Sign Up & Login',
    desc: 'Create your account and join your apartment community in seconds.',
  },
  {
    title: 'Add Flats & Residents',
    desc: 'Easily add flats, owners, and tenants. Assign roles and manage access.',
  },
  {
    title: 'Track Activities',
    desc: 'Schedule and monitor maintenance, events, and more.',
  },
  {
    title: 'Stay Connected',
    desc: 'Get real-time updates, notices, and manage finances with ease.',
  },
];

const testimonials = [
  {
    name: 'Priya S.',
    text: '“This app made our apartment management effortless. The reminders and notices keep everyone informed!”',
    img: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    name: 'Rahul M.',
    text: '“Tracking payments and maintenance is so easy now. Our community is more organized than ever.”',
    img: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Aparna D.',
    text: '“The best part is the transparency in finances and the beautiful, easy-to-use interface!”',
    img: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-stone-100 to-slate-200 flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center py-16 px-4 relative">
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-100 opacity-40 rounded-full blur-3xl -z-10 animate-pulse" style={{top: '-6rem', left: '-6rem'}}></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-100 opacity-40 rounded-full blur-3xl -z-10 animate-pulse" style={{bottom: '-6rem', right: '-6rem'}}></div>
        <div className="flex flex-col items-center mb-2">
          <AppIcon className="w-16 h-16 text-emerald-600 mb-2" />
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-emerald-600 mb-4 text-center drop-shadow-lg">
            Apartment Activity Management
          </h1>
        </div>
        <p className="text-xl md:text-2xl text-slate-600 mb-8 text-center font-medium max-w-2xl">
          Effortlessly manage your apartment’s flats, activities, finances, and more. Stay organized, connected, and in control with a modern, intuitive platform built for apartment communities.
        </p>
        <button
          className="mt-4 px-10 py-4 bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-xl font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-sky-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          onClick={() => navigate('/login')}
        >
          Start Using
        </button>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white bg-opacity-90">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-700 mb-10">Features</h2>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-5 bg-gradient-to-br from-slate-50 to-stone-100 rounded-2xl shadow-lg p-6 hover:scale-105 transition-transform">
              <div>{f.icon}</div>
              <div>
                <h3 className="text-xl font-semibold text-emerald-700 mb-1">{f.title}</h3>
                <p className="text-slate-600">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-slate-50 to-stone-100">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-emerald-700 mb-10">How It Works</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-400 text-white text-2xl font-bold mb-3 shadow-lg">
                {i + 1}
              </div>
              <h4 className="text-lg font-semibold text-slate-800 mb-1">{step.title}</h4>
              <p className="text-slate-600 text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 bg-white">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-700 mb-10">What Our Users Say</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-gradient-to-br from-slate-50 to-stone-100 rounded-2xl shadow-lg p-6 flex flex-col items-center">
              <img src={t.img} alt={t.name} className="w-16 h-16 rounded-full mb-3 border-4 border-emerald-100 shadow" />
              <p className="text-slate-700 italic mb-2">{t.text}</p>
              <div className="font-semibold text-emerald-700">{t.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-emerald-500 to-sky-500 flex flex-col items-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">Ready to simplify your apartment management?</h2>
        <button
          className="px-10 py-4 bg-white text-emerald-700 text-xl font-bold rounded-full shadow-lg hover:bg-emerald-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white"
          onClick={() => navigate('/login')}
        >
          Start Using
        </button>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm bg-white bg-opacity-80">
        &copy; {new Date().getFullYear()} Apartment Activity Management
      </footer>
    </div>
  );
};

export default LandingPage;
