
import React, { useState } from 'react';
import { OdooCredential } from '../types';
import { 
  Plus, 
  Trash2, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  Edit2,
  Database,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface AdminPanelProps {
  credentials: OdooCredential[];
  setCredentials: React.Dispatch<React.SetStateAction<OdooCredential[]>>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ credentials, setCredentials }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCred, setNewCred] = useState<Partial<OdooCredential>>({
    companyName: '',
    url: '',
    db: '',
    username: '',
    isActive: true
  });

  const handleAdd = () => {
    if (newCred.companyName && newCred.url && newCred.db) {
      setCredentials([
        ...credentials,
        {
          ...(newCred as OdooCredential),
          id: Date.now().toString(),
          lastSync: 'Just now'
        }
      ]);
      setShowAddModal(false);
      setNewCred({ companyName: '', url: '', db: '', username: '', isActive: true });
    }
  };

  const toggleStatus = (id: string) => {
    setCredentials(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const removeCred = (id: string) => {
    if (window.confirm('Are you sure you want to remove this connection?')) {
      setCredentials(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Connected Databases</h2>
          <p className="text-slate-500 text-sm mt-1">Manage external Odoo instance credentials and synchronization status.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} />
          <span>Add New Connection</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 text-xs uppercase tracking-wider font-bold">
              <th className="px-6 py-4">Company & Instance</th>
              <th className="px-6 py-4">Database Info</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Sync</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {credentials.map(cred => (
              <tr key={cred.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                         <Database size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-slate-800">{cred.companyName}</p>
                         <p className="text-xs text-slate-400 flex items-center gap-1">
                            <ExternalLink size={10} /> {cred.url}
                         </p>
                      </div>
                   </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">DB: {cred.db}</span>
                      <span className="text-xs text-slate-400">User: {cred.username}</span>
                   </div>
                </td>
                <td className="px-6 py-4">
                   <button 
                    onClick={() => toggleStatus(cred.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      cred.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                   >
                     {cred.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                     {cred.isActive ? 'Active' : 'Paused'}
                   </button>
                </td>
                <td className="px-6 py-4">
                   <span className="text-sm text-slate-500">{cred.lastSync || 'Never'}</span>
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                         <Edit2 size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                         <RefreshCcw size={18} />
                      </button>
                      <button 
                        onClick={() => removeCred(cred.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
               <Database size={24} />
            </div>
            <div>
               <p className="text-xs text-slate-400 font-bold uppercase">Total Connections</p>
               <h4 className="text-2xl font-black text-slate-800">{credentials.length}</h4>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
               <CheckCircle2 size={24} />
            </div>
            <div>
               <p className="text-xs text-slate-400 font-bold uppercase">Healthy Links</p>
               <h4 className="text-2xl font-black text-slate-800">{credentials.filter(c => c.isActive).length}</h4>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
               <ShieldCheck size={24} />
            </div>
            <div>
               <p className="text-xs text-slate-400 font-bold uppercase">System Uptime</p>
               <h4 className="text-2xl font-black text-slate-800">99.9%</h4>
            </div>
         </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">New Odoo Connection</h3>
              <p className="text-sm text-slate-500 mt-1">Provide the XML-RPC credentials to start analyzing data.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g. Acme Corp"
                  value={newCred.companyName}
                  onChange={e => setNewCred({...newCred, companyName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Odoo URL</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="https://company.odoo.com"
                  value={newCred.url}
                  onChange={e => setNewCred({...newCred, url: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Database Name</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="prod_db"
                    value={newCred.db}
                    onChange={e => setNewCred({...newCred, db: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Username / Email</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="admin@example.com"
                    value={newCred.username}
                    onChange={e => setNewCred({...newCred, username: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-b-2xl border-t border-slate-100 flex gap-3 justify-end">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2 text-slate-500 font-bold hover:text-slate-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdd}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
