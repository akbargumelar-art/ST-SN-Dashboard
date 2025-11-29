import React, { useState, useEffect } from 'react';
import { AdistiTransaction, User, UserRole } from '../types';
import { getAdistiTransactions } from '../services/storage';
import { Search, List, ArrowUpDown, Package, Users, MapPin, Calendar, Database, Filter } from 'lucide-react';

interface ListSNProps {
  data: any; 
  user: User;
}

type SortConfig = {
  key: keyof AdistiTransaction;
  direction: 'asc' | 'desc';
};

const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [data, setData] = useState<AdistiTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  
  // Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

  useEffect(() => {
    const load = async () => {
        const res = await getAdistiTransactions();
        setData(res);
    };
    load();
  }, []);

  const accessibleData = user.role === UserRole.SALESFORCE 
    ? data.filter(d => d.salesforce_name === user.name)
    : data;

  const uniqueSales = Array.from(new Set(accessibleData.map(i => i.salesforce_name).filter(Boolean))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.map(i => i.tap).filter(Boolean))).sort();

  // Filter Logic
  const filteredData = accessibleData.filter(item => {
    const matchesSearch = item.sn_number.includes(searchTerm) || item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSales = salesFilter === 'all' || item.salesforce_name === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;
    
    // Date Range Logic
    // Asumsi format created_at dari CSV bisa 'YYYY-MM-DD' atau 'YYYY-MM-DD HH:mm:ss'
    const itemDate = item.created_at.substring(0, 10); 
    const matchesStartDate = !startDate || itemDate >= startDate;
    const matchesEndDate = !endDate || itemDate <= endDate;

    return matchesSearch && matchesSales && matchesTap && matchesStartDate && matchesEndDate;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const requestSort = (key: keyof AdistiTransaction) => {
    setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  // Summary Calculations based on filtered data
  const totalData = filteredData.length;
  const uniqueSalesCount = new Set(filteredData.map(d => d.salesforce_name)).size;
  const uniqueTapCount = new Set(filteredData.map(d => d.tap)).size;
  const uniqueProductsCount = new Set(filteredData.map(d => d.product_name)).size;

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof AdistiTransaction, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase cursor-pointer hover:bg-slate-100 sticky top-0 bg-slate-50 z-20 transition-colors select-none shadow-[0_1px_0_rgba(0,0,0,0.1)] ${className}`} 
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} 
        <ArrowUpDown size={12} className={sortConfig.key === sortKey ? 'text-purple-600' : 'text-slate-300'} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in space-y-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-2 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <List className="text-purple-600" />
            List SN (Adisti)
          </h2>
          <p className="text-slate-500 text-sm mt-1">Database Master Distribusi</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Database size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Data</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{totalData.toLocaleString()}</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sales Aktif</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{uniqueSalesCount}</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><MapPin size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TAP Coverage</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{uniqueTapCount}</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Package size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis Produk</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{uniqueProductsCount}</p>
            </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 flex-shrink-0 items-end">
         
         {/* Search */}
         <div className="lg:col-span-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari SN / Produk</span>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Ketik disini..." 
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
         </div>
         
         {/* Date Range */}
         <div className="lg:col-span-3 flex gap-2">
            <div className="w-1/2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</span>
                <div className="relative">
                    <input 
                        type="date" 
                        className="w-full pl-2 pr-1 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                </div>
            </div>
            <div className="w-1/2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sampai</span>
                <div className="relative">
                    <input 
                        type="date" 
                        className="w-full pl-2 pr-1 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                    />
                </div>
            </div>
         </div>

         {/* Dropdowns */}
         {(user.role !== UserRole.SALESFORCE) && (
             <div className="lg:col-span-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Salesforce</span>
                <select className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" value={salesFilter} onChange={(e) => setSalesFilter(e.target.value)}>
                    <option value="all">Semua Sales</option>
                    {uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
         )}

         <div className="lg:col-span-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">TAP Area</span>
            <select className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" value={tapFilter} onChange={(e) => setTapFilter(e.target.value)}>
                <option value="all">Semua TAP</option>
                {uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
         </div>
      </div>

      {/* Table Container - STACK & SCROLL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <SortableTh label="Tanggal" sortKey="created_at" />
                <SortableTh label="NoTr (SN)" sortKey="sn_number" />
                <SortableTh label="Product" sortKey="product_name" />
                <SortableTh label="Salesforce" sortKey="salesforce_name" />
                <SortableTh label="TAP" sortKey="tap" />
                <SortableTh label="No RS" sortKey="no_rs" />
                <SortableTh label="ID Digipos" sortKey="id_digipos" />
                <SortableTh label="Outlet" sortKey="nama_outlet" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50/50 transition-colors text-xs md:text-sm group">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.created_at}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 bg-slate-50/50">{item.sn_number}</td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]" title={item.product_name}>{item.product_name}</td>
                  <td className="px-4 py-3 text-slate-600 font-medium">{item.salesforce_name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.tap}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{item.no_rs || '-'}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{item.id_digipos || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]" title={item.nama_outlet}>{item.nama_outlet || '-'}</td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                  <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                  <List size={40} className="text-slate-300"/>
                              </div>
                              <p className="font-medium">Tidak ada data ditemukan.</p>
                              <p className="text-xs">Coba ubah filter tanggal atau kata kunci pencarian.</p>
                          </div>
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Info */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 flex justify-between items-center flex-shrink-0 z-20">
            <span>Menampilkan <strong>{sortedData.length}</strong> dari total {data.length} baris data</span>
            <span className="flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full"><Database size={10}/> Adisti DB</span>
        </div>
      </div>
    </div>
  );
};

export default ListSN;