import React, { useState, useEffect } from 'react';
import { TopupTransaction, User, UserRole } from '../types';
import { getBucketTransactions } from '../services/storage';
import { Search, Download, Receipt, ArrowUpDown, DollarSign, FileText, Store } from 'lucide-react';

interface BucketTransaksiProps {
  user: User;
}

type SortConfig = {
  key: keyof TopupTransaction;
  direction: 'asc' | 'desc';
};

const BucketTransaksi: React.FC<BucketTransaksiProps> = ({ user }) => {
  const [data, setData] = useState<TopupTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'transaction_date', 
    direction: 'desc' 
  });

  useEffect(() => {
    setData(getBucketTransactions());
  }, []);

  // Filter accessible data based on user role
  const accessibleData = user.role === UserRole.SALESFORCE
    ? data.filter(d => d.salesforce === user.name)
    : data;

  // Derive unique values for filters
  const uniqueSales = Array.from(new Set(accessibleData.map(d => d.salesforce).filter(Boolean))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.map(d => d.tap).filter(Boolean))).sort();

  // Search Logic & Filters
  const filteredData = accessibleData.filter(item => {
    const matchesSearch = (
      item.salesforce.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nama_outlet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sender.includes(searchTerm) ||
      item.id_digipos.includes(searchTerm) ||
      item.amount.toString().includes(searchTerm)
    );

    const matchesSales = salesFilter === 'all' || item.salesforce === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;

    return matchesSearch && matchesSales && matchesTap;
  });

  // Calculate Resume Summary
  const totalNominal = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
  const totalTrx = filteredData.length;
  // Outlet Aktif based on unique Receiver (No. RS) as requested
  const activeOutlets = new Set(filteredData.map(i => i.receiver)).size;

  // Sorting Logic
  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (sortConfig.key === 'amount') {
       return sortConfig.direction === 'asc' ? (a.amount - b.amount) : (b.amount - a.amount);
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
            : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    return 0;
  });

  const requestSort = (key: keyof TopupTransaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof TopupTransaction, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors whitespace-nowrap sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} 
        <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.key === sortKey ? 'text-orange-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-orange-600" />
            Bucket Transaksi
          </h2>
          <p className="text-slate-500">Rekapitulasi transaksi SF ke Outlet</p>
        </div>
      </div>

      {/* Resume Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Nominal</p>
            <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalNominal)}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Transaksi</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalTrx} Tx</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Outlet Aktif</p>
            <h3 className="text-2xl font-bold text-slate-800">{activeOutlets}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <div className="relative">
            <span className="text-xs font-bold text-black mb-1 block">Cari Data</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari Transaksi..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>

        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
          <div>
            <span className="text-xs font-bold text-black mb-1 block">Salesforce</span>
            <select
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-black font-medium"
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-black font-medium"
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
                <SortableTh label="Tanggal" sortKey="transaction_date" />
                <SortableTh label="Transaksi ID" sortKey="id" />
                <SortableTh label="Sender (SF)" sortKey="sender" />
                <SortableTh label="Salesforce" sortKey="salesforce" />
                <SortableTh label="TAP" sortKey="tap" />
                <SortableTh label="Receiver (No. RS)" sortKey="receiver" />
                <SortableTh label="ID Digipos" sortKey="id_digipos" />
                <SortableTh label="Nama Outlet" sortKey="nama_outlet" />
                <SortableTh label="Nominal" sortKey="amount" className="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-orange-50/30 transition-colors text-sm">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">{item.transaction_date}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.id.split('-')[1]}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{item.sender}</td>
                  <td className="px-4 py-3 text-slate-700">{item.salesforce}</td>
                  <td className="px-4 py-3 text-slate-600">{item.tap}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.receiver}</td>
                  <td className="px-4 py-3 text-emerald-700 font-mono text-xs font-medium">{item.id_digipos}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{item.nama_outlet}</td>
                  <td className="px-4 py-3 font-bold text-slate-800 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    Tidak ada data transaksi.
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

export default BucketTransaksi;