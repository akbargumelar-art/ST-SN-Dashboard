import React, { useState, useEffect } from 'react';
import { User, SerialNumber, UserRole, TopupTransaction, SNStatus, AdistiTransaction } from '../types';
import { getTopupTransactions, getAdistiTransactions } from '../services/storage';
import { Wallet, List, ShoppingBag, Shield, Users, Filter, Calendar } from 'lucide-react';

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

  useEffect(() => {
    const load = async () => {
        const topup = await getTopupTransactions();
        const adisti = await getAdistiTransactions();
        setTopupData(topup);
        setAdistiData(adisti);
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
  
  const adistiSNSet = new Set(adistiData.map(a => a.sn_number));
  const totalSales = sellthruItems.filter(i => adistiSNSet.has(i.sn_number)).length;
  const totalSecuring = sellthruItems.length - totalSales;
  const totalTagihan = totalTopupAmount - totalSellthruAmount;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <h2 className="text-3xl font-bold text-slate-800">Dashboard Utama</h2>
      
      {/* Global Filters Simplified for brevity in this view */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><label className="text-xs font-bold text-slate-500 uppercase">Tanggal</label><input type="date" className="w-full border rounded p-2" value={dateFilter} onChange={e => setDateFilter(e.target.value)} /></div>
        {user.role !== UserRole.SALESFORCE && <div><label className="text-xs font-bold text-slate-500 uppercase">Sales</label><select className="w-full border rounded p-2" value={salesFilter} onChange={e => setSalesFilter(e.target.value)}><option value="all">All</option>{uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex items-center gap-3 mb-4"><Wallet size={24} className="text-blue-600"/> <h3 className="font-semibold">Topup Saldo</h3></div><p className="text-2xl font-bold">{formatCurrency(totalTopupAmount)}</p></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex items-center gap-3 mb-4"><List size={24} className="text-purple-600"/> <h3 className="font-semibold">Report SN</h3></div><p className="text-2xl font-bold">{totalReportSN} Pcs</p></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex items-center gap-3 mb-4"><ShoppingBag size={24} className="text-emerald-600"/> <h3 className="font-semibold">Sales (Match)</h3></div><p className="text-2xl font-bold">{totalSales} Pcs</p></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex items-center gap-3 mb-4"><Shield size={24} className="text-amber-600"/> <h3 className="font-semibold">Securing</h3></div><p className="text-2xl font-bold">{totalSecuring} Pcs</p></div>
      </div>

      <div className="bg-red-600 rounded-2xl p-8 text-white shadow-xl flex justify-between items-center">
        <div><h3 className="text-2xl font-bold">Total Tagihan</h3><p className="text-red-100 opacity-90">Balance Akhir</p></div>
        <div className="text-4xl font-extrabold">{formatCurrency(totalTagihan)}</div>
      </div>
    </div>
  );
};

export default Home;