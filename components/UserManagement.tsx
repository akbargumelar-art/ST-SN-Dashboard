import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { getUsers, addUser, updateUser, deleteUser } from '../services/storage';
import { Edit, Trash2, Save, X, UserPlus } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SALESFORCE);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    setUsers(getUsers());
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setName(user.name);
      setRole(user.role);
    } else {
      setEditingUser(null);
      setUsername('');
      setName('');
      setRole(UserRole.SALESFORCE);
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !name.trim()) {
      setError('Semua field harus diisi.');
      return;
    }

    // Check duplicate username
    const isDuplicate = users.some(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.id !== editingUser?.id
    );

    if (isDuplicate) {
      setError('Username sudah digunakan.');
      return;
    }

    if (editingUser) {
      updateUser({ ...editingUser, username, name, role });
    } else {
      addUser({ username, name, role });
    }

    loadUsers();
    handleCloseModal();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      deleteUser(id);
      loadUsers();
    }
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen User</h2>
          <p className="text-slate-500">Kelola akses dan peran pengguna aplikasi</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 transition-all"
        >
          <UserPlus size={18} />
          <span>Tambah User</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-700 text-sm">ID</th>
                <th className="px-6 py-4 font-bold text-slate-700 text-sm">Username</th>
                <th className="px-6 py-4 font-bold text-slate-700 text-sm">Nama Lengkap</th>
                <th className="px-6 py-4 font-bold text-slate-700 text-sm">Role</th>
                <th className="px-6 py-4 font-bold text-slate-700 text-sm text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500">#{user.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{user.username}</td>
                  <td className="px-6 py-4 text-slate-600">{user.name}</td>
                  <td className="px-6 py-4">
                    <span className={`
                      px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                      ${user.role === UserRole.SUPER_ADMIN ? 'bg-red-100 text-red-700' : 
                        user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 
                        user.role === UserRole.SUPERVISOR ? 'bg-blue-100 text-blue-700' : 
                        'bg-emerald-100 text-emerald-700'}
                    `}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => handleOpenModal(user)}
                        className="p-2 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      {/* Prevent deleting self or safeguard logic if needed */}
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? 'Edit User' : 'Tambah User Baru'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-red-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white text-black"
                  placeholder="Contoh: sales01"
                  disabled={!!editingUser} // Disable username edit to keep id sync simple
                />
                {editingUser && <p className="text-xs text-slate-400 mt-1">Username tidak dapat diubah.</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white text-black"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white text-black"
                >
                  <option value={UserRole.SALESFORCE}>Salesforce</option>
                  <option value={UserRole.SUPERVISOR}>Supervisor</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold shadow-lg shadow-red-600/20 transition-all flex items-center space-x-2"
                >
                  <Save size={18} />
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;