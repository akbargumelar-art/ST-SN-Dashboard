import { SerialNumber, SNStatus, User, UserRole, TopupTransaction, AdistiTransaction } from '../types';

const STORAGE_KEY_SN = 'sn_manager_data';
const STORAGE_KEY_USERS = 'sn_manager_users';
const STORAGE_KEY_TOPUP = 'sn_manager_topup';
const STORAGE_KEY_BUCKET = 'sn_manager_bucket'; // New Key
const STORAGE_KEY_ADISTI = 'sn_manager_adisti';

// Initial Mock Users if storage is empty
const INITIAL_USERS: User[] = [
  { id: 0, username: 'superadmin', role: UserRole.SUPER_ADMIN, name: 'Super Administrator' }, // New Super Admin
  { id: 1, username: 'admin', role: UserRole.ADMIN, name: 'System Admin' },
  { id: 2, username: 'supervisor', role: UserRole.SUPERVISOR, name: 'Head Supervisor' },
  { id: 3, username: 'sales', role: UserRole.SALESFORCE, name: 'Salesforce General' },
  // Users matching specific data in CSV
  { id: 4, username: 'sales1', role: UserRole.SALESFORCE, name: 'CVS KNG 05' },
  { id: 5, username: 'sales2', role: UserRole.SALESFORCE, name: 'CVS KNG 09' },
];

const INITIAL_CSV_DATA = `
650000088233235;Stock Onhand;PERDANA KPK 3GB - LA19.9;Perdana Data;CVS KNG 05;Kuningan
650000088233239;Pengamanan;PERDANA KPK 3GB - LA19.9;Perdana Data;CVS KNG 05;Kuningan
760000033331861;Stock Onhand;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331858;Pengamanan;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331855;Stock Onhand;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331854;Stock Onhand;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331859;Stock Onhand;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331857;Pengamanan;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331860;Pengamanan;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
760000033331852;Stock Onhand;Perdana KPK 3GB - LA14.9;Perdana Data;CVS KNG 08;Kuningan
550000112540906;Pengamanan;KPK2 18GB - LA40;Perdana Data;CVS KNG 09;Kuningan
850000180531831;Pengamanan;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
550000112555189;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
850000180531827;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
850000180531828;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
850000180531829;Pengamanan;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
550000112555188;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
850000180531830;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
550000112555187;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
50000454956069;Stock Onhand;KPK2 35GB - LA63;Perdana Data;CVS KNG 07;Kuningan
`;

const INITIAL_TOPUP_DATA = `Transaction Date;Sender;Receiver;Transaction Type;Amount;Currency;Remarks;salesforce;tap;id digipos;nama outlet
2025-11-26 14:59:46;6282114115293;82118776787;Debit;210.000;IDR;Top Up balance via SF 210000;Ahmad Gunawan;Pemuda;2100005480;MAJU JAYA
2025-11-26 14:58:19;6282114115301;82130439456;Debit;324.600;IDR;Top Up balance via SF 324600;Azhari Saputra;Pemuda;2100018078;MUMI CELL
2025-11-26 14:57:46;6282114115296;82128632753;Debit;230.000;IDR;Top Up balance via SF 230000;Arman Farid;Pemuda;2100024177;Reva Cell
`;

export const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEY_SN)) {
    const parsed = parseCSV(INITIAL_CSV_DATA);
    localStorage.setItem(STORAGE_KEY_SN, JSON.stringify(parsed));
  }
  if (!localStorage.getItem(STORAGE_KEY_USERS)) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEY_TOPUP)) {
    const parsed = parseTopupCSV(INITIAL_TOPUP_DATA);
    localStorage.setItem(STORAGE_KEY_TOPUP, JSON.stringify(parsed));
  }
  // Initialize Bucket same as Topup for demo purposes if empty, or empty array
  if (!localStorage.getItem(STORAGE_KEY_BUCKET)) {
    const parsed = parseTopupCSV(INITIAL_TOPUP_DATA);
    localStorage.setItem(STORAGE_KEY_BUCKET, JSON.stringify(parsed));
  }
  if (!localStorage.getItem(STORAGE_KEY_ADISTI)) {
    localStorage.setItem(STORAGE_KEY_ADISTI, JSON.stringify([]));
  }
};

const parseCSV = (csvText: string): SerialNumber[] => {
  const lines = csvText.trim().split('\n');
  return lines.map((line, index) => {
    const parts = line.split(';');
    return {
      id: `sn-${index}-${Date.now()}`,
      sn_number: parts[0] || '',
      flag: parts[1] || '',
      product_name: parts[2] || '',
      sub_category: parts[3] || '',
      warehouse: parts[5] || '', // Using region as warehouse for demo
      expired_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0], // Mock date
      status: SNStatus.READY,
      created_at: new Date().toISOString(),
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${parts[0]}`,
      salesforce_name: parts[4] || '',
      tap: parts[5] || '',
      // Add mock price for Sellthru visualization
      price: Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000,
      // Add mock transaction ID
      transaction_id: `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      // Add mock No RS
      no_rs: `RS-${Math.floor(10000 + Math.random() * 90000)}`
    };
  });
};

const parseTopupCSV = (csvText: string): TopupTransaction[] => {
  const lines = csvText.trim().split('\n');
  // Skip header
  const dataLines = lines.slice(1);
  
  return dataLines.map((line, index) => {
    const parts = line.split(';');
    // Assuming CSV format: Transaction Date;Sender;Receiver;Transaction Type;Amount;Currency;Remarks;salesforce;tap;id digipos;nama outlet
    return {
      id: `topup-${index}-${Date.now()}`,
      transaction_date: parts[0] || '',
      sender: parts[1] || '',
      receiver: parts[2] || '',
      transaction_type: parts[3] || '',
      amount: parseInt((parts[4] || '0').replace(/\./g, '')), // Handle 210.000 -> 210000
      currency: parts[5] || 'IDR',
      remarks: parts[6] || '',
      salesforce: parts[7] || '',
      tap: parts[8] || '',
      id_digipos: parts[9] || '',
      nama_outlet: parts[10] || ''
    };
  });
};

export const getSerialNumbers = (): SerialNumber[] => {
  const data = localStorage.getItem(STORAGE_KEY_SN);
  return data ? JSON.parse(data) : [];
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEY_USERS);
  return data ? JSON.parse(data) : INITIAL_USERS;
};

export const authenticateUser = (username: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
};

export const updateSerialNumberStatus = (id: string, status: SNStatus) => {
  const currentData = getSerialNumbers();
  const updatedData = currentData.map(item => 
    item.id === id ? { ...item, status } : item
  );
  localStorage.setItem(STORAGE_KEY_SN, JSON.stringify(updatedData));
};

export const addUser = (user: Omit<User, 'id'>) => {
  const users = getUsers();
  const newUser = { ...user, id: Date.now() };
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([...users, newUser]));
};

export const updateUser = (updatedUser: User) => {
  const users = getUsers();
  const newUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(newUsers));
};

export const deleteUser = (id: number) => {
  const users = getUsers();
  const newUsers = users.filter(u => u.id !== id);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(newUsers));
};

export const bulkAddSerialNumbers = (newItems: any[]) => {
  const currentData = getSerialNumbers();
  const formattedItems: SerialNumber[] = newItems.map((item, idx) => ({
    id: `sn-new-${Date.now()}-${idx}`,
    sn_number: item.sn_number,
    flag: item.flag,
    product_name: item.product_name,
    sub_category: item.sub_category,
    warehouse: item.warehouse,
    expired_date: item.expired_date,
    status: SNStatus.READY,
    created_at: new Date().toISOString(),
    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.sn_number}`,
    salesforce_name: item.salesforce_name,
    tap: item.tap,
    price: 0,
    transaction_id: `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    no_rs: item.no_rs || `RS-${Math.floor(10000 + Math.random() * 90000)}`
  }));
  
  localStorage.setItem(STORAGE_KEY_SN, JSON.stringify([...currentData, ...formattedItems]));
};

export const bulkUpdateStatus = (items: {sn_number: string, id_digipos: string, nama_outlet: string, price?: number, transaction_id?: string}[]) => {
  const currentData = getSerialNumbers();
  let successCount = 0;
  let failedCount = 0;

  const updatedData = currentData.map(sn => {
    const match = items.find(i => i.sn_number === sn.sn_number);
    if (match) {
      successCount++;
      return {
        ...sn,
        status: SNStatus.SUKSES_ST,
        id_digipos: match.id_digipos,
        nama_outlet: match.nama_outlet,
        price: match.price || sn.price,
        transaction_id: match.transaction_id || sn.transaction_id
      };
    }
    return sn;
  });

  failedCount = items.length - successCount;
  localStorage.setItem(STORAGE_KEY_SN, JSON.stringify(updatedData));
  
  return { success: successCount, failed: failedCount };
};

// --- TOPUP SALDO STORAGE ---
export const getTopupTransactions = (): TopupTransaction[] => {
  const data = localStorage.getItem(STORAGE_KEY_TOPUP);
  return data ? JSON.parse(data) : [];
};

export const bulkAddTopupTransactions = (newItems: TopupTransaction[]) => {
  const currentData = getTopupTransactions();
  const formattedItems = newItems.map((item, idx) => ({
    ...item,
    id: `topup-upload-${Date.now()}-${idx}`
  }));
  localStorage.setItem(STORAGE_KEY_TOPUP, JSON.stringify([...currentData, ...formattedItems]));
};

// --- BUCKET TRANSAKSI STORAGE ---
export const getBucketTransactions = (): TopupTransaction[] => {
  const data = localStorage.getItem(STORAGE_KEY_BUCKET);
  return data ? JSON.parse(data) : [];
};

export const bulkAddBucketTransactions = (newItems: TopupTransaction[]) => {
  const currentData = getBucketTransactions();
  const formattedItems = newItems.map((item, idx) => ({
    ...item,
    id: `bucket-upload-${Date.now()}-${idx}`
  }));
  localStorage.setItem(STORAGE_KEY_BUCKET, JSON.stringify([...currentData, ...formattedItems]));
};

// Adisti Storage Logic
export const getAdistiTransactions = (): AdistiTransaction[] => {
  const data = localStorage.getItem(STORAGE_KEY_ADISTI);
  return data ? JSON.parse(data) : [];
};

export const bulkAddAdistiTransactions = (newItems: AdistiTransaction[]) => {
  const currentData = getAdistiTransactions();
  const formattedItems = newItems.map((item, idx) => ({
    ...item,
    id: `adisti-${Date.now()}-${idx}`
  }));
  localStorage.setItem(STORAGE_KEY_ADISTI, JSON.stringify([...currentData, ...formattedItems]));
};