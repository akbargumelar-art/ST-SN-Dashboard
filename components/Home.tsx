import React, { useState, useEffect } from 'react';
import { User, SerialNumber, UserRole } from '../types';
import { getDashboardSummary, getAdistiFilters } from '../services/storage';
import { Wallet, ShoppingBag, Shield, Receipt, Filter, Calendar, Users, MapPin, Loader2 } from 'lucide-react';

interface HomeProps {
  data: SerialNumber[];
  user: User;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const [summary, setSummary] = useState({
      totalTopup: 0,
      totalSales: 0,
      totalSecuring: 0,
      countSales: 0,
      countSecuring: 0,
      totalTagihan: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
  const [endDateFilter, setEndDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  
  const [filterOptions, setFilterOptions] = useState<{sales: string[], taps: string[]}>({ sales: [], taps: [] });

  useEffect(() => {
    const loadFilters = async () => {
        try {
            const filters = await getAdistiFilters();
            setFilterOptions(filters);
            if (user.assigned_tap) setTapFilter(user.assigned_tap.split(',')[0]);
            if (user.assigned_salesforce) setSalesFilter(user.assigned_salesforce.split(',')[0]);
        } catch (e) {
            console.error("Filter load error", e);
        }
    };
    loadFilters();
  }, [user]);

  useEffect(() => {
    const loadSummary = async () => {
        setIsLoading(true);
        try {
            const params = {
                startDate: dateFilter,
                endDate: endDateFilter,
                salesforce: salesFilter,
                tap: tapFilter
            };
            const res = await getDashboardSummary(params);
            if (res) setSummary(res);
        } catch (e) {
            console.error("Dashboard Summary Error:", e);
        } finally {
            setIsLoading(false);
        }
    };
    loadSummary();
  }, [dateFilter, endDateFilter, salesFilter, tapFilter]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <h2 className="text-3xl font-bold text-slate-800">Dashboard Utama</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
            <input type="date" className="w-full border rounded-lg p-2 text-sm" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sampai</label>
            <input type="date" className="w-full border rounded-lg p-2 text-sm" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} />
        </div>
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tap Area</label>
            <select 
                className="w-full border rounded-lg p-2 text-sm bg-white" 
                value={tapFilter} 
                onChange={e => setTapFilter(e.target.value)}
                disabled={!!user.assigned_tap}
            >
                <option value="all">Semua TAP</option>
                {filterOptions.taps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Salesforce</label>
            <select 
                className="w-full border rounded-lg p-2 text-sm bg-white" 
                value={salesFilter} 
                onChange={e => setSalesFilter(e.target.value)}
                disabled={!!user.assigned_salesforce}
            >
                <option value="all">Semua Sales</option>
                {filterOptions.sales.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
      </div>

      {isLoading ? (
          <div className="py-20 flex justify-center items-center">
              <Loader2 className="animate-spin text-red-600" size={48} />
          </div>
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={64} className="text-blue-600"/></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Wallet size={24}/></div>
                        <h3 className="font-semibold text-slate-700">Topup Saldo</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalTopup)}</p>
                    <p className="text-xs text-slate-400 mt-1">Total Deposit Masuk</p>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingBag size={64} className="text-emerald-600"/></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ShoppingBag size={24}/></div>
                        <h3 className="font-semibold text-slate-700">Sales (Match)</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalSales)}</p>
                    <p className="text-xs text-emerald-600 mt-1 font-bold">{summary.countSales.toLocaleString()} <span className="font-normal text-slate-400">Transaksi Valid (Ada di Adisti)</span></p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Shield size={64} className="text-amber-600"/></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Shield size={24}/></div>
                        <h3 className="font-semibold text-slate-700">Securing</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalSecuring)}</p>
                    <p className="text-xs text-amber-600 mt-1 font-bold">{summary.countSecuring.toLocaleString()} <span className="font-normal text-slate-400">Transaksi (Tidak ada di Adisti)</span></p>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Receipt size={64} className="text-white"/></div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/10 rounded-lg text-white"><Receipt size={24}/></div>
                        <h3 className="font-semibold text-slate-100">Total Tagihan</h3>
                    </div>
                    <p className="text-2xl font-extrabold text-white tracking-tight">{formatCurrency(summary.totalTagihan)}</p>
                    <p className="text-xs text-slate-400 mt-1 opacity-80">Rumus: Topup - Securing</p>
                </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                <div className="flex-shrink-0 mt-0.5"><Shield size={16}/></div>
                <div>
                    <p className="font-bold mb-1">Penjelasan Logika Tagihan:</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                        <li><strong>Sales (Match):</strong> Transaksi Sellthru yang SN-nya ditemukan di Database Principal (Adisti).</li>
                        <li><strong>Securing:</strong> Transaksi Sellthru yang SN-nya TIDAK ditemukan di Database Principal.</li>
                        <li><strong>Total Tagihan:</strong> Dihitung dari <code>Total Topup - Total Securing</code>.</li>
                    </ul>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default Home;