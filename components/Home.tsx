import React, { useState, useEffect } from 'react';
import { User, SerialNumber, UserRole, TopupTransaction, SNStatus, AdistiTransaction } from '../types';
import { getTopupTransactions, getAdistiTransactions } from '../services/storage';
import { Wallet, List, ShoppingBag, Shield, Users, Filter, Calendar, AlertCircle } from 'lucide-react';

interface HomeProps {
  data: SerialNumber[];
  user: User;
}

const Home: React.FC<HomeProps> = ({ data, user }) => {
  const [topupData, setTopupData] = useState<TopupTransaction[]>([]);
  const [adistiData, setAdistiData] = useState<AdistiTransaction[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        try {
            const topup = await getTopupTransactions();
            // Ambil data Adisti dengan limit cukup besar untuk sampling dashboard (misal 5000)
            // agar statistik match sales lumayan akurat
            const adistiRes = await getAdistiTransactions({ limit: 5000 });
            
            setTopupData(topup);
            
            // Handle response format (Array vs Pagination Object)
            if (adistiRes && adistiRes.data && Array.isArray(adistiRes.data)) {
                setAdistiData(adistiRes.data);
            } else if (Array.isArray(adistiRes)) {
                setAdistiData(adistiRes);
            } else {
                setAdistiData([]);
            }
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        } finally {
            setIsLoading(false);
        }
    };
    load();
  }, []);

  const allSales = new Set([...data.map(d => d.salesforce_name), ...topupData.map(t => t.salesforce)].filter(Boolean));
  const uniqueSales = Array.from(allSales).sort();
  
  const applyFilters = (itemDate: string, itemSales: string, itemTap: string) => {
    if (user.role === UserRole.SALESFORCE && itemSales !== user.name) return false;
    const matchesDate = dateFilter === '' || itemDate.startsWith(dateFilter);
    const matchesSales = salesFilter === 'all' || itemSales === salesFilter;
    const matchesTap = tapFilter === 'all' || itemTap === tapFilter;
    return matchesDate && matchesSales && matchesTap;
  };

  const filteredSNData = data.filter(d => applyFilters(d.created_at, d.salesforce_name, d.tap));
  const filteredTopupData = topupData.filter(t => applyFilters(t.transaction_date, t.salesforce, t.tap));

  const totalTopupAmount = filteredTopupData.reduce((acc, curr) => acc + curr.amount, 0);
  const totalReportSN = filteredSNData.length;
  const sellthruItems = filteredSNData.filter(d => d.status === SNStatus.SUKSES_ST);
  const totalSellthruAmount = sellthruItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
  
  // Kalkulasi Match Sales (Irisan antara Sellthru vs Data Adisti)
  const adistiSNSet = new Set(adistiData.map(a => a.sn_number));
  const totalSales = sellthruItems.filter(i => adistiSNSet.has(i.sn_number)).length;
  const totalSecuring = sellthruItems.length - totalSales;
  const totalTagihan = totalTopupAmount - totalSellthruAmount;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  if (isLoading) {
      return <div className="p-8 text-center text-slate-500">Memuat Dashboard...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <h2 className="text-3xl font-bold text-slate-800">Dashboard Utama</h2>
      
      {/* Global Filters Simplified for brevity in this view */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tanggal</label>
            <input type="date" className="w-full border rounded-lg p-2 text-sm" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        {user.role !== UserRole.SALESFORCE && (
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sales</label>
                <select className="w-full border rounded-lg p-2 text-sm bg-white" value={salesFilter} onChange={e => setSalesFilter(e.target.value)}>
                    <option value="all">Semua Sales</option>
                    {uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Wallet size={24}/></div>
                <h3 className="font-semibold text-slate-700">Topup Saldo</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalTopupAmount)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><List size={24}/></div>
                <h3 className="font-semibold text-slate-700">Report SN</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalReportSN.toLocaleString()} <span className="text-sm font-normal text-slate-500">Pcs</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ShoppingBag size={24}/></div>
                <h3 className="font-semibold text-slate-700">Sales (Match)</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalSales.toLocaleString()} <span className="text-sm font-normal text-slate-500">Pcs</span></p>
            <p className="text-xs text-slate-400 mt-1">Data SN yang ada di Adisti</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Shield size={24}/></div>
                <h3 className="font-semibold text-slate-700">Securing</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalSecuring.toLocaleString()} <span className="text-sm font-normal text-slate-500">Pcs</span></p>
            <p className="text-xs text-slate-400 mt-1">Belum terdata di Adisti</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold">Total Tagihan</h3>
            <p className="text-red-100 opacity-90">Selisih Topup dikurangi Sellthru (Sukses ST)</p>
        </div>
        <div className="text-4xl font-extrabold bg-black/10 px-6 py-2 rounded-xl backdrop-blur-sm">
            {formatCurrency(totalTagihan)}
        </div>
      </div>
    </div>
  );
};

export default Home;