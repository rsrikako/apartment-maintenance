import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useApartment } from '../context/ApartmentContext';
import { getDoc, deleteDoc, updateDoc, collection, doc, setDoc, arrayUnion, arrayRemove, getDocs, writeBatch } from 'firebase/firestore';

// Utility to recursively delete all subcollections under an apartment
async function deleteAllApartmentSubcollections(apartmentId: string) {
  const subcollections = ['flats', 'owners', 'tenants', 'admins'];
  for (const sub of subcollections) {
    const colRef = collection(db, 'apartments', apartmentId, sub);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
    }
  }
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { apartments, selectedApartment, setSelectedApartment, refreshApartments } = useApartment();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newFlatNumber, setNewFlatNumber] = useState('');
  const [newFlatStatus, setNewFlatStatus] = useState<'self' | 'rented'>('self');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedApartmentData, setSelectedApartmentData] = useState<{ admins?: string[] } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      if (!user) throw new Error('Not logged in');
      if (!newName.trim() || !newAddress.trim() || !newFlatNumber.trim()) throw new Error('All fields required');
      const aptRef = doc(collection(db, 'apartments'));
      await setDoc(aptRef, {
        name: newName,
        address: newAddress,
        admins: [user.uid],
      });
      // Add flat for the user in the new apartment
      const flatData: Record<string, any> = {
        flatNumber: newFlatNumber,
        status: newFlatStatus,
      };
      if (newFlatStatus === 'self') {
        flatData.ownerUid = user.uid;
      } else {
        flatData.tenantUid = user.uid;
      }
      await setDoc(doc(collection(db, 'apartments', aptRef.id, 'flats')), flatData);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        apartments: arrayUnion(aptRef.id),
        defaultApartment: aptRef.id,
      });
      // Ensure user is in admins list
      await updateDoc(aptRef, {
        admins: arrayUnion(user.uid)
      });
      setNewName('');
      setNewAddress('');
      setNewFlatNumber('');
      setNewFlatStatus('self');
      setShowAdd(false);
      await refreshApartments();
      setSelectedApartment(aptRef.id); // Switch to new apartment
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create apartment.');
    } finally {
      setCreating(false);
    }
  };

  // Fetch selected apartment data for admin check
  React.useEffect(() => {
    async function fetchApt() {
      if (!selectedApartment) return setSelectedApartmentData(null);
      const snap = await getDoc(doc(db, 'apartments', selectedApartment));
      setSelectedApartmentData(snap.exists() ? snap.data() : null);
    }
    fetchApt();
  }, [selectedApartment]);

  const isAdmin = selectedApartmentData?.admins?.includes(user?.uid || '');

  // Delete apartment logic
  const handleDeleteApartment = async () => {
    if (!selectedApartment) return;
    setDeleting(true);
    setDeleteError('');
    try {
      // Debug: log user and admins
      console.log('Current user UID:', user?.uid);
      console.log('Apartment admins:', selectedApartmentData?.admins);
      // Recursively delete all known subcollections
      await deleteAllApartmentSubcollections(selectedApartment);
      // Delete apartment doc
      await deleteDoc(doc(db, 'apartments', selectedApartment));
      // Remove apartment from all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch2 = writeBatch(db);
      usersSnap.forEach(userDoc => {
        const data = userDoc.data();
        if (data.apartments?.includes(selectedApartment)) {
          const userRef = doc(db, 'users', userDoc.id);
          // Remove the deleted apartment from the user's apartments array
          const newApartments = (data.apartments || []).filter((id: string) => id !== selectedApartment);
          // If defaultApartment is being deleted, pick another apartment if available, else set to ''
          let newDefault = data.defaultApartment;
          if (data.defaultApartment === selectedApartment) {
            newDefault = newApartments.length > 0 ? newApartments[0] : '';
          }
          batch2.update(userRef, {
            apartments: arrayRemove(selectedApartment),
            defaultApartment: newDefault,
          });
        }
      });
      await batch2.commit();
      setShowDeleteConfirm(false);
      await refreshApartments();
      // Switch to another apartment if available
      if (apartments.length > 0) {
        setSelectedApartment(apartments[0].id);
      } else {
        setSelectedApartment('');
      }
    } catch (err) {
      setDeleteError((err as Error).message || 'Failed to delete apartment.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 px-2">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4 flex flex-col items-center pb-24">
        <h2 className="text-xl font-bold text-blue-700 mb-2 text-center">Profile</h2>
        <div className="mb-4 w-full">
          <div className="text-base font-semibold text-center">Mobile: {user?.phoneNumber}</div>
          <div className="mt-4 flex flex-col gap-2 items-center">
            <label className="block text-sm font-medium mb-1 text-center">Select Apartment</label>
            <div className="flex w-full gap-2 items-center">
              <select
                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                value={selectedApartment || ''}
                onChange={e => setSelectedApartment(e.target.value)}
              >
                {apartments.map(apt => (
                  <option key={apt.id} value={apt.id}>{apt.name}</option>
                ))}
              </select>
              <button
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                onClick={() => setShowAdd(v => !v)}
                type="button"
              >
                +
              </button>
              {isAdmin && (
                <button
                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm ml-1"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                  disabled={deleting}
                >
                  🗑
                </button>
              )}
            </div>
            {showAdd && (
              <form onSubmit={handleCreateApartment} className="w-full mt-2 flex flex-col gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                <input
                  type="text"
                  placeholder="Apartment Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                  required
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                  required
                />
                <div className="font-semibold text-blue-700 mt-2 mb-1 text-center">Your Flat Details</div>
                <input
                  type="text"
                  placeholder="Flat Number"
                  value={newFlatNumber}
                  onChange={e => setNewFlatNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                  required
                />
                <select
                  value={newFlatStatus}
                  onChange={e => setNewFlatStatus(e.target.value as 'self' | 'rented')}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                >
                  <option value="self">Owner</option>
                  <option value="rented">Tenant</option>
                </select>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  {creating ? 'Creating...' : 'Add'}
                </button>
                {createError && <div className="text-red-500 text-xs mt-1">{createError}</div>}
              </form>
            )}
          </div>
        </div>
        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full flex flex-col items-center">
              <div className="text-lg font-bold text-red-600 mb-2">Delete Apartment?</div>
              <div className="text-sm text-gray-700 mb-4 text-center">This will permanently delete the apartment and all its data. This action cannot be undone.</div>
              {deleteError && <div className="text-red-500 text-xs mb-2">{deleteError}</div>}
              <div className="flex gap-2 w-full">
                <button
                  className="flex-1 px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >Cancel</button>
                <button
                  className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={handleDeleteApartment}
                  disabled={deleting}
                >{deleting ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="mt-4 w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base">Logout</button>
        <div className="mt-6 text-gray-400 text-xs text-center">
          &copy; {new Date().getFullYear()} Apartment Activity Management
        </div>
      </div>
    </div>
  );
};

export default Profile;
