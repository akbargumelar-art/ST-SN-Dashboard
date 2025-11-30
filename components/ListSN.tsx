
import React, { useState, useEffect, useRef } from 'react';
import { AdistiTransaction, User } from '../types';
import { getAdistiTransactions, getAdistiFilters, getAdistiSummaryTree } from '../services/storage';
import { Search, List, Database, Users, MapPin, Package, ChevronLeft, ChevronRight, Loader2, PlayCircle, Filter, ChevronDown, Check } from 'lucide-react';

interface ListSNProps {
  data?: any; 
  user: User;
}

// Multi Select Component
const MultiSelect = ({ label, options, selected, onChange, disabled, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter((item: string) => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const isAllSelected = selected.length === options.length && options.length > 0;
    const toggleAll = () => {
        if (isAllSelected) onChange([]);
        else onChange([...options]);
    };

    return (
        <div className="relative" ref={containerRef}>
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{label}</span>
            <div 
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-white flex justify-between items-center cursor-pointer ${disabled ? 'bg-slate-100 cursor-not-allowed border-slate-200 text-slate-400' : 'border-slate-300 hover:border-purple-400'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="truncate">
                    {selected.length === 0 ? placeholder : `${selected.length} Terpilih`}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <div 
                        className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-50 cursor-pointer font-bold text-xs text-purple-600"
                        onClick={toggleAll}
                    >
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${isAllSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                             {isAllSelected && <Check size={12} className="text-white"/>}
                        </div>
                        Pilih Semua
                    </div>
                    {options.map((opt: string) => {
                        const isSelected = selected.includes(opt);
                        return (
                            <div 
                                key={opt} 
                                className="px-3 py-2 flex items-center gap-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                                onClick={() => toggleOption(opt)}
                            >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                    {isSelected && <Check size={12} className="text-white"/>}
                                </div>
                                <span className="truncate">{opt}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

interface SummaryTreeItemProps {
  item: any;
  level: number;
}

// Recursive Tree Item Component
const SummaryTreeItem: React.FC<SummaryTreeItemProps> = ({ item, level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Level 0 = TAP, Level 1 = Sales, Level 2 = Product
    const getIcon = () => {
        if (level === 0) return <MapPin size={16} className="text-orange-500" />;
        if (level === 1) return <Users size={16} className="text-blue-500" />;
        return <Package size={16} className="text-emerald-500" />;
    };

    const isLeaf = !item.children || item.children.length === 0;

    return (
        <div className="w-full">
            <div 
                className={`
                    flex items-center justify-between p-3 border-b border-slate-100 
                    ${!isLeaf ? 'cursor-pointer hover:bg-slate-50' : ''}
                    ${level === 0 ? 'bg-white' : level === 1 ? 'bg-slate-50/50' : 'bg-slate-50'}
                `}
                style={{ paddingLeft: `${(level * 20) + 12}px` }}
                onClick={() => !isLeaf && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    {!isLeaf && (
                        <ChevronRight size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    )}
                    {isLeaf && <div className="w-4" />}
                    
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <span className={`text-sm ${level === 0 ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                            {item.name}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-800">{item.total.toLocaleString()} SN</span>
                </div>
            </div>
            {isExpanded && item.children && (
                <div className="w-full">
                    {item.children.map((child: any, idx: number) => (
                        <SummaryTreeItem key={`${child.name}-${idx}`} item={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};


const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [data, setData] = useState<AdistiTransaction[]>([]);
  const [summaryTree, setSummaryTree] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Options for Dropdowns
  const [filterOptions, setFilterOptions] = useState<{sales: string[], taps: string[]}>({ sales: [], taps: [] });

  // Pagination State
  const [pagination, setPagination] = useState({
      page: 1,
      limit: 50, 
      total: 0,
      totalPages: 1
  });

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Array based filters for Multi-Select
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [selectedTaps, setSelectedTaps] = useState<string[]>([]);

  // INIT: Load Filter Options (Initial Load)
  useEffect(() => {
      const loadOptions = async () => {
          try {
              let initialTaps: string[] = [];
              if (user.assigned_tap) initialTaps.push(user.assigned_tap);

              const res = await getAdistiFilters(initialTaps);
              setFilterOptions(res);
              
              if (user.assigned_salesforce) {
                  setSelectedSales([user.assigned_salesforce]);
              }
              if (user.assigned_tap) {
                  setSelectedTaps([user.assigned_tap]);
              }
          } catch (e) { console.error(e); }
      };
      loadOptions();
  }, [user]);

  // UPDATE SALESFORCE DROPDOWN WHEN TAP CHANGES (Cascading Filter)
  useEffect(() => {
      if (user.assigned_tap) return; 

      const updateSalesDropdown = async () => {
          try {
             const res = await getAdistiFilters(selectedTaps);
             setFilterOptions(prev => ({ ...prev, sales: res.sales }));
          } catch(e) { console.error(e); }
      };

      updateSalesDropdown();
  }, [selectedTaps, user.assigned_tap]);


  // Main Data Fetcher
  const loadData = async (pageToLoad = 1) => {
        setIsLoading(true);
        try {
            const filterParams = {
                page: pageToLoad,
                limit: pagination.limit,
                search: searchTerm,
                startDate,
                endDate,
                salesforce: selectedSales,
                tap: selectedTaps
            };

            // Parallel fetch: Data and Summary Tree
            const [dataRes, treeRes] = await Promise.all([
                getAdistiTransactions(filterParams),
                getAdistiSummaryTree(filterParams)
            ]);
            
            // Set Table Data
            if (dataRes && dataRes.data && Array.isArray(dataRes.data)) {
                setData(dataRes.data);
                setPagination(prev => ({
                    ...prev,
                    total: dataRes.total || 0,
                    totalPages: dataRes.totalPages || 1,
                    page: dataRes.page || 1
                }));
            }

            // Set Tree Data
            if (Array.isArray(treeRes)) {
                setSummaryTree(treeRes);
            } else {
                setSummaryTree([]);
            }
            
            setHasLoaded(true);

        } catch (error) {
            console.error("Failed to load data", error);
            alert("Gagal memuat data. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-purple-600" />
            List SN (Adisti)
          </h2>
          <p className="text-slate-500">Database Master Distribusi</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-shrink-0">
          <div className="lg:col-span-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari SN / Produk</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Ketik disini..." 
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</span>
            <input 
                type="date" 
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sampai</span>
            <input 
                type="date" 
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <div>
             <MultiSelect 
                label="TAP AREA" 
                placeholder="Semua TAP"
                options={filterOptions.taps} 
                selected={selectedTaps} 
                onChange={setSelectedTaps}
                disabled={!!user.assigned_tap}
             />
          </div>
          <div>
             <MultiSelect 
                label="SALESFORCE" 
                placeholder="Semua Sales"
                options={filterOptions.sales} 
                selected={selectedSales} 
                onChange={setSelectedSales}
                disabled={!!user.assigned_salesforce}
             />
          </div>
      </div>

      <div className="flex justify-end flex-shrink-0">
         <button 
            onClick={() => loadData(1)}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg shadow-md transition-all disabled:opacity-50"
         >
            {isLoading ? <Loader2 className="animate-spin" size={18}/> : <PlayCircle size={18}/>}
            <span className="font-bold">Tampilkan Data</span>
         </button>
      </div>

      {/* CONTENT AREA */}
      {!hasLoaded ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             <Filter size={48} className="mb-4 text-slate-300" />
             <p className="font-medium">Silakan atur filter dan klik "Tampilkan Data"</p>
          </div>
      ) : (
          <div className="flex flex-col gap-6 flex-1 min-h-0">
             
             {/* SUMMARY TABLE (COLLAPSIBLE) */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0 flex flex-col max-h-[40vh]">
                 <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                        <List size={16}/> Summary Grouping
                    </h3>
                    <span className="text-xs text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-100">
                        {summaryTree.length} TAP Area
                    </span>
                 </div>
                 <div className="overflow-y-auto flex-1">
                    {summaryTree.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">Tidak ada data summary.</div>
                    ) : (
                        summaryTree.map((tapNode, idx) => (
                            <SummaryTreeItem key={`${tapNode.name}-${idx}`} item={tapNode} level={0} />
                        ))
                    )}
                 </div>
             </div>

             {/* MAIN DATA TABLE */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Total Records:</span>
                        <span className="text-sm font-bold text-slate-800">{pagination.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            disabled={pagination.page === 1 || isLoading}
                            onClick={() => loadData(pagination.page - 1)}
                            className="p-1 rounded-md hover:bg-white disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-xs font-medium text-slate-600">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button 
                            disabled={pagination.page >= pagination.totalPages || isLoading}
                            onClick={() => loadData(pagination.page + 1)}
                            className="p-1 rounded-md hover:bg-white disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">Tanggal</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">No TR (SN)</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">Salesforce</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">TAP</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">No RS</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">ID Digipos</th>
                        <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase tracking-wider">Outlet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((item) => (
                        <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.created_at}</td>
                          <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{item.sn_number}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.salesforce_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.tap}</td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-500">{item.no_rs}</td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-500">{item.id_digipos}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.nama_outlet}</td>
                        </tr>
                      ))}
                      {data.length === 0 && (
                          <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Tidak ada data ditemukan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default ListSN;
