import { useAuth } from './context/AuthContext';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Profile from './pages/Profile';
import DummyLogout from './pages/DummyLogout';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Flats from './pages/Flats';
import Financials from './pages/Financials';
import ApartmentActivities from './pages/Activities';
import LandingPage from './pages/LandingPage';

function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showA2HS, setShowA2HS] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowA2HS(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (user && user.phoneNumber) {
        // Only redirect to /profile if currently at root
        if (window.location.pathname === '/' || window.location.pathname === '/login') {
          navigate('/profile');
        }
      }
    }
  }, [user, loading, navigate]);

  if (window.location.pathname === '/dummy-logout') {
    return <DummyLogout />;
  }

  // Hide Navbar on landing page
  const hideNavbar = window.location.pathname === '/' || window.location.pathname === '/login';

  return (
    <>
      {!hideNavbar && <Navbar />}
      {showA2HS && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full flex flex-col items-center">
            <div className="text-lg font-bold text-emerald-600 mb-2">Install App</div>
            <div className="text-sm text-gray-700 mb-4 text-center">
              For best experience, add this app to your home screen.
            </div>
            <button
              className="px-4 py-2 bg-emerald-600 text-white rounded font-semibold"
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  await deferredPrompt.userChoice;
                  setShowA2HS(false);
                  setDeferredPrompt(null);
                }
              }}
            >Add to Home Screen</button>
            <button className="mt-2 px-3 py-2 bg-gray-300 text-gray-800 rounded" onClick={() => setShowA2HS(false)}>Close</button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/flats" element={<Flats />} />
        <Route path="/financials" element={<Financials />} />
        <Route path="/activities" element={<ApartmentActivities />} />
        <Route path="/profile" element={
          loading ? (
            <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>
          ) : user ? (
            <Profile />
          ) : (
            <Login />
          )
        } />
        <Route path="/dummy-logout" element={<DummyLogout />} />
      </Routes>
    </>
  );
}

export default App;
