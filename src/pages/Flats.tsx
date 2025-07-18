import React, { useEffect, useState } from "react";
import { useApartment } from "../context/ApartmentContext";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { createUserAndFirestore } from "../services/createUserAndFirestore";
import { getIdToken } from "firebase/auth";

interface Flat {
  id: string;
  flatNumber: string;
  status: "rented" | "self";
  ownerUid?: string;
  tenantUid?: string;
}

const Flats: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  // Form state for adding a flat
  const [form, setForm] = useState({
    flatNumber: "",
    status: "self" as "self" | "rented",
    ownerName: "",
    ownerContact: "",
    tenantName: "",
    tenantContact: "",
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Edit form state for editing a flat
  const [editForm, setEditForm] = useState({
    flatNumber: "",
    status: "self" as "self" | "rented",
    ownerName: "",
    ownerContact: "",
    tenantName: "",
    tenantContact: "",
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFlatId, setDeleteFlatId] = useState<string | null>(null);
  // const [adminLoading, setAdminLoading] = useState<string | null>(null); // Removed unused state
  const [showAdminModal, setShowAdminModal] = useState(false);
  // Add usersMap state to map phone to user doc
  const [usersMap, setUsersMap] = useState<Record<string, { role: string }>>(
    {}
  );
  // Fetch user details for all unique ownerUid and tenantUid in flats
  const [userDetailsMap, setUserDetailsMap] = useState<
    Record<string, { name?: string; phone?: string }>
  >({});
  // Add admin checkbox state for add and edit forms
  const [addAdmin, setAddAdmin] = useState(false);
  const [editAdmin, setEditAdmin] = useState(false);
  // Add admin checkbox state for tenant in add and edit forms
  const [addTenantAdmin, setAddTenantAdmin] = useState(false);
  const [editTenantAdmin, setEditTenantAdmin] = useState(false);

  useEffect(() => {
    if (!selectedApartment || !user) return;
    // Fetch apartment data to check admin
    getDoc(doc(db, "apartments", selectedApartment)).then((snap) => {
      const data = snap.data();
      setIsAdmin(!!(data && data.admins && data.admins.includes(user.uid)));
    });
  }, [selectedApartment, user]);

  useEffect(() => {
    if (!selectedApartment) return;
    setLoading(true);
    getDocs(collection(db, "apartments", selectedApartment, "flats"))
      .then((snap) => {
        setFlats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flat)));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load flats");
        setLoading(false);
      });
  }, [selectedApartment]);

  // Fetch users and their roles for selectedApartment based on apartment's admins array
  useEffect(() => {
    if (!selectedApartment || flats.length === 0) return;
    getDoc(doc(db, "apartments", selectedApartment)).then((snap) => {
      const data = snap.data();
      const admins: string[] = data?.admins || [];
      const map: Record<string, { role: string }> = {};
      flats.forEach((flat) => {
        if (flat.ownerUid) {
          map[flat.ownerUid] = {
            role: admins.includes(flat.ownerUid) ? "admin" : "owner",
          };
        }
        if (flat.status === "rented" && flat.tenantUid) {
          map[flat.tenantUid] = {
            role: admins.includes(flat.tenantUid) ? "admin" : "tenant",
          };
        }
      });
      setUsersMap(map);
    });
  }, [selectedApartment, flats]);

  // Fetch user details for all unique ownerUid and tenantUid in flats
  useEffect(() => {
    async function fetchUserDetails() {
      if (!flats.length) return;
      const uids = new Set<string>();
      flats.forEach((flat) => {
        if (flat.ownerUid) uids.add(flat.ownerUid);
        if (flat.tenantUid) uids.add(flat.tenantUid);
      });
      const userMap: Record<string, { name?: string; phone?: string }> = {};
      await Promise.all(
        Array.from(uids).map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const data = snap.data();
            userMap[uid] = {
              name: data.name || data.phone || uid,
              phone: data.phone,
            };
          }
        })
      );
      setUserDetailsMap(userMap);
    }
    fetchUserDetails();
  }, [flats]);

  // Helper: Upsert user in users collection for this apartment
  // Only allow upsert if you have the user's UID (required by Firestore rules)
  async function upsertUserWithUid(
    uid: string,
    apartmentId: string,
    phone: string,
    name: string
  ) {
    if (!uid || !phone) return;
    // Get existing user data
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const apartments: string[] = Array.isArray(userData.apartments)
      ? userData.apartments
      : [];
    const updatedApartments = apartments.includes(apartmentId)
      ? apartments
      : [...apartments, apartmentId];
    await setDoc(
      userDocRef,
      {
        ...userData,
        apartments: updatedApartments,
        name,
        phone,
      },
      { merge: true }
    );
  }

  // Helper: Remove user if not present in any other flat in this apartment (by UID)
  async function removeUserIfOrphanByUid(apartmentId: string, userUid: string) {
    if (!userUid) return;
    const flatsSnap = await getDocs(
      collection(db, "apartments", apartmentId, "flats")
    );
    const stillExists = flatsSnap.docs.some((d) => {
      const f = d.data();
      return f.ownerUid === userUid || f.tenantUid === userUid;
    });
    if (!stillExists) {
      await deleteDoc(doc(db, "users", userUid));
    }
  }

  // Helper: Create user via Cloud Function and return UID
  async function createUserAndGetUid(
    phone: string,
    name: string,
    apartments: string[]
  ): Promise<string> {
    if (!user) {
      throw new Error("You must be signed in to create users.");
    }
    const token = await getIdToken(user, true);
    console.log("DEBUG: User UID:", user.uid, "Token:", token);
    return await createUserAndFirestore(phone, name, apartments);
  }

  // Helper: Update apartment admins array
  async function updateApartmentAdmins(
    apartmentId: string,
    uidsToAdd: string[]
  ) {
    if (!apartmentId || !uidsToAdd.length) return;
    const aptRef = doc(db, "apartments", apartmentId);
    const aptSnap = await getDoc(aptRef);
    const data = aptSnap.exists() ? aptSnap.data() : {};
    const admins: string[] = Array.isArray(data.admins) ? data.admins : [];
    const updatedAdmins = Array.from(new Set([...admins, ...uidsToAdd]));
    await updateDoc(aptRef, { admins: updatedAdmins });
  }

  // Helper: Remove apartment admins
  async function removeApartmentAdmins(
    apartmentId: string,
    uidsToRemove: string[]
  ) {
    if (!apartmentId || !uidsToRemove.length) return;
    const aptRef = doc(db, "apartments", apartmentId);
    const aptSnap = await getDoc(aptRef);
    const data = aptSnap.exists() ? aptSnap.data() : {};
    const admins: string[] = Array.isArray(data.admins) ? data.admins : [];
    const updatedAdmins = admins.filter((uid) => !uidsToRemove.includes(uid));
    await updateDoc(aptRef, { admins: updatedAdmins });
  }

  const handleAddFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment) return;
    setLoading(true);
    try {
      // Sync user: create or update owner
      let ownerUid: string | null = null;
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.phone === form.ownerContact) {
          ownerUid = docSnap.id;
        }
      });
      if (!ownerUid && form.ownerContact && form.ownerName) {
        ownerUid = await createUserAndGetUid(
          form.ownerContact,
          form.ownerName,
          [selectedApartment]
        );
      }
      // Sync user: create or update tenant if rented
      let tenantUid: string | null = null;
      if (form.status === "rented" && form.tenantContact && form.tenantName) {
        usersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.phone === form.tenantContact) {
            tenantUid = docSnap.id;
          }
        });
        if (!tenantUid) {
          tenantUid = await createUserAndGetUid(
            form.tenantContact,
            form.tenantName,
            [selectedApartment]
          );
        }
      }
      // Debug log before adding flat
      console.log(
        "DEBUG: selectedApartment",
        selectedApartment,
        "user.uid",
        user?.uid
      );
      // Upsert user info for owner and tenant BEFORE creating the flat
      if (ownerUid && form.ownerContact && form.ownerName) {
        await upsertUserWithUid(
          ownerUid,
          selectedApartment,
          form.ownerContact,
          form.ownerName
        );
      }
      if (
        form.status === "rented" &&
        form.tenantContact &&
        form.tenantName &&
        tenantUid
      ) {
        await upsertUserWithUid(
          tenantUid,
          selectedApartment,
          form.tenantContact,
          form.tenantName
        );
      }
      // If admin checkbox checked, add ownerUid to admins
      if (addAdmin && ownerUid) {
        await updateApartmentAdmins(selectedApartment, [ownerUid]);
      }
      // If tenant admin checkbox checked, add tenantUid to admins
      if (addTenantAdmin && tenantUid) {
        await updateApartmentAdmins(selectedApartment, [tenantUid]);
      }
      // Now add the flat with ownerUid and tenantUid references
      await addDoc(collection(db, "apartments", selectedApartment, "flats"), {
        flatNumber: form.flatNumber,
        status: form.status,
        ownerUid,
        tenantUid:
          form.status === "rented" && form.tenantContact ? tenantUid : null,
      });
      setShowAdd(false);
      setForm({
        flatNumber: "",
        ownerName: "",
        ownerContact: "",
        status: "self",
        tenantName: "",
        tenantContact: "",
      });
      setAddAdmin(false);
      setAddTenantAdmin(false);
      // Refresh
      const snap = await getDocs(
        collection(db, "apartments", selectedApartment, "flats")
      );
      setFlats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flat)));
    } catch (e) {
      setError("Failed to add flat");
      console.error(e);
    }
    setLoading(false);
  };

  const handleDeleteFlat = async (id: string) => {
    if (!selectedApartment) return;
    setLoading(true);
    try {
      const flat = flats.find((f) => f.id === id);
      if (flat) {
        // Remove owner and tenant from admins if present
        const uidsToRemove = [flat.ownerUid, flat.tenantUid].filter(
          Boolean
        ) as string[];
        if (uidsToRemove.length) {
          await removeApartmentAdmins(selectedApartment, uidsToRemove);
        }
        // Remove owner if orphan (after deleting the flat)
        await deleteDoc(doc(db, "apartments", selectedApartment, "flats", id));
        if (flat.ownerUid) {
          await removeUserIfOrphanByUid(selectedApartment, flat.ownerUid);
        }
        // Remove tenant if orphan
        if (flat.tenantUid) {
          await removeUserIfOrphanByUid(selectedApartment, flat.tenantUid);
        }
      }
      setFlats(flats.filter((f) => f.id !== id));
    } catch {
      setError("Failed to delete flat");
    }
    setLoading(false);
  };

  const handleEditFlat = (flat: Flat) => {
    setEditId(flat.id);
    setEditForm({
      flatNumber: flat.flatNumber,
      status: flat.status,
      ownerName: (flat.ownerUid && userDetailsMap[flat.ownerUid]?.name) || "",
      ownerContact:
        (flat.ownerUid && userDetailsMap[flat.ownerUid]?.phone) || "",
      tenantName:
        (flat.tenantUid && userDetailsMap[flat.tenantUid]?.name) || "",
      tenantContact:
        (flat.tenantUid && userDetailsMap[flat.tenantUid]?.phone) || "",
    });
    // Prefill admin checkbox if owner is admin
    setEditAdmin(
      flat.ownerUid ? usersMap[flat.ownerUid]?.role === "admin" : false
    );
    // Prefill tenant admin checkbox if tenant is admin
    setEditTenantAdmin(
      flat.tenantUid ? usersMap[flat.tenantUid]?.role === "admin" : false
    );
  };

  const handleUpdateFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment || !editId) return;
    setLoading(true);
    try {
      // Get the old flat before update
      const oldFlatSnap = await getDoc(
        doc(db, "apartments", selectedApartment, "flats", editId)
      );
      const oldFlat = oldFlatSnap.exists()
        ? (oldFlatSnap.data() as Flat)
        : null;
      const oldOwnerUid = oldFlat?.ownerUid;

      // Find or create owner user
      let ownerUid: string | null = null;
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.phone === editForm.ownerContact) {
          ownerUid = docSnap.id;
        }
      });
      if (!ownerUid && editForm.ownerContact && editForm.ownerName) {
        ownerUid = await createUserAndGetUid(
          editForm.ownerContact,
          editForm.ownerName,
          [selectedApartment]
        );
      }
      // If phone is unchanged, just update user doc
      if (oldFlat && oldFlat.ownerUid === ownerUid) {
        if (ownerUid && editForm.ownerContact && editForm.ownerName) {
          await upsertUserWithUid(
            ownerUid,
            selectedApartment,
            editForm.ownerContact,
            editForm.ownerName
          );
        }
      } else {
        // Phone changed: update new user, and after update, remove old user if orphan
        if (ownerUid && editForm.ownerContact && editForm.ownerName) {
          await upsertUserWithUid(
            ownerUid,
            selectedApartment,
            editForm.ownerContact,
            editForm.ownerName
          );
        }
      }

      // Find or create tenant user if rented
      let tenantUid: string | null = null;
      if (
        editForm.status === "rented" &&
        editForm.tenantContact &&
        editForm.tenantName
      ) {
        usersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.phone === editForm.tenantContact) {
            tenantUid = docSnap.id;
          }
        });
        if (!tenantUid) {
          tenantUid = await createUserAndGetUid(
            editForm.tenantContact,
            editForm.tenantName,
            [selectedApartment]
          );
        }
      }
      // Update flat with new ownerUid and tenantUid
      await updateDoc(
        doc(db, "apartments", selectedApartment, "flats", editId),
        {
          flatNumber: editForm.flatNumber,
          status: editForm.status,
          ownerUid,
          tenantUid:
            editForm.status === "rented" && editForm.tenantContact
              ? tenantUid
              : null,
        }
      );
      // If admin checkbox checked, add ownerUid to admins; if unchecked, remove
      if (editAdmin && ownerUid) {
        await updateApartmentAdmins(selectedApartment, [ownerUid]);
      } else if (!editAdmin && ownerUid) {
        await removeApartmentAdmins(selectedApartment, [ownerUid]);
      }
      // If tenant admin checkbox checked, add tenantUid to admins; if unchecked, remove
      if (editTenantAdmin && tenantUid) {
        await updateApartmentAdmins(selectedApartment, [tenantUid]);
      } else if (!editTenantAdmin && tenantUid) {
        await removeApartmentAdmins(selectedApartment, [tenantUid]);
      }
      // If owner changed, remove old owner if orphan
      if (oldFlat && oldOwnerUid && oldOwnerUid !== ownerUid) {
        await removeUserIfOrphanByUid(selectedApartment, oldOwnerUid);
      }
      setEditId(null);
      setEditForm({
        flatNumber: "",
        ownerName: "",
        ownerContact: "",
        status: "self",
        tenantName: "",
        tenantContact: "",
      });
      setEditAdmin(false);
      setEditTenantAdmin(false);
      // Refresh
      const snap = await getDocs(
        collection(db, "apartments", selectedApartment, "flats")
      );
      setFlats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flat)));
    } catch {
      setError("Failed to update flat");
    }
    setLoading(false);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditForm({
      flatNumber: "",
      ownerName: "",
      ownerContact: "",
      status: "self",
      tenantName: "",
      tenantContact: "",
    });
  };

  const openDeleteModal = (id: string) => {
    setDeleteFlatId(id);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteFlatId(null);
  };

  const confirmDeleteFlat = async () => {
    if (deleteFlatId) {
      await handleDeleteFlat(deleteFlatId);
      closeDeleteModal();
    }
  };

  // Admin users list for modal (UIDs)
  const adminUsers = Object.entries(usersMap)
    .filter(([, u]) => u.role === "admin")
    .map(([uid]) => uid);
  const adminNames = adminUsers
    .map((uid) => ({
      name: userDetailsMap[uid]?.name || uid,
      phone: userDetailsMap[uid]?.phone || "",
      uid,
    }))
    .filter(
      (v, i, arr) => v.phone && arr.findIndex((x) => x.phone === v.phone) === i
    );

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24 min-h-screen">
      <div className="content-center justify-between">
        <div className="flex gap-2 m-auto">
          {isAdmin && (
            <button
              className="px-6 py-3 bg-emerald-600 text-white rounded-full shadow-lg flex items-center gap-2 text-base font-semibold hover:bg-emerald-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              onClick={() => setShowAdd((v) => !v)}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {showAdd ? "Cancel" : "Add Flat"}
            </button>
          )}
          <button
            className="px-6 py-3 bg-slate-500 text-white rounded-full shadow-lg flex items-center gap-2 text-base font-semibold hover:bg-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            onClick={() => setShowAdminModal(true)}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
              />
            </svg>
            Contact Admin
          </button>
        </div>
      </div>
      {showAdd && isAdmin && (
        <form
          onSubmit={handleAddFlat}
          className="mb-4 flex flex-col gap-2 bg-white bg-opacity-80 p-4 rounded-2xl shadow"
        >
          <input
            className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200"
            placeholder="Flat Number"
            value={form.flatNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, flatNumber: e.target.value }))
            }
            required
          />
          <input
            className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200"
            placeholder="Owner Name"
            value={form.ownerName}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerName: e.target.value }))
            }
            required
          />
          <div className="flex items-center">
            <span className="px-2 py-2 bg-gray-100 border border-slate-200 rounded-l">+91</span>
            <input
              className="border border-slate-200 p-2 rounded-r focus:ring-2 focus:ring-emerald-200 flex-1"
              placeholder="Owner Contact"
              value={form.ownerContact.replace(/^\+91/, '')}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerContact: '+91' + e.target.value.replace(/^\+91/, '') }))
              }
              required
              maxLength={10}
              pattern="[0-9]{10}"
            />
          </div>
          <select
            className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as "rented" | "self",
              }))
            }
          >
            <option value="self">Self Occupied</option>
            <option value="rented">Rented</option>
          </select>
          {form.status === "rented" && (
            <>
              <input
                className="border border-slate-200 p-2 rounded focus:ring-2 focus:ring-emerald-200"
                placeholder="Tenant Name"
                value={form.tenantName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tenantName: e.target.value }))
                }
                required
              />
              <div className="flex items-center">
                <span className="px-2 py-2 bg-gray-100 border border-slate-200 rounded-l">+91</span>
                <input
                  className="border border-slate-200 p-2 rounded-r focus:ring-2 focus:ring-emerald-200 flex-1"
                  placeholder="Tenant Contact"
                  value={form.tenantContact.replace(/^\+91/, '')}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tenantContact: '+91' + e.target.value.replace(/^\+91/, '') }))
                  }
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                />
              </div>
              {/* Tenant admin checkbox */}
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={addTenantAdmin}
                  onChange={(e) => setAddTenantAdmin(e.target.checked)}
                />
                <span className="text-sm font-medium text-emerald-700">
                  Make Tenant Admin
                </span>
              </label>
            </>
          )}
          {/* Owner admin checkbox */}
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={addAdmin}
              onChange={(e) => setAddAdmin(e.target.checked)}
            />
            <span className="text-sm font-medium text-emerald-700">
              Make Owner Admin
            </span>
          </label>
          <button
            type="submit"
            className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700"
          >
            Add
          </button>
        </form>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : flats.length === 0 ? (
        <div className="text-gray-500 text-center mt-8 text-lg font-medium">
          No flats available.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 mt-4">
          {flats.map((flat) => (
            <div
              key={flat.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col items-center border border-blue-200 max-w-xs mx-auto group relative transition-all duration-200 hover:shadow-2xl"
            >
              {/* Top image section */}
              <div className="w-full h-24 bg-gradient-to-r from-blue-400 to-blue-200 flex items-end justify-center relative">
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <div className="w-16 h-16 bg-white rounded-full border-4 border-white shadow flex items-center justify-center">
                    {/* Building icon as avatar */}
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 21V7a2 2 0 012-2h2a2 2 0 012 2v14M13 21V3a2 2 0 012-2h2a2 2 0 012 2v18M9 21h6"
                      />
                    </svg>
                  </div>
                </div>
                {/* Edit/Delete icons top right, visible on hover */}
                {isAdmin && user && flat.ownerUid !== undefined && flat.tenantUid !== undefined &&
                  !(flat.ownerUid === user.uid || flat.tenantUid === user.uid) && (
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <>
                      <button
                        className="p-1 bg-yellow-100 hover:bg-yellow-200 rounded-full"
                        title="Edit"
                        onClick={() => handleEditFlat(flat)}
                      >
                        <svg
                          className="w-5 h-5 text-yellow-700"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.232 5.232l3.536 3.536M9 13l6-6M3 17.25V21h3.75l11.06-11.06a2.121 2.121 0 00-3-3L3 17.25z"
                          />
                        </svg>
                      </button>
                      <button
                        className="p-1 bg-red-100 hover:bg-red-200 rounded-full"
                        title="Delete"
                        onClick={() => openDeleteModal(flat.id)}
                      >
                        <svg
                          className="w-5 h-5 text-red-700"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0h8"
                          />
                        </svg>
                      </button>
                    </>
                  </div>
                )}
              </div>
              <div className="pt-12 pb-4 px-4 w-full flex flex-col items-center">
                <div className="font-bold text-lg text-blue-800">
                  Flat #{flat.flatNumber}
                </div>
                <div className="flex justify-center gap-6 mt-2 w-full">
                  <div className="flex flex-col items-center">
                    <span className="text-blue-700 font-semibold text-sm">
                      {flat.status === "rented" ? "Rented" : "Self"}
                    </span>
                    <span className="text-xs text-gray-400">Status</span>
                  </div>
                </div>
                {/* Admin ribbon above action buttons for owner */}
                {flat.ownerUid && usersMap[flat.ownerUid]?.role === "admin" && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-24 z-20">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      Admin (Owner)
                    </span>
                  </div>
                )}
                {/* Admin ribbon above action buttons for tenant */}
                {flat.status === "rented" &&
                  flat.tenantUid &&
                  usersMap[flat.tenantUid]?.role === "admin" && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-36 z-20">
                      <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                        Admin (Tenant)
                      </span>
                    </div>
                  )}
                {/* Action buttons grouped by Owner and Tenant, with names and copy buttons */}
                <div className="flex flex-col gap-2 mt-4 w-full">
                  {/* Owner Actions */}
                  <div className="flex items-center w-full justify-center gap-x-2">
                    <span className="text-xs font-semibold text-gray-500 mr-1">
                      Owner:
                    </span>
                    <span
                      className="text-sm font-medium text-blue-900 mr-2 truncate max-w-[80px]"
                      title={
                        flat.ownerUid && userDetailsMap[flat.ownerUid]?.name
                          ? userDetailsMap[flat.ownerUid]?.name
                          : flat.ownerUid || ""
                      }
                    >
                      {flat.ownerUid && userDetailsMap[flat.ownerUid]?.name
                        ? userDetailsMap[flat.ownerUid]?.name
                        : flat.ownerUid || ""}
                    </span>
                    <button
                      className="w-8 h-8 flex items-center justify-center p-0 bg-gray-100 hover:bg-gray-200 rounded-full mr-2"
                      title="Copy Owner Contact"
                      onClick={() => {
                        const phone =
                          flat.ownerUid && userDetailsMap[flat.ownerUid]?.phone;
                        if (phone) navigator.clipboard.writeText(phone);
                      }}
                    >
                      <svg
                        className="w-4 h-4 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                    <a
                      href={`tel:${
                        flat.ownerUid && userDetailsMap[flat.ownerUid]?.phone
                          ? userDetailsMap[flat.ownerUid]?.phone
                          : ""
                      }`}
                      className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-0"
                      title="Call Owner"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-.7.7a16.001 16.001 0 006.36 6.36l.7-.7a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"
                        />
                      </svg>
                    </a>
                    <a
                      href={`https://wa.me/${
                        flat.ownerUid && userDetailsMap[flat.ownerUid]?.phone
                          ? userDetailsMap[flat.ownerUid]?.phone?.replace(
                              /\D/g,
                              ""
                            )
                          : ""
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded-full p-0"
                      title="WhatsApp Owner"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20.52 3.48A12.07 12.07 0 0012 0C5.37 0 0 5.37 0 12a11.94 11.94 0 001.67 6.13L0 24l6.37-1.67A12.07 12.07 0 0012 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22a9.93 9.93 0 01-5.1-1.39l-.36-.21-3.78 1 1-3.68-.23-.38A9.94 9.94 0 012 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.41-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.62-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.34-.26.27-1 1-1 2.43s1.02 2.82 1.16 3.02c.14.2 2.01 3.07 4.88 4.19.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.12.55-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z" />
                      </svg>
                    </a>
                  </div>
                  {/* Tenant Actions */}
                  {flat.status === "rented" && (
                    <div className="flex items-center w-full justify-center gap-x-2 mt-1">
                      <span className="text-xs font-semibold text-gray-500 mr-1">
                        Tenant:
                      </span>
                      <span
                        className="text-sm font-medium text-blue-900 mr-2 truncate max-w-[80px]"
                        title={
                          flat.tenantUid && userDetailsMap[flat.tenantUid]?.name
                            ? userDetailsMap[flat.tenantUid]?.name
                            : flat.tenantUid || ""
                        }
                      >
                        {flat.tenantUid && userDetailsMap[flat.tenantUid]?.name
                          ? userDetailsMap[flat.tenantUid]?.name
                          : flat.tenantUid || ""}
                      </span>
                      <button
                        className="w-8 h-8 flex items-center justify-center p-0 bg-gray-100 hover:bg-gray-200 rounded-full mr-2"
                        title="Copy Tenant Contact"
                        onClick={() => {
                          const phone =
                            flat.tenantUid &&
                            userDetailsMap[flat.tenantUid]?.phone;
                          if (phone) navigator.clipboard.writeText(phone);
                        }}
                      >
                        <svg
                          className="w-4 h-4 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                      <a
                        href={`tel:${
                          flat.tenantUid &&
                          userDetailsMap[flat.tenantUid]?.phone
                            ? userDetailsMap[flat.tenantUid]?.phone
                            : ""
                        }`}
                        className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-0"
                        title="Call Tenant"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-.7.7a16.001 16.001 0 006.36 6.36l.7-.7a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"
                          />
                        </svg>
                      </a>
                      <a
                        href={`https://wa.me/${
                          flat.tenantUid &&
                          userDetailsMap[flat.tenantUid]?.phone
                            ? userDetailsMap[flat.tenantUid]?.phone?.replace(
                                /\D/g,
                                ""
                              )
                            : ""
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded-full p-0"
                        title="WhatsApp Tenant"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M20.52 3.48A12.07 12.07 0 0012 0C5.37 0 0 5.37 0 12a11.94 11.94 0 001.67 6.13L0 24l6.37-1.67A12.07 12.07 0 0012 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22a9.93 9.93 0 01-5.1-1.39l-.36-.21-3.78 1 1-3.68-.23-.38A9.94 9.94 0 012 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.41-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.62-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.34-.26.27-1 1-1 2.43s1.02 2.82 1.16 3.02c.14.2 2.01 3.07 4.88 4.19.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.12.55-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
                {isAdmin && editId === flat.id ? (
                  <form
                    onSubmit={handleUpdateFlat}
                    className="flex flex-col gap-2"
                  >
                    <input
                      className="border p-2 rounded"
                      placeholder="Owner Name"
                      value={editForm.ownerName}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          ownerName: e.target.value,
                        }))
                      }
                      required
                    />
                    <div className="flex items-center">
                      <span className="px-2 py-2 bg-gray-100 border rounded-l">+91</span>
                      <input
                        className="border p-2 rounded-r flex-1"
                        placeholder="Owner Contact"
                        value={editForm.ownerContact.replace(/^\+91/, '')}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            ownerContact: '+91' + e.target.value.replace(/^\+91/, '')
                          }))
                        }
                        required
                        maxLength={10}
                        pattern="[0-9]{10}"
                      />
                    </div>
                    <input
                      className="border p-2 rounded"
                      placeholder="Flat Number"
                      value={editForm.flatNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          flatNumber: e.target.value,
                        }))
                      }
                      required
                    />
                    <select
                      className="border p-2 rounded"
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          status: e.target.value as "rented" | "self",
                        }))
                      }
                    >
                      <option value="self">Self Occupied</option>
                      <option value="rented">Rented</option>
                    </select>
                    {editForm.status === "rented" && (
                      <>
                        <input
                          className="border p-2 rounded"
                          placeholder="Tenant Name"
                          value={editForm.tenantName}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              tenantName: e.target.value,
                            }))
                          }
                          required
                        />
                        <div className="flex items-center">
                          <span className="px-2 py-2 bg-gray-100 border rounded-l">+91</span>
                          <input
                            className="border p-2 rounded-r flex-1"
                            placeholder="Tenant Contact"
                            value={editForm.tenantContact.replace(/^\+91/, '')}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                tenantContact: '+91' + e.target.value.replace(/^\+91/, '')
                              }))
                            }
                            required
                            maxLength={10}
                            pattern="[0-9]{10}"
                          />
                        </div>
                        {/* Tenant admin checkbox */}
                        <label className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            checked={editTenantAdmin}
                            onChange={(e) =>
                              setEditTenantAdmin(e.target.checked)
                            }
                            disabled={(() => {
                              if (editForm.status !== "rented") return true;
                              if (!user) return false;
                              const flatIdx = editId
                                ? flats.findIndex((f) => f.id === editId)
                                : -1;
                              return (
                                flatIdx !== -1 &&
                                flats[flatIdx]?.tenantUid === user.uid
                              );
                            })()}
                          />
                          <span
                            className={`text-sm font-medium ${(() => {
                              if (editForm.status !== "rented")
                                return "text-gray-400";
                              if (!user) return "text-blue-800";
                              const flatIdx = editId
                                ? flats.findIndex((f) => f.id === editId)
                                : -1;
                              return flatIdx !== -1 &&
                                flats[flatIdx]?.tenantUid === user.uid
                                ? "text-gray-400"
                                : "text-blue-800";
                            })()}`}
                          >
                            Make Tenant Admin
                          </span>
                        </label>
                      </>
                    )}
                    {/* Owner admin checkbox */}
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={editAdmin}
                        onChange={(e) => setEditAdmin(e.target.checked)}
                        disabled={
                          !!user &&
                          flats[
                            editId
                              ? flats.findIndex((f) => f.id === editId)
                              : -1
                          ]?.ownerUid === user.uid
                        }
                      />
                      <span
                        className={`text-sm font-medium ${
                          !!user &&
                          flats[
                            editId
                              ? flats.findIndex((f) => f.id === editId)
                              : -1
                          ]?.ownerUid === user.uid
                            ? "text-gray-400"
                            : "text-blue-800"
                        }`}
                      >
                        Make Owner Admin
                      </span>
                    </label>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col items-center">
            <div className="text-lg font-semibold mb-2 text-red-700">
              Delete Flat?
            </div>
            <div className="text-gray-700 mb-4 text-center">
              Are you sure you want to delete this flat? This action cannot be
              undone.
            </div>
            <div className="flex gap-4 mt-2">
              <button
                onClick={confirmDeleteFlat}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={closeDeleteModal}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Contact Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 flex flex-col items-center">
            <div className="text-lg font-semibold mb-2 text-blue-700">
              Apartment Admins
            </div>
            {adminNames.length === 0 ? (
              <div className="text-gray-500 mb-4">No admins found.</div>
            ) : (
              <div className="w-full flex flex-col gap-4 mb-4">
                {adminNames.map((admin, idx) => {
                  if (!admin.phone) return null;
                  return (
                    <div
                      key={admin.phone + idx}
                      className="flex flex-col items-center border-b pb-2 last:border-b-0"
                    >
                      <div className="font-semibold text-blue-900 text-base">
                        {admin.name || admin.phone}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button
                          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full"
                          title="Copy Phone"
                          onClick={() =>
                            navigator.clipboard.writeText(admin.phone!)
                          }
                        >
                          <svg
                            className="w-5 h-5 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                        <a
                          href={`tel:${admin.phone}`}
                          className="w-10 h-10 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full"
                          title="Call"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-.7.7a16.001 16.001 0 006.36 6.36l.7-.7a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"
                            />
                          </svg>
                        </a>
                        <a
                          href={`https://wa.me/${admin.phone.replace(
                            /\D/g,
                            ""
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded-full"
                          title="WhatsApp"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M20.52 3.48A12.07 12.07 0 0012 0C5.37 0 0 5.37 0 12a11.94 11.94 0 001.67 6.13L0 24l6.37-1.67A12.07 12.07 0 0012 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22a9.93 9.93 0 01-5.1-1.39l-.36-.21-3.78 1 1-3.68-.23-.38A9.94 9.94 0 012 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.41-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.62-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.34-.26.27-1 1-1 2.43s1.02 2.82 1.16 3.02c.14.2 2.01 3.07 4.88 4.19.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.12.55-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setShowAdminModal(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Flats;
