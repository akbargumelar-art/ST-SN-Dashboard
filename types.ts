
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
  mustChangePassword?: boolean;
}

export enum SNStatus {
  READY = 'Ready',
  SUKSES_ST = 'Sukses ST',
  GAGAL_ST = 'Gagal ST'
}

export interface SerialNumber {
  id: number;
  sn_number: string;
  flag: string;
  warehouse: string;
  sub_category: string;
  product_name: string;
  expired_date: string;
  status: SNStatus;
  created_at: string;
  qr_code_url: string;
  salesforce_name: string;
  tap: string;
  price?: number;
  transaction_id?: string;
  no_rs?: string;
  id_digipos?: string;
  nama_outlet?: string;
}

export interface AdistiTransaction {
  id: number;
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
  id: number;
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
