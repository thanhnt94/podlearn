import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Shield, 
  Mail, Calendar, ExternalLink, Trash2, Edit2 
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdminUser } from '../../types';

export const MemberHub: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Form states
  const [newUser, setNewUser] = useState({ username: '', email: '', full_name: '', password: '', role: 'free' });
  const [editForm, setEditForm] = useState({ username: '', email: '', full_name: '', role: 'free', password: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    try {
      await axios.post('/api/admin/users', newUser);
      setIsAddModalOpen(false);
      setNewUser({ username: '', email: '', full_name: '', password: '', role: 'free' });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.put(`/api/admin/users/${selectedUser.id}`, editForm);
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete ${user.username}?`)) return;
    try {
      await axios.delete(`/api/admin/users/${user.id}`);
      fetchUsers();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleStyle = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-sky-500/10 border-sky-500/20 text-sky-400';
      case 'vip': return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      default: return 'bg-white/5 border-white/5 text-slate-400';
    }
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'admin': return 'Admin';
      case 'vip': return 'VIP User';
      default: return 'Free User';
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8 rounded-[2.5rem]">
        <div className="relative flex-1 max-w-xl">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search members by identity, email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-sm outline-none focus:border-sky-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-6 py-4 glass-pill rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
            <Filter size={16} />
            Advanced Filtering
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-8 py-4 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:scale-105 transition-all"
          >
            Instate New Member
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="glass rounded-[3rem] overflow-hidden border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Identity</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status & Role</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Joined Date</th>
              <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="px-10 py-10 h-24 bg-white/[0.01]" />
                </tr>
              ))
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-black text-white shadow-xl relative overflow-hidden">
                       {user.username.substring(0, 2).toUpperCase()}
                       {user.is_admin && <div className="absolute top-0 right-0 w-3 h-3 bg-sky-500 border-2 border-slate-800 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white flex items-center gap-2">
                        {user.username}
                        {user.full_name && <span className="text-slate-500 font-bold">• {user.full_name}</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase mt-0.5">
                        <Mail size={10} /> {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-pill border ${getRoleStyle(user.role)} text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5`}>
                      {user.role === 'admin' ? <Shield size={10} /> : null}
                      {getRoleLabel(user.role)}
                    </div>
                    {user.central_auth_id && (
                      <div className="px-3 py-1.5 rounded-pill bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <ExternalLink size={10} /> SSO Linked
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Calendar size={14} className="text-slate-600" />
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        setSelectedUser(user);
                        setEditForm({
                          username: user.username,
                          email: user.email,
                          full_name: user.full_name || '',
                          role: user.role,
                          password: ''
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="p-3 rounded-xl bg-white/5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user)}
                      className="p-3 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && !loading && (
          <div className="p-20 text-center text-slate-500 space-y-4">
             <div className="text-sm font-black uppercase tracking-widest">No matching identities found</div>
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Try adjusting your filtration criteria</div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-10 rounded-[3rem] w-full max-w-xl space-y-8 border border-white/10 overflow-y-auto max-h-[90vh]"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Instate New Member</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Initialize a fresh local identity</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">User Identity</label>
                  <input 
                    type="text" placeholder="Username" 
                    value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" placeholder="email@example.com" 
                    value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name (Tên)</label>
                  <input 
                    type="text" placeholder="Thanh Nguyen..." 
                    value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secret Key (Password)</label>
                  <input 
                    type="password" placeholder="••••••••" 
                    value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Authorization</label>
                  <select 
                    value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white appearance-none"
                  >
                    <option value="free">Free User</option>
                    <option value="vip">VIP User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 glass-pill rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">Cancel</button>
                <button onClick={handleCreateUser} className="flex-1 py-4 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase">Initialize Member</button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-10 rounded-[3rem] w-full max-w-xl space-y-8 border border-white/10 overflow-y-auto max-h-[90vh]"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Modify Member Identity</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Adjust permissions & info for {selectedUser.username}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">User Identity</label>
                  <input 
                    type="text" 
                    value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name (Tên)</label>
                  <input 
                    type="text" 
                    value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reset Password (Optional)</label>
                  <input 
                    type="password" placeholder="Leave blank to keep current"
                    value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Update Authorization Level</label>
                  <select 
                    value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}
                    className="w-full bg-slate-900/60 border border-white/5 p-4 rounded-2xl outline-none focus:border-sky-500/50 transition-all text-white appearance-none"
                  >
                    <option value="free">Free User</option>
                    <option value="vip">VIP User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 glass-pill rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">Cancel</button>
                <button onClick={handleUpdateUser} className="flex-1 py-4 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase">Update Identity</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
