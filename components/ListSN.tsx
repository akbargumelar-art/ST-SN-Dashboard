import React, { useState, useEffect } from 'react';
import { AdistiTransaction, User } from '../types';
import { getAdistiTransactions } from '../services/storage';
import { Search, List, Database, Users, MapPin, Package, ChevronLeft, ChevronRight, Loader2, PlayCircle, Filter } from 'lucide-react';

interface ListSNProps {
  data?: any; 
  user: User;
}

const ListSN: React.FC<ListSNProps> = ({ user }) => {
  const [data, setData] = useState<AdistiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
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
  const [salesFilter, setSalesFilter] = useState('all');
  const [tapFilter, setTapFilter] = useState('all');

  // USER ASSIGNMENT LOGIC (Lock filters if assigned)
  useEffect(() => {
      if (user.assigned_salesforce) {
          setSalesFilter(user.assigned_salesforce);
      }
      if (user.assigned_tap) {
          setTapFilter(user.assigned_tap);
      }
  }, [user]);

  // Main Data Fetcher
  const loadData = async (pageToLoad = 1) => {
        setIsLoading(true);
        try {
            const res = await getAdistiTransactions({
                page: pageToLoad,
                limit: pagination.limit,
                search: searchTerm,
                startDate,
                endDate,
                salesforce: salesFilter !== 'all' ? salesFilter : undefined,
                tap: tapFilter !== 'all' ? tapFilter : undefined
            });
            
            if (res && res.data && Array.isArray(res.data)) {
                setData(res.data);
                setPagination(prev => ({
                    ...prev,
                    total: res.total || 0,
                    totalPages: res.totalPages || 1,
                    page: res.page || 1
                }));
                setHasLoaded(true);
            } else {
                setData([]);
            }
        } catch (error) {
            console.error("Failed to load adisti data", error);
            setData([]);
        } finally {
            setIsLoading(false);
        }
  };

  // Only load when page changes AND data has already been loaded initially via button
  useEffect(() => {
    if (hasLoaded) {
        loadData(pagination.page);
    }
  }, [pagination.page]);

  // Handler for "Tampilkan" Button
  const handleShowData = () => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadData(1);
  };

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
  
  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in space-y-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-2 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <List className="text-purple-600" />
            List SN (Adisti)
          </h2>
          <p className="text-slate-500 text-sm mt-1">Filter & Tampilkan Data Distribusi</p>
        </div>
      </div>

      {/* Filters Area - TOP PRIORITY */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-purple-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 flex-shrink-0 items-end">
         
         <div className="lg:col-span-12 mb-2 flex items-center gap-2 text-purple-800 border-b border-purple-50 pb-2">
            <Filter size={18} />
            <span className="font-bold text-sm">FILTER DATA</span>
         </div>

         {/* Date Range */}
         <div className="lg:col-span-4 flex gap-2">
            <div className="w-1/2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</span>
                <input 
                    type="date" 
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                />
            </div>
            <div className="w-1/2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sampai</span>
                <input 
                    type="date" 
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                />
            </div>
         </div>

         {/* Sales Filter */}
         <div className="lg:col-span-3">
             <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Salesforce</span>
             <input
                 type="text"
                 placeholder="Semua Sales"
                 className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none ${user.assigned_salesforce ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                 value={salesFilter === 'all' ? '' : salesFilter}
                 onChange={(e) => !user.assigned_salesforce && setSalesFilter(e.target.value || 'all')}
                 disabled={!!user.assigned_salesforce}
             />
         </div>

         <div className="lg:col-span-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">TAP Area</span>
             <input
                 type="text"
                 placeholder="Semua TAP"
                 className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none ${user.assigned_tap ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                 value={tapFilter === 'all' ? '' : tapFilter}
                 onChange={(e) => !user.assigned_tap && setTapFilter(e.target.value || 'all')}
                 disabled={!!user.assigned_tap}
             />
         </div>

         <div className="lg:col-span-2">
            <button 
                onClick={handleShowData}
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                <span>Tampilkan</span>
            </button>
         </div>
         
         {/* Search Bar Secondary */}
         {hasLoaded && (
            <div className="lg:col-span-12 mt-2 pt-2 border-t border-slate-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Cari SN / Produk / Outlet spesifik dalam hasil..." 
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>
         )}
      </div>

      {/* Summary Cards (Only Show After Load) */}
      {hasLoaded && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-shrink-0 animate-fade-in">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Database size={18} /></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Hasil</p>
                    <p className="text-lg font-bold text-slate-800 leading-none mt-1">{pagination.total.toLocaleString()}</p>
                </div>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users size={18} /></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salesforce</p>
                    <p className="text-sm font-bold text-slate-800 leading-none mt-1 truncate max-w-[100px]">{salesFilter === 'all' ? 'All' : salesFilter}</p>
                </div>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><MapPin size={18} /></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TAP Area</p>
                    <p className="text-sm font-bold text-slate-800 leading-none mt-1 truncate max-w-[100px]">{tapFilter === 'all' ? 'All' : tapFilter}</p>
                </div>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Package size={18} /></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                    <p className="text-lg font-bold text-slate-800 leading-none mt-1">Loaded</p>
                </div>
            </div>
        </div>
      )}

      {/* Table Container - STACK & SCROLL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 relative overflow-hidden">
        
        {/* Empty State / Initial State */}
        {!hasLoaded && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 z-10">
                <Filter size={48} className="mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-500">Silakan Filter Data Terlebih Dahulu</p>
                <p className="text-sm">Pilih rentang tanggal dan kriteria lain, lalu klik "Tampilkan"</p>
            </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
            <div className="absolute inset-0 bg-white/60 z-30 flex items-center justify-center backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
        )}

        {hasLoaded && (
            <>
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
                                    <p className="font-medium">Tidak ada data ditemukan untuk filter ini.</p>
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

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                         <span>Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong></span>
                    </div>

                    <button 
                        onClick={handleNextPage}
                        disabled={pagination.page >= pagination.totalPages || isLoading}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-md"
                    >
                        <span>Next</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ListSN;