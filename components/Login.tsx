
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Database, Shield, Layout, Building2, AlertCircle, Key } from 'lucide-react';

interface LoginProps {
  onLogin: (role: UserRole, name: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.SUPERADMIN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === UserRole.SUPERADMIN) {
      // Para SuperAdmin solo validamos la clave solicitada
      if (password === 'Luis2021') {
        onLogin(UserRole.SUPERADMIN, 'Super Administrador');
      } else {
        setError('Acceso denegado. La clave de SuperAdmin es incorrecta.');
      }
    } else {
      // Para Company seguimos pidiendo ambos por identificación de cuenta
      if (username.trim() !== '' && password.trim() !== '') {
        onLogin(UserRole.COMPANY_USER, username || 'Gerente de Compañía');
      } else {
        setError('Por favor, ingrese el usuario y clave de la compañía.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-8 md:p-10 border border-white/20 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-500/30 mb-4">
             <Database className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">OdooHub SaaS</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión de Rentabilidad Odoo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl mb-2">
             <button 
                type="button"
                onClick={() => { setRole(UserRole.SUPERADMIN); setError(''); setPassword(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${role === UserRole.SUPERADMIN ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
             >
                <Shield size={16} /> SuperAdmin
             </button>
             <button 
                type="button"
                onClick={() => { setRole(UserRole.COMPANY_USER); setError(''); setPassword(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${role === UserRole.COMPANY_USER ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
             >
                <Building2 size={16} /> Company
             </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* El campo de usuario solo se muestra para Company */}
          {role === UserRole.COMPANY_USER && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuario de Empresa</label>
               <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                placeholder="ej: soporte@facturaclic.pe"
                required={role === UserRole.COMPANY_USER}
               />
            </div>
          )}

          <div>
             <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
               {role === UserRole.SUPERADMIN ? 'Clave Maestra' : 'Contraseña'}
             </label>
             <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-11 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition" 
                  placeholder="••••••••"
                  required
                />
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
             </div>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition active:scale-95 shadow-xl shadow-blue-500/30 mt-4 flex items-center justify-center gap-2"
          >
            <span>Acceder al Dashboard</span>
          </button>
        </form>

        <div className="mt-8 text-center">
           <p className="text-xs text-slate-400">
             {role === UserRole.SUPERADMIN 
               ? 'Modo de administración total habilitado.' 
               : 'Ingrese sus credenciales corporativas asignadas.'}
           </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
