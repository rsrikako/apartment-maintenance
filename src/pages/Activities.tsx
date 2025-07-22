import { useApartment } from "../context/ApartmentContext";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from "../services/firebase";
import { useEffect, useState } from 'react';
import { eachWeekOfInterval, endOfMonth } from 'date-fns';

interface PendingAction {
  type: 'delete' | 'done' | 'skip' | null;
  activityId?: string;
  occurrenceId?: string;
  skipReason?: string;
}

interface Occurrence {
  id: string;
  expectedDate: Timestamp;
  status: string;
  skipReason?: string;
// Modal state for Add Activity
// (inserted after useState imports)
}

interface Activity {
  id: string;
  name: string;
  frequency: string;
  occurrences: Occurrence[];
}

export default function ApartmentActivities() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [newActivity, setNewActivity] = useState<{ name: string; frequency: string }>({ name: '', frequency: 'daily' });
  const [pendingAction, setPendingAction] = useState<PendingAction>({ type: null });
  const [skipInput, setSkipInput] = useState<string>("");

  function getMonthRange(monthStr: string): [Date, Date] {
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return [start, end];
  }

  function getOccurrences(frequency: string): { expectedDate: Timestamp; status: string }[] {
    const start = new Date(`${month}-01`);
    const end = endOfMonth(start);
    let occurrences: Date[] = [];

    if (frequency === 'daily') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        occurrences.push(new Date(d));
      }
    } else if (frequency === 'weekly') {
      occurrences = eachWeekOfInterval({ start, end }).map(d => d);
    } else if (frequency === 'monthly') {
      occurrences = [start];
    } else if (frequency === 'quarterly') {
      occurrences = [start];
    }

    return occurrences.map(date => ({
      expectedDate: Timestamp.fromDate(new Date(date)),
      status: 'pending'
    }));
  }

  async function fetchActivities() {
    if (!selectedApartment || !user) return;

    const aptRef = doc(db, 'apartments', selectedApartment);
    const aptSnap = await getDoc(aptRef);
    const admins = aptSnap.data()?.admins || [];
    setIsAdmin(admins.includes(user.uid));

    const activitiesRef = collection(db, 'apartments', selectedApartment, 'activities');
    const activitiesQuery = query(activitiesRef);
    const activitySnapshot = await getDocs(activitiesQuery);

    const [start, end] = getMonthRange(month);

    const activitiesData: Activity[] = await Promise.all(
      activitySnapshot.docs.map(async (docSnap) => {
        const activity = { id: docSnap.id, ...docSnap.data() } as Activity;
        const occRef = collection(db, 'apartments', selectedApartment, 'activities', docSnap.id, 'occurrences');

        const occQuery = query(occRef,
          where('expectedDate', '>=', Timestamp.fromDate(start)),
          where('expectedDate', '<=', Timestamp.fromDate(end))
        );

        let occSnap = await getDocs(occQuery);

        if (occSnap.empty) {
          const newOcc = generateOccurrencesForMonth(activity.frequency, month);
          await Promise.all(
            newOcc.map(date =>
              addDoc(occRef, {
                expectedDate: Timestamp.fromDate(new Date(date)),
                status: 'pending'
              })
            )
          );
          occSnap = await getDocs(occQuery); // refetch newly created ones
        }

        activity.occurrences = occSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Occurrence[];
        return activity;
      })
    );

    setActivities(activitiesData);
  }

  function generateOccurrencesForMonth(frequency: string, monthStr: string): string[] {
    const [year, month] = monthStr.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates: string[] = [];

    if (frequency === "daily") {
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push(`${year}-${pad(month)}-${pad(d)}`);
      }
    } else if (frequency === "weekly") {
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() === 1) dates.push(formatDate(date)); // Mondays
      }
    } else if (frequency === "monthly") {
      dates.push(`${year}-${pad(month)}-01`);
    } else if (frequency === "quarterly") {
      if ([1, 4, 7, 10].includes(month)) {
        dates.push(`${year}-${pad(month)}-01`);
      }
    }

    return dates;
  }

  function pad(n: number): string {
    return n.toString().padStart(2, "0");
  }
  function formatDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  useEffect(() => {
    if (selectedApartment && user) {
      fetchActivities();
    }
  }, [selectedApartment, user, month]);

  const handleAdd = async () => {
    if (!newActivity.name || !selectedApartment || !user) return;
    const occurrences = getOccurrences(newActivity.frequency);

    await addDoc(collection(db, 'apartments', selectedApartment, 'activities'), {
      ...newActivity,
      month,
      createdBy: user.uid,
      occurrences
    });
    setNewActivity({ name: '', frequency: 'daily' });
    fetchActivities();
  };

  const updateOccurrence = async (activityId: string, occurrenceId: string, update: Record<string, unknown>) => {
    if (!selectedApartment) return;
    const occRef = doc(db, 'apartments', selectedApartment, 'activities', activityId, 'occurrences', occurrenceId);
    await updateDoc(occRef, update);
    fetchActivities();
  };

  const deleteActivity = async (id: string) => {
    if (!selectedApartment) return;
    await deleteDoc(doc(db, 'apartments', selectedApartment, 'activities', id));
    fetchActivities();
  };

  // Modal action handlers
  const handleConfirmAction = async () => {
    if (pendingAction.type === 'delete' && pendingAction.activityId) {
      await deleteActivity(pendingAction.activityId);
    } else if (pendingAction.type === 'done' && pendingAction.activityId && pendingAction.occurrenceId) {
      await updateOccurrence(pendingAction.activityId, pendingAction.occurrenceId, { status: 'completed', completionDate: Timestamp.now() });
    } else if (pendingAction.type === 'skip' && pendingAction.activityId && pendingAction.occurrenceId) {
      await updateOccurrence(pendingAction.activityId, pendingAction.occurrenceId, { status: 'skipped', skipReason: skipInput });
      setSkipInput("");
    }
    setPendingAction({ type: null });
  };

  const handleCancelAction = () => {
    setPendingAction({ type: null });
    setSkipInput("");
  };

  return (

    <div className="p-6 max-w-4xl mx-auto pb-24 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-emerald-700 text-center mb-6">Apartment Activities</h1>

      <div className="flex flex-row flex-wrap gap-3 mb-8 w-full max-w-lg mx-auto justify-center">
        {isAdmin && (
          <div className="flex flex-col items-center">
            <button
              className="flex items-center justify-center bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition w-14 h-14"
              onClick={() => setShowAddModal(true)}
              title="Add Activity"
            >
              <span className="text-2xl">➕</span>
            </button>
            <span className="text-xs mt-1 text-gray-700 font-medium">Add Activity</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200 bg-white"
        />
      </div>

      {/* Add Activity Modal */}
      {isAdmin && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-2 left-2 px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              onClick={() => setShowAddModal(false)}
            >
              ← Back
            </button>
            <h2 className="font-semibold mb-4 text-slate-700 text-center">Add Activity</h2>
            <input
              type="text"
              value={newActivity.name}
              onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
              placeholder="Activity name"
              className="border border-slate-200 p-2 mb-2 w-full rounded focus:ring-2 focus:ring-emerald-200 bg-white"
            />
            <select
              value={newActivity.frequency}
              onChange={(e) => setNewActivity({ ...newActivity, frequency: e.target.value })}
              className="border border-slate-200 p-2 mb-4 w-full rounded focus:ring-2 focus:ring-emerald-200 bg-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <button
              onClick={async () => { await handleAdd(); setShowAddModal(false); }}
              className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 w-full"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {activities.map((act) => (
          <div key={act.id} className="bg-white bg-opacity-90 border border-slate-200 p-6 rounded-2xl shadow-lg relative">
            {isAdmin && (
              <button
                onClick={() => setPendingAction({ type: 'delete', activityId: act.id })}
                className="absolute top-4 right-4 flex items-center justify-center bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition w-10 h-10 z-10"
                title="Delete Activity"
              >
                <span className="text-xl">🗑️</span>
              </button>
            )}
            <h3 className="font-bold text-lg mb-2 text-emerald-700">{act.name} ({act.frequency})</h3>
            <ul className="space-y-2">
              {act.occurrences?.map((occ, idx) => (
                <li key={occ.id || idx} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-3 w-full">
                    <span className="inline-block w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ background: occ.status === 'completed' ? '#34d399' : occ.status === 'skipped' ? '#fbbf24' : '#e5e7eb', color: occ.status === 'completed' ? '#065f46' : occ.status === 'skipped' ? '#92400e' : '#374151' }}
                    >
                      {occ.status === 'completed' ? '✔️' : occ.status === 'skipped' ? '⏭️' : '⏳'}
                    </span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-base font-medium text-slate-700 truncate">{occ.expectedDate.toDate().toLocaleDateString()}</span>
                      <span className={`text-xs font-semibold ${occ.status === 'completed' ? 'text-emerald-700' : occ.status === 'skipped' ? 'text-yellow-700' : 'text-slate-500'}`}>{occ.status.charAt(0).toUpperCase() + occ.status.slice(1)}</span>
                      {occ.status === 'skipped' && occ.skipReason && (
                        <span className="text-xs text-orange-500 mt-1">Reason: {occ.skipReason}</span>
                      )}
                    </div>
                    {isAdmin && occ.status === 'pending' && (
                      <div className="flex flex-row gap-2 ml-2">
                        <button
                          onClick={() => setPendingAction({ type: 'done', activityId: act.id, occurrenceId: occ.id })}
                          className="flex items-center justify-center bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition w-10 h-10"
                          title="Mark Done"
                        >
                          <span className="text-xl">✔️</span>
                        </button>
                        <button
                          onClick={() => setPendingAction({ type: 'skip', activityId: act.id, occurrenceId: occ.id })}
                          className="flex items-center justify-center bg-yellow-400 text-white rounded-full shadow hover:bg-yellow-500 transition w-10 h-10"
                          title="Skip"
                        >
                          <span className="text-xl">⏭️</span>
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {/* Delete button moved to top right */}
          </div>
        ))}
      </div>
    {/* Warning Modal */}
      {pendingAction.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-80 flex flex-col items-center">
            <div className="flex flex-col items-center mb-4">
              {pendingAction.type === 'delete' && (
                <>
                  <span className="w-14 h-14 flex items-center justify-center bg-red-100 text-red-600 rounded-full mb-2 text-3xl shadow"><span>🗑️</span></span>
                  <span className="text-lg font-bold text-red-700 mb-1">Delete Activity?</span>
                  <span className="text-slate-700 text-center text-sm">Are you sure you want to delete this activity? This action cannot be undone.</span>
                </>
              )}
              {pendingAction.type === 'done' && (
                <>
                  <span className="w-14 h-14 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full mb-2 text-3xl shadow"><span>✔️</span></span>
                  <span className="text-lg font-bold text-emerald-700 mb-1">Mark as Done?</span>
                  <span className="text-slate-700 text-center text-sm">Are you sure you want to mark this occurrence as done?</span>
                </>
              )}
              {pendingAction.type === 'skip' && (
                <>
                  <span className="w-14 h-14 flex items-center justify-center bg-yellow-100 text-yellow-600 rounded-full mb-2 text-3xl shadow"><span>⏭️</span></span>
                  <span className="text-lg font-bold text-yellow-700 mb-1">Skip Activity?</span>
                  <span className="text-slate-700 text-center text-sm mb-2">Are you sure you want to skip this occurrence?</span>
                  <input
                    className="border border-slate-200 p-2 rounded mt-2 w-full focus:ring-2 focus:ring-emerald-200 bg-white"
                    placeholder="Enter reason for skipping"
                    value={skipInput}
                    onChange={e => setSkipInput(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="flex gap-4 mt-2">
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded shadow font-semibold transition ${pendingAction.type === 'delete' ? 'bg-red-600 text-white hover:bg-red-700' : pendingAction.type === 'done' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-yellow-400 text-white hover:bg-yellow-500'}`}
                disabled={pendingAction.type === 'skip' && !skipInput}
              >
                Confirm
              </button>
              <button
                onClick={handleCancelAction}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
