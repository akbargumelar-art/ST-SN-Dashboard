import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, SerialNumber, AdistiTransaction } from '../types';
import { getAdistiTransactions, getAdistiFilters, downloadAdistiReport, getAdistiSummaryTree } from '../services/storage';
import { Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, Loader2, ChevronDown, ChevronUp, Package, Users, MapPin, CheckSquare, Square } from 'lucide-react';

interface ListSNProps {
  user: User;
  data: SerialNumber[];
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

// --- Custom Multi-Select Dropdown Component ---
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
          ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-700 hover:border-purple-500 focus:ring-2 focus:ring-purple-500'}
        `}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div 
            onClick={toggleAll}
            className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-50 text-sm font-bold text-purple-700"
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
              {selected.includes(option) ? <CheckSquare size={16} className="text-purple-600" /> : <Square size={16} className="text-slate-300" />}
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Summary Tree Component (Accordion) ---
interface SummaryTreeItemProps {
    item: any; // Using any for simplicity in tree structure
    level: number;
}
  
const SummaryTreeItem: React.FC<SummaryTreeItemProps> = ({ item, level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = item.children && item.children.length > 0;
    
    // Icon based on level
    let Icon = MapPin;
    let colorClass = "text-purple-600 bg-purple-100";
    if (level === 1) { Icon = Users; colorClass = "text-blue-600 bg-blue-100"; }
    if (level === 2) { Icon = Package; colorClass = "text-emerald-600 bg-emerald-100"; }
  
    return (
      <div className="border-b border-slate-100 last:border-0">
        <div 
          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors ${level > 0 ? 'bg-slate-50/50' : ''}`}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
             {hasChildren && (
                 <div className={`p-1 rounded-full transition-transform ${isExpanded ? 'rotate-90 bg-slate-200' : 'bg-transparent'}`}>
                     <ChevronRight size={14} className="text-slate-400" />
                 </div>
             )}
             {!hasChildren && <div className="w-6" />}
             
             <div className={`p-1.5 rounded-lg ${colorClass}`}>
                 <Icon size={16} />
             </div>
             <div>
                 <p className="text-sm font-bold text-slate-700">{item.name}</p>
             </div>
          </div>
          <div className="text-sm font-bold text-slate-800">
             {(item.total || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">SN</span>
          </div>
        </div>
        
        {isExpanded && hasChildren && (
            <div className="animate-fade-in">
                {item.children.map((child: any, idx: number) => (
                    <SummaryTreeItem key={`${child.name}-${idx}`} item={child} level={level + 1} />
                ))}
            </div>
        )}
      </div>
    );
};

const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<AdistiTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryTree, setSummaryTree] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Options for Dropdowns
  const [filterOptions, setFilterOptions] = useState<{sales: string[], taps: string[]}>({ sales: [], taps: [] });

  // Pagination State - DEFAULT 50
  const [pagination, setPagination] = useState({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1
  });

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  
  // DEFAULT DATES: TODAY
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [selectedTap, setSelectedTap] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false); // Filter First Logic
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

  // Load Filters on Mount
  useEffect(() => {
    const loadFilters = async () => {
        try {
            const filters = await getAdistiFilters();
            setFilterOptions(filters);
            
            // Auto-Assign logic for Restricted Users
            if (user.assigned_tap) {
                const myTaps = user.assigned_tap.split(',').map(t => t.trim());
                setSelectedTap(myTaps);
            }
            if (user.assigned_salesforce) {
                const mySales = user.assigned_salesforce.split(',').map(s => s.trim());
                setSelectedSales(mySales);
            }
        } catch (error) {
            console.error("Failed to load filters", error);
        }
    };
    loadFilters();
  }, [user]);

  // Cascading Dropdown: Load Sales based on Selected TAP
  useEffect(() => {
    const updateSalesOptions = async () => {
        if (selectedTap.length > 0) {
            const filters = await getAdistiFilters(selectedTap);
            // Only update sales options, keep existing selected if valid
            setFilterOptions(prev => ({ ...prev, sales: filters.sales }));
        } else {
             // If no tap selected, reload all
             const filters = await getAdistiFilters();
             setFilterOptions(filters);
        }
    };
    updateSalesOptions();
  }, [selectedTap]);

  // Fetch Data Function
  const fetchData = useCallback(async () => {
      setLoading(true);
      setLoadingSummary(true);
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

          // Parallel Fetch
          const [result, treeResult] = await Promise.all([
              getAdistiTransactions(params),
              getAdistiSummaryTree(params)
          ]);
          
          if (result && Array.isArray(result.data)) {
              setTransactions(result.data);
              setPagination(prev => ({
                  ...prev,
                  total: result.total || 0,
                  totalPages: result.totalPages || 1
              }));
          } else {
               if (Array.isArray(result)) {
                   setTransactions(result);
               } else {
                   setTransactions([]);
               }
          }

          if (Array.isArray(treeResult)) {
              setSummaryTree(treeResult);
          }

          setHasSearched(true);

      } catch (error) {
          console.error("Failed to fetch Adisti transactions", error);
          setTransactions([]);
      } finally {
          setLoading(false);
          setLoadingSummary(false);
      }
  }, [pagination.page, pagination.limit, searchTerm, startDate, endDate, selectedSales, selectedTap, sortConfig]);

  // Trigger fetch only when pagination changes AFTER initial search
  useEffect(() => {
      if (hasSearched) {
          fetchData();
      }
  }, [pagination.page]); // Only trigger on page change, other filters require "Tampilkan" button

  const handleSort = (key: string) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleDownload = async () => {
      try {
          await downloadAdistiReport({
              search: searchTerm,
              startDate,
              endDate,
              salesforce: selectedSales,
              tap: selectedTap,
              sortBy: sortConfig.key,
              sortOrder: sortConfig.direction
          });
      } catch (error) {
          alert('Gagal mendownload laporan');
      }
  };

  const SortableTh = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none transition-colors sticky top-0 bg-slate-50 z-10 ${className}`}
      onClick={() => handleSort(sortKey)}
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
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">List SN (Adisti)</h2>
          <p className="text-slate-500">Database Master Distribusi</p>
        </div>
      </div>

      {/* Summary Section (Tree Table) */}
      {hasSearched && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-sm">Summary Kontribusi (Hierarchy)</h3>
                <span className="text-xs text-slate-500">Tap &gt; Sales &gt; Produk</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
                {loadingSummary ? (
                    <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-purple-600"/></div>
                ) : summaryTree.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Tidak ada data summary.</div>
                ) : (
                    summaryTree.map((tap, idx) => (
                        <SummaryTreeItem key={`${tap.name}-${idx}`} item={tap} level={0} />
                    ))
                )}
            </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-shrink-0">
         <div className="lg:col-span-2 relative">
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cari SN / Produk</label>
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Ketik disini..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
                 />
             </div>
         </div>
         
         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-purple-500" />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sampai</label>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-purple-500" />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tap Area</label>
             <MultiSelectDropdown 
                options={filterOptions.taps} 
                selected={selectedTap} 
                onChange={setSelectedTap} 
                placeholder="Semua TAP"
                disabled={!!user.assigned_tap} // Lock if assigned
             />
         </div>

         <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Salesforce</label>
             <MultiSelectDropdown 
                options={filterOptions.sales} 
                selected={selectedSales} 
                onChange={setSelectedSales} 
                placeholder="Semua Sales"
                disabled={!!user.assigned_salesforce} // Lock if assigned
             />
         </div>
      </div>

      <div className="flex gap-2">
         <button 
            onClick={() => { setPagination(p => ({...p, page: 1})); fetchData(); }} 
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg shadow-md transition-all flex justify-center items-center gap-2"
         >
            <Search size={18} /> Tampilkan Data
         </button>
         {hasSearched && (
             <button 
                onClick={handleDownload}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg shadow-sm transition-all flex justify-center items-center gap-2"
             >
                <Download size={18} /> Export CSV
             </button>
         )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
        {loading && (
            <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
        )}
        
        {!hasSearched ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="font-bold text-lg">Menunggu Filter</p>
                <p className="text-sm">Silakan pilih filter tanggal/area lalu klik "Tampilkan Data"</p>
            </div>
        ) : (
            <>
                <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                    <tr>
                        <SortableTh label="TANGGAL" sortKey="created_at" />
                        <SortableTh label="NOTR (SN)" sortKey="sn_number" />
                        <SortableTh label="PRODUCT" sortKey="product_name" />
                        <SortableTh label="SALESFORCE" sortKey="salesforce_name" />
                        <SortableTh label="TAP" sortKey="tap" />
                        <SortableTh label="NO RS" sortKey="no_rs" />
                        <SortableTh label="ID DIGIPOS" sortKey="id_digipos" />
                        <SortableTh label="OUTLET" sortKey="nama_outlet" />
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {transactions.length > 0 ? (
                        transactions.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-purple-50/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{item.sn_number}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate" title={item.product_name}>{item.product_name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 font-medium">{item.salesforce_name}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.tap}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.no_rs}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 font-mono">{item.id_digipos}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[150px]" title={item.nama_outlet}>{item.nama_outlet}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                Tidak ada data ditemukan untuk filter ini.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>

                {/* Pagination */}
                <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
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

export default ListSN;