import { db } from './firebase';
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';

export interface Occurrence {
  id: string;
  expectedDate: Timestamp;
  status: string;
  skipReason?: string;
}

export interface Activity {
  id: string;
  name: string;
  frequency: string;
  occurrences: Occurrence[];
}

function getMonthRange(monthStr: string): [Date, Date] {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  return [start, end];
}

export async function getActivitiesReport(apartmentId: string, month: string): Promise<Activity[]> {
  if (!apartmentId || !month) return [];
  const activitiesRef = collection(db, 'apartments', apartmentId, 'activities');
  const activitiesQuery = query(activitiesRef);
  const activitySnapshot = await getDocs(activitiesQuery);
  const [start, end] = getMonthRange(month);

  const activitiesData: Activity[] = await Promise.all(
    activitySnapshot.docs.map(async (docSnap) => {
      const activity = { id: docSnap.id, ...docSnap.data() } as Activity;
      const occRef = collection(db, 'apartments', apartmentId, 'activities', docSnap.id, 'occurrences');
      const occQuery = query(
        occRef,
        where('expectedDate', '>=', Timestamp.fromDate(start)),
        where('expectedDate', '<=', Timestamp.fromDate(end))
      );
      let occSnap = await getDocs(occQuery);
      activity.occurrences = occSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Occurrence[];
      return activity;
    })
  );
  return activitiesData;
}
