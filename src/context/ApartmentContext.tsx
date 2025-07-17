import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { doc, getDoc } from 'firebase/firestore';

interface ApartmentContextType {
  selectedApartment: string | null;
  setSelectedApartment: (id: string) => void;
  apartments: { id: string; name: string }[];
  refreshApartments: () => Promise<void>;
  loading: boolean;
}

const ApartmentContext = createContext<ApartmentContextType>({
  selectedApartment: null,
  setSelectedApartment: () => {},
  apartments: [],
  refreshApartments: async () => {},
  loading: true,
});

export const ApartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchApartments = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setApartments([]);
      setSelectedApartment(null);
      setLoading(false);
      return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    // Debug log
    // eslint-disable-next-line no-console
    console.log('ApartmentContext debug:', { userData });
    if (userData && userData.apartments) {
      const apartmentIds = userData.apartments;
      const apartmentSnaps = await Promise.all(
        apartmentIds.map((id: string) => getDoc(doc(db, 'apartments', id)))
      );
      const aptList = apartmentSnaps
        .filter(snap => snap.exists())
        .map(snap => ({ id: snap.id, name: snap.data().name }));
      // Debug log
      // eslint-disable-next-line no-console
      console.log('ApartmentContext debug:', { aptList });
      setApartments(aptList);
      if (userData.defaultApartment) {
        setSelectedApartment(userData.defaultApartment);
      } else if (aptList.length > 0) {
        setSelectedApartment(aptList[0].id);
      }
    } else {
      setApartments([]);
      setSelectedApartment(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  // Ensure selectedApartment is set if apartments are loaded and selectedApartment is null
  useEffect(() => {
    if (!selectedApartment && apartments.length > 0) {
      setSelectedApartment(apartments[0].id);
    }
  }, [apartments, selectedApartment]);

  return (
    <ApartmentContext.Provider value={{ selectedApartment, setSelectedApartment, apartments, refreshApartments: fetchApartments, loading }}>
      {children}
    </ApartmentContext.Provider>
  );
};

export function useApartment() {
  return useContext(ApartmentContext);
}
