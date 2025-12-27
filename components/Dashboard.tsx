import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, Area, AreaChart 
} from 'recharts';
import { TrendingUp, DollarSign, Package, ArrowUpRight, RefreshCw, AlertCircle, Store, Download, FileSpreadsheet, ArrowUp, ArrowDown, Receipt, Target, PieChart as PieChartIcon, MapPin, CreditCard, Wallet, CalendarRange, Zap, X, Clock, Users, Trophy, UserPlus } from 'lucide-react';
import { Venta, Filtros, AgrupadoPorDia, OdooSession } from '../types';
import OdooConfigModal from './OdooConfigModal';
import { OdooClient } from '../services/odoo';
import * as XLSX from 'xlsx';

const generarDatosVentas = (startStr: string, endStr: string): Venta[] => {
  const estructura = [
      { compania: 'BOTICAS MULTIFARMA S.A.C.', sedes: ['Multifarmas', 'Cristo Rey', 'Lomas', 'Tienda 4'] },
      { compania: 'CONSULTORIO MEDICO REQUESALUD', sedes: ['Caja Requesalud'] }
  ];

  const vendedores = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz', 'Ana Torres', 'Caja Principal'];
  const metodosPago = ['Efectivo', 'Yape', 'Plin', 'Visa', 'Mastercard', 'Transferencia'];
  const clientesDemo = ['Luis García', 'Marta Flores', 'Jorge Salas', 'Elena Castro', 'Consumidor Final', 'Ana Belén', 'Pedro Páramo'];

  const productos = [
    { id: 1, nombre: 'Paracetamol 500mg Genérico', costo: 0.50, precio: 2.00, cat: 'Farmacia' },
    { id: 2, nombre: 'Amoxicilina 500mg Blister', costo: 1.20, precio: 3.50, cat: 'Farmacia' },
    { id: 3, nombre: 'Ibuprofeno 400mg Caja', costo: 8.00, precio: 15.00, cat: 'Farmacia' },
    { id: 4, nombre: 'Ensure Advance Vainilla', costo: 85.00, precio: 105.00, cat: 'Nutrición' },
    { id: 5, nombre: 'Pañales Huggies XG', costo: 45.00, precio: 58.00, cat: 'Cuidado Personal' },
    { id: 6, nombre: 'Consulta Médica General', costo: 0.00, precio: 50.00, cat: 'Servicios' },
    { id: 7, nombre: 'Inyectable - Servicio', costo: 1.00, precio: 10.00, cat: 'Servicios' },
    { id: 8, nombre: '[LAB] HEMOGRAMA COMPLETO', costo: 15.00, precio: 35.00, cat: 'Laboratorio' },
    { id: 9, nombre: '[ECO] ABDOMINAL COMPLETA', costo: 40.00, precio: 120.00, cat: 'Imágenes' },
    { id: 10, nombre: 'Shampoo H&S', costo: 18.00, precio: 25.00, cat: 'Cuidado Personal' },
    { id: 11, nombre: 'Vitamina C 1000mg', costo: 25.00, precio: 40.00, cat: 'Nutrición' }
  ];

  const ventas: Venta[] = [];
  const fechaInicioReq = new Date(`${startStr}T00:00:00`);
  const fechaFinReq = new Date(`${endStr}T23:59:59`);
  
  const fechaGeneracionInicio = new Date(fechaInicioReq);
  fechaGeneracionInicio.setMonth(fechaGeneracionInicio.getMonth() - 6);

  for (let d = new Date(fechaGeneracionInicio); d <= fechaFinReq; d.setDate(d.getDate() + 1)) {
    estructura.forEach(emp => {
        const ventasPorDia = Math.floor(Math.random() * 8) + 2; 
        
        for (let i = 0; i < ventasPorDia; i++) {
            const sede = emp.sedes[Math.floor(Math.random() * emp.sedes.length)];
            const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
            const metodo = metodosPago[Math.floor(Math.random() * metodosPago.length)];
            const cliente = clientesDemo[Math.floor(Math.random() * clientesDemo.length)];
            const fakeSession = `POS/${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2, '0')}/${Math.floor(Math.random()*100) + 1000}`;
            
            if (sede === 'Tienda 4') {
                const fechaCierreTienda4 = new Date('2024-08-31');
                if (d > fechaCierreTienda4) continue; 
            }

            const producto = productos[Math.floor(Math.random() * productos.length)];
            let prodFinal = producto;
            
            if (emp.compania.includes('CONSULTORIO')) {
                 if (Math.random() > 0.6) prodFinal = productos.find(p => p.cat === 'Servicios' || p.cat === 'Laboratorio' || p.cat === 'Imágenes') || producto;
            }

            const variacion = 0.9 + (Math.random() * 0.2); 
            const precioVenta = prodFinal.precio * variacion;
            const costoReal = prodFinal.costo * (0.95 + Math.random() * 0.1);

            const total = precioVenta; 
            const margen = total - costoReal;

            const randomHour = Math.floor(Math.random() * 12) + 9;
            const vFecha = new Date(d);
            vFecha.setHours(randomHour);

            ventas.push({
                fecha: vFecha,
                sede, 
                compania: emp.compania,
                sesion: fakeSession,
                producto: prodFinal.nombre,
                categoria: prodFinal.cat,
                vendedor,
                metodoPago: metodo,
                cliente,
                cantidad: 1,
                total, 
                costo: costoReal,
                margen,
                margenPorcentaje: total > 0 ? ((margen / total) * 100).toFixed(1) : '0.0'
            });
        }
    });
  }
  return ventas;
};

interface DashboardProps {
    session: OdooSession | null;
    view?: string;
}

type FilterMode = 'hoy' | 'mes' | 'anio' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ session, view = 'general' }) => {
  const [ventasData, setVentasData] = useState<Venta[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDownSede, setDrillDownSede] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); 

  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const [dateRange, setDateRange] = useState({
      start: new Date(currentYear, currentMonth, 1).toLocaleDateString('en-CA'),
      end: new Date(currentYear, currentMonth + 1, 0).toLocaleDateString('en-CA')
  });

  const [filtros, setFiltros] = useState<Filtros>({
    sedeSeleccionada: 'Todas',
    companiaSeleccionada: session?.companyName || 'Todas',
    periodoSeleccionado: 'mes',
    fechaInicio: '', 
    fechaFin: ''
  });

  useEffect(() => {
      let start = '';
      let end = '';
      if (filterMode === 'hoy') {
          const today = new Date().toLocaleDateString('en-CA');
          start = today;
          end = today;
      }
      else if (filterMode === 'mes') {
          const firstDay = new Date(selectedYear, selectedMonth, 1);
          const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
          start = firstDay.toLocaleDateString('en-CA'); 
          end = lastDay.toLocaleDateString('en-CA');
      } 
      else if (filterMode === 'anio') {
          start = `${selectedYear}-01-01`;
          end = `${selectedYear}-12-31`;
      }
      if (filterMode !== 'custom') {
          setDateRange({ start, end });
      }
  }, [filterMode, selectedYear, selectedMonth]);


  const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);
      setDrillDownSede(null); 
      
      const bufferStart = new Date(dateRange.start);
      bufferStart.setMonth(bufferStart.getMonth() - 12); // Traer un año para comparativas
      const bufferEnd = new Date(dateRange.end);
      
      const queryStart = bufferStart.toISOString().split('T')[0];
      const queryEnd = bufferEnd.toISOString().split('T')[0];

      if (!session) {
          setTimeout(() => {
            const demoData = generarDatosVentas(dateRange.start, dateRange.end);
            setVentasData(demoData);
            setLoading(false);
          }, 800);
          return;
      }

      const client = new OdooClient(session.url, session.db, session.useProxy);
      const domain: any[] = [
        ['state', '!=', 'cancel'], 
        ['date_order', '>=', `${queryStart} 00:00:00`],
        ['date_order', '<=', `${queryEnd} 23:59:59`]
      ];

      if (session.companyId) domain.push(['company_id', '=', session.companyId]);

      try {
          const context = session.companyId ? { allowed_company_ids: [session.companyId] } : {};
          const ordersRaw: any[] = await client.searchRead(session.uid, session.apiKey, 'pos.order', domain, ['date_order', 'config_id', 'lines', 'company_id', 'user_id', 'pos_reference', 'name', 'payment_ids', 'session_id', 'partner_id'], { limit: 15000, order: 'date_order desc', context });

          if (!ordersRaw || ordersRaw.length === 0) {
             setVentasData([]);
             setLoading(false);
             return;
          }

          const allLineIds = ordersRaw.flatMap((o: any) => o.lines || []);
          const allPaymentIds = ordersRaw.flatMap((o: any) => o.payment_ids || []);

          if (allLineIds.length === 0) {
              setVentasData([]);
              setLoading(false);
              return;
          }
          
          const chunkArray = (array: any[], size: number) => {
              const result = [];
              for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
              return result;
          };

          const lineChunks = chunkArray(allLineIds, 1000);
          let allLinesData: any[] = [];
          for (const chunk of lineChunks) {
              const linesData = await client.searchRead(session.uid, session.apiKey, 'pos.order.line', [['id', 'in', chunk]], ['product_id', 'qty', 'price_subtotal_incl'], { context });
              if (linesData) allLinesData = allLinesData.concat(linesData);
          }

          const productIds = new Set(allLinesData.map((l: any) => Array.isArray(l.product_id) ? l.product_id[0] : null).filter(id => id));
          let productMap = new Map<number, {cost: number, cat: string}>();
          if (productIds.size > 0) {
              const productChunks = chunkArray(Array.from(productIds), 1000);
              for (const pChunk of productChunks) {
                  const productsData = await client.searchRead(session.uid, session.apiKey, 'product.product', [['id', 'in', pChunk]], ['standard_price', 'categ_id'], { context });
                  if (productsData) productsData.forEach((p: any) => productMap.set(p.id, { cost: p.standard_price || 0, cat: Array.isArray(p.categ_id) ? p.categ_id[1] : 'General' }));
              }
          }

          let paymentMap = new Map<number, string>();
          if (allPaymentIds.length > 0) {
              const paymentChunks = chunkArray(allPaymentIds, 1000);
              for (const payChunk of paymentChunks) {
                  const paymentsData = await client.searchRead(session.uid, session.apiKey, 'pos.payment', [['id', 'in', payChunk]], ['payment_method_id', 'pos_order_id'], { context });
                  if (paymentsData) paymentsData.forEach((p: any) => { if (p.pos_order_id && p.payment_method_id) paymentMap.set(p.pos_order_id[0], p.payment_method_id[1]); });
              }
          }

          const linesMap = new Map(allLinesData.map((l: any) => [l.id, l]));
          const mappedVentas: Venta[] = [];

          ordersRaw.forEach((order: any) => {
              const orderDate = new Date((order.date_order || "").replace(" ", "T") + "Z");
              const sede = Array.isArray(order.config_id) ? order.config_id[1] : 'Caja General';
              const compania = Array.isArray(order.company_id) ? order.company_id[1] : 'Empresa Principal';
              const vendedor = Array.isArray(order.user_id) ? order.user_id[1] : 'Usuario Sistema';
              const sesion = Array.isArray(order.session_id) ? order.session_id[1] : 'Sesión Desconocida';
              const metodoPago = paymentMap.get(order.id) || 'Desconocido';
              const cliente = Array.isArray(order.partner_id) ? order.partner_id[1] : 'Consumidor Final';

              if (order.lines && Array.isArray(order.lines)) {
                  order.lines.forEach((lineId: number) => {
                      const line = linesMap.get(lineId);
                      if (line) {
                          const productId = Array.isArray(line.product_id) ? line.product_id[0] : 0;
                          const productName = Array.isArray(line.product_id) ? line.product_id[1] : 'Producto Desconocido';
                          const ventaBruta = line.price_subtotal_incl || 0; 
                          const prodInfo = productMap.get(productId) || { cost: 0, cat: 'Varios' };
                          const costoTotal = prodInfo.cost * (line.qty || 1);
                          const margen = ventaBruta - costoTotal; 

                          mappedVentas.push({
                              fecha: orderDate, 
                              sede, 
                              compania, 
                              vendedor, 
                              sesion, 
                              producto: productName, 
                              categoria: prodInfo.cat, 
                              metodoPago, 
                              cliente,
                              cantidad: line.qty || 1, 
                              total: ventaBruta, 
                              costo: costoTotal, 
                              margen,
                              margenPorcentaje: ventaBruta > 0 ? ((margen / ventaBruta) * 100).toFixed(1) : '0.0',
                          });
                      }
                  });
              }
          });
          setVentasData(mappedVentas);
      } catch (err: any) {
          setError(`Error de Conexión: ${err.message || "Fallo en consulta XML-RPC"}`);
          setVentasData([]); 
      } finally {
          setLoading(false);
      }
  }, [session, dateRange]); 

  useEffect(() => { fetchData(); }, [fetchData]); 

  const filteredData = useMemo(() => {
    const startStr = dateRange.start;
    const endStr = dateRange.end;
    let datos = ventasData.filter(v => {
        const vDate = v.fecha.toLocaleDateString('en-CA'); 
        return vDate >= startStr && vDate <= endStr;
    });
    if (filtros.sedeSeleccionada !== 'Todas') datos = datos.filter(v => v.sede === filtros.sedeSeleccionada);
    if (!session && filtros.companiaSeleccionada !== 'Todas') datos = datos.filter(v => v.compania.includes(filtros.companiaSeleccionada));
    if (drillDownSede) datos = datos.filter(v => v.sede === drillDownSede);
    return datos;
  }, [ventasData, filtros, dateRange, session, drillDownSede]);

  const kpis = useMemo(() => {
    const totalVentas = filteredData.reduce((sum, v) => sum + v.total, 0);
    const totalMargen = filteredData.reduce((sum, v) => sum + v.margen, 0);
    const totalCostos = filteredData.reduce((sum, v) => sum + v.costo, 0);
    const unidades = filteredData.length;
    
    return {
      totalVentas,
      totalCostos,
      totalMargen,
      margenPromedio: totalVentas > 0 ? ((totalMargen / totalVentas) * 100).toFixed(1) : '0.0',
      unidadesVendidas: unidades,
      ticketPromedio: unidades > 0 ? (totalVentas / (unidades * 0.6)) : 0
    };
  }, [filteredData]);

  const topProductos = useMemo(() => {
    const agg: Record<string, { nombre: string; cantidad: number; ventas: number; margen: number }> = {};
    filteredData.forEach(v => {
        if (!agg[v.producto]) agg[v.producto] = { nombre: v.producto, cantidad: 0, ventas: 0, margen: 0 };
        agg[v.producto].cantidad += v.cantidad;
        agg[v.producto].ventas += v.total;
        agg[v.producto].margen += v.margen;
    });
    return Object.values(agg).sort((a, b) => b.ventas - a.ventas).slice(0, 10);
  }, [filteredData]);

  const topClientes = useMemo(() => {
    const agg: Record<string, { nombre: string; ventas: number; ordenes: number }> = {};
    filteredData.forEach(v => {
        const c = v.cliente || 'Anónimo';
        if (!agg[c]) agg[c] = { nombre: c, ventas: 0, ordenes: 0 };
        agg[c].ventas += v.total;
        agg[c].ordenes += 1;
    });
    return Object.values(agg).sort((a, b) => b.ventas - a.ventas).slice(0, 10);
  }, [filteredData]);

  const comparativaMensual = useMemo(() => {
    const agg: Record<string, { mes: string; ventas: number; margen: number }> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    ventasData.forEach(v => {
        if (v.fecha < sixMonthsAgo) return;
        const key = `${v.fecha.getFullYear()}-${(v.fecha.getMonth()+1).toString().padStart(2, '0')}`;
        if (!agg[key]) agg[key] = { mes: key, ventas: 0, margen: 0 };
        agg[key].ventas += v.total;
        agg[key].margen += v.margen;
    });
    return Object.values(agg).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [ventasData]);

  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, AgrupadoPorDia> = {};
    filteredData.forEach(v => {
      const fecha = v.fecha.toLocaleDateString('en-CA');
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, ventas: 0, margen: 0 };
      agrupado[fecha].ventas += v.total; agrupado[fecha].margen += v.margen;
    });
    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredData]);

  const ventasPorHora = useMemo(() => {
    const agg: Record<number, number> = {};
    for (let i = 0; i < 24; i++) agg[i] = 0;
    filteredData.forEach(v => {
      const hora = v.fecha.getHours();
      agg[hora] += v.total;
    });
    return Object.entries(agg).map(([hora, total]) => ({ hora: `${hora}:00`, total }));
  }, [filteredData]);

  const ventasPorCategoria = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(v => { const cat = v.categoria || 'Sin Categoría'; agg[cat] = (agg[cat] || 0) + v.total; });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const handleDownloadExcel = () => {
    try {
        const wb = XLSX.utils.book_new();
        
        // 1. Resumen
        const resumenData = [
            ["REPORTE ESTRATÉGICO DE VENTAS"],
            ["Generado el", new Date().toLocaleString()],
            ["Periodo", `${dateRange.start} al ${dateRange.end}`],
            [""],
            ["KPI", "VALOR"],
            ["Ventas Totales", kpis.totalVentas],
            ["Costos Totales", kpis.totalCostos],
            ["Utilidad Bruta", kpis.totalMargen],
            ["Margen Promedio", `${kpis.margenPromedio}%`],
            ["Items Procesados", kpis.unidadesVendidas],
            ["Ticket Promedio", kpis.ticketPromedio]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenData), "Resumen");

        // 2. Detalle de Ventas
        const headersVentas = [["FECHA", "CLIENTE", "PRODUCTO", "SEDE", "MÉTODO", "UNIDADES", "TOTAL (S/)", "MARGEN %"]];
        const bodyVentas = filteredData.map(p => [p.fecha.toLocaleString(), p.cliente, p.producto, p.sede, p.metodoPago, p.cantidad, p.total, p.margenPorcentaje]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...headersVentas, ...bodyVentas]), "Detalle_Ventas");

        // 3. Top Productos
        const headersProd = [["PRODUCTO", "CANTIDAD", "VENTAS", "MARGEN"]];
        const bodyProd = topProductos.map(p => [p.nombre, p.cantidad, p.ventas, p.margen]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...headersProd, ...bodyProd]), "Top_Productos");

        XLSX.writeFile(wb, `Reporte_Odoo_SaaS_${dateRange.start}.xlsx`);
    } catch (e) { alert("Error al generar el reporte Excel."); }
  };

  const isRentabilidad = view === 'rentabilidad';
  const COLORS = ['#84cc16', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#6366f1'];

  return (
    <div className="p-4 md:p-6 lg:p-8 font-sans w-full relative pb-20 text-slate-700">
      {loading && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center h-screen w-full">
              <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 relative z-10">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
                <span className="font-medium text-slate-600 font-mono tracking-tighter">SINCRONIZANDO ODOO...</span>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-2">
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2 uppercase">
                Análisis de Rentabilidad
                {filterMode === 'hoy' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-brand-100 text-brand-700 border border-brand-200 animate-pulse uppercase"><Zap className="w-3 h-3 mr-1" /> Tiempo Real</span>}
              </h1>
              <p className="text-slate-500 text-sm font-light mt-1">Sincronizado con: <span className="text-brand-600 font-bold">{session?.companyName || 'Modo Demo'}</span> | {dateRange.start}</p>
           </div>
           <div className="mt-4 md:mt-0 flex gap-3">
              <button onClick={() => fetchData()} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs hover:bg-slate-50 shadow-sm transition-all uppercase"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar</button>
              <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:bg-slate-800 transition-all uppercase"><Download className="w-4 h-4" /> Exportar Excel</button>
           </div>
        </div>

        {error && ( <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex gap-3 items-center shadow-sm"><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-sm">{error}</p></div> )}

        {/* Filtros */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-wrap gap-6 items-center">
            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Periodo</label>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                    <button onClick={() => setFilterMode('hoy')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === 'hoy' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Hoy</button>
                    <button onClick={() => setFilterMode('mes')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === 'mes' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Mes</button>
                    <button onClick={() => setFilterMode('anio')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === 'anio' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Año</button>
                    <button onClick={() => setFilterMode('custom')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterMode === 'custom' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Libre</button>
                </div>
            </div>

            {filterMode === 'mes' && (
                <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Año</label>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold">{[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}</select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Mes</label>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold">
                            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1.5 flex-1 max-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Punto de Venta</label>
                <select 
                    value={filtros.sedeSeleccionada} 
                    onChange={(e) => setFiltros({...filtros, sedeSeleccionada: e.target.value})} 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                    <option value="Todas">TODAS LAS SEDES</option>
                    {Array.from(new Set(ventasData.map(v => v.sede))).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
            </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl group-hover:bg-brand-500/20 transition-all"></div>
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl"><DollarSign className="w-6 h-6 text-brand-400" /></div>
                    <span className="text-[10px] font-black bg-brand-500 text-white px-2 py-0.5 rounded uppercase">Ventas</span>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Venta Total (IGV)</p>
                <h3 className="text-3xl font-black tracking-tighter">S/ {kpis.totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 relative overflow-hidden group shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-brand-50 rounded-2xl"><TrendingUp className="w-6 h-6 text-brand-600" /></div>
                    <span className="text-[10px] font-black bg-brand-100 text-brand-700 px-2 py-0.5 rounded uppercase">Margen</span>
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Ganancia Neta</p>
                <h3 className="text-3xl font-black tracking-tighter text-brand-600">S/ {kpis.totalMargen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm group">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-violet-50 rounded-2xl text-violet-600"><Package className="w-6 h-6" /></div>
                    <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded uppercase">Items</span>
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Procesados</p>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900">{kpis.unidadesVendidas.toLocaleString()}</h3>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm group">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-orange-50 rounded-2xl text-orange-600"><Target className="w-6 h-6" /></div>
                    <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded uppercase">Profit</span>
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Margen Global %</p>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900">{kpis.margenPromedio}%</h3>
            </div>
        </div>

        {/* Gráficos de Tendencia */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                        <CalendarRange className="w-5 h-5 text-brand-500" /> Ventas Diarias
                    </h3>
                </div>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ventasPorDia}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `S/${v}`} />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Area type="monotone" dataKey="ventas" stroke="#84cc16" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" /> Comparativa Mensual (6m)
                    </h3>
                </div>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativaMensual}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                            <Bar dataKey="ventas" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                            <Bar dataKey="margen" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Secciones de Top Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Productos */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" /> Top 10 Productos
                    </h3>
                </div>
                <div className="space-y-4 flex-1">
                    {topProductos.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                    <div 
                                        className="bg-brand-500 h-full rounded-full transition-all duration-1000" 
                                        style={{ width: `${(p.ventas / topProductos[0].ventas) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-900 text-sm">S/ {p.ventas.toLocaleString()}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{p.cantidad} uds</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Clientes */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-500" /> Mejores Clientes
                    </h3>
                </div>
                <div className="space-y-4 flex-1">
                    {topClientes.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all font-black text-xs overflow-hidden">
                                {c.nombre.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm">{c.nombre}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{c.ordenes} Pedidos</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-900 text-sm">S/ {c.ventas.toLocaleString()}</p>
                                <div className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase">Top #{idx+1}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Análisis Horario y Categorías */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 mb-8 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" /> Curva de Ventas por Hora
                </h3>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ventasPorHora}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8'}} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                            <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 mb-8 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-rose-500" /> Por Categoría
                </h3>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={ventasPorCategoria} 
                                cx="50%" cy="50%" 
                                innerRadius={60} outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {ventasPorCategoria.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                            <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Detalle Operativo (Tabla) */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-brand-500" /> Registro Detallado
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Últimas transacciones del periodo seleccionado.</p>
                </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Fecha / Cliente</th>
                            <th className="px-6 py-4">Producto</th>
                            <th className="px-6 py-4">Sede / Pago</th>
                            <th className="px-6 py-4 text-right">Total</th>
                            <th className="px-6 py-4 text-center">Margen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredData.slice(0, 50).map((v, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900">{v.cliente || 'Consumidor Final'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{v.fecha.toLocaleString()}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-medium text-slate-700 truncate max-w-[200px]">{v.producto}</p>
                                    <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">{v.categoria}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-xs font-bold text-slate-500">{v.sede}</p>
                                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{v.metodoPago}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <p className="font-black text-slate-900">S/ {v.total.toFixed(2)}</p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${Number(v.margenPorcentaje) > 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {v.margenPorcentaje}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;