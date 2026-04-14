import React, { useEffect, useState } from 'react';
import { 
  Search, Filter, MoreVertical, Shield, 
  Mail, Calendar, ExternalLink, Trash2, Edit2 
} from 'lucide-react';
import type { AdminUser } from '../../types';

export const MemberHub: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const PODLEARN_DATA = (window as any).__PODLEARN_ADMIN_DATA__;
    fetch(PODLEARN_DATA.api_base + '/users')
      .then(r => r.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8 rounded-[2.5rem]">
        <div className="relative flex-1 max-w-xl">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search members by identity, email or ID..."
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
          <button className="px-8 py-4 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:scale-105 transition-all">
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
                      <div className="text-sm font-black text-white">{user.username}</div>
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase mt-0.5">
                        <Mail size={10} /> {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-3">
                    {user.is_admin ? (
                      <div className="px-3 py-1.5 rounded-pill bg-sky-500/10 border border-sky-500/20 text-sky-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Shield size={10} /> Administrator
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-pill bg-white/5 border border-white/5 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                        Standard Member
                      </div>
                    )}
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
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-3 rounded-xl bg-white/5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button className="p-3 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all">
                      <Trash2 size={16} />
                    </button>
                    <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                      <MoreVertical size={16} />
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
    </div>
  );
};
