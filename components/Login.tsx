import React, { useState } from 'react';
import { login } from '../services/storage';
import { User } from '../types';
import { Lock, User as UserIcon, ArrowRight, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
        const { user, token } = await login(username, password);
        localStorage.setItem('sn_token', token);
        onLogin(user);
    } catch (err: any) {
        setError(err.message || 'Login failed');
    } finally {
        setLoading(false);
    }
  };

  const loginAs = async (u: string) => {
    setUsername(u);
    setLoading(true);
    try {
        // Default password for demo
        const { user, token } = await login(u, '123456');
        localStorage.setItem('sn_token', token);
        onLogin(user);
    } catch (err: any) {
        setError('Login failed: ' + err.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-red-700 to-red-600 p-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight relative z-10">SN ST Monitoring</h1>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white text-black font-semibold"
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white text-black font-semibold"
                  placeholder="Masukkan password"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <><span>Masuk Aplikasi</span><ArrowRight size={18} /></>
            )}
          </button>
          
          <div className="text-center text-xs text-slate-500 mt-6">
            <p className="font-semibold mb-2 text-black">Akun Demo (Pass: 123456):</p>
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <button type="button" onClick={() => loginAs('superadmin')} className="bg-red-800 text-white px-3 py-1 rounded border border-red-900">superadmin</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => loginAs('admin')} className="bg-slate-200 text-black px-3 py-1 rounded">admin</button>
              <button type="button" onClick={() => loginAs('sales1')} className="bg-slate-200 text-black px-3 py-1 rounded">sales1</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;