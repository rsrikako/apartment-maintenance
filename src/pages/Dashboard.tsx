import React, { useEffect, useState } from "react";
import Whiteboard from "../components/Whiteboard";
import Stats from "../components/Stats";
import { useApartment } from "../context/ApartmentContext";
import Notice from "../components/Notice";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>("");
  const [showNotice, setShowNotice] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchName = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setUserName(userDoc.data()?.name || user.displayName || "");
      }
    };
    fetchName();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto pb-24 px-2">
      {/* Personalized Welcome */}
      <div className="flex flex-col items-center gap-3 mt-8 mb-6 text-center">
        <AppIcon className="w-12 h-12 text-emerald-600 mx-auto" />
        <div>
          <div className="text-lg font-semibold text-gray-700">Welcome{userName ? `, ${userName}` : ''}!</div>
          <div className="text-sm text-gray-500">Here's your apartment dashboard</div>
        </div>
      </div>

      {/* Quick Actions - icon + label, pill-shaped, centered, single row */}
      <div className="flex flex-row flex-wrap gap-3 mb-8 w-full max-w-lg mx-auto justify-center">
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition w-14 h-14"
            onClick={() => navigate('/financials')}
            title="Accounts"
          >
            <span className="text-2xl">💸</span>
          </button>
          <span className="text-xs mt-1 text-gray-700 font-medium">Accounts</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition w-14 h-14"
            onClick={() => setShowNotice(true)}
            title="Notifications"
          >
            <span className="text-2xl">📢</span>
          </button>
          <span className="text-xs mt-1 text-gray-700 font-medium">Notices</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center bg-amber-500 text-white rounded-full shadow hover:bg-amber-600 transition w-14 h-14"
            onClick={() => setShowWhiteboard(true)}
            title="Whiteboard"
          >
            <span className="text-2xl">📝</span>
          </button>
          <span className="text-xs mt-1 text-gray-700 font-medium">Whiteboard</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center bg-purple-600 text-white rounded-full shadow hover:bg-purple-700 transition w-14 h-14"
            onClick={() => navigate('/report')}
            title="Report"
          >
            <span className="text-2xl">📄</span>
          </button>
          <span className="text-xs mt-1 text-gray-700 font-medium">Report</span>
        </div>
      </div>

      {/* Show Notice as modal/panel if Post Notice is clicked */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 relative">
            <button
              className="absolute top-2 left-2 px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              onClick={() => setShowNotice(false)}
            >
              ← Back
            </button>
            <Notice />
          </div>
        </div>
      )}
      {/* Show Whiteboard as modal/panel if Open Whiteboard is clicked */}
      {showWhiteboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 relative">
            <button
              className="absolute top-2 left-2 px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              onClick={() => setShowWhiteboard(false)}
            >
              ← Back
            </button>
            <Whiteboard />
          </div>
        </div>
      )}
      {selectedApartment && !showNotice && !showWhiteboard && (
        <>
          <Stats />
        </>
      )}
    </div>
  );
};

export default Dashboard;
