import React, { useState } from 'react';
import { bulkAddSerialNumbers, bulkUpdateStatus, bulkAddTopupTransactions, bulkAddBucketTransactions, bulkAddAdistiTransactions } from '../services/storage';
import { UploadCloud, AlertCircle, FileText, Download, FileSpreadsheet, RefreshCw, Plus, Wallet, List, Receipt, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface InputFormProps {
  onSuccess: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'new' | 'update' | 'topup' | 'bucket' | 'adisti'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const handleDownloadTemplate = () => {
    let headers, example, filename;

    // UPDATE: Header disesuaikan PERSIS dengan nama kolom Database untuk akurasi 100%
    if (uploadMode === 'new') {
      // Database: sn_number, flag, warehouse, sub_category, product_name, salesforce_name, tap, no_rs
      headers = "sn_number;flag;product_name;sub_category;warehouse;salesforce_name;tap;no_rs";
      example = "123456789012;HVC;Kartu Sakti 10GB;Voucher Fisik;Gudang Jakarta;CVS KNG 05;TAP Pasar Baru;RS-99901";
      filename = "template_db_report_sn.csv";
    } else if (uploadMode === 'update') {
      // Database Update: sn_number, id_digipos, nama_outlet, price, transaction_id
      headers = "sn_number;id_digipos;nama_outlet;price;transaction_id";
      example = "123456789012;DG-10001;Outlet Berkah Jaya;25000;TRX-ABC1234\n987654321098;DG-10002;Cellular Maju;50000;TRX-XYZ9876";
      filename = "template_db_sellthru.csv";
    } else if (uploadMode === 'topup') {
      // Database: transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet
      headers = "transaction_date;sender;receiver;transaction_type;amount;currency;remarks;salesforce;tap;id_digipos;nama_outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210000;IDR;Top Up balance via SF;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_db_topup_saldo.csv";
    } else if (uploadMode === 'bucket') {
      headers = "transaction_date;sender;receiver;transaction_type;amount;currency;remarks;salesforce;tap;id_digipos;nama_outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210000;IDR;Top Up balance via SF;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_db_bucket_transaksi.csv";
    } else {
      // ADISTI TEMPLATE (Sesuai Tabel Database adisti_transactions)
      // Database: created_at, sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet
      headers = "created_at;sn_number;warehouse;product_name;salesforce_name;tap;no_rs;id_digipos;nama_outlet";
      example = "2025-11-26;123456789012;Gudang Utama;Voucher 10GB;CVS KNG 05;Pemuda;RS-99901;DG-10001;Outlet A";
      filename = "template_db_list_sn_adisti.csv";
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
      setDebugLog([]);
      setShowDebug(false);
    }
  };

  // Helper: Membersihkan string dari tanda kutip
  const cleanStr = (str: string) => {
      if (!str) return '';
      return str.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
  };

  // Improved CSV Splitter that respects quotes
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
    return res.map(val => cleanStr(val));
  };

  const addLog = (msg: string) => {
      setDebugLog(prev => [...prev, msg]);
      console.log(msg);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setDebugLog([]);
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
        
        // Remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

        const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
        if (lines.length === 0) throw new Error("File tidak memiliki baris data.");

        addLog(`Total Baris File: ${lines.length}`);
        
        // === DETEKSI PEMISAH OTOMATIS (AUTO DETECT DELIMITER) ===
        const delimitersToTry = [';', ',', '\t', '|'];
        let finalParsedItems: any[] = [];
        let usedDelimiter = '';
        let headerRow: string[] = [];

        // Loop untuk mencoba setiap pemisah sampai ketemu data yang valid
        for (const delimiter of delimitersToTry) {
            // Ambil header
            const currentHeader = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim().replace(/_/g, '')); // Normalize for matching
            const rawHeader = parseCSVLine(lines[0], delimiter).map(h => h.trim());
            
            // Cek apakah header masuk akal (minimal 2 kolom)
            if (currentHeader.length < 2) continue;

            addLog(`Mencoba pemisah '${delimiter}' -> Header: [${rawHeader.join(', ')}]`);

            // --- CONFIGURASI MAPPING ---
            // Kita cari index kolom berdasarkan nama header di CSV
            // UPDATE: Prioritaskan nama kolom database (snnumber, warehouse, dll)
            const findIdx = (keywords: string[]) => {
                // Normalize keywords too
                const normKeywords = keywords.map(k => k.toLowerCase().replace(/_/g, ''));
                return currentHeader.findIndex(h => normKeywords.includes(h));
            };
            const getVal = (parts: string[], idx: number) => (idx !== -1 && parts[idx]) ? parts[idx] : '';

            // Definisikan Variabel Index
            let snIdx = -1, dateIdx = -1, prodIdx = -1, flagIdx = -1, catIdx = -1;
            let whIdx = -1, sfIdx = -1, tapIdx = -1, rsIdx = -1;
            let digiIdx = -1, outletIdx = -1, amountIdx = -1;
            let trxTypeIdx = -1, senderIdx = -1, receiverIdx = -1, remarksIdx = -1, currencyIdx = -1, trxIdIdx = -1;

            // --- LOGIKA MAPPING ---
            
            if (uploadMode === 'adisti') {
                // Database: created_at, sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet
                snIdx = findIdx(['snnumber', 'sn', 'notrsn']);
                dateIdx = findIdx(['createdat', 'tanggal', 'date']);
                whIdx = findIdx(['warehouse', 'gudang']);
                prodIdx = findIdx(['productname', 'product', 'produk']);
                sfIdx = findIdx(['salesforcename', 'salesforce', 'sf']);
                rsIdx = findIdx(['nors', 'rs']);
                digiIdx = findIdx(['iddigipos', 'digipos']);
                outletIdx = findIdx(['namaoutlet', 'outlet', 'nama_outlet']);
                tapIdx = findIdx(['tap']);

                // Fallback Force Index jika pakai template lama
                if (snIdx === -1 && rawHeader.includes('NO_TR_SN')) {
                   addLog("Menggunakan fallback index Adisti Lama.");
                   dateIdx=0; snIdx=1; whIdx=2; prodIdx=3; sfIdx=4; rsIdx=5; digiIdx=6; outletIdx=7; tapIdx=8;
                }
            } 
            else if (uploadMode === 'new') {
                // Database: sn_number, flag, product_name, sub_category, warehouse, salesforce_name, tap, no_rs
                snIdx = findIdx(['snnumber', 'nosn', 'sn']);
                flagIdx = findIdx(['flag']);
                prodIdx = findIdx(['productname', 'namaproduk', 'product']);
                catIdx = findIdx(['subcategory', 'kategori', 'category']);
                whIdx = findIdx(['warehouse', 'gudang']);
                sfIdx = findIdx(['salesforcename', 'salesforce', 'sf']);
                tapIdx = findIdx(['tap']);
                rsIdx = findIdx(['nors']);

                if (snIdx === -1) { snIdx=0; flagIdx=1; prodIdx=2; } // Default fallback
            }
            else if (uploadMode === 'update') {
                // Database: sn_number, id_digipos, nama_outlet, price, transaction_id
                snIdx = findIdx(['snnumber', 'nosn', 'sn']);
                digiIdx = findIdx(['iddigipos', 'digipos']);
                outletIdx = findIdx(['namaoutlet', 'outlet']);
                amountIdx = findIdx(['price', 'harga', 'amount']);
                trxIdIdx = findIdx(['transactionid', 'trxid']);
                
                // Default fallback
                if (snIdx === -1) { snIdx=0; digiIdx=1; outletIdx=2; amountIdx=3; trxIdIdx=4; }
            }
            else { // Topup & Bucket
                // Database: transaction_date, sender, receiver, transaction_type, amount, ...
                dateIdx = findIdx(['transactiondate', 'tanggal', 'date']);
                senderIdx = findIdx(['sender', 'pengirim']);
                receiverIdx = findIdx(['receiver', 'penerima']);
                trxTypeIdx = findIdx(['transactiontype', 'type', 'tipe']);
                amountIdx = findIdx(['amount', 'jumlah']);
                currencyIdx = findIdx(['currency']);
                remarksIdx = findIdx(['remarks', 'ket']);
                sfIdx = findIdx(['salesforce']);
                tapIdx = findIdx(['tap']);
                digiIdx = findIdx(['iddigipos', 'digipos']);
                outletIdx = findIdx(['namaoutlet', 'outlet']);
                
                if (amountIdx === -1) amountIdx = 4; // Fallback
            }

            const tempItems: any[] = [];
            
            // Loop data mulai baris ke-2 (index 1)
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i], delimiter);
                if (parts.length < 2) continue; // Skip baris rusak

                const snRaw = snIdx !== -1 ? getVal(parts, snIdx) : '';
                
                // === KONSTRUKSI OBJECT DATA ===
                
                if (uploadMode === 'adisti') {
                    if (!snRaw || snRaw.length < 5) continue; 
                    tempItems.push({
                        created_at: getVal(parts, dateIdx) || new Date().toISOString(),
                        sn_number: snRaw,
                        warehouse: getVal(parts, whIdx),
                        product_name: getVal(parts, prodIdx),
                        salesforce_name: getVal(parts, sfIdx),
                        no_rs: getVal(parts, rsIdx),
                        id_digipos: getVal(parts, digiIdx),
                        nama_outlet: getVal(parts, outletIdx),
                        tap: getVal(parts, tapIdx)
                    });
                }
                else if (uploadMode === 'new') {
                     if (!snRaw || snRaw.length < 5) continue;
                     tempItems.push({
                        sn_number: snRaw,
                        flag: getVal(parts, flagIdx) || '-',
                        product_name: getVal(parts, prodIdx) || 'Unknown',
                        sub_category: getVal(parts, catIdx) || 'General',
                        warehouse: getVal(parts, whIdx) || 'Gudang Utama',
                        expired_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
                        salesforce_name: getVal(parts, sfIdx) || '-',
                        tap: getVal(parts, tapIdx) || '-',
                        no_rs: getVal(parts, rsIdx) || '-'
                    });
                }
                else if (uploadMode === 'update') {
                    if (!snRaw) continue;
                    const priceStr = getVal(parts, amountIdx).replace(/[^0-9]/g, '');
                    tempItems.push({
                        sn_number: snRaw,
                        id_digipos: getVal(parts, digiIdx),
                        nama_outlet: getVal(parts, outletIdx),
                        price: priceStr ? parseInt(priceStr) : 0,
                        transaction_id: getVal(parts, trxIdIdx)
                    });
                }
                else { // Topup & Bucket
                    if (parts.length < 5) continue;
                    const amtStr = getVal(parts, amountIdx).replace(/[^0-9]/g, '');
                    tempItems.push({
                        transaction_date: getVal(parts, dateIdx) || getVal(parts, 0),
                        sender: getVal(parts, senderIdx) || getVal(parts, 1),
                        receiver: getVal(parts, receiverIdx) || getVal(parts, 2),
                        transaction_type: getVal(parts, trxTypeIdx) || getVal(parts, 3),
                        amount: amtStr ? parseInt(amtStr) : 0,
                        currency: getVal(parts, currencyIdx) || 'IDR',
                        remarks: getVal(parts, remarksIdx) || getVal(parts, 6),
                        salesforce: getVal(parts, sfIdx) || getVal(parts, 7),
                        tap: getVal(parts, tapIdx) || getVal(parts, 8),
                        id_digipos: getVal(parts, digiIdx) || getVal(parts, 9),
                        nama_outlet: getVal(parts, outletIdx) || getVal(parts, 10)
                    });
                }
            }

            if (tempItems.length > 0) {
                finalParsedItems = tempItems;
                usedDelimiter = delimiter;
                headerRow = rawHeader;
                addLog(`SUKSES: Ditemukan ${tempItems.length} baris data valid menggunakan pemisah '${delimiter}'`);
                break; // Stop loop delimiters
            }
        }

        if (finalParsedItems.length === 0) {
            setShowDebug(true);
            throw new Error(`GAGAL: Tidak ada data valid yang ditemukan.\nTips: Pastikan baris pertama file CSV adalah Judul Kolom (Header) yang sesuai dengan Template Baru.`);
        }

        // SEND TO BACKEND
        let count = finalParsedItems.length;
        addLog(`Sedang mengirim ${count} data ke server...`);

        if (uploadMode === 'new') {
            await bulkAddSerialNumbers(finalParsedItems);
            setSuccessMsg(`Sukses upload ${count} data ke Report SN.`);
        } else if (uploadMode === 'update') {
            const result: any = await bulkUpdateStatus(finalParsedItems);
            setSuccessMsg(`Update Sukses: ${result.success}. Gagal: ${result.failed}.`);
        } else if (uploadMode === 'topup') {
            await bulkAddTopupTransactions(finalParsedItems);
            setSuccessMsg(`Sukses upload ${count} data Topup.`);
        } else if (uploadMode === 'bucket') {
            await bulkAddBucketTransactions(finalParsedItems);
            setSuccessMsg(`Sukses upload ${count} data Bucket.`);
        } else if (uploadMode === 'adisti') {
            await bulkAddAdistiTransactions(finalParsedItems);
            setSuccessMsg(`Sukses upload ${count} data List SN (Adisti).`);
        }

        setFile(null);
        // Delay refresh
        setTimeout(() => {
            onSuccess();
            setSuccessMsg('');
            setDebugLog([]);
            setShowDebug(false);
        }, 2500);

      } catch (err: any) {
        console.error("Upload Error:", err);
        setError(err.message || 'Gagal memproses file.');
        setShowDebug(true); // Auto show debug on error
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
             <p className="text-xs text-slate-400 mt-1">Gunakan template database terbaru untuk hasil akurat.</p>
           </div>
           <button onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"><Download size={16} /><span>Template DB</span></button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex flex-col gap-2 text-sm border border-red-100">
                <div className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> <span className="font-bold whitespace-pre-wrap">{error}</span></div>
            </div>
          )}
          
          {successMsg && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100"><CheckCircle2 size={16} />{successMsg}</div>}

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
            <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="p-4 rounded-full mb-3 bg-slate-100 text-slate-600 group-hover:bg-red-50 group-hover:text-red-600 transition-colors"><FileSpreadsheet size={32} /></div>
            {file ? <div><p className="text-lg font-bold text-slate-800">{file.name}</p><p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p></div> : <div><p className="text-lg font-bold text-slate-800">Klik untuk pilih file</p><p className="text-sm text-slate-500">atau drag & drop file .csv disini</p></div>}
          </div>

          {/* Diagnostic Log Viewer */}
          {(showDebug || debugLog.length > 0) && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 flex justify-between items-center cursor-pointer" onClick={() => setShowDebug(!showDebug)}>
                      <span className="text-xs font-bold text-slate-600">Log Diagnosa Sistem</span>
                      {showDebug ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}
                  </div>
                  {showDebug && (
                      <div className="bg-slate-50 p-3 text-xs font-mono text-slate-600 max-h-40 overflow-y-auto">
                          {debugLog.map((log, idx) => <div key={idx} className="border-b border-slate-100 last:border-0 py-1">{log}</div>)}
                      </div>
                  )}
              </div>
          )}

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