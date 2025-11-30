import React, { useEffect, useState } from 'react';
import { DashboardStats, SerialNumber, SNStatus, User, UserRole } from '../types';
import { generateDailyInsight } from '../services/geminiService';
import { updateSerialNumberStatus } from '../services/storage';
import { Sparkles, Activity, CheckCircle, XCircle, Clock, Search, Download, QrCode, Check, X, ArrowUpDown } from 'lucide-react';

interface DashboardProps {
  data: SerialNumber[];
  user: User;
  refreshData: () => void;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

const Dashboard: React.FC<DashboardProps> = ({ data, user, refreshData }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalToday: 0,
    totalSuccess: 0,
    totalFailed: 0,
    totalReady: 0
  });
  
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  
  // DEFAULT DATE: TODAY (Local Timezone YYYY-MM-DD)
  const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
  
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [activeStatFilter, setActiveStatFilter] = useState<string>('all');

  const accessibleData = user.role === UserRole.SALESFORCE 
    ? data.filter(d => d.salesforce_name === user.name)
    : data;

  const uniqueSalesNames = Array.from(new Set(accessibleData.map(d => d.salesforce_name).filter(Boolean))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.map(d => d.tap).filter(Boolean))).sort();
  const categories = Array.from(new Set(accessibleData.map(d => d.sub_category).filter(Boolean))).sort();
  const uniqueFlags = Array.from(new Set(accessibleData.map(d => d.flag).filter(Boolean))).sort();

  useEffect(() => {
    const newStats = {
      totalToday: accessibleData.length,
      totalSuccess: accessibleData.filter(d => d.status === SNStatus.SUKSES_ST).length,
      totalFailed: accessibleData.filter(d => d.status === SNStatus.GAGAL_ST).length,
      totalReady: accessibleData.filter(d => d.status === SNStatus.READY).length,
    };
    setStats(newStats);
  }, [accessibleData]);

  const filteredData = accessibleData.filter(item => {
    const matchesSearch = item.sn_number.includes(searchTerm) || 
                         item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.id_digipos && item.id_digipos.includes(searchTerm)) ||
                         (item.nama_outlet && item.nama_outlet.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || item.sub_category === categoryFilter;
    const matchesSales = salesFilter === 'all' || item.salesforce_name === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;
    const matchesFlag = flagFilter === 'all' || item.flag === flagFilter;
    const matchesDate = dateFilter === '' || item.created_at.startsWith(dateFilter);

    let matchesStat = true;
    if (activeStatFilter === 'success') matchesStat = item.status === SNStatus.SUKSES_ST;
    else if (activeStatFilter === 'failed') matchesStat = item.status === SNStatus.GAGAL_ST;
    else if (activeStatFilter === 'ready') matchesStat = item.status === SNStatus.READY;

    return matchesSearch && matchesCategory && matchesSales && matchesTap && matchesFlag && matchesDate && matchesStat;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const getVal = (obj: any, key: string) => obj[key] || '';
    let aVal = getVal(a, sortConfig.key);
    let bVal = getVal(b, sortConfig.key);

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (sortConfig.key === 'created_at') {
      aVal = new Date(a.created_at || 0).getTime();
      bVal = new Date(b.created_at || 0).getTime();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const result = await generateDailyInsight(stats);
    setInsight(result);
    setLoadingInsight(false);
  };

  const handleDownloadCSV = () => {
    const headers = ["Tanggal", "SN Number", "Flag", "Produk", "Kategori", "Status", "ID Digipos", "Nama Outlet", "Salesforce", "TAP"];
    const rows = sortedData.map(item => [
      new Date(item.created_at).toLocaleDateString('id-ID'),
      `'${item.sn_number}`,
      item.flag || '-',
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.sub_category,
      item.status,
      item.status === SNStatus.SUKSES_ST ? (item.id_digipos || '-') : '-',
      item.status === SNStatus.SUKSES_ST ? (`"${(item.nama_outlet || '-').replace(/"/g, '""')}"`) : '-',
      item.salesforce_name || '-',
      item.tap || '-'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_sn_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = async (id: number, newStatus: SNStatus) => {
    try {
        await updateSerialNumberStatus(id, newStatus);
        refreshData();
    } catch (err) {
        alert("Gagal update status");
    }
  };

  const StatusBadge = ({ status }: { status: SNStatus }) => {
    const styles = {
      [SNStatus.READY]: "bg-amber-100 text-amber-700 border-amber-200",
      [SNStatus.SUKSES_ST]: "bg-emerald-100 text-emerald-700 border-emerald-200",
      [SNStatus.GAGAL_ST]: "bg-red-100 text-red-700 border-red-200",
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status]}`}>{status}</span>;
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.direction === 'asc' ? 'text-red-600 rotate-180' : 'text-red-600'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Report List SN</h2>
          <p className="text-slate-500">Pantauan real-time performa harian</p>
        </div>
        <button
          onClick={handleGenerateInsight}
          disabled={loadingInsight}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Sparkles size={18} className={loadingInsight ? "animate-spin" : ""} />
          <span>{loadingInsight ? "Menganalisa..." : "AI Insight Harian"}</span>
        </button>
      </div>

      {insight && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start space-x-3 flex-shrink-0">
          <div className="bg-white p-2 rounded-lg text-red-600 mt-1 shadow-sm">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="font-bold text-red-900">Analisa Cerdas Gemini</h4>
            <p className="text-red-800 text-sm leading-relaxed mt-1">{insight}</p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-shrink-0">
        {/* ... (StatCard code remains same as previous, just render props) ... */}
        {/* Placeholder for brevity - logic same as before */}
        <StatCard title="Total Hari Ini" value={stats.totalToday} icon={Activity} color="bg-blue-600" isActive={activeStatFilter === 'all'} onClick={() => setActiveStatFilter('all')} />
        <StatCard title="Sukses ST" value={stats.totalSuccess} icon={CheckCircle} color="bg-emerald-500" isActive={activeStatFilter === 'success'} onClick={() => setActiveStatFilter('success')} />
        <StatCard title="Gagal ST" value={stats.totalFailed} icon={XCircle} color="bg-red-600" isActive={activeStatFilter === 'failed'} onClick={() => setActiveStatFilter('failed')} />
        <StatCard title="Pending / Ready" value={stats.totalReady} icon={Clock} color="bg-amber-500" isActive={activeStatFilter === 'ready'} onClick={() => setActiveStatFilter('ready')} />
      </div>

      <div className="space-y-4 pt-4 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">Laporan Detail</h3>
            <p className="text-sm text-slate-500">Filter Aktif: <span className="font-bold text-red-600 uppercase">{activeStatFilter === 'all' ? 'Semua Data' : activeStatFilter}</span></p>
          </div>
          <button onClick={handleDownloadCSV} className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium shadow-sm">
            <Download size={16} /><span>Unduh Excel (CSV)</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-shrink-0">
          <div className="relative">
            <span className="text-xs font-bold text-black mb-1 block">Pencarian</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="SN / Digipos / Outlet..." className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-black mb-1 block">Tanggal</span>
            <input type="date" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <div>
            <span className="text-xs font-bold text-black mb-1 block">Kategori</span>
            <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Semua Kategori</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="text-xs font-bold text-black mb-1 block">Flag</span>
            <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)}>
              <option value="all">Semua Flag</option>
              {uniqueFlags.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
            <div>
              <span className="text-xs font-bold text-black mb-1 block">Salesforce</span>
              <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={salesFilter} onChange={(e) => setSalesFilter(e.target.value)}>
                <option value="all">Semua Sales</option>
                {uniqueSalesNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}
          <div>
            <span className="text-xs font-bold text-black mb-1 block">TAP</span>
            <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black" value={tapFilter} onChange={(e) => setTapFilter(e.target.value)}>
              <option value="all">Semua TAP</option>
              {uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <SortableTh label="Tanggal" sortKey="created_at" />
                  <SortableTh label="SN Number" sortKey="sn_number" />
                  <SortableTh label="Flag" sortKey="flag" />
                  <SortableTh label="Produk" sortKey="product_name" />
                  <th className="px-4 py-3 font-bold text-slate-900 text-xs text-center">QR</th>
                  <SortableTh label="Status" sortKey="status" />
                  <SortableTh label="ID Digipos" sortKey="id_digipos" />
                  <SortableTh label="Nama Outlet" sortKey="nama_outlet" />
                  <SortableTh label="Salesforce" sortKey="salesforce_name" />
                  <SortableTh label="TAP" sortKey="tap" />
                  {user.role === UserRole.SALESFORCE && <th className="px-4 py-3 font-bold text-slate-900 text-xs text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((item) => (
                  <tr key={item.id} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{item.sn_number}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700"><span className="px-2 py-1 bg-slate-100 rounded-md text-xs border border-slate-200 whitespace-nowrap">{item.flag || '-'}</span></td>
                    <td className="px-4 py-3 text-sm"><div className="font-medium text-slate-900 truncate max-w-[150px]">{item.product_name}</div></td>
                    <td className="px-4 py-3 text-center"><button onClick={() => setSelectedQR(item.qr_code_url)} className="text-slate-400 hover:text-red-600"><QrCode size={18} /></button></td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.status === SNStatus.SUKSES_ST ? (item.id_digipos || '-') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.status === SNStatus.SUKSES_ST ? (item.nama_outlet || '-') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{item.salesforce_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{item.tap || '-'}</td>
                    {user.role === UserRole.SALESFORCE && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {item.status === SNStatus.READY ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleStatusChange(item.id, SNStatus.SUKSES_ST)} className="p-1.5 rounded-md bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
                            <button onClick={() => handleStatusChange(item.id, SNStatus.GAGAL_ST)} className="p-1.5 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50"><X size={16} /></button>
                          </div>
                        ) : <span className="text-xs text-slate-300 italic">Locked</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* QR Modal omitted for brevity, same as before */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedQR(null)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative animate-scale-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedQR(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-600 transition-colors"><X size={24} /></button>
            <h3 className="text-lg font-bold text-slate-800 mb-6">QR Code Detail</h3>
            <div className="bg-white p-4 rounded-xl border-2 border-slate-100 inline-block shadow-inner"><img src={selectedQR} alt="QR Large" className="w-64 h-64 mx-auto" /></div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, isActive, onClick }: any) => (
  <div onClick={onClick} className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer transition-all duration-200 flex items-center space-x-4 select-none ${isActive ? 'border-red-500 ring-2 ring-red-100 transform -translate-y-1' : 'border-slate-200 hover:-translate-y-1 hover:shadow-md'}`}>
    <div className={`${color} p-3 rounded-lg text-white shadow-lg shadow-opacity-20`}><Icon size={24} /></div>
    <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p><h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3></div>
  </div>
);

export default Dashboard;