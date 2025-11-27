
import React, { useState } from 'react';
import { authenticateUser } from '../services/storage';
import { User } from '../types';
import { Lock, User as UserIcon, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = authenticateUser(username);
    if (user) {
      onLogin(user);
    } else {
      setError('Username tidak ditemukan. Coba akun demo di bawah.');
    }
  };

  const loginAs = (u: string) => {
    setUsername(u);
    const user = authenticateUser(u);
    if (user) onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header Merah */}
        <div className="bg-gradient-to-r from-red-700 to-red-600 p-8 text-center relative overflow-hidden">
          {/* Decorative Circle */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight relative z-10">
            SN ST Monitoring
          </h1>
          <p className="text-red-100 text-sm relative z-10">Data SN ST Harian Salesforce</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center border border-red-100 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-black uppercase mb-1 ml-1">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all bg-white text-black font-semibold placeholder:text-slate-400"
                  placeholder="Masukkan username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black uppercase mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all bg-white text-black font-semibold placeholder:text-slate-400"
                  placeholder="Masukkan password"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center space-x-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Masuk Aplikasi</span>
            <ArrowRight size={18} />
          </button>
          
          <div className="text-center text-xs text-slate-500 mt-6">
            <p className="font-semibold mb-2 text-black">Akun Demo:</p>
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <button type="button" onClick={() => loginAs('superadmin')} className="bg-red-800 hover:bg-red-900 text-white px-3 py-1 rounded transition-colors font-bold border border-red-900">superadmin</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => loginAs('admin')} className="bg-slate-200 hover:bg-slate-300 text-black px-3 py-1 rounded transition-colors">admin</button>
              <button type="button" onClick={() => loginAs('supervisor')} className="bg-slate-200 hover:bg-slate-300 text-black px-3 py-1 rounded transition-colors">supervisor</button>
              <button type="button" onClick={() => loginAs('sales')} className="bg-slate-200 hover:bg-slate-300 text-black px-3 py-1 rounded transition-colors">sales</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <button type="button" onClick={() => loginAs('sales1')} className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors font-medium">sales1 (CVS KNG 05)</button>
              <button type="button" onClick={() => loginAs('sales2')} className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors font-medium">sales2 (CVS KNG 09)</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;