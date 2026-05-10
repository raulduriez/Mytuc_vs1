import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, remove, update, push } from 'firebase/database';
import { 
  Building2, Bus, Shield, Plus, Lock, Unlock, Trash2, 
  MapPin, X, Cpu, Navigation, BarChart3, Users, 
  Download, Activity, Eye, Settings2, AlertTriangle 
} from 'lucide-react';
import { Cooperative, Unit } from '../types';
import Logo from './Logo';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TERMINAL_210, KEY_STOPS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import * as XLSX from 'xlsx';

// Custom icons
const busIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #10b981; width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); border: 2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const terminalIcon = L.divIcon({
  className: 'terminal-marker',
  html: `<div style="background-color: #fbbf24; width: 24px; height: 24px; border-radius: 6px; border: 3px solid white; box-shadow: 0 0 15px rgba(251, 191, 36, 0.6); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);"><div style="width: 10px; height: 10px; background-color: #1e293b; border-radius: 2px; transform: rotate(-45deg);"></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const stopIcon = L.divIcon({
  className: 'stop-marker',
  html: `<div style="background-color: #64748b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.2);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const isValidLatLng = (lat: any, lng: any) => {
  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lng === 'string' ? parseFloat(lng) : lng;

  return (
    typeof latitude === 'number' && 
    typeof longitude === 'number' && 
    !isNaN(latitude) && 
    !isNaN(longitude) && 
    Number.isFinite(latitude) && 
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
};

function SafeMarker({ position, icon, children, ...props }: any) {
  if (!position || !isValidLatLng(position[0], position[1])) return null;
  return <Marker position={position} icon={icon} {...props}>{children}</Marker>;
}

type AdminTab = 'dashboard' | 'monitor' | 'gestion' | 'soporte' | 'reportes';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [cooperativas, setCooperativas] = useState<Cooperative[]>([]);
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [activeDispatches, setActiveDispatches] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [adminChats, setAdminChats] = useState<any[]>([]);
  const [selectedChatPhone, setSelectedStopChatPhone] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [publicChat, setPublicChat] = useState<any[]>([]);
  const [newCoopName, setNewCoopName] = useState('');
  const [showUnitModal, setShowUnitModal] = useState(false);

  // New Unit Form State
  const [uCoopId, setUCoopId] = useState('');
  const [uNumero, setUNumero] = useState('');
  const [uRuta, setURuta] = useState('');

  const checkAccess = () => {
    if (password === '7070' || password === '2026') {
      setIsAdmin(true);
    } else {
      alert('Acceso Denegado');
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    
    // ... existings ...
    const coopsRef = ref(db, 'cooperativas');
    const unsubscribeCoops = onValue(coopsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: value.id || key,
          codigo: value.codigo || key
        }));
        setCooperativas(list);
      } else {
        setCooperativas([]);
      }
    });

    const unitsRef = ref(db, 'unidades');
    const unsubscribeUnits = onValue(unitsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: value.id || key,
          lat: typeof value.lat === 'string' ? parseFloat(value.lat) : value.lat,
          lng: typeof value.lng === 'string' ? parseFloat(value.lng) : value.lng
        })).filter((u: any) => isValidLatLng(u.lat, u.lng));
        setUnidades(list);
      } else {
        setUnidades([]);
      }
    });

    const presenceRef = ref(db, 'presencia');
    const unsubscribePresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setPresence(list);
      }
      else setPresence([]);
    });

    const queriesRef = ref(db, 'stats/queries');
    const unsubscribeQueries = onValue(queriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setQueries(list);
      }
      else setQueries([]);
    });

    const historialRef = ref(db, 'historial_operativo');
    const unsubscribeHistorial = onValue(historialRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setHistorial(list.reverse());
      }
      else setHistorial([]);
    });

    const alertasRef = ref(db, 'alertas_flota');
    const unsubscribeAlertas = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setAlertas(list.reverse());
      }
      else setAlertas([]);
    });

    const activeDispatchesRef = ref(db, 'despachos_activos');
    const unsubscribeActiveDispatches = onValue(activeDispatchesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setActiveDispatches(list);
      }
      else setActiveDispatches([]);
    });

    const blockedRef = ref(db, 'blocked_numbers');
    const unsubscribeBlocked = onValue(blockedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBlockedNumbers(Object.values(data));
      } else {
        setBlockedNumbers([]);
      }
    });

    const adminChatsRef = ref(db, 'chats_admin');
    const unsubscribeAdminChats = onValue(adminChatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAdminChats(Object.entries(data).map(([phone, messages]) => ({ phone, messages })));
      } else {
        setAdminChats([]);
      }
    });

    const publicChatRef = ref(db, 'chat_comunidad');
    const unsubscribePublicChat = onValue(publicChatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPublicChat(Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id })).slice(-30).reverse());
      } else {
        setPublicChat([]);
      }
    });

    return () => {
      unsubscribeCoops();
      unsubscribeUnits();
      unsubscribePresence();
      unsubscribeQueries();
      unsubscribeHistorial();
      unsubscribeAlertas();
      unsubscribeActiveDispatches();
      unsubscribeBlocked();
      unsubscribeAdminChats();
      unsubscribePublicChat();
    };
  }, [isAdmin]);

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const getDashboardStats = useMemo(() => {
    const activeUnits = unidades.filter(u => u.activo).length;
    const blockedUnits = unidades.filter(u => u.bloqueado).length;
    const activeUsers = presence.filter(p => Date.now() - p.lastSeen < 60000).length;
    const activeAlerts = alertas.filter(a => Date.now() - a.timestamp < 3600000).length; // last hour

    const queryStats = [
      { name: 'Reporte', value: queries.filter(q => q.text.includes('reporte')).length },
      { name: 'Emergencia', value: queries.filter(q => q.text.includes('emergencia') || q.text.includes('ayuda')).length },
      { name: 'Paradas', value: queries.filter(q => q.text.includes('parada')).length },
      { name: 'Otros', value: queries.filter(q => !q.text.includes('reporte') && !q.text.includes('parada') && !q.text.includes('emergencia')).length },
    ];

    return { activeUnits, blockedUnits, activeUsers, activeAlerts, queryStats };
  }, [unidades, presence, queries, alertas]);

  const registrarCooperativa = () => {
    if (!newCoopName) return alert('Ingrese nombre de empresa');
    const codigo = Math.floor(1000 + Math.random() * 8999).toString();
    set(ref(db, 'cooperativas/' + codigo), { 
      nombre: newCoopName, 
      codigo: codigo, 
      bloqueado: false 
    });
    setNewCoopName('');
  };

  const registrarUnidad = () => {
    if (!uCoopId || !uNumero || !uRuta) return alert('Complete todos los datos');
    
    const pinAcceso = Math.floor(1000 + Math.random() * 8999);
    const idUnidad = `UNI-${uCoopId}-${uNumero}`;
    
    set(ref(db, 'unidades/' + idUnidad), {
      id: idUnidad,
      cooperativa: uCoopId,
      numero: uNumero,
      ruta: uRuta,
      codigo_acceso: pinAcceso,
      activo: false,
      bloqueado: false,
      conductor_nombre: "Esperando conexión...",
      conductor_tel: ""
    }).then(() => {
      alert(`UNIDAD REGISTRADA\n\nPARA EL CONDUCTOR:\nCódigo Empresa: ${uCoopId}\nPIN de Acceso: ${pinAcceso}`);
      setShowUnitModal(false);
      setUNumero('');
      setURuta('');
    });
  };

  const blockNumber = (phone: string, reason: string = 'Comportamiento inapropiado') => {
    if (!phone) return;
    if (confirm(`¿Bloquear número ${phone}?`)) {
      set(ref(db, `blocked_numbers/${phone}`), {
        phone,
        reason,
        timestamp: Date.now()
      });
    }
  };

  const unblockNumber = (phone: string) => {
    remove(ref(db, `blocked_numbers/${phone}`));
  };

  const sendAdminReply = () => {
    if (!selectedChatPhone || !adminReply.trim()) return;
    push(ref(db, `chats_admin/${selectedChatPhone}`), {
      user: 'Admin',
      msg: adminReply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'admin'
    });
    setAdminReply('');
  };

  const clearBranch = (path: string, label: string) => {
    if (confirm(`¿Estás seguro de que deseas LIMPIAR TODOS los datos de ${label}? Esta acción no se puede deshacer.`)) {
      remove(ref(db, path)).then(() => alert(`${label} limpiado correctamente.`));
    }
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-immersive-bg relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="relative mb-12 z-10">
          <Logo className="w-48 h-48 drop-shadow-[0_0_50px_rgba(37,99,235,0.4)]" />
        </div>

        <div className="w-full max-w-sm glass-panel p-10 rounded-[3rem] space-y-8 z-10 border-white/5 shadow-2xl relative">
          <div className="text-center">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">MYTUC_ADMIN</h2>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] mt-2">Autorización de Seguridad Requerida</p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Clave de Acceso Maestra</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-center text-xl tracking-[0.5em] transition-all focus:ring-4 focus:ring-indigo-500/20 text-indigo-400"
                />
            </div>
            <button 
              onClick={checkAccess}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black p-5 rounded-2xl shadow-xl shadow-indigo-900/30 transition-all flex items-center justify-center gap-3 active:scale-95 group"
            >
              <Lock size={22} className="group-hover:rotate-12 transition-transform" />
              <span className="uppercase tracking-widest text-xs font-black">Verificar Credenciales</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 lg:p-10 overflow-y-auto invisible-scrollbar bg-immersive-bg relative">
      <div className="max-w-7xl mx-auto space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div className="flex items-center gap-6">
            <Logo className="w-20 h-20 bg-white/5 rounded-2xl p-2 border border-white/5" />
            <div>
              <div className="flex items-center gap-3 mb-2">
                  <div className="text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Administrador Activo</div>
                  <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Sistema en Línea</div>
              </div>
              <h1 className="text-5xl font-black italic tracking-tighter italic uppercase underline underline-offset-8 decoration-indigo-500/30">MYTUC</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-4">Centro de Gestión Cooperativa y Activos</p>
            </div>
          </div>
          
          <nav className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md overflow-x-auto invisible-scrollbar">
            {(['dashboard', 'monitor', 'gestion', 'soporte', 'reportes'] as AdminTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              >
                {tab === 'dashboard' && <BarChart3 size={16} />}
                {tab === 'monitor' && <Eye size={16} />}
                {tab === 'gestion' && <Settings2 size={16} />}
                {tab === 'soporte' && <Users size={16} />}
                {tab === 'reportes' && <Download size={16} />}
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Unidades Activas', value: getDashboardStats.activeUnits, icon: Bus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Usuarios Hoy', value: getDashboardStats.activeUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Alertas Sistema', value: getDashboardStats.activeAlerts, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Uni. Suspendidas', value: getDashboardStats.blockedUnits, icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
              ].map((stat, i) => (
                <div key={i} className="glass-panel p-8 rounded-[2.5rem] border-white/5 shadow-xl group hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl`}>
                      <stat.icon size={24} />
                    </div>
                  </div>
                  <div className="text-4xl font-black italic tracking-tighter mb-1">{stat.value}</div>
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Alerts Log in Dashboard */}
            {alertas.length > 0 && (
              <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-xl bg-red-950/5">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-red-500 italic">
                    <AlertTriangle size={16} /> Protocolo_Alertas_Criticas
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => clearBranch('alertas_emergencia', 'Alertas SOS')}
                      className="text-[9px] font-black uppercase tracking-widest text-red-400/50 hover:text-red-400 flex items-center gap-2 transition-all p-2 hover:bg-red-500/10 rounded-xl"
                    >
                      <Trash2 size={12} /> Limpiar SOS
                    </button>
                    <button 
                      onClick={() => clearBranch('alertas_flota', 'Alertas')}
                      className="text-[9px] font-black uppercase tracking-widest text-red-400/50 hover:text-red-400 flex items-center gap-2 transition-all p-2 hover:bg-red-500/10 rounded-xl"
                    >
                      <Trash2 size={12} /> Limpiar Alertas
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                   {alertas.slice(0, 3).map((a) => (
                     <div key={a.id} className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-red-500/10">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                            <div>
                                <div className="text-[11px] font-black uppercase italic tracking-tight">{a.msj}</div>
                                <div className="text-[9px] text-slate-500 font-mono">{new Date(a.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="text-[10px] font-black bg-red-500 text-white px-3 py-1 rounded-full uppercase italic">U_{a.unidad}</div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 italic">
                  <BarChart3 className="text-indigo-500" size={16} /> Frecuencia_Consultas_IA
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getDashboardStats.queryStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }}
                        itemStyle={{ color: '#818cf8', fontWeight: '900' }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 italic">
                  <Activity className="text-emerald-500" size={16} /> Distribución_Flota
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Activos', value: getDashboardStats.activeUnits },
                          { name: 'Suspendidos', value: getDashboardStats.blockedUnits },
                          { name: 'Offline', value: unidades.length - getDashboardStats.activeUnits - getDashboardStats.blockedUnits }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell key="cell-0" fill="#10b981" />
                        <Cell key="cell-1" fill="#ef4444" />
                        <Cell key="cell-2" fill="#334155" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <section className="glass-panel rounded-[3rem] p-4 border-white/5 shadow-2xl relative overflow-hidden h-[600px] animate-in fade-in zoom-in duration-500">
             <div className="absolute top-8 left-8 z-[1000] pointer-events-none">
                  <div className="glass-hud p-4 rounded-2xl flex items-center gap-4">
                      <div className="bg-emerald-500 p-2 rounded-xl text-white">
                          <Navigation size={20} className="rotate-45" />
                      </div>
                      <div>
                          <h3 className="text-xs font-black uppercase tracking-widest leading-none mb-1">Radar Global en Tiempo Real</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase italic">{unidades.filter(u => u.activo).length} Unidades Sincronizadas</p>
                      </div>
                  </div>
              </div>
              
              <div className="w-full h-full rounded-[2.5rem] overflow-hidden border border-white/5">
                  <MapContainer 
                    center={isValidLatLng(TERMINAL_210.lat, TERMINAL_210.lng) ? [TERMINAL_210.lat, TERMINAL_210.lng] : [12.1150, -86.2363]} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }} 
                    zoomControl={false}
                  >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      
                      {/* Terminal marker */}
                      <SafeMarker position={[TERMINAL_210.lat, TERMINAL_210.lng]} icon={terminalIcon}>
                          <Popup className="dark-popup">
                              <div className="p-1 font-black text-xs uppercase tracking-tighter">Punto Control Central: Terminal 210</div>
                          </Popup>
                      </SafeMarker>

                      {/* Routes/Stops markers */}
                      {KEY_STOPS.map(stop => (
                        <SafeMarker key={stop.id} position={[stop.lat, stop.lng]} icon={stopIcon}>
                            <Popup className="dark-popup">
                                <div className="text-[10px] font-black uppercase">{stop.name}</div>
                            </Popup>
                        </SafeMarker>
                      ))}

                      {unidades.filter(u => u.activo).map(u => (
                          <SafeMarker key={u.id} position={[u.lat!, u.lng!]} icon={busIcon}>
                              <Popup className="dark-popup">
                                  <div className="p-2">
                                      <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Unidad Identificada</div>
                                      <div className="font-black text-emerald-400 text-lg italic">Unidad {u.numero}</div>
                                      <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold italic">Ruta: {u.ruta}</div>
                                      <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-slate-500 font-mono">Última pos: {u.lat?.toFixed(4)}, {u.lng?.toFixed(4)}</div>
                                  </div>
                              </Popup>
                          </SafeMarker>
                      ))}
                  </MapContainer>
              </div>
          </section>
        )}

        {activeTab === 'gestion' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-center px-4">
               <div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase italic">Control_Activos</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Gestión Centralizada de Cooperativas y Unidades</p>
               </div>
               <button onClick={() => setShowUnitModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/40 flex items-center gap-2 transition-all active:scale-95">
                 <Plus size={18} /> ASIGNAR_NUEVA_UNIDAD
               </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {/* Cooperative Management */}
              <div className="glass-panel rounded-[3rem] p-10 space-y-8 border-white/5 shadow-2xl">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                            <Building2 size={24} className="text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black italic tracking-tight italic uppercase">Cooperativas / Empresas</h3>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Entidades Acreditadas en el Sistema</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <input 
                          type="text" 
                          value={newCoopName}
                          onChange={(e) => setNewCoopName(e.target.value)}
                          placeholder="NOMBRE_EMPRESA_O_COOPERATIVA"
                          className="flex-1 bg-slate-950/50 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black transition-all focus:ring-1 focus:ring-indigo-500 outline-none italic"
                        />
                        <button 
                          onClick={registrarCooperativa}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 px-8 rounded-2xl shadow-xl shadow-indigo-900/20 active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
                        >
                          REGISTRAR
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {cooperativas.map(coop => (
                            <div key={coop.codigo} className="glass-panel bg-white/2 hover:bg-white/5 p-6 rounded-2xl border-white/5 group transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-1.5 h-8 rounded-full ${coop.bloqueado ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} />
                                        <div>
                                            <div className="font-black text-sm uppercase italic tracking-tight">{coop.nombre}</div>
                                            <div className="text-[10px] text-indigo-400 font-mono font-black uppercase tracking-tighter mt-1">CÓDIGO_EMPRESA: <span className="text-white bg-indigo-500/20 px-2 rounded-lg text-sm">{coop.codigo}</span> • {unidades.filter(u => u.cooperativa === coop.codigo).length} Unidades</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => update(ref(db, 'cooperativas/' + coop.codigo), { bloqueado: !coop.bloqueado })}
                                            className={`p-3 rounded-xl transition-all border ${coop.bloqueado ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}
                                            title={coop.bloqueado ? "Autorizar Empresa" : "Suspender Empresa"}
                                        >
                                            {coop.bloqueado ? <Unlock size={16} /> : <Lock size={16} />}
                                        </button>
                                        <button 
                                            onClick={() => remove(ref(db, 'cooperativas/' + coop.codigo))}
                                            className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
              </div>

              {/* Units Management List */}
              <div className="space-y-6">
                <div className="glass-panel rounded-[3rem] p-10 border-white/5 shadow-2xl space-y-8 overflow-hidden relative">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 italic">
                        <Bus size={16} className="text-emerald-500" /> Inventario_Vehicular_Total
                    </h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {unidades.map(unit => {
                          const coop = cooperativas.find(c => c.codigo === unit.cooperativa);
                          return (
                            <div key={unit.id} className="glass-panel p-6 rounded-3xl border-white/5 flex flex-col gap-4 group hover:border-emerald-500/30 transition-all bg-white/2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${unit.activo ? 'bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]' : 'bg-slate-700'}`} />
                                        <div>
                                          <div className="font-black text-sm uppercase italic tracking-tighter">Unidad_{unit.numero}</div>
                                          <div className="text-[9px] text-slate-500 font-black uppercase">{coop?.nombre || 'Desconocido'}</div>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${unit.activo ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-white/10'}`}>
                                        {unit.activo ? 'ACTIVO_LINEA' : 'EN_ESPERA'}
                                    </span>
                                </div>
                                
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-950/30 rounded-xl space-y-1 border border-white/5">
                                        <span className="text-slate-500 text-[8px] font-black italic leading-none block uppercase">Ruta Sector</span>
                                        <span className="text-indigo-400 text-xs font-black italic">{unit.ruta}</span>
                                    </div>
                                    <div className="p-3 bg-indigo-500/10 rounded-xl space-y-1 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                                        <span className="text-indigo-400 text-[8px] font-black italic leading-none block uppercase">PIN DE ACCESO</span>
                                        <span className="text-white text-lg font-black tracking-widest font-mono">{unit.codigo_acceso}</span>
                                    </div>
                                  </div>

                                <div className="flex gap-2 pt-2">
                                    <button 
                                        onClick={() => update(ref(db, 'unidades/' + unit.id), { bloqueado: !unit.bloqueado })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${unit.bloqueado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                                    >
                                        {unit.bloqueado ? <Unlock size={14} /> : <Lock size={14} />}
                                        {unit.bloqueado ? 'RESTAURAR' : 'SUSPENDER'}
                                    </button>
                                    <button 
                                        onClick={() => remove(ref(db, 'unidades/' + unit.id))}
                                        className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                          );
                        })}
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'soporte' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Admin Chat List */}
            <div className="lg:col-span-2 glass-panel p-8 rounded-[3rem] border-white/5 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 italic">
                  <Users className="text-indigo-400" size={18} /> Atencion_Directa_Usuarios
                </h3>
                <button 
                  onClick={() => clearBranch('chats_admin', 'Mensajes Directos')}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 flex items-center gap-2 transition-all"
                >
                  <Trash2 size={12} /> LIMPIAR_CHATS
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
                <div className="bg-slate-950/30 rounded-2xl border border-white/5 overflow-y-auto invisible-scrollbar">
                  {adminChats.map(chat => (
                    <button 
                      key={chat.phone}
                      onClick={() => setSelectedStopChatPhone(chat.phone)}
                      className={`w-full p-4 text-left border-b border-white/5 transition-all ${selectedChatPhone === chat.phone ? 'bg-indigo-600 text-white' : 'hover:bg-white/5'}`}
                    >
                      <div className="text-xs font-black">Ref_{chat.phone.slice(-4)}</div>
                      <div className="text-[10px] opacity-60 font-mono">{chat.phone}</div>
                    </button>
                  ))}
                  {adminChats.length === 0 && <div className="p-10 text-center text-[10px] text-slate-700 font-black uppercase italic">Sin chats activos</div>}
                </div>
                
                <div className="md:col-span-2 flex flex-col bg-slate-950/20 rounded-2xl border border-white/5 p-4">
                  {selectedChatPhone ? (
                    <>
                      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                        {Object.values(adminChats.find(c => c.phone === selectedChatPhone)?.messages || {}).map((m: any, i) => (
                          <div key={i} className={`flex flex-col ${m.user === 'Admin' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-3 rounded-2xl max-w-[80%] text-xs ${m.user === 'Admin' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                              {m.msg}
                            </div>
                            <span className="text-[8px] text-slate-600 mt-1 uppercase font-black tracking-widest">{m.time}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={adminReply}
                          onChange={e => setAdminReply(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendAdminReply()}
                          placeholder="Escribir respuesta..."
                          className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button onClick={sendAdminReply} className="bg-indigo-600 p-3 rounded-xl hover:bg-indigo-500"><Navigation size={16} /></button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-50 space-y-4">
                      <Users size={48} />
                      <p className="text-[10px] font-black uppercase italic tracking-widest">Seleccione un chat para responder</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Public Chat Moderation & Blocked List */}
            <div className="space-y-6">
              <div className="glass-panel p-8 rounded-[3rem] border-white/5 space-y-6 bg-slate-900/30">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest italic flex items-center gap-2">
                    <Activity size={14} /> Monitor_Chat_Publico
                  </h3>
                  <button 
                    onClick={() => clearBranch('chat_comunidad', 'Chat Público')}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 flex items-center gap-2 transition-all"
                  >
                    <Trash2 size={12} /> LIMPIAR
                  </button>
                </div>
                <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {publicChat.map((m: any) => (
                    <div key={m.id} className="p-3 bg-white/2 rounded-xl border border-white/5 group relative">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-blue-400">{m.user}</span>
                        <button 
                          onClick={() => blockNumber(m.phone || '', `Spam en chat público: "${m.msg.slice(0, 20)}..."`)}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-red-500/20 text-red-400 rounded transition-all hover:bg-red-500 hover:text-white"
                          title="Bloquear Usuario"
                        >
                          <Lock size={10} />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">{m.msg}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-8 rounded-[3rem] border-red-500/10 bg-red-950/5 space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-red-400 italic">Lista_Negra_Suspendidos</h3>
                <div className="space-y-3">
                  {blockedNumbers.map(b => (
                    <div key={b.phone} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                      <div>
                        <div className="text-xs font-black text-white">{b.phone}</div>
                        <div className="text-[8px] text-slate-500 uppercase font-bold italic">{b.reason}</div>
                      </div>
                      <button onClick={() => unblockNumber(b.phone)} className="text-emerald-500 hover:text-emerald-400 transition-colors">
                        <Unlock size={14} />
                      </button>
                    </div>
                  ))}
                  {blockedNumbers.length === 0 && <p className="text-center text-[9px] text-slate-700 italic">No hay números bloqueados</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'reportes' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                   <h2 className="text-4xl font-black italic tracking-tighter uppercase italic">Centro_Informes_Empresa</h2>
                   <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1">Control de flota y marcaciones de paradas claves</p>
                </div>
                <div className="flex gap-4">
                   <button 
                    onClick={() => clearBranch('despachos_activos', 'Despachos Activos')}
                    className="bg-slate-900 border border-white/5 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
                   >
                     <Trash2 size={14} /> LIMPIAR_ACTIVOS
                   </button>
                   <button 
                    onClick={() => clearBranch('historial_operativo', 'Historial Operativo')}
                    className="bg-slate-900 border border-white/5 text-slate-500 hover:text-red-400 hover:border-red-500/30 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
                   >
                     <Trash2 size={14} /> LIMPIAR_HISTORIAL
                   </button>
                   <button 
                    onClick={() => exportToExcel(historial.map(h => ({
                      FECHA: h.fecha,
                      UNIDAD: h.unidad,
                      CONDUCTOR: h.conductor,
                      SALIDA: h.hora_salida,
                      LLEGADA: h.hora_llegada || '--:--',
                      CICLO: h.ciclo_actual || 1,
                      DURACION: h.timestamp_llegada ? `${Math.round((h.timestamp_llegada - h.timestamp_salida) / 60000)} min` : 'En curso'
                    })), `Informe_Operaciones_${Date.now()}`)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                   >
                     <Download size={14} /> EXPORTAR_GENERAL
                   </button>
                   <button 
                    onClick={() => exportToExcel(historial.map(h => ({
                      UNIDAD: h.unidad,
                      CICLO: h.ciclo_actual || 1,
                      P17: h.marcacion_P17 || '--:--',
                      P24: h.marcacion_P24 || '--:--',
                      P31: h.marcacion_P31 || '--:--',
                      P48: h.marcacion_P48 || '--:--',
                      P54: h.marcacion_P54 || '--:--',
                      P66: h.marcacion_P66 || '--:--',
                      P76: h.marcacion_P76 || '--:--',
                    })), `Informe_Marcaciones_${Date.now()}`)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                   >
                     <Download size={14} /> EXPORTAR_PARADAS
                   </button>
                </div>
             </div>

             <div className="space-y-12">
                {/* Operational Table */}
                <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-2xl overflow-hidden relative">
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 mb-8 italic">
                      <Activity className="text-indigo-500" size={16} /> I_OPERACIONAL_FLOTA
                   </h3>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Unidad</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Conductor</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">H. Salida</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">H. Llegada</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Duración</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ciclo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {[...activeDispatches, ...historial].map((h) => (
                            <tr key={h.id} className="group hover:bg-white/2">
                              <td className="py-4 text-[11px] font-mono text-slate-400">{h.fecha}</td>
                              <td className="py-4 text-xs font-black italic">{h.unidad}</td>
                              <td className="py-4 text-xs font-bold text-slate-300">{h.conductor}</td>
                              <td className="py-4 text-xs font-black text-indigo-400">{h.hora_salida}</td>
                              <td className="py-4 text-xs font-black text-emerald-400">{h.hora_llegada || '--:--'}</td>
                              <td className="py-4 text-[10px] font-black uppercase text-slate-500">
                                {h.timestamp_llegada ? `${Math.round((h.timestamp_llegada - h.timestamp_salida) / 60000)} MIN` : 'EN_CURSO'}
                              </td>
                              <td className="py-4">
                                <span className="bg-slate-800 text-[10px] font-black px-3 py-1 rounded-full">{h.ciclo_actual || 1}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>

                {/* Key Stops Table */}
                <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-2xl overflow-hidden relative">
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 mb-8 italic">
                      <MapPin className="text-emerald-500" size={16} /> II_MARCACIONES_CLAVES
                   </h3>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Unidad</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Ciclo</th>
                            {['P17','P24','P31','P48','P54','P66','P76'].map(p => (
                              <th key={p} className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{p}</th>
                            ))}
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Pts</th>
                            <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {[...activeDispatches, ...historial].map((h) => (
                            <tr key={h.id} className="group hover:bg-white/2">
                              <td className="py-4 text-xs font-black italic underline decoration-emerald-500/30">{h.unidad}</td>
                              <td className="py-4 text-[10px] font-black px-4">{h.ciclo_actual || 1}</td>
                            {['P17','P24','P31','P48','P54','P66','P76'].map(p => {
                                const time = h[`marcacion_${p}`];
                                const variance = h[`variacion_${p}`] || 0;
                                const isLate = variance > 0;
                                const isEarly = variance < 0;
                                
                                return (
                                  <td key={p} className="py-4 text-[10px] font-mono font-bold px-2">
                                     <div className={`${time ? (isLate ? 'text-red-500' : isEarly ? 'text-amber-500' : 'text-emerald-400') : 'text-slate-700'}`}>
                                        {time || '--:--'}
                                     </div>
                                     {time && (
                                       <div className={`text-[8px] opacity-70 ${isLate ? 'text-red-400' : isEarly ? 'text-amber-400' : 'text-emerald-500'}`}>
                                         {variance === 0 ? 'OK' : (variance > 0 ? `+${variance}` : `${variance}`)}
                                       </div>
                                     )}
                                  </td>
                                );
                              })}
                              <td className="py-4 text-xs font-black text-emerald-500 px-2 text-center">
                                 {['P17','P24','P31','P48','P54','P66','P76'].filter(p => h[`marcacion_${p}`]).length}
                              </td>
                              <td className="py-4">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${h.hora_llegada ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                   {h.hora_llegada ? 'FINALIZADO' : 'EN_CAMINO'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  { [
                    { title: 'Inventario de Unidades', data: unidades, file: 'Inventario_Unidades', desc: 'Listado total de unidades por cooperativa, rutas y códigos de acceso.', clear: null },
                    { title: 'Registro de Cooperativas', data: cooperativas, file: 'Registro_Cooperativas', desc: 'Base de datos de empresas acreditadas y su estado de operación.', clear: null },
                    { title: 'Registro de Consultas IA', data: queries, file: 'Estadisticas_Consultas', desc: 'Historial de comandos de voz realizados por los usuarios.', clear: 'stats/queries' },
                    { title: 'Registro de Presencia', data: presence, file: 'Presencia_Usuarios', desc: 'Monitoreo de actividad de usuarios en la plataforma.', clear: 'presencia' },
                  ].map((item, i) => (
                    <div key={i} className="glass-panel p-8 rounded-[2.5rem] border-white/5 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-black italic uppercase tracking-tight italic opacity-80">{item.title}</h3>
                        {item.clear && (
                          <button 
                            onClick={() => clearBranch(item.clear!, item.title)}
                            className="text-slate-700 hover:text-red-500 transition-colors p-1"
                            title="Limpiar Datos"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-6 h-10 overflow-hidden">{item.desc}</p>
                      <button 
                        onClick={() => exportToExcel(item.data, `${item.file}_${new Date().toLocaleDateString()}`)}
                        className="w-full bg-slate-900 hover:bg-indigo-600 text-slate-500 hover:text-white p-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] border border-white/5 transition-all flex items-center justify-center gap-3 active:scale-95"
                      >
                        <Download size={14} /> DESCARGAR
                      </button>
                    </div>
                  ))}
             </div>
          </div>
        )}
      </div>

      {/* Modal: Deployment */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-1000/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg glass-panel p-10 rounded-[3.5rem] border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
            
            <div className="flex justify-between items-start mb-10">
                <div>
                     <h3 className="text-3xl font-black italic tracking-tighter italic uppercase underline underline-offset-4 decoration-emerald-500/30">Asignación_Vehículos</h3>
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Inicializando perfil de hardware</p>
                </div>
                <button onClick={() => setShowUnitModal(false)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                    <X size={20} className="text-slate-400" />
                </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Fuente de Asignación de Activo</label>
                <div className="relative">
                    <select 
                      value={uCoopId}
                      onChange={(e) => setUCoopId(e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-sm font-black italic tracking-tight appearance-none outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option key="default-coop" value="" className="bg-slate-900">SELECCIONAR_COOPERATIVA</option>
                      {cooperativas.map(c => <option key={c.codigo} value={c.codigo} className="bg-slate-900 uppercase font-black">{c.nombre}</option>)}
                    </select>
                    <Building2 className="absolute right-5 top-5 text-slate-600 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Secuencia Unidad</label>
                    <input 
                      type="text" 
                      value={uNumero}
                      onChange={(e) => setUNumero(e.target.value)}
                      placeholder="ej. 102"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-sm font-black font-mono transition-all focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Patrón de Sector</label>
                    <input 
                      type="text" 
                      value={uRuta}
                      onChange={(e) => setURuta(e.target.value)}
                      placeholder="Sector 114"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-sm font-black italic transition-all focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                </div>
              </div>

              <button 
                onClick={registrarUnidad}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] italic shadow-2xl shadow-emerald-900/30 active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <Cpu size={22} className="group-hover:animate-spin transition-all duration-1000" /> CONFIRMAR_DESPLIEGUE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
