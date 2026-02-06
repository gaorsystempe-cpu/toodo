
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, RefreshCw, AlertCircle, FileSpreadsheet, 
  Zap, Calculator, CreditCard, LayoutGrid, ClipboardList,
  Store, MapPin, ArrowUpRight, Package, History, Info, Plus, Loader2
} from 'lucide-react';
import { Venta, OdooSession } from '../types';
import { OdooClient } from '../services/odoo';
import * as XLSX from 'xlsx';

const COLORS = ['#84cc16', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#6366f1'];

interface DashboardProps {
    session: OdooSession | null;
    view?: string;
}

type FilterMode = 'hoy' | 'mes' | 'anio' | 'custom';
type ReportTab = 'consolidado' | 'recepcion' | 'surco';

const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('hoy');
  const [activeTab, setActiveTab] = useState<ReportTab>('consolidado');
  const [syncProgress, setSyncProgress] = useState('');
  const [dateRange, setDateRange] = useState({
      start: new Date().toLocaleDateString('en-CA'),
      end: new Date().toLocaleDateString('en-CA')
  });

  const updateRangeByMode = (mode: FilterMode) => {
    setFilterMode(mode);
    const today = new Date();
    let start = '';
    let end = today.toLocaleDateString('en-CA');

    if (mode === 'hoy') {
        start = end;
    } else if (mode === 'mes') {
        start = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
    } else if (mode === 'anio') {
        start = new Date(today.getFullYear(), 0, 1).toLocaleDateString('en-CA');
    }
    
    if (mode !== 'custom') {
        setDateRange({ start, end });
    }
  };

  const fetchData = useCallback(async () => {
      if (!session) return;
      setLoading(true);
      setError(null);
      setSyncProgress('Conectando...');

      try {
          const client = new OdooClient(session.url, session.db);
          
          // 1. Obtener Pedidos (Cabeceras) - Solo campos esenciales para velocidad
          setSyncProgress('Buscando pedidos...');
          const domain: any[] = [
            ['state', 'in', ['paid', 'done', 'invoiced']], 
            ['date_order', '>=', `${dateRange.start} 00:00:00`],
            ['date_order', '<=', `${dateRange.end} 23:59:59`]
          ];
          if (session.companyId) domain.push(['company_id', '=', session.companyId]);

          const orders = await client.searchRead(session.uid, session.apiKey, 'pos.order', domain, 
            ['date_order', 'config_id', 'lines', 'amount_total', 'user_id', 'payment_ids'], 
            { order: 'date_order desc', limit: 1000 }
          );

          if (!orders || orders.length === 0) {
              setVentasData([]);
              setSyncProgress('Sin datos');
              setLoading(false);
              return;
          }

          // 2. Obtener Líneas y Pagos
          setSyncProgress(`Analizando ${orders.length} órdenes...`);
          const allLineIds = orders.flatMap((o: any) => o.lines || []);
          const allPaymentIds = orders.flatMap((o: any) => o.payment_ids || []);

          // Eliminado 'purchase_price' de linesData para evitar el ValueError
          const [linesData, paymentsData] = await Promise.all([
            client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', allLineIds]], 
                ['product_id', 'qty', 'price_subtotal', 'price_subtotal_incl', 'order_id']),
            client.searchRead(session.uid, session.apiKey, 'pos.payment', [['id', 'in', allPaymentIds]], 
                ['payment_method_id', 'amount', 'pos_order_id'])
          ]);

          // 3. Obtener Costos Reales de Productos (standard_price es el campo universal de costo)
          setSyncProgress('Calculando costos...');
          const productIds = Array.from(new Set(linesData.map((l: any) => l.product_id[0])));
          
          // Consultamos el costo directamente de la ficha técnica del producto
          const products = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', productIds]], ['standard_price', 'categ_id']);
          
          const productMap = new Map<number, { cost: number; cat: string }>(
            products.map((p: any) => [p.id, { cost: p.standard_price || 0, cat: p.categ_id ? p.categ_id[1] : 'General' }])
          );
          
          const paymentsByOrder = new Map();
          paymentsData.forEach((p: any) => {
              const oId = p.pos_order_id[0];
              if (!paymentsByOrder.has(oId)) paymentsByOrder.set(oId, []);
              paymentsByOrder.get(oId).push(p.payment_method_id[1]);
          });

          const linesByOrder = new Map();
          linesData.forEach((l: any) => {
              const oId = l.order_id[0];
              if (!linesByOrder.has(oId)) linesByOrder.set(oId, []);
              linesByOrder.get(oId).push(l);
          });

          // 4. Mapeo y Cálculo de Rentabilidad
          setSyncProgress('Generando reporte...');
          const mapped: Venta[] = orders.flatMap((o: any) => {
              const orderLines = linesByOrder.get(o.id) || [];
              const orderDate = new Date(o.date_order.replace(' ', 'T') + 'Z');
              const sede = o.config_id[1] || 'Caja';
              const metodos = paymentsByOrder.get(o.id) || ['Otros'];
              const metodoPrincipal = metodos[0];

              return orderLines.map((l: any) => {
                  const pId = l.product_id[0];
                  const pInfo = productMap.get(pId) || { cost: 0, cat: 'Varios' };
                  
                  const ventaConImpuesto = l.price_subtotal_incl || 0;
                  const ventaBase = l.price_subtotal || 0; // Ganancia se calcula sobre base imponible
                  
                  const costoUnitario = pInfo.cost; 
                  const costoTotal = costoUnitario * l.qty;
                  
                  const margenNeto = ventaBase - costoTotal;

                  return {
                      fecha: orderDate,
                      sede,
                      compania: session.companyName || '',
                      vendedor: o.user_id[1] || 'Usuario',
                      producto: l.product_id[1],
                      categoria: pInfo.cat,
                      total: ventaConImpuesto, 
                      costo: costoTotal,
                      margen: margenNeto,
                      cantidad: l.qty,
                      sesion: '', 
                      metodoPago: metodoPrincipal,
                      margenPorcentaje: ventaBase > 0 ? ((margenNeto / ventaBase) * 100).toFixed(1) : '0.0'
                  };
              });
          });

          setVentasData(mapped);
          setSyncProgress('¡Sincronizado!');
      } catch (err: any) {
          console.error("Dashboard Error:", err);
          setError(`No se pudo sincronizar: El servidor de Odoo tardó demasiado o la configuración de campos es distinta.`);
      } finally {
          setLoading(false);
      }
  }, [session, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // FILTRADO DE SEDES
  const dataFeetCare = useMemo(() => ventasData.filter(v => v.sede.toUpperCase().includes('FEETCARE') || (v.sede.toUpperCase().includes('RECEPCION') && !v.sede.toUpperCase().includes('SURCO'))), [ventasData]);
  const dataFeetSurco = useMemo(() => ventasData.filter(v => v.sede.toUpperCase().includes('SURCO')), [ventasData]);

  const filteredData = useMemo(() => {
    if (activeTab === 'consolidado') return ventasData;
    if (activeTab === 'recepcion') return dataFeetCare;
    if (activeTab === 'surco') return dataFeetSurco;
    return ventasData;
  }, [ventasData, dataFeetCare, dataFeetSurco, activeTab]);

  const kpis = useMemo(() => {
      const v = filteredData.reduce((s, x) => s + x.total, 0);
      const c = filteredData.reduce((s, x) => s + x.costo, 0);
      const m = filteredData.reduce((s, x) => s + x.margen, 0);
      return {
          totalVenta: v,
          totalCosto: c,
          totalMargen: m,
          rentabilidad: v > 0 ? ((m / v) * 100).toFixed(1) : '0'
      };
  }, [filteredData]);

  const resumenSedes = useMemo(() => {
    const calc = (data: Venta[]) => ({
        venta: data.reduce((s, x) => s + x.total, 0),
        costo: data.reduce((s, x) => s + x.costo, 0),
        ganancia: data.reduce((s, x) => s + x.margen, 0)
    });
    const rc = calc(dataFeetCare);
    const sc = calc(dataFeetSurco);
    return {
        recepcion: rc,
        surco: sc,
        total: {
            venta: rc.venta + sc.venta,
            costo: rc.costo + sc.costo,
            ganancia: rc.ganancia + sc.ganancia
        }
    };
  }, [dataFeetCare, dataFeetSurco]);

  const metodosPagoData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(v => {
        agg[v.metodoPago] = (agg[v.metodoPago] || 0) + v.total;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ["REPORTE DE RENTABILIDAD"],
      ["Rango:", `${dateRange.start} al ${dateRange.end}`],
      [],
      ["Sede", "Venta Total", "Costo", "Ganancia", "Rent %"]
    ];
    summaryData.push(
      ["FeetCare", resumenSedes.recepcion.venta, resumenSedes.recepcion.costo, resumenSedes.recepcion.ganancia, `${(resumenSedes.recepcion.venta > 0 ? (resumenSedes.recepcion.ganancia / resumenSedes.recepcion.venta * 100) : 0).toFixed(2)}%`],
      ["Feet Surco", resumenSedes.surco.venta, resumenSedes.surco.costo, resumenSedes.surco.ganancia, `${(resumenSedes.surco.venta > 0 ? (resumenSedes.surco.ganancia / resumenSedes.surco.venta * 100) : 0).toFixed(2)}%`],
      ["TOTAL", resumenSedes.total.venta, resumenSedes.total.costo, resumenSedes.total.ganancia, `${(resumenSedes.total.venta > 0 ? (resumenSedes.total.ganancia / resumenSedes.total.venta * 100) : 0).toFixed(2)}%`]
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Resumen");
    XLSX.writeFile(wb, `Rentabilidad_${dateRange.start}.xlsx`);
  };

  return (
    <div className="p-4 md:p-10 font-sans max-w-7xl mx-auto space-y-8 animate-in fade-in pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-8">
        <div>
           <div className="flex items-center gap-3">
             <div className="p-3 bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/20"><TrendingUp className="text-white w-6 h-6" /></div>
             <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Control de Rentabilidad</h1>
           </div>
           <p className="text-slate-500 text-sm mt-2 font-medium flex items-center gap-2">
             Estado actual de ganancias por punto de venta
             {loading && <span className="flex items-center gap-2 text-brand-600 animate-pulse ml-4 font-black text-xs uppercase"><Loader2 className="w-3 h-3 animate-spin"/> {syncProgress}</span>}
           </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <button onClick={fetchData} disabled={loading} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white px-6 py-3.5 rounded-2xl border border-slate-200 font-bold text-[10px] hover:bg-slate-50 transition-all uppercase tracking-widest disabled:opacity-50">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} /> Sincronizar
           </button>
           <button onClick={exportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-bold text-[10px] shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest"><FileSpreadsheet className="w-4 h-4" /> Exportar Excel</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-4 text-red-600 animate-in slide-in-from-top-4">
          <AlertCircle className="w-6 h-6" />
          <p className="font-black text-xs uppercase tracking-widest leading-relaxed max-w-2xl">{error}</p>
        </div>
      )}

      <div className="bg-slate-100 p-2 rounded-[2.8rem] border border-slate-200 flex flex-wrap gap-2 w-full lg:w-fit">
         <button onClick={() => setActiveTab('consolidado')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'consolidado' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-200'}`}>
            <LayoutGrid className="w-4 h-4" /> Consolidado
         </button>
         <button onClick={() => setActiveTab('recepcion')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'recepcion' ? 'bg-brand-500 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-200'}`}>
            <Store className="w-4 h-4" /> FeetCare
         </button>
         <button onClick={() => setActiveTab('surco')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'surco' ? 'bg-blue-500 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-200'}`}>
            <MapPin className="w-4 h-4" /> Surco
         </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap gap-8 items-center">
         <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {(['hoy', 'mes', 'anio', 'custom'] as FilterMode[]).map(m => (
              <button key={m} onClick={() => updateRangeByMode(m)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === m ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-slate-400 hover:text-slate-600'}`}>
                 {m === 'anio' ? 'Año' : m}
              </button>
            ))}
         </div>
         {filterMode === 'custom' && (
           <div className="flex gap-4 items-center animate-in slide-in-from-left-4">
              <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
              <span className="text-slate-300 font-bold">→</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
           </div>
         )}
      </div>

      {activeTab === 'consolidado' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm group hover:shadow-xl transition-all">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Store className="w-4 h-4 text-brand-500" /> FeetCare</h4>
                 <div className="space-y-4">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Venta Total</p>
                       <p className="text-2xl font-black text-slate-900">S/ {resumenSedes.recepcion.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-brand-600 uppercase mb-1">Ganancia Real</p>
                       <p className="text-2xl font-black text-brand-600">S/ {resumenSedes.recepcion.ganancia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm group hover:shadow-xl transition-all">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /> Sede Feet Surco</h4>
                 <div className="space-y-4">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Venta Total</p>
                       <p className="text-2xl font-black text-slate-900">S/ {resumenSedes.surco.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Ganancia Real</p>
                       <p className="text-2xl font-black text-blue-600">S/ {resumenSedes.surco.ganancia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl group hover:scale-[1.02] transition-all">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Plus className="w-4 h-4 text-brand-400" /> Global Negocio</h4>
                 <div className="space-y-4">
                    <div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Venta Global</p>
                       <p className="text-3xl font-black text-white">S/ {resumenSedes.total.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-brand-400 uppercase mb-1">Ganancia Neta</p>
                       <p className="text-3xl font-black text-brand-400">S/ {resumenSedes.total.ganancia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {(activeTab === 'recepcion' || activeTab === 'surco') && (
        <div className="space-y-8 animate-in slide-in-from-right-10">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Venta Sede</p>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter">S/ {kpis.totalVenta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Costo Total</p>
                 <h3 className="text-3xl font-black text-slate-400 tracking-tighter">S/ {kpis.totalCosto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className={`p-8 rounded-[2.5rem] text-white shadow-xl ${activeTab === 'recepcion' ? 'bg-brand-500' : 'bg-blue-500'}`}>
                 <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Utilidad Sede</p>
                 <h3 className="text-3xl font-black tracking-tighter">S/ {kpis.totalMargen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
              </div>
           </div>

           <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/80">
                       <tr>
                          <th className="px-10 py-7">Fecha</th>
                          <th className="px-10 py-7">Servicio / Producto</th>
                          <th className="px-10 py-7 text-right">Venta</th>
                          <th className="px-10 py-7 text-right">Costo</th>
                          <th className="px-10 py-7 text-right">Ganancia</th>
                          <th className="px-10 py-7 text-center">Rent %</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {filteredData.map((v, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-all">
                            <td className="px-10 py-6 font-bold text-slate-900 text-sm">{v.fecha.toLocaleDateString('es-PE')}</td>
                            <td className="px-10 py-6">
                               <p className="font-black text-slate-800 text-xs uppercase leading-tight">{v.producto}</p>
                               <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{v.categoria}</span>
                            </td>
                            <td className="px-10 py-6 text-right font-black text-slate-900 text-sm">S/ {v.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-10 py-6 text-right font-bold text-slate-300 text-sm">S/ {v.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-10 py-6 text-right font-black text-brand-600 text-sm">S/ {v.margen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-10 py-6 text-center">
                               <div className={`px-4 py-1.5 rounded-xl text-[11px] font-black inline-block ${Number(v.margenPorcentaje) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                                 {v.margenPorcentaje}%
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
