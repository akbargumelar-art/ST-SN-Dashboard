import React, { useState, useEffect } from 'react';
import { TopupTransaction, User, UserRole } from '../types';
import { getBucketTransactions } from '../services/storage';
import { Search, Receipt } from 'lucide-react';

interface BucketTransaksiProps { user: User; }

const BucketTransaksi: React.FC<BucketTransaksiProps> = ({ user }) => {
  const [data, setData] = useState<TopupTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
        const res = await getBucketTransactions();
        setData(res);
    };
    load();
  }, []);

  const accessibleData = user.role === UserRole.SALESFORCE ? data.filter(d => d.salesforce === user.name) : data;
  const filteredData = accessibleData.filter(item => item.salesforce.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-end pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt className="text-orange-600"/> Bucket Transaksi</h2>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <input type="text" placeholder="Cari..." className="w-full px-4 py-2 border rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-bold uppercase">Salesforce</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-bold uppercase">Receiver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(item => (
                <tr key={item.id} className="hover:bg-orange-50/30 text-sm">
                  <td className="px-4 py-3">{item.transaction_date}</td>
                  <td className="px-4 py-3">{item.salesforce}</td>
                  <td className="px-4 py-3 text-right font-bold">{item.amount.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3">{item.receiver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BucketTransaksi;