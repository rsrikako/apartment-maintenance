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
import { format, eachWeekOfInterval, startOfMonth, endOfMonth, addDays } from 'date-fns';

export default function ApartmentActivities() {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isAdmin, setIsAdmin] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', frequency: 'daily' });

  const getMonthRange = (monthStr) => {
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return [start, end];
  };

  const getOccurrences = (frequency) => {
    const start = new Date(`${month}-01`);
    const end = endOfMonth(start);
    let occurrences = [];

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
  };

  


const fetchActivities = async () => {
  if (!selectedApartment || !user) return;

  const aptRef = doc(db, 'apartments', selectedApartment);
  const aptSnap = await getDoc(aptRef);
  const admins = aptSnap.data()?.admins || [];
  setIsAdmin(admins.includes(user.uid));

  const activitiesRef = collection(db, 'apartments', selectedApartment, 'activities');
  const activitiesQuery = query(activitiesRef);
  const activitySnapshot = await getDocs(activitiesQuery);

  const [start, end] = getMonthRange(month);

  const activitiesData = await Promise.all(
    activitySnapshot.docs.map(async (docSnap) => {
      const activity = { id: docSnap.id, ...docSnap.data() };
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

      activity.occurrences = occSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return activity;
    })
  );

  setActivities(activitiesData);
};

const generateOccurrencesForMonth = (frequency, monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];

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
};

const pad = (n) => n.toString().padStart(2, "0");
const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;


    useEffect(() => {
    if (selectedApartment && user) {
        fetchActivities();
    }
    }, [selectedApartment, user, month]);

  const handleAdd = async () => {
    if (!newActivity.name) return;
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

  const updateOccurrence = async (activityId, occurrenceId, update) => {
    const occRef = doc(db, 'apartments', selectedApartment, 'activities', activityId, 'occurrences', occurrenceId);
    await updateDoc(occRef, update);
    fetchActivities();
  };

  const deleteActivity = async (id) => {
    await deleteDoc(doc(db, 'apartments', selectedApartment, 'activities', id));
    fetchActivities();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-4">Apartment Activities</h1>

      <div className="flex justify-between items-center mb-6">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {isAdmin && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="font-semibold mb-2">Add Activity</h2>
          <input
            type="text"
            value={newActivity.name}
            onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
            placeholder="Activity name"
            className="border p-2 mr-2 rounded"
          />
          <select
            value={newActivity.frequency}
            onChange={(e) => setNewActivity({ ...newActivity, frequency: e.target.value })}
            className="border p-2 mr-2 rounded"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      )}

      <div className="space-y-6">
        {activities.map((act) => (
          <div key={act.id} className="border p-4 rounded shadow-sm bg-white">
            <h3 className="font-bold text-lg mb-2">{act.name} ({act.frequency})</h3>
            <ul className="space-y-2">
              {act.occurrences?.map((occ, idx) => (
                <li key={occ.id || idx} className="flex justify-between items-center border-b pb-1">
                  <div>
                    <span className="text-sm text-gray-600">
                      {occ.expectedDate.toDate().toLocaleDateString()} - Status: {occ.status}
                    </span>
                    {occ.status === 'skipped' && occ.skipReason && (
                      <span className="text-red-600 ml-2 text-sm">Reason: {occ.skipReason}</span>
                    )}
                  </div>
                  {isAdmin && occ.status === 'pending' && (
                    <div className="space-x-2">
                      <button
                        onClick={() => updateOccurrence(act.id, occ.id, { status: 'completed', completionDate: Timestamp.now() })}
                        className="px-2 py-1 bg-green-600 text-white rounded"
                      >
                        Mark Done
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Enter reason for skipping:');
                          if (reason) updateOccurrence(act.id, occ.id, { status: 'skipped', skipReason: reason });
                        }}
                        className="px-2 py-1 bg-yellow-500 text-white rounded"
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
                  onClick={() => deleteActivity(act.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  Delete Activity
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
