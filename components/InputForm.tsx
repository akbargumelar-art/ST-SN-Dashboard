import React, { useState } from 'react';
import { bulkAddSerialNumbers, bulkUpdateStatus, bulkAddTopupTransactions, bulkAddBucketTransactions, bulkAddAdistiTransactions } from '../services/storage';
import { UploadCloud, AlertCircle, FileText, Download, FileSpreadsheet, RefreshCw, Plus, Wallet, List, Receipt, Info } from 'lucide-react';

interface InputFormProps {
  onSuccess: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'new' | 'update' | 'topup' | 'bucket' | 'adisti'>('new');
  
  const handleDownloadTemplate = () => {
    let headers, example, filename;

    // Use semicolons for templates as they are generally safer for Excel in Indonesia/EU regions,
    // but the new parser handles both commas and semicolons.
    if (uploadMode === 'new') {
      headers = "NO_SN;FLAG;NAMA_PRODUK;KATEGORI;GUDANG;SALESFORCE;TAP;NO_RS";
      example = "123456789012;HVC;Kartu Sakti 10GB;Voucher Fisik;Gudang Jakarta;CVS KNG 05;TAP Pasar Baru;RS-99901";
      filename = "template_input_report_sn.csv";
    } else if (uploadMode === 'update') {
      headers = "SN_NUMBER;ID_DIGIPOS;NAMA_OUTLET;HARGA;TRX_ID";
      example = "123456789012;DG-10001;Outlet Berkah Jaya;25000;TRX-ABC1234\n987654321098;DG-10002;Cellular Maju;50000;TRX-XYZ9876";
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
      headers = "TANGGAL;NO_TR_SN;GUDANG;PRODUCT;SALESFORCE;NO_RS;ID_DIGIPOS;NAMA_OUTLET;TAP";
      example = "2025-11-26;123456789012;Gudang Utama;Voucher 10GB;CVS KNG 05;RS-99901;DG-10001;Outlet A;Pemuda";
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
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("File kosong.");

        // Normalize line endings to \n (handles Windows \r\n and Mac \r)
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length === 0) throw new Error("File tidak memiliki baris data.");

        // AUTO-DETECT DELIMITER
        // Check the first line to see if it uses ; or ,
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount >= commaCount ? ';' : ','; 

        // Helper to clean quotes and whitespace
        const clean = (str: string) => str ? str.trim().replace(/^"|"$/g, '').trim() : '';

        const parsedItems = [];
        
        // --- PARSING LOGIC ---
        if (uploadMode === 'new') {
            // Report SN
            const headerLine = lines[0].toLowerCase();
            const hasHeader = headerLine.includes('sn') || headerLine.includes('no_sn');
            const startIndex = hasHeader ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(delimiter);
                if (parts.length < 1) continue;
                
                const sn = clean(parts[0]);
                // Basic validation: SN usually long, skip empty or short rows
                if (!sn || sn.length < 4) continue; 

                parsedItems.push({
                    sn_number: sn,
                    flag: clean(parts[1]) || '-',
                    product_name: clean(parts[2]) || 'Unknown',
                    sub_category: clean(parts[3]) || 'General',
                    warehouse: clean(parts[4]) || 'Gudang Utama',
                    expired_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
                    salesforce_name: clean(parts[5]) || '-',
                    tap: clean(parts[6]) || '-',
                    no_rs: clean(parts[7]) || '-'
                });
            }

            if (parsedItems.length === 0) throw new Error(`Tidak ada data valid yang ditemukan. Deteksi delimiter: "${delimiter}". Pastikan format CSV sesuai.`);
            await bulkAddSerialNumbers(parsedItems);
            setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data baru ke Report SN.`);

        } else if (uploadMode === 'update') {
            // Sellthru
            const headerLine = lines[0].toLowerCase();
            const hasHeader = headerLine.includes('sn');
            const startIndex = hasHeader ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(delimiter);
                const sn = clean(parts[0]);
                if (!sn || sn.length < 4) continue;

                parsedItems.push({
                    sn_number: sn,
                    id_digipos: clean(parts[1]),
                    nama_outlet: clean(parts[2]),
                    // Robust number parsing: remove non-digits before parsing int
                    price: parts[3] ? parseInt(clean(parts[3]).replace(/[^0-9]/g, '') || '0') : 0,
                    transaction_id: clean(parts[4])
                });
            }

            if (parsedItems.length === 0) throw new Error(`Tidak ada data valid (Sellthru). Deteksi delimiter: "${delimiter}".`);
            const result: any = await bulkUpdateStatus(parsedItems);
            setSuccessMsg(`Update Sukses: ${result.success} data. Gagal/Tidak Ditemukan: ${result.failed} data.`);

        } else if (uploadMode === 'topup' || uploadMode === 'bucket') {
            // Topup / Bucket
            const headerLine = lines[0].toLowerCase();
            const hasHeader = headerLine.includes('transaction') || headerLine.includes('sender') || headerLine.includes('tanggal');
            const startIndex = hasHeader ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(delimiter);
                if (parts.length < 5) continue;

                parsedItems.push({
                    transaction_date: clean(parts[0]),
                    sender: clean(parts[1]),
                    receiver: clean(parts[2]),
                    transaction_type: clean(parts[3]),
                    amount: parseInt(clean(parts[4]).replace(/[^0-9]/g, '') || '0'),
                    currency: clean(parts[5]) || 'IDR',
                    remarks: clean(parts[6]),
                    salesforce: clean(parts[7]),
                    tap: clean(parts[8]),
                    id_digipos: clean(parts[9]),
                    nama_outlet: clean(parts[10])
                });
            }

            if (parsedItems.length === 0) throw new Error(`Tidak ada data valid (${uploadMode}). Deteksi delimiter: "${delimiter}".`);
            
            if (uploadMode === 'topup') {
                await bulkAddTopupTransactions(parsedItems);
                setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke Topup Saldo.`);
            } else {
                await bulkAddBucketTransactions(parsedItems);
                setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke Bucket Transaksi.`);
            }

        } else if (uploadMode === 'adisti') {
            // Adisti
            const headerLine = lines[0].toLowerCase();
            const hasHeader = headerLine.includes('tanggal') || headerLine.includes('no_tr');
            const startIndex = hasHeader ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(delimiter);
                if (parts.length < 3) continue;

                parsedItems.push({
                    created_at: clean(parts[0]) || new Date().toISOString(),
                    sn_number: clean(parts[1]),
                    warehouse: clean(parts[2]),
                    product_name: clean(parts[3]),
                    salesforce_name: clean(parts[4]),
                    no_rs: clean(parts[5]),
                    id_digipos: clean(parts[6]),
                    nama_outlet: clean(parts[7]),
                    tap: clean(parts[8])
                });
            }

            if (parsedItems.length === 0) throw new Error(`Tidak ada data valid (Adisti). Deteksi delimiter: "${delimiter}".`);
            await bulkAddAdistiTransactions(parsedItems);
            setSuccessMsg(`Berhasil mengupload ${parsedItems.length} data ke List SN (Adisti).`);
        }

        setFile(null);
        setTimeout(() => onSuccess(), 1500);

      } catch (err: any) {
        console.error("Parse Error:", err);
        setError(err.message || 'Gagal memproses file. Pastikan format CSV benar.');
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Upload Center</h2>
        <p className="text-slate-500">Kelola semua data aplikasi dalam satu tempat</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <button onClick={() => setUploadMode('new')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'new' ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}><Plus size={20} /><span className="font-bold text-xs md:text-sm">Report SN</span></button>
        <button onClick={() => setUploadMode('adisti')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'adisti' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500'}`}><List size={20} /><span className="font-bold text-xs md:text-sm">List SN (Adisti)</span></button>
        <button onClick={() => setUploadMode('update')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'update' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}><RefreshCw size={20} /><span className="font-bold text-xs md:text-sm">Sellthru</span></button>
        <button onClick={() => setUploadMode('topup')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'topup' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500'}`}><Wallet size={20} /><span className="font-bold text-xs md:text-sm">Topup Saldo</span></button>
        <button onClick={() => setUploadMode('bucket')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'bucket' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500'}`}><Receipt size={20} /><span className="font-bold text-xs md:text-sm">Bucket Trx</span></button>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
           <div>
             <h3 className="text-lg font-bold text-slate-800">
               {uploadMode === 'new' ? 'Upload Data Report SN' : uploadMode === 'update' ? 'Upload Laporan Sellthru' : uploadMode === 'adisti' ? 'Upload List SN (Adisti)' : uploadMode === 'topup' ? 'Upload Topup Saldo' : 'Upload Bucket Transaksi'}
             </h3>
             <p className="text-xs text-slate-400 mt-1">Sistem akan otomatis mendeteksi pemisah (koma atau titik koma).</p>
           </div>
           <button onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"><Download size={16} /><span>Template CSV</span></button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-red-100"><AlertCircle size={16} />{error}</div>}
          {successMsg && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100"><UploadCloud size={16} />{successMsg}</div>}

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="p-4 rounded-full mb-3 bg-slate-100 text-slate-600"><FileSpreadsheet size={32} /></div>
            {file ? <div><p className="text-lg font-bold text-slate-800">{file.name}</p><p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p></div> : <div><p className="text-lg font-bold text-slate-800">Klik untuk pilih file</p><p className="text-sm text-slate-500">atau drag & drop file .csv disini</p></div>}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Tips Upload:</p>
              <ul className="list-disc ml-4 space-y-1">
                 <li>Pastikan file berformat <strong>.csv</strong></li>
                 <li>Urutan kolom harus sesuai dengan Template.</li>
                 <li>Aplikasi mendukung format Excel Indonesia (titik koma ';') dan Internasional (koma ',').</li>
                 <li>Jika gagal, coba buka file di Notepad untuk memastikan datanya tidak kosong atau rusak.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={!file} className="flex items-center space-x-2 px-8 py-3 rounded-lg transition-all font-bold shadow-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"><UploadCloud size={20} /><span>Proses Upload</span></button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputForm;