import React, { useState } from 'react';
import { SerialNumber, SNStatus, User, UserRole } from '../types';
import { Search, Download, ShoppingBag, ArrowUpDown, DollarSign, Package, Store } from 'lucide-react';

interface SellthruProps {
  data: SerialNumber[];
  user: User;
}

type SortConfig = {
  key: keyof SerialNumber | 'price';
  direction: 'asc' | 'desc';
};

const Sellthru: React.FC<SellthruProps> = ({ data, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  
  // DEFAULT DATE: TODAY
  const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA'));

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

  // Filter accessible data
  const accessibleData = user.role === UserRole.SALESFORCE 
    ? data.filter(d => d.salesforce_name === user.name)
    : data;

  // Unique Dropdowns
  const uniqueSales = Array.from(new Set(accessibleData.filter(i => i.status === SNStatus.SUKSES_ST && i.salesforce_name).map(i => i.salesforce_name))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.filter(i => i.status === SNStatus.SUKSES_ST && i.tap).map(i => i.tap))).sort();
  
  // Filter only Success ST data
  const sellthruData = accessibleData.filter(item => {
    if (item.status !== SNStatus.SUKSES_ST) return false;

    const matchesSearch = 
      item.sn_number.includes(searchTerm) || 
      (item.id_digipos && item.id_digipos.includes(searchTerm)) ||
      (item.nama_outlet && item.nama_outlet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSales = salesFilter === 'all' || item.salesforce_name === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;
    const matchesDate = dateFilter === '' || item.created_at.startsWith(dateFilter);

    return matchesSearch && matchesSales && matchesTap && matchesDate;
  });

  // Calculate Summaries based on filtered data
  const totalAmount = sellthruData.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalQty = sellthruData.length;
  const uniqueOutlets = new Set(sellthruData.map(i => i.nama_outlet)).size;

  // Sorting
  const sortedData = [...sellthruData].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof SerialNumber] ?? '';
    const bVal = b[sortConfig.key as keyof SerialNumber] ?? '';

    if (sortConfig.key === 'price') {
       return sortConfig.direction === 'asc' 
         ? (a.price || 0) - (b.price || 0)
         : (b.price || 0) - (a.price || 0);
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
            : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    return sortConfig.direction === 'asc'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const requestSort = (key: keyof SerialNumber | 'price') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const handleDownloadCSV = () => {
    const headers = ["Tanggal Sellthru", "SN Number", "Produk", "Flag", "ID Digipos", "Nama Outlet", "Kategori", "Salesforce", "TAP", "Harga", "Transaksi ID"];
    const rows = sortedData.map(item => [
      new Date(item.created_at).toLocaleDateString('id-ID'),
      `'${item.sn_number}`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.flag || '-',
      item.id_digipos || '-',
      `"${(item.nama_outlet || '-').replace(/"/g, '""')}"`,
      item.sub_category,
      item.salesforce_name || '-',
      item.tap || '-',
      item.price || 0,
      item.transaction_id || '-'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_sellthru_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof SerialNumber | 'price', className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors whitespace-nowrap sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.key === sortKey ? 'text-red-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="text-emerald-600" />
            Laporan Sellthru
          </h2>
          <p className="text-slate-500">Data transaksi sukses (Sukses ST)</p>
        </div>
        <button 
          onClick={handleDownloadCSV}
          disabled={sortedData.length === 0}
          className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
        >
          <Download size={16} />
          <span>Unduh Laporan</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Nilai</p>
            <h3 className="text-lg font-bold text-slate-800">{formatCurrency(totalAmount)}</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Unit</p>
            <h3 className="text-lg font-bold text-slate-800">{totalQty} Pcs</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Outlet Aktif</p>
            <h3 className="text-lg font-bold text-slate-800">{uniqueOutlets}</h3>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <div className="relative">
            <span className="text-xs font-bold text-black mb-1 block">Cari Data</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="SN / Digipos / Outlet..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>

        <div>
          <span className="text-xs font-bold text-black mb-1 block">Tanggal</span>
          <input
            type="date"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black font-medium"
            style={{ colorScheme: 'light' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
            <div>
                <span className="text-xs font-bold text-black mb-1 block">Salesforce</span>
                <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black font-medium"
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
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-black font-medium"
                value={tapFilter}
                onChange={(e) => setTapFilter(e.target.value)}
            >
                <option value="all">Semua TAP</option>
                {uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
      </div>

      {/* Table - Fixed Height Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
              <tr>
                <SortableTh label="Tanggal" sortKey="created_at" />
                <SortableTh label="SN Number" sortKey="sn_number" />
                <SortableTh label="Produk" sortKey="product_name" />
                <SortableTh label="Flag" sortKey="flag" />
                <SortableTh label="ID Digipos" sortKey="id_digipos" />
                <SortableTh label="Nama Outlet" sortKey="nama_outlet" />
                <SortableTh label="Kategori" sortKey="sub_category" />
                <SortableTh label="Salesforce" sortKey="salesforce_name" />
                <SortableTh label="TAP" sortKey="tap" />
                <SortableTh label="Harga" sortKey="price" className="text-right" />
                <SortableTh label="Transaksi ID" sortKey="transaction_id" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{item.sn_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 font-medium truncate max-w-[150px]" title={item.product_name}>{item.product_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="px-2 py-1 bg-slate-100 rounded-md text-xs border border-slate-200 whitespace-nowrap">{item.flag || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 bg-emerald-50/50 rounded-sm">{item.id_digipos || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{item.nama_outlet || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.sub_category}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.salesforce_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.tap || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">
                    {item.price ? formatCurrency(item.price) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500 text-right">
                    {item.transaction_id || '-'}
                  </td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                    Belum ada data penjualan (Sellthru) ditemukan.
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

export default Sellthru;