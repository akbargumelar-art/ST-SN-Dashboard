import React, { useState } from 'react';
import { bulkAddSerialNumbers, bulkUpdateStatus, bulkAddTopupTransactions, bulkAddBucketTransactions, bulkAddAdistiTransactions } from '../services/storage';
import { UploadCloud, AlertCircle, FileText, Download, FileSpreadsheet, RefreshCw, Plus, Wallet, List, Receipt } from 'lucide-react';

interface InputFormProps {
  onSuccess: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // Separate modes for topup and bucket
  const [uploadMode, setUploadMode] = useState<'new' | 'update' | 'topup' | 'bucket' | 'adisti'>('new');
  
  const handleDownloadTemplate = () => {
    let headers, example, filename;

    if (uploadMode === 'new') {
      headers = "NO_SN,FLAG,NAMA_PRODUK,KATEGORI,GUDANG,SALESFORCE,TAP,NO_RS";
      example = "123456789012,HVC,Kartu Sakti 10GB,Voucher Fisik,Gudang Jakarta,CVS KNG 05,TAP Pasar Baru,RS-99901";
      filename = "template_input_report_sn.csv";
    } else if (uploadMode === 'update') {
      headers = "SN_NUMBER,ID_DIGIPOS,NAMA_OUTLET,HARGA,TRX_ID";
      example = "123456789012,DG-10001,Outlet Berkah Jaya,25000,TRX-ABC1234\n987654321098,DG-10002,Cellular Maju,50000,TRX-XYZ9876";
      filename = "template_upload_sellthru.csv";
    } else if (uploadMode === 'topup') {
      headers = "Transaction Date;Sender;Receiver;Transaction Type;Amount;Currency;Remarks;salesforce;tap;id digipos;nama outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210.000;IDR;Top Up balance via SF 210000;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_upload_topup_saldo.csv";
    } else if (uploadMode === 'bucket') {
      headers = "Transaction Date;Sender;Receiver;Transaction Type;Amount;Currency;Remarks;salesforce;tap;id digipos;nama outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210.000;IDR;Top Up balance via SF 210000;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_upload_bucket_transaksi.csv";
    } else {
      // Adisti Template
      headers = "TANGGAL,NO_TR_SN,GUDANG,PRODUCT,SALESFORCE,NO_RS,ID_DIGIPOS,NAMA_OUTLET,TAP";
      example = "2025-11-26,123456789012,Gudang Utama,Voucher 10GB,CVS KNG 05,RS-99901,DG-10001,Outlet A,Pemuda";
      filename = "template_upload_list_sn_adisti.csv";
    }

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setSuccessMsg('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!file) {
      setError('Silakan pilih file CSV terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("File kosong.");

        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const parsedItems = [];
        
        if (uploadMode === 'new') {
          // Input Data Baru (Comma separated)
          const hasHeader = lines[0].toLowerCase().includes('sn') || lines[0].toLowerCase().includes('no_sn');
          const startIndex = hasHeader ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length < 6) continue; 

            const sn = parts[0];
            if (sn.length < 5) continue;

            parsedItems.push({
              sn_number: sn,
              flag: parts[1] || '-',
              product_name: parts[2] || 'Unknown',
              sub_category: parts[3] || 'General',
              warehouse: parts[4] || 'Gudang Utama',
              expired_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
              salesforce_name: parts[5] || '-',
              tap: parts[6] || '-',
              no_rs: parts[7] || '-'
            });
          }

          if (parsedItems.length === 0) throw new Error("Tidak ada data valid.");
          bulkAddSerialNumbers(parsedItems);
          setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data baru ke Report SN.`);

        } else if (uploadMode === 'update') {
          // Update Status (Comma separated)
          const hasHeader = lines[0].toLowerCase().includes('sn') || lines[0].toLowerCase().includes('no_sn');
          const startIndex = hasHeader ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length < 3) continue;
            const sn = parts[0];
            if (sn.length < 5) continue;

            parsedItems.push({
              sn_number: sn,
              id_digipos: parts[1],
              nama_outlet: parts[2],
              price: parts[3] ? parseInt(parts[3]) : 0,
              transaction_id: parts[4] || ''
            });
          }

          if (parsedItems.length === 0) throw new Error("Tidak ada data valid.");
          const result = bulkUpdateStatus(parsedItems);
          setSuccessMsg(`Update Sukses: ${result.success} data. Gagal/Tidak Ditemukan: ${result.failed} data.`);
        
        } else if (uploadMode === 'topup' || uploadMode === 'bucket') {
          // Upload Topup or Bucket (Semicolon separated)
          const hasHeader = lines[0].toLowerCase().includes('transaction date') || lines[0].toLowerCase().includes('sender');
          const startIndex = hasHeader ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(';').map(p => p.trim());
            
            if (parts.length < 5) continue;

            parsedItems.push({
              id: `${uploadMode}-new-${Date.now()}-${i}`,
              transaction_date: parts[0] || '',
              sender: parts[1] || '',
              receiver: parts[2] || '',
              transaction_type: parts[3] || '',
              amount: parseInt((parts[4] || '0').replace(/\./g, '')),
              currency: parts[5] || 'IDR',
              remarks: parts[6] || '',
              salesforce: parts[7] || '',
              tap: parts[8] || '',
              id_digipos: parts[9] || '',
              nama_outlet: parts[10] || ''
            });
          }

          if (parsedItems.length === 0) throw new Error("Tidak ada data valid. Pastikan format CSV menggunakan delimiter titik koma (;)");
          
          if (uploadMode === 'topup') {
            bulkAddTopupTransactions(parsedItems);
            setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke Topup Saldo.`);
          } else {
            bulkAddBucketTransactions(parsedItems);
            setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke Bucket Transaksi.`);
          }

        } else if (uploadMode === 'adisti') {
          // Upload List SN Adisti (Comma separated)
          const hasHeader = lines[0].toLowerCase().includes('tanggal') || lines[0].toLowerCase().includes('no_tr');
          const startIndex = hasHeader ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length < 5) continue;

            parsedItems.push({
              created_at: parts[0] || new Date().toISOString(),
              sn_number: parts[1] || '',
              warehouse: parts[2] || '',
              product_name: parts[3] || '',
              salesforce_name: parts[4] || '',
              no_rs: parts[5] || '',
              id_digipos: parts[6] || '',
              nama_outlet: parts[7] || '',
              tap: parts[8] || ''
            });
          }

          if (parsedItems.length === 0) throw new Error("Tidak ada data valid.");
          bulkAddAdistiTransactions(parsedItems);
          setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke List SN (Adisti).`);
        }

        setFile(null);
        
        // Delay refresh
        setTimeout(() => {
           onSuccess();
        }, 2000);

      } catch (err: any) {
        setError(err.message || 'Gagal memproses file.');
      }
    };

    reader.onerror = () => {
      setError('Gagal membaca file.');
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Upload Center</h2>
        <p className="text-slate-500">Kelola semua data aplikasi dalam satu tempat</p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => { setUploadMode('new'); setFile(null); setSuccessMsg(''); setError(''); }}
          className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'new' ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500 hover:border-red-200'}`}
        >
          <Plus size={20} />
          <span className="font-bold text-center text-xs md:text-sm">Report SN</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wide opacity-70">Master Distribusi</span>
        </button>
        <button
          onClick={() => { setUploadMode('adisti'); setFile(null); setSuccessMsg(''); setError(''); }}
          className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'adisti' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200'}`}
        >
          <List size={20} />
          <span className="font-bold text-center text-xs md:text-sm">List SN (Adisti)</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wide opacity-70">Master Terjual</span>
        </button>
        <button
          onClick={() => { setUploadMode('update'); setFile(null); setSuccessMsg(''); setError(''); }}
          className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'update' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200'}`}
        >
          <RefreshCw size={20} />
          <span className="font-bold text-center text-xs md:text-sm">Sellthru</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wide opacity-70">Update Status</span>
        </button>
        <button
          onClick={() => { setUploadMode('topup'); setFile(null); setSuccessMsg(''); setError(''); }}
          className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'topup' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'}`}
        >
          <Wallet size={20} />
          <span className="font-bold text-center text-xs md:text-sm">Topup Saldo</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wide opacity-70">Balance SF</span>
        </button>
        <button
          onClick={() => { setUploadMode('bucket'); setFile(null); setSuccessMsg(''); setError(''); }}
          className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'bucket' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:border-teal-200'}`}
        >
          <Receipt size={20} />
          <span className="font-bold text-center text-xs md:text-sm">Bucket Trx</span>
          <span className="hidden md:block text-[10px] uppercase tracking-wide opacity-70">Log Transaksi</span>
        </button>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
        
        <div className="flex justify-between items-center mb-6">
           <div>
             <h3 className="text-lg font-bold text-slate-800">
               {uploadMode === 'new' ? 'Upload Data Report SN' : 
                uploadMode === 'update' ? 'Upload Laporan Sellthru' : 
                uploadMode === 'adisti' ? 'Upload List SN (Adisti)' : 
                uploadMode === 'topup' ? 'Upload Topup Saldo' : 'Upload Bucket Transaksi'}
             </h3>
             <p className="text-sm text-slate-500 mt-1">
               {uploadMode === 'new' ? 'Menambah data distribusi baru ke Report SN.' : 
                uploadMode === 'update' ? 'Mengupdate status SN di Report SN menjadi Sukses ST.' : 
                uploadMode === 'adisti' ? 'Mengupload data master penjualan dari Principal (Adisti).' :
                uploadMode === 'topup' ? 'Menambah data ke tabel Topup Saldo.' :
                'Menambah data ke tabel Bucket Transaksi.'}
             </p>
           </div>
           <button 
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={16} />
            <span>Template CSV</span>
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100">
              <UploadCloud size={16} />
              {successMsg}
            </div>
          )}

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className={`p-4 rounded-full mb-3 
              ${uploadMode === 'new' ? 'bg-red-100 text-red-600' : 
                uploadMode === 'update' ? 'bg-blue-100 text-blue-600' : 
                uploadMode === 'adisti' ? 'bg-purple-100 text-purple-600' : 
                uploadMode === 'topup' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`
            }>
              <FileSpreadsheet size={32} />
            </div>
            {file ? (
              <div>
                <p className="text-lg font-bold text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-bold text-slate-800">Klik untuk pilih file</p>
                <p className="text-sm text-slate-500">atau drag & drop file .csv disini</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={!file}
              className={`
                flex items-center space-x-2 px-8 py-3 rounded-lg transition-all font-bold shadow-lg text-white
                ${!file 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : uploadMode === 'new' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' 
                  : uploadMode === 'update' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : uploadMode === 'adisti' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                  : uploadMode === 'topup' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                  : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'}
              `}
            >
              <UploadCloud size={20} />
              <span>Proses Upload</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputForm;