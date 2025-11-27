import React, { useState, useEffect } from 'react';
import { AdistiTransaction, User, UserRole } from '../types';
import { getAdistiTransactions } from '../services/storage';
import { Search, List, ArrowUpDown, Package, Box, Store, FileText } from 'lucide-react';

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

  const filteredData = accessibleData.filter(item => {
    const matchesSearch = item.sn_number.includes(searchTerm) || item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSales = salesFilter === 'all' || item.salesforce_name === salesFilter;
    const matchesTap = tapFilter === 'all' || item.tap === tapFilter;
    return matchesSearch && matchesSales && matchesTap;
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

  const SortableTh = ({ label, sortKey }: { label: string, sortKey: keyof AdistiTransaction }) => (
    <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase cursor-pointer hover:bg-slate-100" onClick={() => requestSort(sortKey)}>
      <div className="flex items-center gap-1">{label} <ArrowUpDown size={12} /></div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-4">
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><List className="text-purple-600" />List SN (Adisti)</h2></div>
      </div>
      {/* Filters (Sales, TAP, Search) same structure as other components */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="relative"><input type="text" placeholder="Search..." className="w-full pl-4 pr-3 py-2 text-sm rounded-lg border border-slate-300" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
         {(user.role !== UserRole.SALESFORCE) && <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300" value={salesFilter} onChange={(e) => setSalesFilter(e.target.value)}><option value="all">Semua Sales</option>{uniqueSales.map(s => <option key={s} value={s}>{s}</option>)}</select>}
         <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300" value={tapFilter} onChange={(e) => setTapFilter(e.target.value)}><option value="all">Semua TAP</option>{uniqueTaps.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <SortableTh label="Tanggal" sortKey="created_at" />
                <SortableTh label="NoTr (SN)" sortKey="sn_number" />
                <SortableTh label="Product" sortKey="product_name" />
                <SortableTh label="Salesforce" sortKey="salesforce_name" />
                <SortableTh label="TAP" sortKey="tap" />
                <SortableTh label="No RS" sortKey="no_rs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50/30 transition-colors text-sm">
                  <td className="px-4 py-3">{item.created_at}</td>
                  <td className="px-4 py-3 font-mono font-bold">{item.sn_number}</td>
                  <td className="px-4 py-3">{item.product_name}</td>
                  <td className="px-4 py-3">{item.salesforce_name}</td>
                  <td className="px-4 py-3">{item.tap}</td>
                  <td className="px-4 py-3 font-mono">{item.no_rs || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListSN;