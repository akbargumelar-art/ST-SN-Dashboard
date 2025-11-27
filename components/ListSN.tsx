import React, { useState, useEffect } from 'react';
import { AdistiTransaction, User, UserRole } from '../types';
import { getAdistiTransactions } from '../services/storage';
import { Search, List, ArrowUpDown, Package, Box, Store, FileText } from 'lucide-react';

interface ListSNProps {
  data: any; // We ignore the passed prop as we use independent storage
  user: User;
}

type SortConfig = {
  key: keyof AdistiTransaction;
  direction: 'asc' | 'desc';
};

const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [data, setData] = useState<AdistiTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'created_at', 
    direction: 'desc' 
  });

  useEffect(() => {
    setData(getAdistiTransactions());
  }, []);

  // Filter accessible data
  const accessibleData = user.role === UserRole.SALESFORCE 
    ? data.filter(d => d.salesforce_name === user.name)
    : data;

  const uniqueSales = Array.from(new Set(accessibleData.map(i => i.salesforce_name).filter(Boolean))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.map(i => i.tap).filter(Boolean))).sort();

  // Filter Logic
  const filteredData = accessibleData.filter(item => {
    const matchesSearch = 
      item.sn_number.includes(searchTerm) || 
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.no_rs && item.no_rs.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSales = salesFilter === 'all' || item.salesforce_name === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;

    return matchesSearch && matchesSales && matchesTap;
  });

  // Calculate Summaries based on filtered data
  const totalSN = filteredData.length;
  const uniqueProducts = new Set(filteredData.map(i => i.product_name)).size;
  const uniqueWarehouses = new Set(filteredData.map(i => i.warehouse)).size;
  const uniqueOutlets = new Set(filteredData.map(i => i.id_digipos)).size; // Using ID Digipos as unique identifier for outlet

  // Sorting Logic
  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';

    if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const requestSort = (key: keyof AdistiTransaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof AdistiTransaction, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors whitespace-nowrap sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} 
        <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.key === sortKey ? 'text-purple-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <List className="text-purple-600" />
            List SN (Adisti)
          </h2>
          <p className="text-slate-500">Daftar master Serial Number dari Principal</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total SN</p>
            <h3 className="text-xl font-bold text-slate-800">{totalSN}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Produk</p>
            <h3 className="text-xl font-bold text-slate-800">{uniqueProducts}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
            <Box size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Gudang</p>
            <h3 className="text-xl font-bold text-slate-800">{uniqueWarehouses}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Outlet</p>
            <h3 className="text-xl font-bold text-slate-800">{uniqueOutlets}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <div className="relative">
            <span className="text-xs font-bold text-black mb-1 block">Cari Data</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari SN / Produk / Gudang..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>

        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
            <div>
                <span className="text-xs font-bold text-black mb-1 block">Salesforce</span>
                <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-black font-medium"
                    value={salesFilter}
                    onChange={(e) => setSalesFilter(e.target.value)}
                >
                    <option value="all">Semua Sales</option>
                    {uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        )}

        <div>
            <span className="text-xs font-bold text-black mb-1 block">TAP</span>
            <select
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-black font-medium"
                value={tapFilter}
                onChange={(e) => setTapFilter(e.target.value)}
            >
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
                <SortableTh label="NoTr (SN)" sortKey="sn_number" />
                <SortableTh label="Gudang" sortKey="warehouse" />
                <SortableTh label="Product" sortKey="product_name" />
                <SortableTh label="Salesforce" sortKey="salesforce_name" />
                <SortableTh label="TAP" sortKey="tap" />
                <SortableTh label="No RS" sortKey="no_rs" />
                <SortableTh label="ID Digipos" sortKey="id_digipos" />
                <SortableTh label="Nama Outlet" sortKey="nama_outlet" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50/30 transition-colors text-sm">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {item.created_at}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{item.sn_number}</td>
                  <td className="px-4 py-3 text-slate-600">{item.warehouse}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium truncate max-w-[200px]" title={item.product_name}>{item.product_name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.salesforce_name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.tap}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.no_rs || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.id_digipos || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.nama_outlet || '-'}</td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    Data SN tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListSN;