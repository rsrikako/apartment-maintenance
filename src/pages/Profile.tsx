import React, { useState } from 'react';
import AppIcon from '../components/AppIcon';
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
  // Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  // Modal for notification/PWA suggestion
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  // Suggest notification permission or PWA if enabled but not granted/installed
  React.useEffect(() => {
    if (!user) return;
    if (!notificationsEnabled) return;
    const permission = Notification?.permission;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Only show if permission not granted or not installed as PWA
    if (permission !== 'granted' || (!isStandalone && isIos())) {
      setShowSuggestModal(true);
    }
  }, [user, notificationsEnabled, setShowSuggestModal]);
  // Register service worker for FCM notifications
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
  }, []);
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
  const [name, setName] = useState('');
  const [showNameSaved, setShowNameSaved] = useState(false);
  // Notification states
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Utility: request permission and save token
  async function requestNotificationPermission(user: import('firebase/auth').User) {
    setNotificationLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission denied');
      // Dynamically import messaging
      const { getMessaging, getToken } = await import('firebase/messaging');
      const messaging = getMessaging();
      // TODO: Replace with your VAPID key
      const VAPID_KEY = 'BOopqj_M9KrjnAFztdR99gvKCOa8pv5aGecYYsa5qXnlie8xHNZ8dmfX1M3V_xF0wShHz1lxoIHOFH7zzdq6M70';
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
      await updateDoc(doc(db, 'users', user.uid), {
        fcmTokens: arrayUnion(token),
        notificationsEnabled: true,
      });
      setFcmToken(token);
      setNotificationsEnabled(true);
      return token;
    } catch (err) {
      alert((err as Error).message || 'Failed to enable notifications.');
      setNotificationsEnabled(false);
      return null;
    } finally {
      setNotificationLoading(false);
    }
  }

  // Utility: remove token
  async function removeFcmToken(user: import('firebase/auth').User, token: string | null) {
    setNotificationLoading(true);
    try {
      if (!token) return;
      const { getMessaging, deleteToken } = await import('firebase/messaging');
      const messaging = getMessaging();
      await deleteToken(messaging);
      await updateDoc(doc(db, 'users', user.uid), {
        fcmTokens: arrayRemove(token),
        notificationsEnabled: false,
      });
      setNotificationsEnabled(false);
      setFcmToken(null);
    } catch (err) {
      alert((err as Error).message || 'Failed to disable notifications.');
    } finally {
      setNotificationLoading(false);
    }
  }

  // Utility: iOS detection and PWA check
  function isIos() {
    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  }
  function isPwa() {
    return window.matchMedia('(display-mode: standalone)').matches;
  }

  // write a logic to fetch the user from Firestore and check if the user available if not create a user
  React.useEffect(() => {
    if (!user) return;

    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Create a new user document if it doesn't exist
        await setDoc(doc(db, 'users', user.uid), {
          phone: user.phoneNumber,
          apartments: [],
          defaultApartment: null,
          name: '',
          notificationsEnabled: false,
          fcmTokens: [],
        });
        setNotificationsEnabled(false);
        setFcmToken(null);
      } else {
        setName(userDoc.data()?.name || '');
        setNotificationsEnabled(!!userDoc.data()?.notificationsEnabled);
        // Try to get current token from fcmTokens array
        const tokens = userDoc.data()?.fcmTokens || [];
        setFcmToken(tokens.length ? tokens[0] : null);
      }
    };
    fetchUser();
  }, [user, setNotificationsEnabled]);

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
      if (!name) throw new Error('Please set your name in profile settings');
      if (!newName.trim() || !newAddress.trim() || !newFlatNumber.trim()) throw new Error('All fields required');
      const aptRef = doc(collection(db, 'apartments'));
      await setDoc(aptRef, {
        name: newName,
        address: newAddress,
        admins: [user.uid],
      });
      // Add flat for the user in the new apartment
      const flatData: Record<string, string | 'self' | 'rented'> = {
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
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create apartment.');
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
    <div className="min-h-screen flex items-center justify-center px-2 bg-gradient-to-br from-slate-100 via-stone-100 to-slate-200">
      <div className="w-full max-w-sm bg-white bg-opacity-90 rounded-2xl shadow-2xl p-6 flex flex-col items-center pb-24">
        {/* Suggest notification/PWA modal */}
        {showSuggestModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full flex flex-col items-center">
              <div className="text-lg font-bold text-emerald-600 mb-2">Get the Most Out of the App</div>
              <div className="text-sm text-gray-700 mb-4 text-center">
                {Notification?.permission !== 'granted' && (
                  <>
                    <div>To receive important updates, please enable notifications.</div>
                    <button className="mt-2 px-3 py-2 bg-emerald-600 text-white rounded" onClick={async () => {
                      if (user) await requestNotificationPermission(user);
                      setShowSuggestModal(false);
                    }}>Enable Notifications</button>
                  </>
                )}
                {!window.matchMedia('(display-mode: standalone)').matches && isIos() && (
                  <div className="mt-4">For best experience, add this app to your home screen.<br />Tap <b>Share</b> &gt; <b>Add to Home Screen</b>.</div>
                )}
              </div>
              <button className="px-3 py-2 bg-gray-300 text-gray-800 rounded mt-2" onClick={() => setShowSuggestModal(false)}>Close</button>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center mb-2">
          <AppIcon className="w-10 h-10 text-emerald-600 mb-2" />
          <h2 className="text-2xl font-bold text-emerald-700 mb-4 text-center">Profile</h2>
        </div>
        <div className="mb-4 w-full">
          <div className="flex flex-col items-center w-full mb-4">
            <div className="flex gap-2 w-full items-center justify-center">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded focus:ring-2 focus:ring-emerald-200 text-base flex-1 bg-white"
                placeholder="Enter your name"
                style={{ minWidth: 0 }}
              />
              <button
                className="px-3 py-2 bg-emerald-600 text-white rounded shadow hover:bg-emerald-700 text-sm"
                onClick={async () => {
                  if (!user) return;
                  await updateDoc(doc(db, 'users', user.uid), { name });
                  setShowNameSaved(true);
                  setTimeout(() => setShowNameSaved(false), 1500);
                }}
                type="button"
              >
                Save
              </button>
            </div>
            {showNameSaved && (
              <div className="text-emerald-600 text-xs mt-1">Name updated!</div>
            )}
            {/* Notification toggle */}
            <div className="flex items-center mt-4 w-full justify-center">
              <label className="mr-2 text-sm">Enable Notifications</label>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                disabled={notificationLoading || !user}
                onChange={async (e) => {
                  if (e.target.checked) {
                    if (isIos() && !isPwa()) {
                      setShowIosModal(true);
                      return;
                    }
                    if (user) await requestNotificationPermission(user);
                  } else {
                    if (user) await removeFcmToken(user, fcmToken);
                  }
                }}
              />
              {notificationLoading && <span className="ml-2 text-xs text-gray-400">...</span>}
            </div>
            {/* iOS install modal */}
            {showIosModal && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full flex flex-col items-center">
                  <div className="text-lg font-bold text-emerald-600 mb-2">Install App</div>
                  <div className="text-sm text-gray-700 mb-4 text-center">
                    To receive notifications, please install this app to your home screen.<br />
                    Tap <b>Share</b> &gt; <b>Add to Home Screen</b>.
                  </div>
                  <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={() => setShowIosModal(false)}>Close</button>
                </div>
              </div>
            )}
            </div>
            {showNameSaved && (
              <div className="text-emerald-600 text-xs mt-1">Name updated!</div>
            )}
          <div className="text-base font-semibold text-center text-slate-700">Mobile: {user?.phoneNumber}</div>
          {(!apartments.length || !selectedApartment) && (
            <div className="mt-4 text-center text-orange-500 font-semibold">
              Please select or create an apartment to use the app.
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2 items-center">
            <label className="block text-sm font-medium mb-1 text-center text-slate-700">Select Apartment</label>
            <div className="flex w-full gap-2 items-center">
              <select
                className="flex-1 px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base bg-white"
                value={selectedApartment || ''}
                onChange={e => setSelectedApartment(e.target.value)}
              >
                {apartments.map(apt => (
                  <option key={apt.id} value={apt.id}>{apt.name}</option>
                ))}
              </select>
              <button
                className="px-2 py-1 bg-emerald-600 text-white rounded shadow hover:bg-emerald-700 text-sm"
                onClick={() => setShowAdd(v => !v)}
                type="button"
              >
                +
              </button>
              {isAdmin && (
                <button
                  className="px-2 py-1 bg-red-600 text-white rounded shadow hover:bg-red-700 text-sm ml-1"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                  disabled={deleting}
                >
                  🗑
                </button>
              )}
            </div>
            {showAdd && (
              <form onSubmit={handleCreateApartment} className="w-full mt-2 flex flex-col gap-2 bg-white bg-opacity-80 border border-slate-200 rounded-2xl p-4 shadow">
                <input
                  type="text"
                  placeholder="Apartment Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base bg-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base bg-white"
                  required
                />
                <div className="font-semibold text-emerald-700 mt-2 mb-1 text-center">Your Flat Details</div>
                <input
                  type="text"
                  placeholder="Flat Number"
                  value={newFlatNumber}
                  onChange={e => setNewFlatNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base bg-white"
                  required
                />
                <select
                  value={newFlatStatus}
                  onChange={e => setNewFlatStatus(e.target.value as 'self' | 'rented')}
                  className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-200 text-base bg-white"
                >
                  <option value="self">Owner</option>
                  <option value="rented">Tenant</option>
                </select>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold shadow hover:bg-emerald-700 transition-all disabled:opacity-60"
                >
                  {creating ? 'Creating...' : 'Add'}
                </button>
                {createError && <div className="text-orange-500 text-xs mt-1">{createError}</div>}
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
