import { useAuth } from './context/AuthContext';
import { useEffect } from 'react';
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
