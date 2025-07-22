import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { sendPushNotification } from '../services/sendPushNotification';
import { db } from '../services/firebase';
import { useApartment } from '../context/ApartmentContext';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  getDoc,
} from 'firebase/firestore';

interface Notice {
  id: string;
  title: string;
  details: string;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
}

const Notice: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDetails, setAddDetails] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [error, setError] = useState('');

  // Fetch admin status and notices
  useEffect(() => {
    if (!selectedApartment || !user) return;
    setLoading(true);
    (async () => {
      // Check admin
      const aptDocRef = doc(db, 'apartments', selectedApartment);
      const aptSnap = await getDoc(aptDocRef);
      const admins = aptSnap.data()?.admins || [];
      setIsAdmin(admins.includes(user.uid));
      // Fetch notices
      const noticesRef = collection(db, 'apartments', selectedApartment, 'notices');
      const q = query(noticesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      setLoading(false);
    })();
  }, [selectedApartment, user]);

  // Add Notice
  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!addTitle.trim() || !addDetails.trim()) {
      setError('Title and details are required.');
      toast.error('Title and details are required.');
      return;
    }
    if (!selectedApartment || !user) {
      setError('Apartment or user not found.');
      toast.error('Apartment or user not found.');
      return;
    }
    try {
      const noticesRef = collection(db, 'apartments', selectedApartment, 'notices');
      await addDoc(noticesRef, {
        title: addTitle,
        details: addDetails,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });
      setAddTitle('');
      setAddDetails('');
      setShowAdd(false);
      // Refresh
      const q = query(noticesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      // Send push notification to all apartment users
      await sendPushNotification({
        apartmentId: selectedApartment,
        title: `New Notice: ${addTitle}`,
        message: addDetails,
        clickUrl: '/dashboard',
      });
      toast.success('Notice added successfully!');
    } catch (e) {
      setError('Failed to add notice.');
      toast.error('Failed to add notice.');
    }
  };

  // Edit Notice
  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!editTitle.trim() || !editDetails.trim() || !editId) {
      setError('Title and details are required.');
      toast.error('Title and details are required.');
      return;
    }
    if (!selectedApartment) {
      setError('Apartment not found.');
      toast.error('Apartment not found.');
      return;
    }
    try {
      const noticeRef = doc(db, 'apartments', selectedApartment, 'notices', editId);
      await updateDoc(noticeRef, {
        title: editTitle,
        details: editDetails,
        updatedAt: Timestamp.now(),
      });
      setEditId(null);
      setEditTitle('');
      setEditDetails('');
      // Refresh
      const noticesRef = collection(db, 'apartments', selectedApartment, 'notices');
      const q = query(noticesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      // Send push notification to all apartment users
      await sendPushNotification({
        apartmentId: selectedApartment,
        title: `Updated Notice: ${editTitle}`,
        message: editDetails,
        clickUrl: '/dashboard',
      });
      toast.success('Notice updated successfully!');
    } catch (e) {
      setError('Failed to update notice.');
      toast.error('Failed to update notice.');
    }
  };

  // Delete Notice
  const handleDelete = async (id: string) => {
    setError('');
    if (!selectedApartment) {
      setError('Apartment not found.');
      toast.error('Apartment not found.');
      return;
    }
    try {
      const noticeRef = doc(db, 'apartments', selectedApartment, 'notices', id);
      await deleteDoc(noticeRef);
      // Refresh
      const noticesRef = collection(db, 'apartments', selectedApartment, 'notices');
      const q = query(noticesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      toast.success('Notice deleted successfully!');
    } catch (e) {
      setError('Failed to delete notice.');
      toast.error('Failed to delete notice.');
    }
  };

  // Accordion state
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex flex-col items-center mb-2">
        <h2 className="text-2xl font-bold mb-4 text-blue-700">Notifications</h2>
      </div>
      {isAdmin && (
        <div className="mb-6">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-full font-semibold shadow hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-60"
            >
              Add Transaction
            </button>
          ) : (
            <form onSubmit={handleAdd} className="bg-blue-50 p-4 rounded shadow flex flex-col gap-2 mt-2">
              <input
                className="border p-2 rounded"
                placeholder="Title"
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                required
              />
              <textarea
                className="border p-2 rounded min-h-[80px]"
                placeholder="Notice details"
                value={addDetails}
                onChange={e => setAddDetails(e.target.value)}
                required
              />
              <div className="flex gap-2 mt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
                <button type="button" className="bg-gray-300 text-gray-800 px-4 py-2 rounded" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
            </form>
          )}
        </div>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : notices.length === 0 ? (
        <div className="text-gray-500">No notices yet.</div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice, idx) => (
            <div key={notice.id} className="border rounded shadow bg-white">
              <button
                className="w-full text-left px-4 py-3 font-semibold text-blue-800 flex justify-between items-center focus:outline-none"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              >
                <span>{notice.title}</span>
                <svg className={`w-5 h-5 ml-2 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openIdx === idx && (
                <div className="px-4 pb-4 pt-2 text-gray-700">
                  <div className="whitespace-pre-line mb-2">{notice.details}</div>
                  <div className="text-xs text-gray-400 mb-2">{notice.createdAt?.toDate ? notice.createdAt.toDate().toLocaleString() : ''}</div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <button
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                        onClick={() => {
                          setEditId(notice.id);
                          setEditTitle(notice.title);
                          setEditDetails(notice.details);
                        }}
                      >Edit</button>
                      <button
                        className="bg-red-600 text-white px-3 py-1 rounded"
                        onClick={() => handleDelete(notice.id)}
                      >Delete</button>
                    </div>
                  )}
                </div>
              )}
              {isAdmin && editId === notice.id && (
                <form onSubmit={handleEdit} className="bg-yellow-50 p-4 rounded-b flex flex-col gap-2">
                  <input
                    className="border p-2 rounded"
                    placeholder="Title"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    required
                  />
                  <textarea
                    className="border p-2 rounded min-h-[80px]"
                    placeholder="Notice details"
                    value={editDetails}
                    onChange={e => setEditDetails(e.target.value)}
                    required
                  />
                  <div className="flex gap-2 mt-2">
                    <button type="submit" className="bg-yellow-600 text-white px-4 py-2 rounded">Save</button>
                    <button type="button" className="bg-gray-300 text-gray-800 px-4 py-2 rounded" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                  {error && <div className="text-red-500 text-sm">{error}</div>}
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notice;
