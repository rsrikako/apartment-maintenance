import type React from "react";
import Whiteboard from "../components/Whiteboard";
import Stats from "../components/Stats";
import { useApartment } from "../context/ApartmentContext";
import Notice from "../components/Notice";

const Dashboard: React.FC = () => {
  const { selectedApartment } = useApartment();
  return (
    <div className="max-w-4xl mx-auto pb-24">
      {selectedApartment && (
        <>
          <Notice />
          <Stats />
          <Whiteboard />
        </>
      )}
    </div>
  );
};

export default Dashboard;
