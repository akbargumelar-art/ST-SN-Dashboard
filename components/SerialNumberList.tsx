import React, { useState } from 'react';
import { SerialNumber, SNStatus, User, UserRole } from '../types';
import { Search, Filter, QrCode, Check, X, Clock } from 'lucide-react';
import { updateSerialNumberStatus } from '../services/storage';

interface SNListProps {
  data: SerialNumber[];
  user: User;
  refreshData: () => void;
}

const SerialNumberList: React.FC<SNListProps> = ({ data, user, refreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Logic: Salesforce sees assigned (or all for demo), Admin/Super sees all
  // Filter by search and status status
  const filteredData = data.filter(item => {
    const matchesSearch = item.sn_number.includes(searchTerm) || 
                         item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (id: number, newStatus: SNStatus) => {
    updateSerialNumberStatus(id, newStatus);
    refreshData();
  };

  const StatusBadge = ({ status }: { status: SNStatus }) => {
    const styles = {
      [SNStatus.READY]: "bg-amber-100 text-amber-700 border-amber-200",
      [SNStatus.SUKSES_ST]: "bg-emerald-100 text-emerald-700 border-emerald-200",
      [SNStatus.GAGAL_ST]: "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Serial Numbers</h2>
          <p className="text-slate-500">Manage and track daily serial numbers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search SN or Product..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <select
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value={SNStatus.READY}>Ready</option>
            <option value={SNStatus.SUKSES_ST}>Sukses ST</option>
            <option value={SNStatus.GAGAL_ST}>Gagal ST</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">SN Number</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Product</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Category</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-center">QR</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
              {(user.role === UserRole.ADMIN || user.role === UserRole.SALESFORCE) && (
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-slate-700">{item.sn_number}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-xs text-slate-400">{item.warehouse}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{item.sub_category}</td>
                <td className="px-6 py-4 text-center">
                  <div className="relative group inline-block">
                    <QrCode size={20} className="text-slate-400 mx-auto cursor-pointer" />
                    {/* Tooltip QR Preview */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <div className="bg-white p-2 rounded-lg shadow-xl border border-slate-200">
                        <img src={item.qr_code_url} alt="QR" className="w-32 h-32" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={item.status} />
                </td>
                {(user.role === UserRole.ADMIN || user.role === UserRole.SALESFORCE) && (
                  <td className="px-6 py-4 text-right">
                    {item.status === SNStatus.READY ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleStatusChange(item.id, SNStatus.SUKSES_ST)}
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Set Success"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => handleStatusChange(item.id, SNStatus.GAGAL_ST)}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                          title="Set Failed"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Locked</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No serial numbers found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {filteredData.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-sm font-bold text-slate-800 block">{item.sn_number}</span>
                <span className="text-xs text-slate-500">{item.product_name}</span>
              </div>
              <StatusBadge status={item.status} />
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Clock size={14} />
                <span>Exp: {item.expired_date}</span>
              </div>
              
              {(user.role === UserRole.ADMIN || user.role === UserRole.SALESFORCE) && item.status === SNStatus.READY && (
                <div className="flex items-center space-x-2">
                  <button 
                     onClick={() => handleStatusChange(item.id, SNStatus.SUKSES_ST)}
                     className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium"
                  >
                    Success
                  </button>
                  <button 
                     onClick={() => handleStatusChange(item.id, SNStatus.GAGAL_ST)}
                     className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium"
                  >
                    Failed
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SerialNumberList;