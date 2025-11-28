import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import InputForm from './components/InputForm';
import UserManagement from './components/UserManagement';
import Sellthru from './components/Sellthru';
import TopupSaldo from './components/TopupSaldo';
import BucketTransaksi from './components/BucketTransaksi';
import ListSN from './components/ListSN';
import ForceChangePassword from './components/ForceChangePassword';
import { User, SerialNumber } from './types';
import { getSerialNumbers } from './services/storage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('home');
  const [data, setData] = useState<SerialNumber[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('sn_user_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user && !user.mustChangePassword) {
        loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
        const res = await getSerialNumbers();
        setData(res);
    } catch (error) {
        console.error("Failed to load SN data", error);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('sn_user_session', JSON.stringify(loggedInUser));
    setCurrentView('home');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sn_user_session');
    localStorage.removeItem('sn_token');
    setCurrentView('home');
  };

  const handlePasswordChanged = () => {
    if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        localStorage.setItem('sn_user_session', JSON.stringify(updatedUser));
        loadData();
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.mustChangePassword) {
    return <ForceChangePassword onSuccess={handlePasswordChanged} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home data={data} user={user} />;
      case 'dashboard':
        return <Dashboard data={data} user={user} refreshData={loadData} />;
      case 'sellthru':
        return <Sellthru data={data} user={user} />;
      case 'topup':
        return <TopupSaldo user={user} />;
      case 'bucket':
        return <BucketTransaksi user={user} />;
      case 'listsn':
        return <ListSN user={user} data={data} />; 
      case 'input':
        return <InputForm onSuccess={() => {
          loadData();
          setCurrentView('dashboard');
        }} />;
      case 'users':
        return <UserManagement />;
      default:
        return <Home data={data} user={user} />;
    }
  };

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout}
      currentView={currentView}
      setCurrentView={setCurrentView}
    >
      {renderView()}
    </Layout>
  );
};

export default App;