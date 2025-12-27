
import React, { useState } from 'react';
import { ArrowRight, Loader2, AlertTriangle, ShieldCheck, Citrus, Building2, Lock, UserCog, Rocket } from 'lucide-react';
import { OdooClient } from '../services/odoo';
import { OdooSession, ClientConfig } from '../types';
import { getClientByCode, verifyAdminPassword } from '../services/clientManager';

interface LoginProps {
  onLogin: (session: OdooSession | null, config: ClientConfig) => void;
  onAdminLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onAdminLogin }) => {
  const [accessCode, setAccessCode] = useState('');
  const [password, setPassword] = useState(''); 
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (isAdminMode) {
        if (verifyAdminPassword(password)) {
            setStatusMessage("Acceso Autorizado");
            setTimeout(() => { onAdminLogin(); }, 600);
        } else {
             setError("Contraseña incorrecta.");
             setIsLoading(false);
        }
        return;
    }

    const code = accessCode.trim().toUpperCase();
    try {
        const clientConfig = await getClientByCode(code);
        if (!clientConfig) {
            setError("Código de sucursal no encontrado.");
            setIsLoading(false);
            return;
        }
        setStatusMessage(`Conectando con servidor...`);
        const client = new OdooClient(clientConfig.url, clientConfig.db, true); 
        const uid = await client.authenticate(clientConfig.username, clientConfig.apiKey);
        if (!uid) throw new Error("Credenciales técnicas inválidas.");
        setStatusMessage("Sincronizando datos...");
        const userData: any[] = await client.searchRead(uid, clientConfig.apiKey, 'res.users', [['id', '=', uid]], ['company_ids']);

        let targetCompanyId = 0;
        let targetCompanyName = '';
        if (userData && userData.length > 0) {
            const companyIds = userData[0].company_ids || [];
            if (companyIds.length === 0) throw new Error("El usuario no tiene compañías asignadas.");
            const companiesData: any[] = await client.searchRead(uid, clientConfig.apiKey, 'res.company', [['id', 'in', companyIds]], ['name']);
            let foundCompany;
            if (!clientConfig.companyFilter || clientConfig.companyFilter === 'ALL') {
                 foundCompany = companiesData[0]; 
            } else {
                 foundCompany = companiesData.find((c: any) => c.name && c.name.toUpperCase().includes(clientConfig.companyFilter.toUpperCase()));
            }
            if (foundCompany) {
                targetCompanyId = foundCompany.id;
                targetCompanyName = foundCompany.name;
            } else {
                throw new Error(`Empresa '${code}' no encontrada en el servidor.`);
            }
        } else {
            throw new Error("No se pudo recuperar la información del usuario.");
        }
        setStatusMessage("¡Acceso Correcto!");
        setTimeout(() => {
            onLogin({ 
                url: clientConfig.url, 
                db: clientConfig.db, 
                username: clientConfig.username, 
                apiKey: clientConfig.apiKey, 
                uid: uid, 
                useProxy: true, 
                companyId: targetCompanyId, 
                companyName: targetCompanyName 
            }, clientConfig);
        }, 500);
    } catch (err: any) {
        setError(err.message || "Error de comunicación.");
        setIsLoading(false);
        setStatusMessage('');
    }
  };

  const toggleAdminMode = () => {
      setIsAdminMode(!isAdminMode);
      setError(null);
      setAccessCode('');
      setPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      <div className="w-full md:w-1/2 lg:w-5/12 bg-white relative overflow-hidden flex flex-col justify-between p-8 md:p-12 border-r border-slate-200">
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-brand-50 via-white to-white opacity-80"></div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                    <Citrus className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">LEMON_BI</h1>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-slate-900">
                Tus datos de Odoo,<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-brand-600">frescos y claros.</span>
            </h2>
            <p className="text-slate-500 text-lg font-light mb-12 max-w-md leading-relaxed">
                Plataforma de analítica inteligente para iluminar tus decisiones de negocio en tiempo real.
            </p>
        </div>
        
        <div className="relative z-10 space-y-8">
            <h3 className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-4 pb-2 border-b border-brand-100 inline-block">Proceso de Inicio</h3>
            
            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold shadow-sm group-hover:bg-brand-500 group-hover:text-white transition-all">01</div>
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Conecta</h4>
                  <p className="text-sm text-slate-500 font-light">Ingresa tu código de sucursal para establecer conexión.</p>
                </div>
            </div>
            
            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold shadow-sm group-hover:bg-brand-500 group-hover:text-white transition-all">02</div>
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Sincroniza</h4>
                  <p className="text-sm text-slate-500 font-light">Sincronizamos tus ventas e inventario de Odoo al instante.</p>
                </div>
            </div>

            <div className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-mono text-sm font-bold shadow-sm group-hover:bg-brand-500 group-hover:text-white transition-all">03</div>
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Decide</h4>
                  <p className="text-sm text-slate-500 font-light">Visualiza métricas clave con claridad y toma el control.</p>
                </div>
            </div>
        </div>

        <div className="mt-12 relative z-10 flex flex-col gap-3">
            <p className="text-[10px] text-slate-400 font-mono opacity-70">&copy; 2025 LEMON BI Analytics v2.4</p>
            <a href="https://gaorsystem.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center gap-2 group transition-all hover:scale-[1.02] origin-left">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-violet-600 fill-emerald-500/20" />
                </div>
                <div className="text-xl font-bold tracking-tight">
                    <span className="text-slate-800">Gaor</span>
                    <span className="text-violet-600">System</span>
                </div>
            </a>
        </div>
      </div>

      <div className={`w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative transition-colors duration-500 ${isAdminMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`max-w-md w-full relative z-10 backdrop-blur-xl p-8 rounded-3xl shadow-xl border transition-all duration-500 ${isAdminMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-white'}`}>
            <div className="mb-8 flex justify-between items-start">
                <div><h3 className={`text-3xl font-bold mb-2 tracking-tight ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>{isAdminMode ? 'Superadmin' : 'Bienvenido'}</h3><p className={`font-light text-sm ${isAdminMode ? 'text-slate-400' : 'text-slate-500'}`}>{isAdminMode ? 'Ingresa la contraseña maestra.' : 'Ingresa tu código de cliente para acceder.'}</p></div>
                {isAdminMode && <div className="p-2 bg-brand-500 rounded-lg"><UserCog className="w-6 h-6 text-white"/></div>}
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
                {!isAdminMode ? (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Código de Sucursal</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Building2 className={`h-5 w-5 ${error ? 'text-red-400' : 'text-slate-400'}`} /></div>
                            <input type="text" className={`w-full pl-11 pr-4 py-4 bg-slate-50 border rounded-xl outline-none font-bold text-slate-800 uppercase tracking-wider ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-brand-500'}`} placeholder="EJ: REQUESALUD" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); if(error) setError(null); }} autoFocus disabled={isLoading} />
                        </div>
                    </div>
                ) : (
                    <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Contraseña Maestra</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className={`h-5 w-5 ${error ? 'text-red-400' : 'text-slate-500'}`} /></div>
                            <input type="password" className={`w-full pl-11 pr-4 py-4 bg-slate-900 border rounded-xl outline-none font-bold text-white tracking-widest ${error ? 'border-red-500' : 'border-slate-700 focus:border-brand-500'}`} placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); if(error) setError(null); }} autoFocus disabled={isLoading} />
                        </div>
                    </div>
                )}
                {error && ( <div className="mt-3 flex items-start gap-2 animate-in slide-in-from-top-1"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-red-500 text-xs font-medium">{error}</p></div> )}
                <button type="submit" disabled={(!isAdminMode && accessCode.length < 3) || (isAdminMode && password.length < 1) || isLoading} className={`w-full py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all ${isLoading ? 'bg-slate-200 text-slate-400' : isAdminMode ? 'bg-white text-slate-900' : 'bg-brand-500 text-white'}`}>
                    {isLoading ? ( <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">{statusMessage || 'VALIDANDO...'}</span></> ) : ( <> {isAdminMode ? 'ACCEDER' : 'INGRESAR'} <ArrowRight className="w-5 h-5" /> </> )}
                </button>
                <div className="text-center pt-4">
                     <button type="button" onClick={toggleAdminMode} className={`text-xs font-bold transition-colors uppercase tracking-wider ${isAdminMode ? 'text-slate-500 hover:text-white' : 'text-slate-300 hover:text-brand-600'}`}>{isAdminMode ? 'Volver al Login de Cliente' : 'Acceso Administrativo'}</button>
                </div>
                {!isAdminMode && ( <div className="flex items-center justify-center gap-2 pt-2 opacity-40"><ShieldCheck className="w-3 h-3 text-slate-500" /><p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Conexión Segura</p></div> )}
            </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
