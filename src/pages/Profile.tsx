import React from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

const Profile: React.FC<{ role: string }> = ({ role }) => {
  const { user } = useAuth();
  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 md:p-10 flex flex-col items-center">
        <h2 className="text-2xl font-bold text-blue-700 mb-2 text-center">Profile</h2>
        <div className="mb-4 text-center">
          <div className="text-lg font-semibold">Mobile: {user?.phoneNumber}</div>
          <div className="text-md text-gray-600">Role: <span className="capitalize">{role}</span></div>
        </div>
        <button onClick={handleLogout} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Logout</button>
        <div className="mt-6 text-gray-400 text-xs text-center">
          &copy; {new Date().getFullYear()} Apartment Activity Management
        </div>
      </div>
    </div>
  );
};

export default Profile;
