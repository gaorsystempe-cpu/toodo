
import React, { useState, useEffect } from 'react';
import { UserRole, OdooCredential } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: UserRole; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'settings'>('dashboard');
  const [selectedCredential, setSelectedCredential] = useState<OdooCredential | null>(null);

  // Simulated initial credentials for SuperAdmin
  const [credentials, setCredentials] = useState<OdooCredential[]>([
    {
      id: '1',
      companyName: 'Vida Factura Clic',
      url: 'https://vida.facturaclic.pe',
      db: 'vida_master',
      username: 'soporte@facturaclic.pe',
      isActive: true,
      lastSync: '2023-11-20 10:30'
    },
    {
      id: '3',
      companyName: 'IGP Factura Clic',
      url: 'https://igp.facturaclic.pe/',
      db: 'igp_master',
      username: 'soporte@facturaclic.pe',
      isActive: true,
      lastSync: 'Just now'
    },
    {
      id: '2',
      companyName: 'Restaurante El Gourmet',
      url: 'https://gourmet.odoo.com',
      db: 'gourmet_prod',
      username: 'admin@gourmet.com',
      isActive: false,
      lastSync: '2023-10-15 08:00'
    }
  ]);

  if (!user) {
    return <Login onLogin={(role, name) => setUser({ role, name })} />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar 
        role={user.role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => setUser(null)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          userName={user.name} 
          role={user.role} 
          activeTab={activeTab}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <Dashboard 
              credential={user.role === UserRole.COMPANY_USER ? credentials[0] : (selectedCredential || credentials[0])} 
              credentials={credentials}
              onSelectCredential={setSelectedCredential}
              role={user.role}
            />
          )}
          
          {activeTab === 'admin' && user.role === UserRole.SUPERADMIN && (
            <AdminPanel 
              credentials={credentials} 
              setCredentials={setCredentials} 
            />
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8 border border-slate-200">
               <h2 className="text-2xl font-bold mb-6">Configuración de Usuario</h2>
               <p className="text-slate-600 mb-4">Cuenta: {user.name}</p>
               <p className="text-slate-600 mb-4">Rol: {user.role}</p>
               <div className="pt-6 border-t border-slate-100">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Cambiar Contraseña</button>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
