

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  SALESFORCE = 'salesforce'
}

export interface User {
  id: number;
  username: string;
  role: UserRole;
  name: string;
}

export enum SNStatus {
  READY = 'Ready',
  SUKSES_ST = 'Sukses ST',
  GAGAL_ST = 'Gagal ST'
}

export interface SerialNumber {
  id: string;
  sn_number: string;
  flag: string;
  warehouse: string;
  sub_category: string;
  product_name: string;
  expired_date: string; // ISO Date string
  status: SNStatus;
  created_at: string; // ISO Date string
  qr_code_url: string;
  salesforce_name: string; // Changed from ID to string to match CSV data
  tap: string;
  price?: number; // Added for Sellthru report
  transaction_id?: string; // New field
  no_rs?: string; // New field for Number RS
  
  // New Fields for Success Status
  id_digipos?: string;
  nama_outlet?: string;
}

export interface AdistiTransaction {
  id: string;
  created_at: string;
  sn_number: string;
  warehouse: string;
  product_name: string;
  salesforce_name: string;
  tap: string;
  no_rs: string;
  id_digipos: string;
  nama_outlet: string;
}

export interface DashboardStats {
  totalToday: number;
  totalSuccess: number;
  totalFailed: number;
  totalReady: number;
}

export interface TopupTransaction {
  id: string;
  transaction_date: string;
  sender: string;
  receiver: string;
  transaction_type: string;
  amount: number;
  currency: string;
  remarks: string;
  salesforce: string;
  tap: string;
  id_digipos: string;
  nama_outlet: string;
}