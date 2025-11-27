import React, { useState, useEffect } from 'react';
import { TopupTransaction, User, UserRole } from '../types';
import { getTopupTransactions } from '../services/storage';
import { Search, Download, Wallet, ArrowUpDown, DollarSign, Users, Store, FileText, Calendar } from 'lucide-react';

interface TopupSaldoProps {
  user: User;
}

type SortConfig = {
  key: keyof TopupTransaction;
  direction: 'asc' | 'desc';
};

const TopupSaldo: React.FC<TopupSaldoProps> = ({ user }) => {
  const [data, setData] = useState<TopupTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'transaction_date', 
    direction: 'desc' 
  });

  useEffect(() => {
    setData(getTopupTransactions());
  }, []);

  const accessibleData = user.role === UserRole.SALESFORCE
    ? data.filter(d => d.salesforce === user.name)
    : data;

  const uniqueSales = Array.from(new Set(accessibleData.map(i => i.salesforce).filter(Boolean))).sort();
  const uniqueTaps = Array.from(new Set(accessibleData.map(i => i.tap).filter(Boolean))).sort();

  const filteredData = accessibleData.filter(item => {
    const matchesSearch = 
      item.salesforce.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nama_outlet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sender.includes(searchTerm) ||
      item.receiver.includes(searchTerm) ||
      item.id_digipos.includes(searchTerm) ||
      item.remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.amount.toString().includes(searchTerm);

    const matchesSales = salesFilter === 'all' || item.salesforce === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;
    const matchesDate = dateFilter === '' || item.transaction_date.startsWith(dateFilter);

    return matchesSearch && matchesSales && matchesTap && matchesDate;
  });

  const totalAmount = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
  const uniqueOutlets = new Set(filteredData.map(i => i.nama_outlet)).size;
  const activeSalesforce = new Set(filteredData.map(i => i.salesforce)).size;

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

  const handleDownloadCSV = () => {
    const headers = [
      "Transaction Date", "Sender", "Receiver", "Transaction Type", "Amount", 
      "Currency", "Remarks", "salesforce", "tap", "id digipos", "nama outlet"
    ];
    
    const rows = sortedData.map(item => [
      item.transaction_date,
      `'${item.sender}`,
      `'${item.receiver}`,
      item.transaction_type,
      item.amount,
      item.currency,
      `"${item.remarks.replace(/"/g, '""')}"`,
      item.salesforce,
      item.tap,
      item.id_digipos,
      `"${item.nama_outlet.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `topup_saldo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof TopupTransaction, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100 select-none transition-colors whitespace-nowrap sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} 
        <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? 'text-red-600 rotate-180' : 'text-red-600') : 'text-slate-300'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-blue-600" />
            Topup Saldo
          </h2>
          <p className="text-slate-500">Monitoring transaksi topup harian sesuai data Digipos</p>
        </div>
        <button 
          onClick={handleDownloadCSV}
          disabled={sortedData.length === 0}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
        >
          <Download size={16} />
          <span>Unduh Laporan (CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Amount</p>
            <h3 className="text-xl font-bold text-slate-800">{formatCurrency(totalAmount)}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Transaksi</p>
            <h3 className="text-xl font-bold text-slate-800">{sortedData.length} Tx</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Outlet Aktif</p>
            <h3 className="text-xl font-bold text-slate-800">{uniqueOutlets}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Salesforce</p>
            <h3 className="text-xl font-bold text-slate-800">{activeSalesforce}</h3>
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
                placeholder="Cari Sender, Outlet, Amount..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>

        <div>
          <span className="text-xs font-bold text-black mb-1 block">Transaction Date</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-black font-medium"
              style={{ colorScheme: 'light' }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR || user.role === UserRole.SUPER_ADMIN) && (
            <div>
                <span className="text-xs font-bold text-black mb-1 block">salesforce</span>
                <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-black font-medium"
                    value={salesFilter}
                    onChange={(e) => setSalesFilter(e.target.value)}
                >
                    <option value="all">Semua salesforce</option>
                    {uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        )}

        <div>
            <span className="text-xs font-bold text-black mb-1 block">tap</span>
            <select
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-black font-medium"
                value={tapFilter}
                onChange={(e) => setTapFilter(e.target.value)}
            >
                <option value="all">Semua tap</option>
                {uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <SortableTh label="Transaction Date" sortKey="transaction_date" />
                <SortableTh label="Sender" sortKey="sender" />
                <SortableTh label="Receiver" sortKey="receiver" />
                <SortableTh label="Transaction Type" sortKey="transaction_type" />
                <SortableTh label="Amount" sortKey="amount" className="text-right" />
                <SortableTh label="Currency" sortKey="currency" />
                <SortableTh label="Remarks" sortKey="remarks" />
                <SortableTh label="salesforce" sortKey="salesforce" />
                <SortableTh label="tap" sortKey="tap" />
                <SortableTh label="id digipos" sortKey="id_digipos" />
                <SortableTh label="nama outlet" sortKey="nama_outlet" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors text-sm">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">
                    {item.transaction_date}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{item.sender}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{item.receiver}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-medium">
                      {item.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800 text-right whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.currency}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.remarks}>
                    {item.remarks}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.salesforce}</td>
                  <td className="px-4 py-3 text-slate-600">{item.tap}</td>
                  <td className="px-4 py-3 text-emerald-700 font-medium">{item.id_digipos}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{item.nama_outlet}</td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                    Tidak ada data transaksi ditemukan.
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

export default TopupSaldo;