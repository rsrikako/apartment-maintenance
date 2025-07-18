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
  expectedDate: any;
  status: string;
  skipReason?: string;
}

interface Activity {
  id: string;
  name: string;
  frequency: string;
  occurrences: Occurrence[];
}

export default function ApartmentActivities() {
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

  function getOccurrences(frequency: string): { expectedDate: any; status: string }[] {
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

  const updateOccurrence = async (activityId: string, occurrenceId: string, update: any) => {
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
      <h1 className="text-2xl font-bold mb-4 text-emerald-700">Apartment Activities</h1>

      <div className="flex justify-between items-center mb-6">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200 bg-white"
        />
      </div>

      {isAdmin && (
        <div className="bg-white bg-opacity-80 p-4 rounded-2xl shadow mb-6">
          <h2 className="font-semibold mb-2 text-slate-700">Add Activity</h2>
          <input
            type="text"
            value={newActivity.name}
            onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
            placeholder="Activity name"
            className="border border-slate-200 p-2 mr-2 rounded focus:ring-2 focus:ring-emerald-200 bg-white"
          />
          <select
            value={newActivity.frequency}
            onChange={(e) => setNewActivity({ ...newActivity, frequency: e.target.value })}
            className="border border-slate-200 p-2 mr-2 rounded focus:ring-2 focus:ring-emerald-200 bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button
            onClick={handleAdd}
            className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700"
          >
            Add
          </button>
        </div>
      )}

      <div className="space-y-6">
        {activities.map((act) => (
          <div key={act.id} className="bg-white bg-opacity-90 border border-slate-200 p-6 rounded-2xl shadow-lg">
            <h3 className="font-bold text-lg mb-2 text-emerald-700">{act.name} ({act.frequency})</h3>
            <ul className="space-y-2">
              {act.occurrences?.map((occ, idx) => (
                <li key={occ.id || idx} className="flex justify-between items-center border-b border-slate-100 pb-1">
                  <div>
                    <span className="text-sm text-slate-600">
                      {occ.expectedDate.toDate().toLocaleDateString()} - Status: {occ.status}
                    </span>
                    {occ.status === 'skipped' && occ.skipReason && (
                      <span className="text-orange-500 ml-2 text-sm">Reason: {occ.skipReason}</span>
                    )}
                  </div>
                  {isAdmin && occ.status === 'pending' && (
                    <div className="space-x-2">
                      <button
                        onClick={() => setPendingAction({ type: 'done', activityId: act.id, occurrenceId: occ.id })}
                        className="px-3 py-1 bg-emerald-600 text-white rounded shadow hover:bg-emerald-700"
                      >
                        Mark Done
                      </button>
                      <button
                        onClick={() => setPendingAction({ type: 'skip', activityId: act.id, occurrenceId: occ.id })}
                        className="px-3 py-1 bg-yellow-400 text-white rounded shadow hover:bg-yellow-500"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <div className="mt-4 text-right">
                <button
                  onClick={() => setPendingAction({ type: 'delete', activityId: act.id })}
                  className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700"
                >
                  Delete Activity
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    {/* Warning Modal */}
      {pendingAction.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-80 flex flex-col items-center">
            <div className="text-lg font-semibold mb-2 text-red-700">
              {pendingAction.type === 'delete' && 'Delete Activity?'}
              {pendingAction.type === 'done' && 'Mark as Done?'}
              {pendingAction.type === 'skip' && 'Skip Activity?'}
            </div>
            <div className="text-slate-700 mb-4 text-center">
              {pendingAction.type === 'delete' && 'Are you sure you want to delete this activity? This action cannot be undone.'}
              {pendingAction.type === 'done' && 'Are you sure you want to mark this occurrence as done?'}
              {pendingAction.type === 'skip' && (
                <>
                  <div>Are you sure you want to skip this occurrence?</div>
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
                className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"
                disabled={pendingAction.type === 'skip' && !skipInput}
              >
                Confirm
              </button>
              <button
                onClick={handleCancelAction}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
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
