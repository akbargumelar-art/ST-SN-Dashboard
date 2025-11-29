import React, { useState } from 'react';
import { bulkAddSerialNumbers, bulkUpdateStatus, bulkAddTopupTransactions, bulkAddBucketTransactions, bulkAddAdistiTransactions } from '../services/storage';
import { UploadCloud, AlertCircle, FileText, Download, FileSpreadsheet, RefreshCw, Plus, Wallet, List, Receipt, Info, CheckCircle2 } from 'lucide-react';

interface InputFormProps {
  onSuccess: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'new' | 'update' | 'topup' | 'bucket' | 'adisti'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleDownloadTemplate = () => {
    let headers, example, filename;

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

  // Robust Line Parser that handles quotes
  const parseCSVLine = (text: string, separator: string): string[] => {
    const res = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuote && text[i+1] === '"') {
             cur += '"';
             i++; 
        } else {
             inQuote = !inQuote;
        }
      } else if (c === separator && !inQuote) {
        res.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur);
    return res.map(val => val.trim().replace(/^"|"$/g, '').trim());
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsProcessing(true);

    if (!file) {
      setError('Silakan pilih file CSV terlebih dahulu.');
      setIsProcessing(false);
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        let text = event.target?.result as string;
        if (!text) throw new Error("File kosong.");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

        const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
        if (lines.length === 0) throw new Error("File tidak memiliki baris data.");

        // === BRUTE FORCE PARSING ===
        // Try these delimiters in order. If one returns > 0 items, use it.
        const delimitersToTry = [';', ',', '\t', '|'];
        let finalParsedItems: any[] = [];
        let usedDelimiter = '';

        for (const delimiter of delimitersToTry) {
            console.log(`Trying delimiter: '${delimiter}'`);
            
            // Helper to get value safely
            const getVal = (parts: string[], idx: number) => parts[idx] || '';
            
            // Analyze Header for Dynamic Indexing
            const headerParts = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase());
            
            // -- Find Column Indexes based on Header Name --
            const findIdx = (keywords: string[]) => headerParts.findIndex(h => keywords.some(k => h.includes(k)));

            let snIdx = findIdx(['sn', 'no_tr', 'serial', 'nomor']);
            let dateIdx = findIdx(['tanggal', 'date', 'tgl']);
            let prodIdx = findIdx(['produk', 'product', 'nama_produk']);
            let flagIdx = findIdx(['flag']);
            let whIdx = findIdx(['gudang', 'warehouse']);
            let sfIdx = findIdx(['sales', 'sf']);
            let tapIdx = findIdx(['tap']);
            let rsIdx = findIdx(['rs', 'no_rs']);
            let digiIdx = findIdx(['digi', 'id_digi']);
            let outletIdx = findIdx(['outlet']);
            let amountIdx = findIdx(['amount', 'nilai', 'harga', 'price']);
            
            // Defaults if not found (fallback to legacy positions)
            if (uploadMode === 'adisti') {
                if (snIdx === -1) snIdx = 1; // Default NO_TR_SN
            } else if (uploadMode === 'new') {
                if (snIdx === -1) snIdx = 0;
            } else if (uploadMode === 'update') {
                if (snIdx === -1) snIdx = 0;
            }

            const currentAttemptItems: any[] = [];
            // Determine Start Row (Skip Header if we found header keywords, else Row 0)
            // But usually Row 0 is header. Let's assume Row 1 start unless Row 0 looks like data (numbers).
            let startRow = 1; 

            for (let i = startRow; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i], delimiter);
                // Basic validation: line must have enough parts relative to our needed index
                if (parts.length <= snIdx && snIdx !== -1) continue; 

                try {
                    if (uploadMode === 'new') {
                        const sn = getVal(parts, snIdx !== -1 ? snIdx : 0);
                        if (!sn || sn.length < 5) continue;
                        
                        currentAttemptItems.push({
                            sn_number: sn,
                            flag: getVal(parts, flagIdx !== -1 ? flagIdx : 1) || '-',
                            product_name: getVal(parts, prodIdx !== -1 ? prodIdx : 2) || 'Unknown',
                            sub_category: getVal(parts, 3) || 'General', // Fallback index
                            warehouse: getVal(parts, whIdx !== -1 ? whIdx : 4) || 'Gudang Utama',
                            expired_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
                            salesforce_name: getVal(parts, sfIdx !== -1 ? sfIdx : 5) || '-',
                            tap: getVal(parts, tapIdx !== -1 ? tapIdx : 6) || '-',
                            no_rs: getVal(parts, rsIdx !== -1 ? rsIdx : 7) || '-'
                        });
                    } else if (uploadMode === 'update') {
                         const sn = getVal(parts, snIdx !== -1 ? snIdx : 0);
                         if (!sn || sn.length < 5) continue;

                         const priceStr = getVal(parts, amountIdx !== -1 ? amountIdx : 3).replace(/[^0-9]/g, '');

                         currentAttemptItems.push({
                            sn_number: sn,
                            id_digipos: getVal(parts, digiIdx !== -1 ? digiIdx : 1),
                            nama_outlet: getVal(parts, outletIdx !== -1 ? outletIdx : 2),
                            price: priceStr ? parseInt(priceStr) : 0,
                            transaction_id: getVal(parts, 4)
                         });
                    } else if (uploadMode === 'adisti') {
                        // ADISTI MODE
                        const sn = getVal(parts, snIdx); 
                        if (!sn || sn.length < 4) continue;

                        currentAttemptItems.push({
                            created_at: getVal(parts, dateIdx !== -1 ? dateIdx : 0) || new Date().toISOString(),
                            sn_number: sn,
                            warehouse: getVal(parts, whIdx !== -1 ? whIdx : 2),
                            product_name: getVal(parts, prodIdx !== -1 ? prodIdx : 3),
                            salesforce_name: getVal(parts, sfIdx !== -1 ? sfIdx : 4),
                            no_rs: getVal(parts, rsIdx !== -1 ? rsIdx : 5),
                            id_digipos: getVal(parts, digiIdx !== -1 ? digiIdx : 6),
                            nama_outlet: getVal(parts, outletIdx !== -1 ? outletIdx : 7),
                            tap: getVal(parts, tapIdx !== -1 ? tapIdx : 8)
                        });
                    } else if (uploadMode === 'topup' || uploadMode === 'bucket') {
                        // Topup/Bucket usually standard format
                        if (!getVal(parts, 0)) continue;
                        const amtStr = getVal(parts, 4).replace(/[^0-9]/g, '');
                        currentAttemptItems.push({
                            transaction_date: getVal(parts, 0),
                            sender: getVal(parts, 1),
                            receiver: getVal(parts, 2),
                            transaction_type: getVal(parts, 3),
                            amount: amtStr ? parseInt(amtStr) : 0,
                            currency: getVal(parts, 5) || 'IDR',
                            remarks: getVal(parts, 6),
                            salesforce: getVal(parts, 7),
                            tap: getVal(parts, 8),
                            id_digipos: getVal(parts, 9),
                            nama_outlet: getVal(parts, 10)
                        });
                    }
                } catch (err) {
                    // ignore line error
                }
            }

            // If this delimiter produced results, break and use them
            if (currentAttemptItems.length > 0) {
                finalParsedItems = currentAttemptItems;
                usedDelimiter = delimiter;
                break;
            }
        } // End Delimiter Loop

        if (finalParsedItems.length === 0) {
            throw new Error(`Gagal membaca data. Sistem sudah mencoba pemisah titik koma (;), koma (,), dan pipe (|) namun tidak menemukan data valid.\n\nTips: Pastikan baris pertama adalah Header dan baris kedua berisi data.`);
        }

        console.log(`Success Parsing with delimiter '${usedDelimiter}'. Found ${finalParsedItems.length} items.`);

        // SEND TO API
        let count = finalParsedItems.length;
        if (uploadMode === 'new') {
            await bulkAddSerialNumbers(finalParsedItems);
            setSuccessMsg(`Berhasil mengupload ${count} data ke Report SN.`);
        } else if (uploadMode === 'update') {
            const result: any = await bulkUpdateStatus(finalParsedItems);
            setSuccessMsg(`Update Sukses: ${result.success}. Gagal/Tidak Ditemukan: ${result.failed}.`);
        } else if (uploadMode === 'topup') {
            await bulkAddTopupTransactions(finalParsedItems);
            setSuccessMsg(`Berhasil mengupload ${count} data ke Topup Saldo.`);
        } else if (uploadMode === 'bucket') {
            await bulkAddBucketTransactions(finalParsedItems);
            setSuccessMsg(`Berhasil mengupload ${count} data ke Bucket Transaksi.`);
        } else if (uploadMode === 'adisti') {
            await bulkAddAdistiTransactions(finalParsedItems);
            setSuccessMsg(`Berhasil mengupload ${count} data ke List SN (Adisti).`);
        }

        setFile(null);
        setTimeout(() => {
            onSuccess();
            setSuccessMsg(''); 
        }, 2000);

      } catch (err: any) {
        console.error("Upload Error:", err);
        setError(err.message || 'Gagal memproses file.');
      } finally {
        setIsProcessing(false);
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
             <p className="text-xs text-slate-400 mt-1">Sistem otomatis mendeteksi pemisah (koma/titik koma) & posisi kolom.</p>
           </div>
           <button onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"><Download size={16} /><span>Template CSV</span></button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-2 text-sm border border-red-100 whitespace-pre-wrap"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</div>}
          {successMsg && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100"><CheckCircle2 size={16} />{successMsg}</div>}

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
            <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="p-4 rounded-full mb-3 bg-slate-100 text-slate-600 group-hover:bg-red-50 group-hover:text-red-600 transition-colors"><FileSpreadsheet size={32} /></div>
            {file ? <div><p className="text-lg font-bold text-slate-800">{file.name}</p><p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p></div> : <div><p className="text-lg font-bold text-slate-800">Klik untuk pilih file</p><p className="text-sm text-slate-500">atau drag & drop file .csv disini</p></div>}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Tips Upload:</p>
              <ul className="list-disc ml-4 space-y-1">
                 <li>Sistem akan mencoba membaca otomatis file Excel Indonesia (;) maupun US (,).</li>
                 <li>Pastikan file memiliki Header di baris pertama.</li>
                 <li>Kolom "No Tr SN" atau "SN" wajib ada untuk mode Adisti.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button 
                type="submit" 
                disabled={!file || isProcessing} 
                className={`
                    flex items-center space-x-2 px-8 py-3 rounded-lg transition-all font-bold shadow-lg text-white
                    ${!file || isProcessing ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}
                `}
            >
                <UploadCloud size={20} className={isProcessing ? "animate-bounce" : ""} />
                <span>{isProcessing ? "Memproses Data..." : "Proses Upload"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputForm;