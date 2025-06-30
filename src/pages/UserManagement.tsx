import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface UserDoc {
  phone: string;
  role: 'admin' | 'owner' | 'tenant';
}

const emptyUser: UserDoc = { phone: '', role: 'tenant' };

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [form, setForm] = useState<UserDoc>(emptyUser);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user?.phoneNumber === '+918341334400';
  const isOwner = user?.phoneNumber === '+917207734035';

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => d.data() as UserDoc));
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\+91\d{10}$/.test(form.phone)) {
      setError('Phone must be +91 followed by 10 digits');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), form);
      } else {
        await addDoc(collection(db, 'users'), form);
      }
      setForm(emptyUser);
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to save user');
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(phone: string) {
    const u = users.find(u => u.phone === phone);
    if (u) {
      setForm(u);
      setEditingId(phone);
    }
  }

  async function handleDelete(phone: string) {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const docId = snap.docs.find(d => d.data().phone === phone)?.id;
      if (docId) await deleteDoc(doc(db, 'users', docId));
      fetchUsers();
    } catch {
      setError('Failed to delete user');
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin && !isOwner) return <div className="text-center mt-10 text-red-500">Access denied</div>;

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="tel"
          placeholder="+911234567890"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="flex-1 px-4 py-2 border rounded-lg"
          required
        />
        <select
          value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value as UserDoc['role'] }))}
          className="flex-1 px-4 py-2 border rounded-lg"
        >
          <option value="tenant">Tenant</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={loading}>
          {editingId ? 'Update' : 'Add'}
        </button>
      </form>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <table className="w-full text-left border-t">
        <thead>
          <tr>
            <th className="py-2">Phone</th>
            <th className="py-2">Role</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.phone} className="border-t">
              <td className="py-2">{u.phone}</td>
              <td className="py-2 capitalize">{u.role}</td>
              <td className="py-2 flex gap-2">
                <button onClick={() => handleEdit(u.phone)} className="px-3 py-1 bg-yellow-400 rounded hover:bg-yellow-500">Edit</button>
                <button onClick={() => handleDelete(u.phone)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
