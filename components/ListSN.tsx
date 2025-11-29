import React, { useState, useEffect } from 'react';
import { AdistiTransaction, User, UserRole } from '../types';
import { getAdistiTransactions } from '../services/storage';
import { Search, List, ArrowUpDown, Package, Users, MapPin, Database, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ListSNProps {
  data?: any; // Not used anymore as we fetch internally
  user: User;
}

const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [data, setData] = useState<AdistiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Pagination State
  const [pagination, setPagination] = useState({
      page: 1,
      limit: 100, // Load 100 items per page
      total: 0,
      totalPages: 1
  });

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');

  // Load Data Effect - Triggered on Mount & When Filters/Page Change
  useEffect(() => {
    const load = async () => {
        setIsLoading(true);
        try {
            const res = await getAdistiTransactions({
                page: pagination.page,
                limit: pagination.limit,
                search: searchTerm,
                startDate,
                endDate,
                salesforce: salesFilter !== 'all' ? salesFilter : undefined,
                tap: tapFilter !== 'all' ? tapFilter : undefined
            });
            
            // Check if response is the new format { data, total, ... } or old array
            if (Array.isArray(res)) {
                setData(res); // Fallback if server old
            } else {
                setData(res.data);
                setPagination(prev => ({
                    ...prev,
                    total: res.total,
                    totalPages: res.totalPages,
                    page: res.page
                }));
            }
        } catch (error) {
            console.error("Failed to load adisti data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce search to prevent too many API calls
    const timeoutId = setTimeout(() => {
        load();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [pagination.page, searchTerm, startDate, endDate, salesFilter, tapFilter]);

  // Reset page to 1 when filters change
  useEffect(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, startDate, endDate, salesFilter, tapFilter]);

  // Handler for Pagination
  const handleNextPage = () => {
      if (pagination.page < pagination.totalPages) {
          setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      }
  };

  const handlePrevPage = () => {
      if (pagination.page > 1) {
          setPagination(prev => ({ ...prev, page: prev.page - 1 }));
      }
  };

  // Hardcoded lists for filters (In real app, fetch unique values via separate API)
  // For now, we assume users type or we use some known values. 
  // Since we use server-side, we can't get all unique values from `data` state easily.
  // For UX, we'll keep it simple or remove the dropdowns if we can't populate them.
  // Let's keep them as text inputs or basic dropdowns if we know the values.
  
  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in space-y-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-2 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <List className="text-purple-600" />
            List SN (Adisti)
          </h2>
          <p className="text-slate-500 text-sm mt-1">Database Master Distribusi (Server-Side)</p>
        </div>
        
        {/* Pagination Info Top Right */}
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-200">
            <span>Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong></span>
            <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
            <span>Total: <strong>{pagination.total.toLocaleString()}</strong> data</span>
        </div>
      </div>

      {/* Summary Cards - Statis / Dinamis dari Total */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Database size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Data DB</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{pagination.total.toLocaleString()}</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salesforce</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">--</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><MapPin size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TAP Area</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">--</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Package size={18} /></div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">Active</p>
            </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 flex-shrink-0 items-end">
         
         {/* Search */}
         <div className="lg:col-span-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari SN / Produk / Outlet</span>
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
         <div className="lg:col-span-4 flex gap-2">
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

         {/* Sales Filter (Manual Input for now as getting all unique sales from DB is expensive) */}
         <div className="lg:col-span-2">
             <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Salesforce</span>
             <input
                 type="text"
                 placeholder="Nama Sales..."
                 className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none"
                 value={salesFilter === 'all' ? '' : salesFilter}
                 onChange={(e) => setSalesFilter(e.target.value || 'all')}
             />
         </div>

         <div className="lg:col-span-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">TAP Area</span>
             <input
                 type="text"
                 placeholder="Nama TAP..."
                 className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none"
                 value={tapFilter === 'all' ? '' : tapFilter}
                 onChange={(e) => setTapFilter(e.target.value || 'all')}
             />
         </div>
      </div>

      {/* Table Container - STACK & SCROLL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 relative overflow-hidden">
        
        {/* Loading Overlay */}
        {isLoading && (
            <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
        )}

        <div className="flex-1 overflow-y-auto w-full scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">Tanggal</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">NoTr (SN)</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">Product</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">Salesforce</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">TAP</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">No RS</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">ID Digipos</th>
                <th className="px-4 py-3 font-bold text-slate-900 text-xs uppercase sticky top-0 bg-slate-50">Outlet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item) => (
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
              {!isLoading && data.length === 0 && (
                  <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                  <List size={40} className="text-slate-300"/>
                              </div>
                              <p className="font-medium">Tidak ada data ditemukan.</p>
                              <p className="text-xs">Coba ubah filter atau tanggal pencarian.</p>
                          </div>
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Pagination Controls */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center flex-shrink-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <button 
                onClick={handlePrevPage}
                disabled={pagination.page <= 1 || isLoading}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
                <ChevronLeft size={16} />
                <span>Previous</span>
            </button>

            <span className="text-sm text-slate-600 font-medium">
                Halaman {pagination.page} dari {pagination.totalPages}
            </span>

            <button 
                onClick={handleNextPage}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-md"
            >
                <span>Next</span>
                <ChevronRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ListSN;