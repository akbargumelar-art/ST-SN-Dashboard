import React, { useState, useEffect } from 'react';
import { bulkAddSerialNumbers, bulkAddSellthruTransactions, bulkAddTopupTransactions, bulkAddBucketTransactions, bulkAddAdistiTransactions } from '../services/storage';
import { UploadCloud, AlertCircle, FileSpreadsheet, Plus, Wallet, List, Receipt, ChevronDown, ChevronUp, CheckCircle2, Loader2, Download, Lock } from 'lucide-react';

interface InputFormProps {
  onSuccess: () => void;
  setIsGlobalProcessing: (isProcessing: boolean) => void; // New Prop
}

const InputForm: React.FC<InputFormProps> = ({ onSuccess, setIsGlobalProcessing }) => {
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'new' | 'update' | 'topup' | 'bucket' | 'adisti'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0 - 100
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  // PREVENT REFRESH / TAB CLOSE WHEN PROCESSING
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isProcessing) {
            e.preventDefault();
            e.returnValue = ''; // Chrome requires this to show dialog
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  const handleDownloadTemplate = () => {
    let headers, example, filename;

    if (uploadMode === 'new') {
      headers = "sn_number;flag;product_name;sub_category;warehouse;salesforce_name;tap;no_rs";
      example = "123456789012;HVC;Kartu Sakti 10GB;Voucher Fisik;Gudang Jakarta;CVS KNG 05;TAP Pasar Baru;RS-99901";
      filename = "template_db_report_sn.csv";
    } else if (uploadMode === 'update') {
      headers = "sn_number;sellthru_date;id_digipos;nama_outlet;price;transaction_id";
      example = "123456789012;2025-11-27;DG-10001;Outlet Berkah Jaya;25000;TRX-ABC1234\n987654321098;2025-11-27;DG-10002;Cellular Maju;50000;TRX-XYZ9876";
      filename = "template_db_sellthru.csv";
    } else if (uploadMode === 'topup') {
      headers = "transaction_date;sender;receiver;transaction_type;amount;currency;remarks;salesforce;tap;id_digipos;nama_outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210000;IDR;Top Up balance via SF;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_db_topup_saldo.csv";
    } else if (uploadMode === 'bucket') {
      headers = "transaction_date;sender;receiver;transaction_type;amount;currency;remarks;salesforce;tap;id_digipos;nama_outlet";
      example = "2025-11-26 14:59:46;6282114115293;82118776787;Debit;210000;IDR;Top Up balance via SF;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA";
      filename = "template_db_bucket_transaksi.csv";
    } else {
      headers = "created_at;sn_number;warehouse;product_name;salesforce_name;no_rs;id_digipos;nama_outlet;tap";
      example = "2025-11-26;123456789012;Gudang Utama;Voucher 10GB;CVS KNG 05;RS-99901;DG-10001;Outlet A;Pemuda";
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
      setUploadProgress(0);
      setProcessedCount(0);
      setTotalCount(0);
    }
  };

  const cleanStr = (str: string) => {
      if (!str) return '';
      return str.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
  };

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

  // --- CHUNKED UPLOAD LOGIC ---
  const uploadInChunks = async (data: any[], apiFunction: (chunk: any[]) => Promise<any>) => {
      const CHUNK_SIZE = 500; // Smaller chunk for safety
      const total = data.length;
      setTotalCount(total);
      
      for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          
          let attempts = 0;
          let success = false;
          while(attempts < 3 && !success) {
            try {
                await apiFunction(chunk);
                success = true;
            } catch (err) {
                attempts++;
                addLog(`Gagal mengirim chunk ${i}-${i+chunk.length}. Retry ${attempts}...`);
                await new Promise(r => setTimeout(r, 2000)); // Retry delay
            }
          }

          if (!success) throw new Error("Gagal mengupload sebagian data setelah 3x percobaan.");
          
          const currentProcessed = Math.min(i + CHUNK_SIZE, total);
          setProcessedCount(currentProcessed);
          setUploadProgress(Math.round((currentProcessed / total) * 100));
          
          await new Promise(resolve => setTimeout(resolve, 500)); // Breathe
      }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setDebugLog([]);
    setIsProcessing(true);
    setIsGlobalProcessing(true); // LOCK UI
    setUploadProgress(0);

    if (!file) {
      setError('Silakan pilih file CSV terlebih dahulu.');
      setIsProcessing(false);
      setIsGlobalProcessing(false); // UNLOCK
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

        addLog(`Total Baris File: ${lines.length}`);
        
        const delimitersToTry = [';', ',', '\t', '|'];
        let finalParsedItems: any[] = [];
        let usedDelimiter = '';
        let headerRow: string[] = [];

        // --- BLIND FALLBACK MODE ---
        // Jika deteksi header gagal total, kita coba paksa baca berdasarkan urutan kolom (Blind Mode)
        const tryBlindParse = (delimiter: string, mode: string) => {
            addLog(`Mencoba Blind Mode dengan pemisah '${delimiter}'...`);
            const items = [];
            for(let i=1; i<lines.length; i++) {
                const parts = parseCSVLine(lines[i], delimiter);
                if (parts.length < 2) continue;
                
                if (mode === 'adisti') {
                    // Fallback Order: Date, SN, Warehouse, Product, SF, RS, Digipos, Outlet, Tap
                    if(parts[1] && parts[1].length > 5) {
                        items.push({
                            created_at: parts[0], sn_number: parts[1], warehouse: parts[2] || '-', product_name: parts[3] || '-',
                            salesforce_name: parts[4] || '-', no_rs: parts[5] || '-', id_digipos: parts[6] || '-',
                            nama_outlet: parts[7] || '-', tap: parts[8] || '-'
                        });
                    }
                }
            }
            return items;
        };

        for (const delimiter of delimitersToTry) {
            const currentHeader = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim().replace(/_/g, '')); 
            const rawHeader = parseCSVLine(lines[0], delimiter).map(h => h.trim());
            
            if (currentHeader.length < 2) continue;

            addLog(`Mencoba pemisah '${delimiter}' -> Header: [${rawHeader.join(', ')}]`);

            const findIdx = (keywords: string[]) => {
                const normKeywords = keywords.map(k => k.toLowerCase().replace(/_/g, ''));
                return currentHeader.findIndex(h => normKeywords.includes(h));
            };
            const getVal = (parts: string[], idx: number) => (idx !== -1 && parts[idx]) ? parts[idx] : '';

            let snIdx = -1, dateIdx = -1, prodIdx = -1, flagIdx = -1, catIdx = -1;
            let whIdx = -1, sfIdx = -1, tapIdx = -1, rsIdx = -1;
            let digiIdx = -1, outletIdx = -1, amountIdx = -1;
            let trxTypeIdx = -1, senderIdx = -1, receiverIdx = -1, remarksIdx = -1, currencyIdx = -1, trxIdIdx = -1;

            if (uploadMode === 'adisti') {
                snIdx = findIdx(['snnumber', 'sn', 'notrsn']);
                dateIdx = findIdx(['createdat', 'tanggal', 'date', 'transactiondate']);
                whIdx = findIdx(['warehouse', 'gudang']);
                prodIdx = findIdx(['productname', 'product', 'produk']);
                sfIdx = findIdx(['salesforcename', 'salesforce', 'sf']);
                rsIdx = findIdx(['nors', 'rs']);
                digiIdx = findIdx(['iddigipos', 'digipos', 'id_digipos']);
                outletIdx = findIdx(['namaoutlet', 'outlet', 'nama_outlet']);
                tapIdx = findIdx(['tap']);

                if (snIdx === -1) {
                    addLog("Warning: Kolom SN tidak ditemukan by Name. Menggunakan Fallback Urutan Adisti (TAP Akhir).");
                    dateIdx=0; snIdx=1; whIdx=2; prodIdx=3; sfIdx=4; rsIdx=5; digiIdx=6; outletIdx=7; tapIdx=8;
                }
            } 
            else if (uploadMode === 'new') {
                snIdx = findIdx(['snnumber', 'nosn', 'sn']);
                flagIdx = findIdx(['flag']);
                prodIdx = findIdx(['productname', 'namaproduk', 'product']);
                catIdx = findIdx(['subcategory', 'kategori', 'category']);
                whIdx = findIdx(['warehouse', 'gudang']);
                sfIdx = findIdx(['salesforcename', 'salesforce', 'sf']);
                tapIdx = findIdx(['tap']);
                rsIdx = findIdx(['nors']);

                if (snIdx === -1) { 
                    addLog("Fallback Urutan Report SN");
                    snIdx=0; flagIdx=1; prodIdx=2; catIdx=3; whIdx=4; sfIdx=5; tapIdx=6; rsIdx=7; 
                }
            }
            else if (uploadMode === 'update') {
                snIdx = findIdx(['snnumber', 'nosn', 'sn']);
                dateIdx = findIdx(['sellthrudate', 'tanggal', 'date']);
                digiIdx = findIdx(['iddigipos', 'digipos']);
                outletIdx = findIdx(['namaoutlet', 'outlet']);
                amountIdx = findIdx(['price', 'harga', 'amount']);
                trxIdIdx = findIdx(['transactionid', 'trxid']);
                
                if (snIdx === -1) { snIdx=0; dateIdx=1; digiIdx=2; outletIdx=3; amountIdx=4; trxIdIdx=5; }
            }
            else { 
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
                
                if (amountIdx === -1) { amountIdx = 4; dateIdx=0; } 
            }

            const tempItems: any[] = [];
            
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i], delimiter);
                
                if (parts.length < 2) continue; 

                const snRaw = snIdx !== -1 ? getVal(parts, snIdx) : '';
                
                if (uploadMode === 'adisti') {
                    if (snRaw && snRaw.length > 5) {
                        tempItems.push({
                            created_at: getVal(parts, dateIdx) || new Date().toISOString(),
                            sn_number: snRaw,
                            warehouse: getVal(parts, whIdx) || '-',
                            product_name: getVal(parts, prodIdx) || '-',
                            salesforce_name: getVal(parts, sfIdx) || '-',
                            no_rs: getVal(parts, rsIdx) || '-',
                            id_digipos: getVal(parts, digiIdx) || '-',
                            nama_outlet: getVal(parts, outletIdx) || '-',
                            tap: getVal(parts, tapIdx) || '-'
                        });
                    }
                }
                else if (uploadMode === 'new') {
                     if (snRaw && snRaw.length > 5) {
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
                }
                else if (uploadMode === 'update') {
                    if (snRaw) {
                        const priceStr = getVal(parts, amountIdx).replace(/[^0-9]/g, '');
                        tempItems.push({
                            sn_number: snRaw,
                            sellthru_date: getVal(parts, dateIdx) || new Date().toISOString().split('T')[0],
                            id_digipos: getVal(parts, digiIdx),
                            nama_outlet: getVal(parts, outletIdx),
                            price: priceStr ? parseInt(priceStr) : 0,
                            transaction_id: getVal(parts, trxIdIdx)
                        });
                    }
                }
                else { 
                     const amtStr = getVal(parts, amountIdx).replace(/[^0-9]/g, '');
                     if (amtStr) {
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
            }

            if (tempItems.length > 0) {
                finalParsedItems = tempItems;
                usedDelimiter = delimiter;
                headerRow = rawHeader;
                addLog(`SUKSES: Ditemukan ${tempItems.length} baris data valid menggunakan pemisah '${delimiter}'`);
                break; 
            }
        }

        // --- RETRY WITH BLIND MODE IF FAILED ---
        if (finalParsedItems.length === 0 && uploadMode === 'adisti') {
            finalParsedItems = tryBlindParse(';', 'adisti');
            if (finalParsedItems.length > 0) addLog("Blind Parse (;) berhasil.");
            else {
                finalParsedItems = tryBlindParse(',', 'adisti');
                 if (finalParsedItems.length > 0) addLog("Blind Parse (,) berhasil.");
            }
        }

        if (finalParsedItems.length === 0) {
            setShowDebug(true);
            throw new Error(`GAGAL: Tidak ada data valid yang ditemukan.\nMohon pastikan file menggunakan template terbaru v2.0.`);
        }

        let count = finalParsedItems.length;
        addLog(`Mulai mengirim ${count} data ke server secara bertahap...`);

        if (uploadMode === 'new') {
            await uploadInChunks(finalParsedItems, bulkAddSerialNumbers);
            setSuccessMsg(`SUKSES TOTAL: ${count} Data Report SN berhasil tersimpan di Database.`);
        } else if (uploadMode === 'update') {
            // Using new architecture function
            await uploadInChunks(finalParsedItems, bulkAddSellthruTransactions);
            setSuccessMsg(`SUKSES TOTAL: ${count} Data Sellthru berhasil diproses (Arsitektur Baru).`);
        } else if (uploadMode === 'topup') {
            await uploadInChunks(finalParsedItems, bulkAddTopupTransactions);
            setSuccessMsg(`SUKSES TOTAL: ${count} Data Topup berhasil tersimpan.`);
        } else if (uploadMode === 'bucket') {
            await uploadInChunks(finalParsedItems, bulkAddBucketTransactions);
            setSuccessMsg(`SUKSES TOTAL: ${count} Data Bucket berhasil tersimpan.`);
        } else if (uploadMode === 'adisti') {
            await uploadInChunks(finalParsedItems, bulkAddAdistiTransactions);
            setSuccessMsg(`SUKSES TOTAL: ${count} Data List SN (Adisti) berhasil tersimpan.`);
        }

        setFile(null);
        setTimeout(() => {
            onSuccess();
            setSuccessMsg('');
            setDebugLog([]);
            setShowDebug(false);
            setUploadProgress(0);
        }, 5000); 

      } catch (err: any) {
        console.error("Upload Error:", err);
        setError(err.message || 'Gagal memproses file.');
        setShowDebug(true);
      } finally {
        setIsProcessing(false);
        setIsGlobalProcessing(false); // UNLOCK UI
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in relative">
      {isProcessing && (
         <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-xl">
             <div className="bg-white p-6 rounded-2xl shadow-2xl text-center border-2 border-red-100 max-w-sm">
                <Loader2 size={40} className="animate-spin text-red-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Sedang Mengupload...</h3>
                <p className="text-sm text-slate-500 mt-2 mb-4">Mohon jangan tutup atau refresh halaman ini sampai proses selesai 100%.</p>
                
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200">
                    <div className="bg-red-600 h-full transition-all duration-300 relative" style={{ width: `${uploadProgress}%` }}>
                       <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">{uploadProgress}%</span>
                    </div>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-2">{processedCount} / {totalCount} Data</p>
             </div>
         </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Upload Center <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">v2.1 Chunked</span>
        </h2>
        <p className="text-slate-500">Kelola semua data aplikasi dalam satu tempat</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <button disabled={isProcessing} onClick={() => setUploadMode('new')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'new' ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}><Plus size={20} /><span className="font-bold text-xs md:text-sm">Report SN</span></button>
        <button disabled={isProcessing} onClick={() => setUploadMode('adisti')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'adisti' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500'}`}><List size={20} /><span className="font-bold text-xs md:text-sm">List SN (Adisti)</span></button>
        <button disabled={isProcessing} onClick={() => setUploadMode('update')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'update' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}><ChevronUp size={20} /><span className="font-bold text-xs md:text-sm">Sellthru</span></button>
        <button disabled={isProcessing} onClick={() => setUploadMode('topup')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'topup' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500'}`}><Wallet size={20} /><span className="font-bold text-xs md:text-sm">Topup Saldo</span></button>
        <button disabled={isProcessing} onClick={() => setUploadMode('bucket')} className={`py-4 px-2 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${uploadMode === 'bucket' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500'}`}><Receipt size={20} /><span className="font-bold text-xs md:text-sm">Bucket Trx</span></button>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
           <div>
             <h3 className="text-lg font-bold text-slate-800">
               {uploadMode === 'new' ? 'Upload Data Report SN' : uploadMode === 'update' ? 'Upload Laporan Sellthru' : uploadMode === 'adisti' ? 'Upload List SN (Adisti)' : uploadMode === 'topup' ? 'Upload Topup Saldo' : 'Upload Bucket Transaksi'}
             </h3>
             <p className="text-xs text-slate-400 mt-1">Gunakan template database terbaru untuk hasil akurat.</p>
           </div>
           <button disabled={isProcessing} onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"><Download size={16} /><span>Template DB</span></button>
        </div>

        <form onSubmit={handleUpload} className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex flex-col gap-2 text-sm border border-red-100">
                <div className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> <span className="font-bold whitespace-pre-wrap">{error}</span></div>
            </div>
          )}
          
          {successMsg && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-emerald-100 animate-pulse"><CheckCircle2 size={16} />{successMsg}</div>}

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
            <input type="file" accept=".csv" onChange={handleFileChange} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            <div className="p-4 rounded-full mb-3 bg-slate-100 text-slate-600 group-hover:bg-red-50 group-hover:text-red-600 transition-colors"><FileSpreadsheet size={32} /></div>
            {file ? <div><p className="text-lg font-bold text-slate-800">{file.name}</p><p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p></div> : <div><p className="text-lg font-bold text-slate-800">Klik untuk pilih file</p><p className="text-sm text-slate-500">atau drag & drop file .csv disini</p></div>}
          </div>

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
                {isProcessing ? <Lock size={20} /> : <UploadCloud size={20} />}
                <span>{isProcessing ? `Mengupload (${uploadProgress}%)...` : "Proses Upload"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputForm;