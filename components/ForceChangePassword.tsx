
import React, { useState } from 'react';
import { changeMyPassword } from '../services/storage';
import { Lock, Save, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
    onSuccess: () => void;
}

const ForceChangePassword: React.FC<Props> = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password minimal 6 karakter.');
            return;
        }
        if (password !== confirm) {
            setError('Konfirmasi password tidak cocok.');
            return;
        }
        if (password === '123456') {
            setError('Password baru tidak boleh sama dengan password default.');
            return;
        }

        setLoading(true);
        try {
            await changeMyPassword(password);
            alert('Password berhasil diubah! Silakan lanjutkan.');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-amber-500 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Ganti Password</h2>
                    <p className="text-amber-100 text-sm mt-1">Demi keamanan, Anda wajib mengganti password default.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Password Baru</label>
                        <input 
                            type="password" 
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="Minimal 6 karakter"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Konfirmasi Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="Ulangi password baru"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        <span>Simpan Password Baru</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForceChangePassword;
