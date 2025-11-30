
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopupTransaction, User, UserRole } from '../types';
import { getTopupTransactions, getTopupFilters, getTopupSummary } from '../services/storage';
import { Search, Wallet, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, CheckSquare, Square, ChevronDown } from 'lucide-react';

interface TopupSaldoProps {
  user: User;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

// Reuse MultiSelect Dropdown
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options);
    }
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === options.length 
      ? `Semua (${options.length})` 
      : `${selected.length} Terpilih`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm rounded-lg border flex justify-between items-center text-left transition-colors
          ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 focus:ring-2 focus:ring-blue-500'}
        `}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div 
            onClick={toggleAll}
            className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-50 text-sm font-bold text-blue-700"
          >
            {selected.length === options.length ? <CheckSquare size={16} /> : <Square size={16} />}
            Pilih Semua
          </div>
          {options.map(option => (
            <div 
              key={option}
              onClick={() => toggleOption(option)}
              className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700"
            >
              {selected.includes(option) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TopupSaldo: React.FC<TopupSaldoProps> = ({ user }) => {
  const [data, setData] = useState<TopupTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalAmount: 0, totalCount: 0, uniqueSenders: 0 });
  
  const [filterOptions, setFilterOptions] = useState<{sales: string[], taps: string[]}>({ sales: [], taps: [] });
  
  const [pagination, setPagination] = useState({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [selectedTap, setSelectedTap] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'transaction_date', direction: 'desc' });

  // Load Filters
  useEffect(() => {
    const loadFilters = async () => {
        try {
            const filters = await getTopupFilters();
            setFilterOptions(filters);
            if (user.assigned_tap) setSelectedTap(user.assigned_tap.split(',').map(t => t.trim()));
            if (user.assigned_salesforce) setSelectedSales(user.assigned_salesforce.split(',').map(s => s.trim()));
        } catch (e) { console.error(e); }
    };
    loadFilters();
  }, [user]);

  // Update Sales on Tap change
  useEffect(() => {
    const updateSales = async () => {
        if (selectedTap.length > 0) {
            const filters = await getTopupFilters(selectedTap);
            setFilterOptions(prev => ({ ...prev, sales: filters.sales }));
        } else {
             const filters = await getTopupFilters();
             setFilterOptions(filters);
        }
    };
    updateSales();
  }, [selectedTap]);

  const fetchData = useCallback(async () => {
      setLoading(true);
      try {
          const params = {
              page: pagination.page,
              limit: pagination.limit,
              search: searchTerm,
              startDate,
              endDate,
              salesforce: selectedSales,
              tap: selectedTap,
              sortBy: sortConfig.key,
              sortOrder: sortConfig.direction
          };

          const [result, summaryRes] = await Promise.all([
              getTopupTransactions(params),
              getTopupSummary(params)
          ]);

          if (result && Array.isArray(result.data)) {
              setData(result.data);
              setPagination(prev => ({ ...prev, total: result.total || 0, totalPages: result.totalPages || 1 }));
          } else {
              setData([]);
          }

          if (summaryRes) setSummary(summaryRes);
          setHasSearched(true);

      } catch (e) {
          console.error(e);
          setData([]);
      } finally {
          setLoading(false);
      }
  }, [pagination.page, pagination.limit, searchTerm, startDate, endDate, selectedSales, selectedTap, sortConfig]);

  // Initial Fetch on Mount or Page Change if Searched
  useEffect(() => {
      if(hasSearched) fetchData();
  }, [pagination.page, sortConfig]);

  const handleSort = (key: string) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
      setPagination(p => ({ ...p, page: 1 }));
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown size={12} className={`ml-1 inline ${sortConfig.key === sortKey ? 'text-blue-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-end pb-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-blue-600"/> Topup Saldo</h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-shrink-0">
         <div className="lg:col-span-2 relative">
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cari Transaksi</label>
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Trx ID, Salesforce, atau Remarks..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                 />
             </div>
         </div>
         
         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sampai</label>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tap Area</label>
             <MultiSelectDropdown 
                options={filterOptions.taps} 
                selected={selectedTap} 
                onChange={setSelectedTap} 
                placeholder="Semua TAP"
                disabled={!!user.assigned_tap}
             />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Salesforce</label>
             <MultiSelectDropdown 
                options={filterOptions.sales} 
                selected={selectedSales} 
                onChange={setSelectedSales} 
                placeholder="Semua Sales"
                disabled={!!user.assigned_salesforce}
             />
         </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
         <button 
            onClick={() => { setPagination(p => ({...p, page: 1})); fetchData(); }} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow-md transition-all flex justify-center items-center gap-2"
         >
            <Search size={18} /> Tampilkan Data
         </button>
      </div>

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase">Total Nominal</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalAmount)}</p>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase">Total Transaksi</p>
                <p className="text-2xl font-bold text-slate-700">{summary.totalCount.toLocaleString()}</p>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase">Pengirim Unik</p>
                <p className="text-2xl font-bold text-slate-700">{summary.uniqueSenders.toLocaleString()}</p>
             </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
        {loading && (
            <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        )}
        
        {!hasSearched ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="font-bold text-lg">Menunggu Filter</p>
                <p className="text-sm">Silakan pilih filter dan klik "Tampilkan Data"</p>
             </div>
        ) : (
            <>
                <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                    <tr>
                        <SortableTh label="TRX ID" sortKey="transaction_id" />
                        <SortableTh label="TANGGAL" sortKey="transaction_date" />
                        <SortableTh label="SALESFORCE" sortKey="salesforce" />
                        <SortableTh label="TAP" sortKey="tap" />
                        <SortableTh label="AMOUNT" sortKey="amount" className="text-right" />
                        <SortableTh label="REMARKS" sortKey="remarks" />
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {data.length > 0 ? (
                        data.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/30 text-sm">
                            <td className="px-4 py-3 font-mono text-slate-500">{item.transaction_id || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.transaction_date}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{item.salesforce}</td>
                            <td className="px-4 py-3 text-slate-500">{item.tap}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(item.amount)}</td>
                            <td className="px-4 py-3 truncate max-w-xs text-slate-500">{item.remarks}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Tidak ada data ditemukan.</td></tr>
                    )}
                    </tbody>
                </table>
                </div>

                {/* Pagination */}
                <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between flex-shrink-0">
                    <div className="text-xs text-slate-500">
                        Halaman <strong>{pagination.page}</strong> dari <strong>{pagination.totalPages}</strong> (Total: {pagination.total} Data)
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={pagination.page <= 1 || loading}
                            onClick={() => setPagination(p => ({...p, page: p.page - 1}))}
                            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            disabled={pagination.page >= pagination.totalPages || loading}
                            onClick={() => setPagination(p => ({...p, page: p.page + 1}))}
                            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default TopupSaldo;
