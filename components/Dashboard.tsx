
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, RefreshCw, AlertCircle, FileSpreadsheet, 
  LayoutGrid, ClipboardList, Store, MapPin, Package, Loader2, CalendarDays, ArrowDownToLine, Calculator
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
  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [activeTab, setActiveTab] = useState<ReportTab>('consolidado');
  const [syncProgress, setSyncProgress] = useState('');
  
  const getInitialDates = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
    const end = today.toLocaleDateString('en-CA');
    return { start, end };
  };

  const [dateRange, setDateRange] = useState(getInitialDates());

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
      setSyncProgress('Autenticando...');

      try {
          const client = new OdooClient(session.url, session.db);
          
          setSyncProgress('Buscando Ventas...');
          const domain: any[] = [
            ['state', 'in', ['paid', 'done', 'invoiced']], 
            ['date_order', '>=', `${dateRange.start} 00:00:00`],
            ['date_order', '<=', `${dateRange.end} 23:59:59`]
          ];
          if (session.companyId) domain.push(['company_id', '=', session.companyId]);

          const orders = await client.searchRead(session.uid, session.apiKey, 'pos.order', domain, 
            ['date_order', 'config_id', 'lines', 'amount_total', 'user_id', 'payment_ids'], 
            { order: 'date_order desc', limit: 2000 }
          );

          if (!orders || orders.length === 0) {
              setVentasData([]);
              setSyncProgress('Rango sin ventas');
              setLoading(false);
              return;
          }

          setSyncProgress('Cargando Detalles...');
          const allLineIds = orders.flatMap((o: any) => o.lines || []);
          const linesData = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', allLineIds]], 
                ['product_id', 'qty', 'price_subtotal', 'price_subtotal_incl', 'order_id']);

          setSyncProgress('Sincronizando Costos...');
          const productIds = Array.from(new Set(linesData.map((l: any) => l.product_id[0])));
          
          // Importante: standard_price es el campo de costo en Odoo (product.product)
          const products = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', productIds]], ['standard_price', 'categ_id']);
          
          const productMap = new Map<number, { cost: number; cat: string }>(
            products.map((p: any) => [p.id, { cost: p.standard_price || 0, cat: p.categ_id ? p.categ_id[1] : 'General' }])
          );
          
          const linesByOrder = new Map();
          linesData.forEach((l: any) => {
              const oId = l.order_id[0];
              if (!linesByOrder.has(oId)) linesByOrder.set(oId, []);
              linesByOrder.get(oId).push(l);
          });

          setSyncProgress('Calculando Rentabilidad...');
          const mapped: Venta[] = orders.flatMap((o: any) => {
              const orderLines = linesByOrder.get(o.id) || [];
              const orderDate = new Date(o.date_order.replace(' ', 'T') + 'Z');
              const sede = o.config_id[1] || 'Caja Central';

              return orderLines.map((l: any) => {
                  const pId = l.product_id[0];
                  const pInfo = productMap.get(pId) || { cost: 0, cat: 'Servicio' };
                  
                  // La rentabilidad se basa en price_subtotal (Venta neta sin IGV)
                  const ventaBase = l.price_subtotal || 0; 
                  const costoRealUnitario = pInfo.cost; 
                  const costoTotalLinea = costoRealUnitario * l.qty;
                  const gananciaReal = ventaBase - costoTotalLinea;

                  return {
                      fecha: orderDate,
                      sede,
                      compania: session.companyName || '',
                      vendedor: o.user_id[1] || 'Usuario',
                      producto: l.product_id[1],
                      categoria: pInfo.cat,
                      total: l.price_subtotal_incl || 0, // Monto pagado por cliente
                      costo: costoTotalLinea,
                      margen: gananciaReal,
                      cantidad: l.qty,
                      sesion: '', 
                      metodoPago: 'Consultar Pedido',
                      margenPorcentaje: ventaBase > 0 ? ((gananciaReal / ventaBase) * 100).toFixed(1) : '0.0'
                  };
              });
          });

          setVentasData(mapped);
          setSyncProgress('Sincronizado');
      } catch (err: any) {
          setError(`Error Odoo: ${err.message}`);
      } finally {
          setLoading(false);
      }
  }, [session, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtros de sede exactos
  const dataFeetCare = useMemo(() => ventasData.filter(v => v.sede.toUpperCase().includes('FEETCARE') || (v.sede.toUpperCase().includes('RECEPCION') && !v.sede.toUpperCase().includes('SURCO'))), [ventasData]);
  const dataFeetSurco = useMemo(() => ventasData.filter(v => v.sede.toUpperCase().includes('SURCO')), [ventasData]);

  const stats = useMemo(() => {
    const calc = (data: Venta[]) => {
      const v = data.reduce((s, x) => s + x.total, 0);
      const c = data.reduce((s, x) => s + x.costo, 0);
      const g = data.reduce((s, x) => s + x.margen, 0);
      return { venta: v, costo: c, ganancia: g };
    };
    return {
      feetCare: calc(dataFeetCare),
      surco: calc(dataFeetSurco),
      total: calc(ventasData)
    };
  }, [ventasData, dataFeetCare, dataFeetSurco]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Pestaña: RESUMEN DE RENTABILIDAD
    const summaryHeader = [
      ["REPORTE CONSOLIDADO DE RENTABILIDAD POR SEDE"],
      ["Rango de Fechas:", `${dateRange.start} al ${dateRange.end}`],
      [],
      ["SEDE", "VENTA TOTAL (INC. IGV)", "COSTO TOTAL (GASTO)", "GANANCIA NETA FINAL", "RENTABILIDAD %"]
    ];

    const fc = stats.feetCare;
    const sc = stats.surco;
    const gt = stats.total;

    const summaryRows = [
      ["FEETCARE (RECEPCIÓN)", fc.venta, fc.costo, fc.ganancia, `${(fc.venta > 0 ? (fc.ganancia / fc.venta * 100) : 0).toFixed(2)}%`],
      ["FEET SURCO", sc.venta, sc.costo, sc.ganancia, `${(sc.venta > 0 ? (sc.ganancia / sc.venta * 100) : 0).toFixed(2)}%`],
      [],
      ["TOTAL GENERAL NEGOCIO", gt.venta, gt.costo, gt.ganancia, `${(gt.venta > 0 ? (gt.ganancia / gt.venta * 100) : 0).toFixed(2)}%`]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryRows]);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Rentabilidad");

    // 2. Pestaña: DETALLE FEETCARE
    const createDetailSheet = (data: Venta[]) => {
      const rows = data.map(v => ({
        'Fecha': v.fecha.toLocaleDateString('es-PE'),
        'Producto / Servicio': v.producto,
        'Categoría': v.categoria,
        'Monto de Venta': v.total,
        'Monto de Costo': v.costo,
        'Ganancia Final': v.margen,
        '% Rent': v.margenPorcentaje + '%'
      }));
      return XLSX.utils.json_to_sheet(rows);
    };

    if (dataFeetCare.length > 0) {
      XLSX.utils.book_append_sheet(wb, createDetailSheet(dataFeetCare), "Ventas FeetCare");
    }

    // 3. Pestaña: DETALLE SURCO
    if (dataFeetSurco.length > 0) {
      XLSX.utils.book_append_sheet(wb, createDetailSheet(dataFeetSurco), "Ventas Surco");
    }

    XLSX.writeFile(wb, `Reporte_Mensual_Odoo_${dateRange.start}.xlsx`);
  };

  const RenderTable = ({ data, title, totals }: { data: Venta[], title: string, totals: any }) => (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden mb-12 animate-in fade-in slide-in-from-bottom-4">
      <div className="px-10 py-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div>
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
             <ClipboardList className="text-brand-500 w-6 h-6" /> {title}
           </h3>
           <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 italic">Ventas del mes obtenidas de Odoo</p>
        </div>
        <div className="flex gap-4">
           <div className="text-center px-4">
             <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Registros</p>
             <p className="text-sm font-black text-slate-900">{data.length}</p>
           </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-10 py-6">Fecha</th>
              <th className="px-10 py-6">Producto o Servicio</th>
              <th className="px-10 py-6 text-right">Monto Venta</th>
              <th className="px-10 py-6 text-right">Monto Costo</th>
              <th className="px-10 py-6 text-right">Ganancia Final</th>
              <th className="px-10 py-6 text-center">Rent. %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((v, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-all group">
                <td className="px-10 py-5 text-sm font-bold text-slate-500">{v.fecha.toLocaleDateString('es-PE')}</td>
                <td className="px-10 py-5">
                   <p className="font-black text-slate-900 text-xs uppercase leading-tight">{v.producto}</p>
                   <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{v.categoria}</p>
                </td>
                <td className="px-10 py-5 text-right font-black text-slate-900 text-sm">S/ {v.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-5 text-right font-bold text-slate-300 text-sm italic">S/ {v.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-5 text-right font-black text-brand-600 text-sm">S/ {v.margen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-5 text-center">
                   <div className={`px-3 py-1 rounded-lg text-[10px] font-black inline-block ${Number(v.margenPorcentaje) > 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                      {v.margenPorcentaje}%
                   </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-10 py-24 text-center text-slate-300 font-black uppercase italic tracking-widest">Sin registros encontrados</td></tr>
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-900 text-white">
              <tr className="font-black">
                <td colSpan={2} className="px-10 py-8 text-right text-[11px] uppercase tracking-[0.2em] text-slate-400">Sumatoria Mensual {title}:</td>
                <td className="px-10 py-8 text-right text-xl tracking-tighter text-white">S/ {totals.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-8 text-right text-slate-500 text-sm italic">S/ {totals.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-8 text-right text-brand-400 text-xl tracking-tighter">S/ {totals.ganancia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td className="px-10 py-8 text-center bg-brand-600 text-xs italic">
                  {(totals.venta > 0 ? (totals.ganancia / totals.venta * 100) : 0).toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 font-sans max-w-7xl mx-auto space-y-8 animate-in fade-in pb-24">
      
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-2">
           <div className="flex items-center gap-4">
             <div className="p-4 bg-brand-500 rounded-[1.5rem] shadow-xl shadow-brand-500/30"><TrendingUp className="text-white w-7 h-7" /></div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Reporte de Rentabilidad</h1>
           </div>
           <p className="text-slate-500 text-sm font-medium ml-1">
             Cálculo automático de Ventas vs Costos reales de Odoo.
             {loading && <span className="ml-4 text-brand-600 font-black text-[10px] uppercase animate-pulse flex items-center gap-2 inline-flex"><Loader2 className="w-3 h-3 animate-spin"/> {syncProgress}</span>}
           </p>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
           <button onClick={fetchData} disabled={loading} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white px-8 py-4 rounded-2xl border border-slate-200 font-black text-[11px] hover:bg-slate-50 transition-all uppercase tracking-widest shadow-sm">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} /> Sincronizar Odoo
           </button>
           <button onClick={exportExcel} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] shadow-2xl hover:bg-slate-800 transition-all uppercase tracking-widest">
             <FileSpreadsheet className="w-4 h-4" /> Descargar Excel
           </button>
        </div>
      </div>

      {/* TABS DE SELECCIÓN DE SEDE */}
      <div className="bg-slate-100 p-2 rounded-[3rem] border border-slate-200 flex flex-wrap gap-2 w-full lg:w-fit shadow-inner">
         <button onClick={() => setActiveTab('consolidado')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-5 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'consolidado' ? 'bg-slate-900 text-white shadow-2xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-200'}`}>
            <LayoutGrid className="w-4 h-4" /> Consolidado Global
         </button>
         <button onClick={() => setActiveTab('recepcion')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-5 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'recepcion' ? 'bg-brand-500 text-white shadow-2xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-200'}`}>
            <Store className="w-4 h-4" /> FeetCare (Mes)
         </button>
         <button onClick={() => setActiveTab('surco')} className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-5 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'surco' ? 'bg-blue-600 text-white shadow-2xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-200'}`}>
            <MapPin className="w-4 h-4" /> Surco (Mes)
         </button>
      </div>

      {/* FILTROS DE FECHA */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-wrap gap-10 items-center">
         <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            {(['hoy', 'mes', 'anio', 'custom'] as FilterMode[]).map(m => (
              <button key={m} onClick={() => updateRangeByMode(m)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === m ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-slate-400 hover:text-slate-600'}`}>
                 {m === 'anio' ? 'Año' : m}
              </button>
            ))}
         </div>
         {filterMode === 'custom' && (
           <div className="flex gap-4 items-center animate-in slide-in-from-left-4">
              <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
              <span className="text-slate-300 font-bold">→</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
           </div>
         )}
      </div>

      {/* KPIs DE RENTABILIDAD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><ArrowDownToLine className="w-3 h-3"/> Venta Mensual Bruta</p>
             <h3 className="text-3xl font-black text-slate-900 tracking-tighter">S/ {stats.total.venta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Calculator className="w-3 h-3"/> Costo / Inversión</p>
             <h3 className="text-3xl font-black text-slate-400 tracking-tighter">S/ {stats.total.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="bg-brand-500 p-8 rounded-[2.5rem] shadow-xl shadow-brand-500/20 text-white">
             <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Ganancia Real Neta</p>
             <h3 className="text-3xl font-black tracking-tighter">S/ {stats.total.ganancia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Margen Comercial</p>
             <h3 className="text-3xl font-black tracking-tighter text-brand-400">
               {(stats.total.venta > 0 ? (stats.total.ganancia / stats.total.venta * 100) : 0).toFixed(1)}%
             </h3>
          </div>
      </div>

      {/* REPORTES DETALLADOS POR SEDE */}
      <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-700">
         {activeTab === 'consolidado' ? (
           <>
              <RenderTable data={dataFeetCare} title="Reporte Mensual: FeetCare" totals={stats.feetCare} />
              <RenderTable data={dataFeetSurco} title="Reporte Mensual: Feet Surco" totals={stats.surco} />
           </>
         ) : activeTab === 'recepcion' ? (
           <RenderTable data={dataFeetCare} title="Detalle Mensual FeetCare" totals={stats.feetCare} />
         ) : (
           <RenderTable data={dataFeetSurco} title="Detalle Mensual Surco" totals={stats.surco} />
         )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 p-8 rounded-[3rem] flex items-center gap-6 text-rose-600 animate-in slide-in-from-top-6 shadow-xl">
          <AlertCircle className="w-8 h-8" />
          <div>
            <p className="font-black text-xs uppercase tracking-[0.2em] mb-1">Error de Sincronización con Odoo</p>
            <p className="font-medium text-sm leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
