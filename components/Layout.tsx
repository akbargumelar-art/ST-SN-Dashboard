import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { 
  LayoutDashboard, 
  LogOut, 
  UploadCloud, 
  User as UserIcon,
  Users, 
  ShoppingBag, 
  Wallet,
  Receipt,
  List,
  Home,
  MoreHorizontal,
  ChevronRight,
  Lock
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  isProcessing?: boolean; // New Prop
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentView, setCurrentView, isProcessing = false }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: Home, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'dashboard', label: 'Report SN', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'sellthru', label: 'Sellthru', icon: ShoppingBag, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'topup', label: 'Topup Saldo', icon: Wallet, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'bucket', label: 'Bucket Transaksi', icon: Receipt, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'listsn', label: 'List SN (Adisti)', icon: List, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SALESFORCE] },
    { id: 'input', label: 'Upload Data', icon: UploadCloud, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { id: 'users', label: 'Manajemen User', icon: Users, roles: [UserRole.SUPER_ADMIN] }, // Only SUPER_ADMIN
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  // Define Mobile Menu Order
  const mobilePrimaryIds = ['dashboard', 'topup', 'home', 'sellthru'];
  
  const mobilePrimaryItems = mobilePrimaryIds
    .map(id => filteredMenu.find(item => item.id === id))
    .filter((item): item is typeof menuItems[0] => item !== undefined);

  const mobileSecondaryItems = filteredMenu.filter(item => !mobilePrimaryIds.includes(item.id));

  // Handler for navigation click with Lock check
  const handleNavClick = (viewId: string) => {
    if (isProcessing) {
      alert("⚠️ PERINGATAN: Sedang dalam proses upload data ke database.\n\nMohon tunggu hingga proses 100% selesai sebelum berpindah halaman.");
      return;
    }
    setCurrentView(viewId);
    setIsMobileMenuOpen(false);
  };

  const handleLogoutClick = () => {
    if (isProcessing) {
        alert("⚠️ PERINGATAN: Tidak bisa Logout saat proses upload berjalan.");
        return;
    }
    onLogout();
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar - Desktop (Hidden on mobile) */}
      <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-red-700 to-red-800 text-white shadow-2xl z-30 relative">
        {/* Overlay Lock for Desktop Sidebar */}
        {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/50 z-50 cursor-not-allowed flex flex-col items-center justify-center text-center p-4 backdrop-blur-[1px]">
                <Lock className="text-white mb-2" size={32} />
                <p className="text-white font-bold text-sm">Menu Terkunci</p>
                <p className="text-red-100 text-xs mt-1">Sedang Proses Upload...</p>
            </div>
        )}

        <div className="p-6 border-b border-red-600/50">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SN Manager
          </h1>
          <p className="text-xs text-red-200 mt-1">Sistem Manajemen Terpadu</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              disabled={isProcessing}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${currentView === item.id 
                  ? 'bg-white text-red-700 shadow-md font-bold' 
                  : 'text-red-100 hover:bg-red-600 hover:text-white'}
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-red-600/50 bg-red-900/20">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <UserIcon size={20} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-red-200 capitalize truncate">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogoutClick}
            disabled={isProcessing}
            className={`w-full flex items-center justify-center space-x-2 bg-red-900/50 hover:bg-white hover:text-red-700 text-white p-2 rounded-lg transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10 shadow-sm relative">
           {isProcessing && <div className="absolute inset-0 bg-white/50 z-20 cursor-not-allowed" />}
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">
                SN
             </div>
             <span className="font-bold text-slate-800 text-lg">
                {filteredMenu.find(m => m.id === currentView)?.label || 'SN Manager'}
             </span>
          </div>
          <button onClick={handleLogoutClick} className="text-slate-500 hover:text-red-600">
            <LogOut size={20} />
          </button>
        </header>

        {/* Content Body - with explicit spacer for mobile nav */}
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            {/* Explicit Spacer for Mobile Bottom Nav - Matches height of bottom nav + some buffer */}
            <div className="h-28 w-full flex-shrink-0 lg:hidden opacity-0 pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        {/* Mobile "Lainnya" Menu Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
            onClick={() => !isProcessing && setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile "Lainnya" Popup Menu */}
        <div className={`
            lg:hidden fixed bottom-20 right-4 left-4 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden transition-all duration-300 transform origin-bottom-right
            ${isMobileMenuOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8 pointer-events-none'}
        `}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">Menu Lainnya</h3>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                {mobileSecondaryItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors
                            ${currentView === item.id ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </div>
                        {currentView === item.id && <div className="w-2 h-2 rounded-full bg-red-600"></div>}
                        {currentView !== item.id && <ChevronRight size={16} className="text-slate-300" />}
                    </button>
                ))}
            </div>
        </div>

        {/* Bottom Navigation - Mobile Only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-2 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-pb relative">
           
           {/* Overlay Lock for Mobile Nav */}
           {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/50 z-50 cursor-not-allowed flex items-center justify-center backdrop-blur-[1px]">
                  <div className="bg-white px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
                    <Lock size={14} className="text-red-600" />
                    <span className="text-[10px] font-bold text-slate-800">Terkunci</span>
                  </div>
              </div>
           )}

           {/* Primary 4 Items */}
           {mobilePrimaryItems.map((item) => (
             <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  flex flex-col items-center justify-center w-full py-1 space-y-1 active:scale-95 transition-transform
                  ${currentView === item.id ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}
                `}
             >
                <item.icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
                <span className="text-[10px] font-medium leading-none text-center truncate w-full px-1">
                    {item.label === 'Dashboard' ? 'Home' : item.label.split(' ')[0]}
                </span>
             </button>
           ))}

           {/* "Lainnya" Button */}
           <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`
                flex flex-col items-center justify-center w-full py-1 space-y-1 active:scale-95 transition-transform
                ${isMobileMenuOpen ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}
              `}
           >
              <MoreHorizontal size={22} strokeWidth={isMobileMenuOpen ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-none text-center">Lainnya</span>
           </button>
        </nav>

      </main>
    </div>
  );
};

export default Layout;