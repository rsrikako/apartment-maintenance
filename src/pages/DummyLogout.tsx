import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

const DummyLogout: React.FC = () => {
  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow flex flex-col items-center pb-24">
        <h2 className="text-xl font-bold mb-4">Dummy Logout Page</h2>
        <button onClick={handleLogout} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Logout</button>
      </div>
    </div>
  );
};

export default DummyLogout;
