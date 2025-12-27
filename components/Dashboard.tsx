
import React, { useState, useEffect } from 'react';
import { 
  OdooCredential, 
  SalesSummary, 
  ProductSold, 
  MonthlyData, 
  CategoryData, 
  CustomerData,
  UserRole
} from '../types';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Download,
  AlertCircle,
  Building2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { GoogleGenAI } from '@google/genai';

interface DashboardProps {
  credential: OdooCredential | null;
  credentials?: OdooCredential[];
  onSelectCredential?: (cred: OdooCredential) => void;
  role: UserRole;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const Dashboard: React.FC<DashboardProps> = ({ credential, credentials, onSelectCredential, role }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<ProductSold[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerData[]>([]);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (credential) {
      fetchDashboardData();
    }
  }, [credential]);

  const fetchDashboardData = async () => {
    setLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mocking the Python calculations provided by the user
    setSummary({
      ventas_totales: 145890.50,
      costos_totales: 98450.20,
      utilidad_bruta: 47440.30,
      margen_global: 32.52,
      ordenes_totales: 1245,
      ticket_promedio: 117.18,
      items_vendidos: 4560
    });

    setTopProducts([
      { product_id: 1, nombre: 'Monitor LG 27" 4K', cantidad_vendida: 145, ventas_totales: 43500, veces_vendido: 130, precio_promedio: 300 },
      { product_id: 2, nombre: 'Laptop HP ProBook', cantidad_vendida: 82, ventas_totales: 65600, veces_vendido: 80, precio_promedio: 800 },
      { product_id: 3, nombre: 'Teclado Mecánico RGB', cantidad_vendida: 210, ventas_totales: 16800, veces_vendido: 195, precio_promedio: 80 },
      { product_id: 4, nombre: 'Mouse Wireless G Pro', cantidad_vendida: 185, ventas_totales: 11100, veces_vendido: 180, precio_promedio: 60 },
      { product_id: 5, nombre: 'Webcam 1080p Ultra', cantidad_vendida: 120, ventas_totales: 8400, veces_vendido: 115, precio_promedio: 70 }
    ]);

    setMonthlyData([
      { mes: '2023-06', ventas: 120000, ordenes: 980, ticket_promedio: 122 },
      { mes: '2023-07', ventas: 135000, ordenes: 1100, ticket_promedio: 122 },
      { mes: '2023-08', ventas: 118000, ordenes: 950, ticket_promedio: 124 },
      { mes: '2023-09', ventas: 142000, ordenes: 1200, ticket_promedio: 118 },
      { mes: '2023-10', ventas: 155000, ordenes: 1300, ticket_promedio: 119 },
      { mes: '2023-11', ventas: 145890, ordenes: 1245, ticket_promedio: 117 }
    ]);

    setCategories([
      { nombre: 'Cómputo', ventas: 65000, cantidad: 450 },
      { nombre: 'Periféricos', ventas: 35000, cantidad: 1200 },
      { nombre: 'Accesorios', ventas: 25000, cantidad: 2000 },
      { nombre: 'Software', ventas: 20890, cantidad: 910 }
    ]);

    setTopCustomers([
      { cliente_id: 101, nombre: 'Inversiones Global S.A.C.', ventas_totales: 12500, ordenes: 15, ticket_promedio: 833, ultima_compra: '2023-11-18' },
      { cliente_id: 102, nombre: 'Distribuidora del Norte', ventas_totales: 10200, ordenes: 8, ticket_promedio: 1275, ultima_compra: '2023-11-15' },
      { cliente_id: 103, nombre: 'Tech Solutions EIRL', ventas_totales: 8900, ordenes: 12, ticket_promedio: 741, ultima_compra: '2023-11-19' },
      { cliente_id: 104, nombre: 'Almacenes San Jose', ventas_totales: 7500, ordenes: 5, ticket_promedio: 1500, ultima_compra: '2023-11-10' }
    ]);

    setLoading(false);
  };

  const generateAiInsight = async () => {
    if (!summary || isAiLoading) return;
    setIsAiLoading(true);
    try {
      // Initialize GoogleGenAI using the environment variable API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as a senior business analyst. Analyze this sales report summary for an Odoo instance:
      - Total Sales: ${summary.ventas_totales}
      - Total Costs: ${summary.costos_totales}
      - Gross Profit: ${summary.utilidad_bruta}
      - Margin: ${summary.margen_global}%
      - Total Orders: ${summary.ordenes_totales}
      
      Give me a 2-paragraph summary in Spanish about the business health and 2 actionable recommendations. Keep it professional and concise.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      
      // Accessing .text property directly as per guidelines
      setAiInsight(response.text || "No insights generated.");
    } catch (error) {
      console.error("AI Error:", error);
      setAiInsight("Unable to generate AI analysis at this time.");
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!credential) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md">
           <AlertCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
           <h3 className="text-xl font-bold text-slate-800 mb-2">No Company Selected</h3>
           <p className="mb-6">Please select an Odoo database from the dropdown to visualize the profitability reports.</p>
           {role === UserRole.SUPERADMIN && credentials && (
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => {
                  const cred = credentials.find(c => c.id === e.target.value);
                  if (cred && onSelectCredential) onSelectCredential(cred);
                }}
              >
                <option value="">Choose a company...</option>
                {credentials.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters & Selection */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            {/* Fix: Added missing Building2 component from lucide-react */}
            <Building2 className="text-blue-600 w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{credential.companyName}</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${credential.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {credential.isActive ? 'Connected' : 'Offline'}
          </span>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {role === UserRole.SUPERADMIN && credentials && (
            <select 
              className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              value={credential.id}
              onChange={(e) => {
                const cred = credentials.find(c => c.id === e.target.value);
                if (cred && onSelectCredential) onSelectCredential(cred);
              }}
            >
              {credentials.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          )}
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
            <Calendar size={16} />
            <span>Last 30 Days</span>
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Download size={16} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Sales" 
          value={`S/ ${summary?.ventas_totales.toLocaleString() || '0'}`} 
          trend="+12.5%" 
          isPositive={true}
          icon={DollarSign}
          color="blue"
        />
        <KpiCard 
          title="Gross Profit" 
          value={`S/ ${summary?.utilidad_bruta.toLocaleString() || '0'}`} 
          trend="+8.2%" 
          isPositive={true}
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard 
          title="Gross Margin" 
          value={`${summary?.margen_global || '0'}%`} 
          trend="-2.1%" 
          isPositive={false}
          icon={ArrowUpRight}
          color="amber"
        />
        <KpiCard 
          title="Total Orders" 
          value={summary?.ordenes_totales.toString() || '0'} 
          trend="+18.4%" 
          isPositive={true}
          icon={Package}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Sales Trend</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Monthly
              </span>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `S/${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insight Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-xl shadow-lg shadow-blue-900/20 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-yellow-300 w-6 h-6" />
              <h3 className="font-bold text-xl">Gemini Insights</h3>
            </div>
            
            {aiInsight ? (
               <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 text-sm leading-relaxed overflow-y-auto max-h-[300px] scrollbar-hide">
                 {aiInsight}
               </div>
            ) : (
               <div className="py-12 text-center opacity-80">
                  <p className="italic mb-6">Click below to generate an AI analysis of your profitability based on recent data.</p>
               </div>
            )}
          </div>
          
          <button 
            onClick={generateAiInsight}
            disabled={isAiLoading}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition active:scale-95 disabled:opacity-50"
          >
            {isAiLoading ? (
               <div className="flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                 <span>Analyzing...</span>
               </div>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Generate Business Advice</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-slate-800 text-lg mb-4">Top 5 Products</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                   <th className="pb-3">Product</th>
                   <th className="pb-3">Quantity</th>
                   <th className="pb-3">Revenue</th>
                   <th className="pb-3 text-right">Avg Price</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {topProducts.map(p => (
                    <tr key={p.product_id} className="text-sm hover:bg-slate-50 transition">
                      <td className="py-4 font-semibold text-slate-700">{p.nombre}</td>
                      <td className="py-4 text-slate-600">{p.cantidad_vendida}</td>
                      <td className="py-4 text-slate-600 font-medium">S/ {p.ventas_totales.toLocaleString()}</td>
                      <td className="py-4 text-right text-slate-500">S/ {p.precio_promedio}</td>
                    </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* Categories Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 text-lg mb-4">Revenue by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="ventas"
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
             {categories.map((cat, idx) => (
                <div key={cat.nombre} className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                   <span className="text-sm text-slate-600 font-medium">{cat.nombre}: <span className="text-slate-400">S/{cat.ventas/1000}k</span></span>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Top Customers</h3>
            <button className="text-blue-600 text-sm font-bold hover:underline">View All Clients</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {topCustomers.map(customer => (
               <div key={customer.cliente_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-blue-200 transition">
                  <p className="text-sm font-bold text-slate-800 truncate mb-1">{customer.nombre}</p>
                  <p className="text-xs text-slate-400 mb-3">ID: #{customer.cliente_id}</p>
                  <div className="flex items-center justify-between">
                     <span className="text-lg font-black text-blue-600">S/ {customer.ventas_totales.toLocaleString()}</span>
                     <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold leading-none">Orders</p>
                        <p className="text-sm font-bold text-slate-700">{customer.ordenes}</p>
                     </div>
                  </div>
               </div>
            ))}
          </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: any;
  color: 'blue' | 'emerald' | 'amber' | 'indigo';
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, trend, isPositive, icon: Icon, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition cursor-default">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
        <h4 className="text-2xl font-black text-slate-800 leading-tight">{value}</h4>
      </div>
    </div>
  );
};

export default Dashboard;
