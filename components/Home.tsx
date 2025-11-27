import React, { useState, useEffect } from 'react';
import { User, SerialNumber, UserRole, TopupTransaction, SNStatus, AdistiTransaction } from '../types';
import { getTopupTransactions, getAdistiTransactions } from '../services/storage';
import { Wallet, List, ShoppingBag, Receipt, DollarSign, Package, CheckCircle, Shield, Users, Filter, Calendar } from 'lucide-react';

interface HomeProps {
  data: SerialNumber[]; // Report SN Data
  user: User;
}

const Home: React.FC<HomeProps> = ({ data, user }) => {
  const [topupData, setTopupData] = useState<TopupTransaction[]>([]);
  const [adistiData, setAdistiData] = useState<AdistiTransaction[]>([]);

  // Filter States
  const [dateFilter, setDateFilter] = useState('');
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');

  useEffect(() => {
    setTopupData(getTopupTransactions());
    setAdistiData(getAdistiTransactions());
  }, []);

  // --- Derived Lists for Dropdowns ---
  // Combine all sources to get unique Sales and TAPs
  const allSales = new Set([
    ...data.map(d => d.salesforce_name),
    ...topupData.map(t => t.salesforce),
    ...adistiData.map(a => a.salesforce_name)
  ].filter(Boolean));
  
  const allTaps = new Set([
    ...data.map(d => d.tap),
    ...topupData.map(t => t.tap),
    ...adistiData.map(a => a.tap)
  ].filter(Boolean));

  const uniqueSales = Array.from(allSales).sort();
  const uniqueTaps = Array.from(allTaps).sort();

  // --- Filter Logic ---
  const applyFilters = (itemDate: string, itemSales: string, itemTap: string) => {
    // Role-based restriction first
    if (user.role === UserRole.SALESFORCE && itemSales !== user.name) return false;

    // UI Filters
    const matchesDate = dateFilter === '' || itemDate.startsWith(dateFilter);
    const matchesSales = salesFilter === 'all' || itemSales === salesFilter;
    const matchesTap = tapFilter === 'all' || itemTap === tapFilter;

    return matchesDate && matchesSales && matchesTap;
  };

  const filteredSNData = data.filter(d => applyFilters(d.created_at, d.salesforce_name, d.tap));
  const filteredTopupData = topupData.filter(t => applyFilters(t.transaction_date, t.salesforce, t.tap));
  // Note: Adisti data usually doesn't strictly follow the daily date filter for "Securing" logic check, 
  // but for "Sales" matching we compare against the specific SNs in the filtered Report SN.
  // However, for pure display or referencing, we might filter it. 
  // For the Dashboard calculations, we need the *Global* Adisti list to check if a sold SN exists in master.
  // But we filter the *Topup* and *Report* data to calculate performance for that specific period/person.

  // --- Resume Calculations ---

  // 1. Topup Saldo
  const totalTopupAmount = filteredTopupData.reduce((acc, curr) => acc + curr.amount, 0);

  // 2. Report SN
  const totalReportSN = filteredSNData.length;
  
  // 3. Sellthru
  const sellthruItems = filteredSNData.filter(d => d.status === SNStatus.SUKSES_ST);
  const totalSellthruAmount = sellthruItems.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // 4. Sales vs Securing
  // We check the *filtered* sellthru items against the *entire* Adisti database to see if they are valid sales
  const adistiSNSet = new Set(adistiData.map(a => a.sn_number)); // Compare against full master list

  let totalSales = 0;
  let totalSecuring = 0;

  sellthruItems.forEach(item => {
    if (adistiSNSet.has(item.sn_number)) {
      totalSales++;
    } else {
      totalSecuring++;
    }
  });

  // 5. Total Tagihan
  const totalTagihan = totalTopupAmount - totalSellthruAmount;

  // --- Performance Table Data ---
  const showSummaryTable = user.role !== UserRole.SALESFORCE;
  
  const summaryMap = new Map<string, {
    salesforce: string,
    tap: string,
    topup: number,
    sellthru: number,
    sales: number,
    securing: number,
    tagihan: number
  }>();

  if (showSummaryTable) {
    // Process Topup (Filtered)
    filteredTopupData.forEach(t => {
      const key = `${t.salesforce}-${t.tap}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { salesforce: t.salesforce, tap: t.tap, topup: 0, sellthru: 0, sales: 0, securing: 0, tagihan: 0 });
      }
      summaryMap.get(key)!.topup += t.amount;
    });

    // Process Sellthru (Filtered)
    sellthruItems.forEach(d => {
      const key = `${d.salesforce_name}-${d.tap}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { salesforce: d.salesforce_name, tap: d.tap, topup: 0, sellthru: 0, sales: 0, securing: 0, tagihan: 0 });
      }
      const entry = summaryMap.get(key)!;
      entry.sellthru += (d.price || 0);
      
      if (adistiSNSet.has(d.sn_number)) {
        entry.sales += 1;
      } else {
        entry.securing += 1;
      }
    });

    // Calculate Tagihan per row
    summaryMap.forEach(entry => {
      entry.tagihan = entry.topup - entry.sellthru;
    });
  }

  const summaryData = Array.from(summaryMap.values());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Dashboard Utama</h2>
          <p className="text-slate-500">Ringkasan performa dan tagihan terkini</p>
        </div>
      </div>

      {/* Global Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Filter Tanggal</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Filter Salesforce</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
              >
                <option value="all">Semua Sales</option>
                {uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Filter TAP</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
              value={tapFilter}
              onChange={(e) => setTapFilter(e.target.value)}
            >
              <option value="all">Semua TAP</option>
              {uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Resume Topup Saldo */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Wallet size={24} />
              </div>
              <h3 className="font-semibold text-slate-700">Topup Saldo</h3>
            </div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Nominal</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalTopupAmount)}</p>
          </div>
        </div>

        {/* Resume Report SN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <List size={24} />
              </div>
              <h3 className="font-semibold text-slate-700">Report SN</h3>
            </div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Terdistribusi</p>
            <p className="text-2xl font-bold text-slate-900">{totalReportSN.toLocaleString()} Pcs</p>
          </div>
        </div>

        {/* Resume Sellthru Sales */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <ShoppingBag size={24} />
              </div>
              <h3 className="font-semibold text-slate-700">Sellthru Sales</h3>
            </div>
            <div className="flex justify-between items-end">
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total (Match Adisti)</p>
                 <p className="text-2xl font-bold text-slate-900">{totalSales} Pcs</p>
               </div>
               <CheckCircle size={20} className="text-emerald-300 mb-1" />
            </div>
          </div>
        </div>

        {/* Resume Sellthru Securing */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                <Shield size={24} />
              </div>
              <h3 className="font-semibold text-slate-700">Sellthru Securing</h3>
            </div>
            <div className="flex justify-between items-end">
               <div>
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total (Non-Adisti)</p>
                 <p className="text-2xl font-bold text-slate-900">{totalSecuring} Pcs</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Total Tagihan Section */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom-right"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Receipt size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Total Tagihan</h3>
              <p className="text-red-100 text-sm opacity-90">Selisih Topup Saldo - Total Sellthru (Amount)</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
               {formatCurrency(totalTagihan)}
             </div>
             <p className="text-red-200 text-xs mt-2 uppercase font-medium tracking-widest">Balance Akhir</p>
          </div>
        </div>
      </div>

      {/* Summary Table for Management */}
      {showSummaryTable && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <Users size={20} className="text-slate-500" />
               Daftar Performa per Sales & TAP
             </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase">Salesforce</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase">TAP</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase text-right">Topup Saldo</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase text-right">Sellthru Amount</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase text-center">Sales (Pcs)</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase text-center">Securing (Pcs)</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-xs uppercase text-right">Sisa Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.length > 0 ? (
                  summaryData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{row.salesforce}</td>
                      <td className="px-6 py-4 text-slate-600">{row.tap}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(row.topup)}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(row.sellthru)}</td>
                      <td className="px-6 py-4 text-center text-emerald-600 font-bold">{row.sales}</td>
                      <td className="px-6 py-4 text-center text-amber-600 font-bold">{row.securing}</td>
                      <td className={`px-6 py-4 text-right font-bold font-mono ${row.tagihan < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatCurrency(row.tagihan)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Belum ada data transaksi yang sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;