import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

interface Apartment {
  id: string;
  name: string;
  address: string;
  admins: string[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    async function fetchApartments() {
      setLoading(true);
      setError('');
      try {
        if (!user) return;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (!userData || !userData.apartments) {
          setApartments([]);
          setLoading(false);
          return;
        }
        const apartmentIds = userData.apartments;
        const apartmentSnaps = await Promise.all(
          apartmentIds.map((id: string) => getDoc(doc(db, 'apartments', id)))
        );
        setApartments(
          apartmentSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() } as Apartment))
        );
      } catch (err) {
        setError('Failed to load apartments.');
      } finally {
        setLoading(false);
      }
    }
    fetchApartments();
  }, [user]);

  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      if (!user) throw new Error('Not logged in');
      if (!newName.trim() || !newAddress.trim()) throw new Error('Name and address required');
      // Create new apartment doc
      const aptRef = doc(collection(db, 'apartments'));
      await setDoc(aptRef, {
        name: newName,
        address: newAddress,
        admins: [user.uid],
      });
      // Add apartment to user
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        apartments: arrayUnion(aptRef.id),
        defaultApartment: aptRef.id,
      });
      setNewName('');
      setNewAddress('');
      // Refresh apartments
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      if (userData && userData.apartments) {
        const apartmentIds = userData.apartments;
        const apartmentSnaps = await Promise.all(
          apartmentIds.map((id: string) => getDoc(doc(db, 'apartments', id)))
        );
        setApartments(
          apartmentSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() } as Apartment))
        );
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create apartment.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Apartments</h1>
      <form onSubmit={handleCreateApartment} className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col md:flex-row md:items-end gap-3 shadow-sm">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Apartment Name</label>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Address</label>
          <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300" required />
        </div>
        <button type="submit" disabled={creating} className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-all disabled:opacity-60 mt-2 md:mt-0">
          {creating ? 'Creating...' : 'Add Apartment'}
        </button>
      </form>
      {createError && <div className="text-red-500 mb-4">{createError}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : apartments.length === 0 ? (
        <div>No apartments found. You can add a new apartment.</div>
      ) : (
        <ul className="space-y-2">
          {apartments.map(apt => (
            <li key={apt.id} className="border rounded p-4 bg-white shadow flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-lg">{apt.name}</div>
                <div className="text-gray-500 text-sm">{apt.address}</div>
              </div>
              <div className="mt-2 md:mt-0">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">ID: {apt.id}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dashboard;
