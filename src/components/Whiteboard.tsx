import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApartment } from '../context/ApartmentContext';
import { useAuth } from '../context/AuthContext';

const WHITEBOARD_DOC_ID = 'whiteboard';

const Whiteboard: React.FC = () => {
  const { selectedApartment, loading: apartmentLoading } = useApartment();
  const { user } = useAuth();
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedApartment || !user) {
      setError('No apartment selected or user not logged in.');
      setLoading(false);
      return;
    } else {
      setError('');
      setNote(''); // Reset note when apartment changes
      setIsAdmin(false); // Reset admin status
    }
    const fetchNoteAndAdmin = async () => {
      setLoading(true);
      try {
        // Check admin status
        const aptRef = doc(db, 'apartments', selectedApartment);
        const aptSnap = await getDoc(aptRef);
        const admins = aptSnap.data()?.admins || [];
        setIsAdmin(admins.includes(user.uid));
        // Fetch whiteboard note
        const docRef = doc(db, 'apartments', selectedApartment, 'meta', WHITEBOARD_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setNote(docSnap.data().note || '');
        } else {
          setNote('welcome note :)');
        }
      } catch (err) {
        setError('Failed to load whiteboard note.' + err);
      } finally {
        setLoading(false);
      }
    };
    fetchNoteAndAdmin();
  }, [selectedApartment, user]);

  const handleSave = async () => {
    if (!selectedApartment || !user) return;
    setSaving(true);
    setError('');
    try {
      const docRef = doc(db, 'apartments', selectedApartment, 'meta', WHITEBOARD_DOC_ID);
      await setDoc(docRef, { note });
    } catch (err) {
      setError('Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedApartment || !user || loading || apartmentLoading) {
    return <div className="text-center py-8 text-gray-500">Loading whiteboard...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-xl p-6 border border-gray-200 mt-8 pb-24">
      <h2 className="text-2xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M7 3v4M17 3v4" stroke="currentColor" strokeWidth="2"/></svg>
        Whiteboard
      </h2>
      {error && <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-2 text-sm">{error}</div>}
      {isAdmin ? (
        <>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-base mb-3 bg-gray-50 resize-y min-h-[120px]"
            placeholder="Write notes for your apartment here..."
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded shadow disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      ) : (
        <div className="whitespace-pre-wrap min-h-[120px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4">
          {note ? note : <span className="italic text-gray-400">No notes yet.</span>}
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
