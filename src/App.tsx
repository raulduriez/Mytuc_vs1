import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Bus, 
  Radio, 
  Menu,
  X,
  User as UserIcon
} from 'lucide-react';
import AdminView from './components/AdminView';
import DriverView from './components/DriverView';
import CheckerView from './components/CheckerView';
import UserView from './components/UserView';
import CompanyView from './components/CompanyView';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard } from 'lucide-react';

import Logo from './components/Logo';

type Module = 'admin' | 'driver' | 'checker' | 'user' | 'company';

export default function App() {
  const [activeModule, setModule] = useState<Module>('user');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeModule]);

  const modules = [
    { id: 'user', name: 'Usuario Público', icon: UserIcon, color: 'bg-emerald-500' },
    { id: 'driver', name: 'Panel Conductor', icon: Radio, color: 'bg-blue-500' },
    { id: 'checker', name: 'Chequeador', icon: Bus, color: 'bg-amber-500' },
    { id: 'company', name: 'Control Empresa', icon: LayoutDashboard, color: 'bg-indigo-600' },
    { id: 'admin', name: 'Administrador', icon: ShieldCheck, color: 'bg-slate-700' },
  ];

  return (
    <div className="flex h-screen bg-immersive-bg text-slate-100 overflow-hidden font-sans relative">
      {/* Background Map Simulation Layer */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.1),_transparent_70%)]"></div>
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-slate-900/80 backdrop-blur-md rounded-lg shadow-lg border border-slate-700/50"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-1000/80 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex flex-col items-center gap-4 mb-10 pb-6 border-b border-white/5">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-blue-600/20 rounded-[2rem] blur-2xl group-hover:bg-blue-600/40 transition-all duration-700"></div>
                <Logo className="w-40 relative z-10 transition-transform duration-500 group-hover:scale-105" />
              </div>
            </div>

            <nav className="space-y-1.5">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModule(m.id as Module)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative
                    ${activeModule === m.id 
                      ? `${m.color} text-white shadow-lg` 
                      : 'hover:bg-white/5 text-slate-400 hover:text-slate-100'}
                  `}
                >
                  {activeModule === m.id && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-current opacity-20"
                    />
                  )}
                  <m.icon size={18} className={`${activeModule === m.id ? 'text-white' : 'group-hover:text-white'} transition-colors`} />
                  <span className="font-bold text-xs uppercase tracking-widest">{m.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-white/5 bg-white/2 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">SINCRONIZACIÓN</span>
            </div>
            <div className="text-[9px] text-center uppercase tracking-[0.2em] font-bold text-slate-600">
              Transporte Colectivo v2.4.0
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-950 overflow-hidden">
        {activeModule === 'admin' && <AdminView />}
        {activeModule === 'driver' && <DriverView />}
        {activeModule === 'checker' && <CheckerView />}
        {activeModule === 'user' && <UserView />}
        {activeModule === 'company' && <CompanyView />}
      </main>

      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </div>
  );
}
