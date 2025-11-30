import { SerialNumber, SNStatus, User, TopupTransaction, AdistiTransaction } from '../types';

const API_URL = '/api';

const getHeaders = () => {
    const token = localStorage.getItem('sn_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

// --- AUTH ---
export const login = async (username: string, password: string): Promise<{user: User, token: string}> => {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
    }
    return res.json();
};

export const changeMyPassword = async (newPassword: string) => {
    const res = await fetch(`${API_URL}/change-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Gagal mengubah password');
    }
    return res.json();
};

export const initStorage = () => {
    // No initialization needed for API
};

// --- USERS ---
export const getUsers = async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const addUser = async (user: any) => {
    await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(user)
    });
};

export const updateUser = async (user: User) => {
    await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(user)
    });
};

export const deleteUser = async (id: number) => {
    await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
};

// --- SERIAL NUMBERS ---
export const getSerialNumbers = async (): Promise<SerialNumber[]> => {
    const res = await fetch(`${API_URL}/serial-numbers`, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
        ...d,
        qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${d.sn_number}`
    }));
};

export const updateSerialNumberStatus = async (id: number, status: SNStatus) => {
    await fetch(`${API_URL}/serial-numbers/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
    });
};

export const bulkAddSerialNumbers = async (newItems: any[]) => {
    const res = await fetch(`${API_URL}/serial-numbers/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newItems)
    });
    if (!res.ok) throw new Error('Failed to upload data');
};

export const bulkUpdateStatus = async (items: any[]) => {
    const res = await fetch(`${API_URL}/serial-numbers/sellthru`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(items)
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
};

// --- TOPUP ---
export const getTopupTransactions = async (): Promise<TopupTransaction[]> => {
    const res = await fetch(`${API_URL}/topup`, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const bulkAddTopupTransactions = async (newItems: any[]) => {
    const res = await fetch(`${API_URL}/topup/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newItems)
    });
    if (!res.ok) throw new Error('Failed to upload topup');
};

// --- BUCKET ---
export const getBucketTransactions = async (): Promise<TopupTransaction[]> => {
    const res = await fetch(`${API_URL}/bucket`, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const bulkAddBucketTransactions = async (newItems: any[]) => {
    const res = await fetch(`${API_URL}/bucket/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newItems)
    });
    if (!res.ok) throw new Error('Failed to upload bucket');
};

// --- ADISTI ---

// Get unique filter options (salesforce and taps)
export const getAdistiFilters = async (taps?: string[]): Promise<{ sales: string[], taps: string[] }> => {
    let url = `${API_URL}/adisti/filters`;
    if (taps && taps.length > 0) {
        const query = new URLSearchParams();
        query.append('tap', taps.join(','));
        url += `?${query.toString()}`;
    }
    
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return { sales: [], taps: [] };
    return res.json();
};

// Modified to support query parameters AND SORTING
export const getAdistiTransactions = async (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): Promise<any> => {
    let url = `${API_URL}/adisti`;
    
    if (params) {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.sortOrder) query.append('sortOrder', params.sortOrder);
        
        // Handle Array or comma string for multiple select
        if (params.salesforce) {
            query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        }
        if (params.tap) {
             query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        }
        
        url += `?${query.toString()}`;
    }

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 1 };
    
    // Response is now an object { data, total, page, totalPages, summary }
    return res.json();
};

// Download CSV Export
export const downloadAdistiReport = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) => {
    let url = `${API_URL}/adisti/export`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.sortOrder) query.append('sortOrder', params.sortOrder);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }

    // Use Fetch with Blob to download file
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Gagal mendownload file');
    
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `adisti_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
};

// Get Hierarchical Summary Tree
export const getAdistiSummaryTree = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
}): Promise<any[]> => {
    let url = `${API_URL}/adisti/summary-tree`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

// Get Product Summary
export const getAdistiProductSummary = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
}): Promise<{product_name: string, total: number}[]> => {
    let url = `${API_URL}/adisti/summary-products`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const bulkAddAdistiTransactions = async (newItems: any[]) => {
    const res = await fetch(`${API_URL}/adisti/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newItems)
    });
    if (!res.ok) throw new Error('Failed to upload adisti');
};

// --- SELLTHRU (NEW) ---

export const getSellthruFilters = async (taps?: string[]): Promise<{ sales: string[], taps: string[] }> => {
    let url = `${API_URL}/sellthru/filters`;
    if (taps && taps.length > 0) {
        const query = new URLSearchParams();
        query.append('tap', taps.join(','));
        url += `?${query.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return { sales: [], taps: [] };
    return res.json();
};

export const getSellthruTransactions = async (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): Promise<any> => {
    let url = `${API_URL}/sellthru`;
    
    if (params) {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.sortOrder) query.append('sortOrder', params.sortOrder);
        
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        
        url += `?${query.toString()}`;
    }

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 1 };
    return res.json();
};

export const getSellthruSummaryTree = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
}): Promise<any[]> => {
    let url = `${API_URL}/sellthru/summary-tree`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const getSellthruProductSummary = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
}): Promise<{product_name: string, total: number}[]> => {
    let url = `${API_URL}/sellthru/summary-products`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
};

export const downloadSellthruReport = async (params?: { 
    search?: string;
    startDate?: string;
    endDate?: string;
    salesforce?: string | string[];
    tap?: string | string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) => {
    let url = `${API_URL}/sellthru/export`;
    if (params) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.sortOrder) query.append('sortOrder', params.sortOrder);
        if (params.salesforce) query.append('salesforce', Array.isArray(params.salesforce) ? params.salesforce.join(',') : params.salesforce);
        if (params.tap) query.append('tap', Array.isArray(params.tap) ? params.tap.join(',') : params.tap);
        url += `?${query.toString()}`;
    }

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Gagal mendownload file');
    
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `sellthru_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
};