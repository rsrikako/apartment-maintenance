import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { doc, getDoc } from 'firebase/firestore';

interface ApartmentContextType {
  selectedApartment: string | null;
  setSelectedApartment: (id: string) => void;
  apartments: { id: string; name: string }[];
  refreshApartments: () => Promise<void>;
}

const ApartmentContext = createContext<ApartmentContextType>({
  selectedApartment: null,
  setSelectedApartment: () => {},
  apartments: [],
  refreshApartments: async () => {},
});

export const ApartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<string | null>(null);

  const fetchApartments = useCallback(async () => {
    if (!user) return;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    if (userData && userData.apartments) {
      const apartmentIds = userData.apartments;
      const apartmentSnaps = await Promise.all(
        apartmentIds.map((id: string) => getDoc(doc(db, 'apartments', id)))
      );
      const aptList = apartmentSnaps
        .filter(snap => snap.exists())
        .map(snap => ({ id: snap.id, name: snap.data().name }));
      setApartments(aptList);
      if (userData.defaultApartment) {
        setSelectedApartment(userData.defaultApartment);
      } else if (aptList.length > 0) {
        setSelectedApartment(aptList[0].id);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  return (
    <ApartmentContext.Provider value={{ selectedApartment, setSelectedApartment, apartments, refreshApartments: fetchApartments }}>
      {children}
    </ApartmentContext.Provider>
  );
};

export function useApartment() {
  return useContext(ApartmentContext);
}
