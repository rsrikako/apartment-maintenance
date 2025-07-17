import { useAuth } from './context/AuthContext';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Profile from './pages/Profile';
import { getUserRoleByPhone } from './services/firestoreUsers';
// import UserManagement from './pages/UserManagement';
import DummyLogout from './pages/DummyLogout';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Flats from './pages/Flats';
import Financials from './pages/Financials';
import ApartmentActivities from './pages/Activities';

function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[APP] Auth user:', user);
    console.log('[APP] Auth loading:', loading);
    if (!loading) {
      if (user && user.phoneNumber) {
        setRoleLoading(true);
        setRoleError(null);
        console.log('[APP] Looking up Firestore user for phone:', user.phoneNumber);
        // Add a timeout for Firestore lookup
        let didTimeout = false;
        const timeoutId = setTimeout(() => {
          didTimeout = true;
          setRoleLoading(false);
          setRoleError('Timed out while fetching user role from Firestore. Please try again or contact admin.');
        }, 7000); // 7 seconds
        getUserRoleByPhone(user.phoneNumber).then(userDoc => {
          clearTimeout(timeoutId);
          if (didTimeout) return;
          console.log('[APP] Firestore userDoc:', userDoc);
          setRole(userDoc?.role || null);
          setRoleLoading(false);
          // Only redirect to /profile if currently at root
          if (userDoc?.role && window.location.pathname === '/') {
            navigate('/profile');
          }
          else if (!userDoc?.role) {
            setRoleError(`No user found in Firestore for phone: ${user.phoneNumber}`);
          }
        }).catch(() => {
          clearTimeout(timeoutId);
          if (didTimeout) return;
          setRoleLoading(false);
          setRoleError('Error fetching user role from Firestore.');
        });
      } else {
        setRole(null);
      }
    }
  }, [user, loading, navigate]);

  if (window.location.pathname === '/dummy-logout') {
    return <DummyLogout />;
  }

  // Hide Navbar on login page
  const hideNavbar = window.location.pathname === '/';

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/flats" element={<Flats />} />
        <Route path="/financials" element={<Financials />} />
        <Route path="/activities" element={<ApartmentActivities />} />
        <Route path="/profile" element={
          loading || roleLoading ? (
            <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>
          ) : roleError ? (
            <div className="flex items-center justify-center min-h-screen text-red-500 text-lg">{roleError}</div>
          ) : role ? (
            <Profile role={role} />
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
