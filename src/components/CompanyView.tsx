import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { 
  Building2, Bus, Shield, BarChart3, Users, 
  Download, Activity, Eye, Settings2, AlertTriangle, MapPin, Navigation, Timer
} from 'lucide-react';
import { Cooperative, Unit } from '../types';
import Logo from './Logo';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TERMINAL_210, KEY_STOPS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import * as XLSX from 'xlsx';

const busIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><i class="fas fa-bus text-white text-xs"></i></div>`,
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

type ManagerTab = 'dashboard' | 'monitor' | 'reportes';

export default function CompanyView() {
  const [activeTab, setActiveTab] = useState<ManagerTab>('dashboard');
  const [companyCode, setCompanyCode] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [company, setCompany] = useState<Cooperative | null>(null);
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [activeDispatches, setActiveDispatches] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuth || !companyCode) return;

    // Fetch Company Profile
    const coopRef = ref(db, `cooperativas/${companyCode}`);
    onValue(coopRef, (snapshot) => {
      setCompany(snapshot.val());
    });

    // Fetch Fleet for this company (Client-side filtering fallback for missing indexes)
    const unitsRef = ref(db, 'unidades');
    const unsubscribeUnits = onValue(unitsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allUnits = Object.entries(data).map(([id, val]: [string, any]) => ({ 
          ...val, 
          id,
          lat: typeof val.lat === 'string' ? parseFloat(val.lat) : val.lat,
          lng: typeof val.lng === 'string' ? parseFloat(val.lng) : val.lng
        }));
        setUnidades(allUnits.filter(u => 
          String(u.cooperativa).trim() === String(companyCode).trim() && 
          isValidLatLng(u.lat, u.lng)
        ));
      } else {
        setUnidades([]);
      }
    });

    // Fetch History for this company
    const histRef = ref(db, 'historial_operativo');
    const unsubscribeHist = onValue(histRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allHist = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setHistorial(allHist.filter((h: any) => String(h.cooperativa).trim() === String(companyCode).trim()).reverse());
      } else {
        setHistorial([]);
      }
    });

    // Fetch Alerts for this company
    const alertsRef = ref(db, 'alertas_flota');
    const unsubscribeAlerts = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allAlerts = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setAlertas(allAlerts.filter((a: any) => String(a.coop).trim() === String(companyCode).trim()).reverse());
      } else {
        setAlertas([]);
      }
    });

    // Global Stats for context (filtered where possible)
    onValue(ref(db, 'presencia'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setPresence(list);
      }
    });

    onValue(ref(db, 'stats/queries'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setQueries(list);
      }
    });

    const activeDispRef = ref(db, 'despachos_activos');
    const unsubscribeActiveDisp = onValue(activeDispRef, (snap) => {
      const data = snap.val();
      if (data) {
        const all = Object.entries(data).map(([id, val]: [string, any]) => ({ ...val, id }));
        setActiveDispatches(all.filter((d: any) => String(d.empresa).trim() === String(companyCode).trim()));
      } else {
        setActiveDispatches([]);
      }
    });

    return () => {
      unsubscribeUnits();
      unsubscribeHist();
      unsubscribeAlerts();
      unsubscribeActiveDisp();
    };
  }, [isAuth, companyCode]);

  const [reportType, setReportType] = useState<'operativo' | 'marcaciones'>('operativo');

  const stats = useMemo(() => {
    const active = unidades.filter(u => u.activo).length;
    const suspended = unidades.filter(u => u.bloqueado).length;
    const criticalAlerts = alertas.filter(a => Date.now() - a.timestamp < 3600000).length;
    
    return { active, suspended, criticalAlerts };
  }, [unidades, alertas]);

  const login = async () => {
    setLoading(true);
    const snap = await new Promise<any>((resolve) => {
      onValue(ref(db, `cooperativas/${companyCode}`), (snapshot) => resolve(snapshot.val()), { onlyOnce: true });
    });

    if (snap) {
      if (snap.bloqueado) {
        alert("Esta cooperativa está suspendida por la administración global.");
      } else {
        setIsAuth(true);
      }
    } else {
      alert("Código de empresa no válido");
    }
    setLoading(false);
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isAuth) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <Logo className="w-48 h-48 mx-auto mb-8 drop-shadow-[0_0_30px_rgba(37,99,235,0.3)]" />
            <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">MYTUC_EMPRESA</h1>
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em]">Acceso a Control de Flota Privado</p>
          </div>

          <div className="glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">CÓDIGO_ASIGNADO</label>
              <input 
                type="text" 
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                placeholder="EJ: TUC-001"
                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-xl font-black text-center tracking-[0.2em] outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase italic"
              />
            </div>
            <button 
              onClick={login}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "IDENTIFICANDO..." : "INGRESAR AL SISTEMA"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 lg:p-10 overflow-y-auto invisible-scrollbar bg-immersive-bg relative">
      {/* Styles for printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print { display: none !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #ddd !important; padding: 8px !important; color: black !important; font-size: 10px !important; }
          .bg-emerald-600, .bg-indigo-600 { background-color: transparent !important; color: black !important; }
          .glass-panel { border: none !important; background: transparent !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-10 pb-20 no-print">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div className="flex items-center gap-6">
            <Logo className="w-20 h-20 bg-white/5 rounded-2xl p-2 border border-white/5" />
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Sesión_Cooperativa</div>
                <div className="text-[10px] font-mono text-slate-500">ID: {companyCode}</div>
              </div>
              <h1 className="text-5xl font-black italic tracking-tighter uppercase italic underline underline-offset-8 decoration-emerald-500/30">
                {company?.nombre || 'Control_Empresa'}
              </h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-6 italic">Gestión de Activos y Supervisión de Marcaciones</p>
            </div>
          </div>
          
          <nav className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
            {(['dashboard', 'monitor', 'reportes'] as ManagerTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              >
                {tab === 'dashboard' && <BarChart3 size={16} />}
                {tab === 'monitor' && <Eye size={16} />}
                {tab === 'reportes' && <Download size={16} />}
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 shadow-xl group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                    <Bus size={24} />
                  </div>
                </div>
                <div className="text-4xl font-black italic tracking-tighter mb-1">{stats.active}</div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Flota Desplegada</div>
              </div>
              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 shadow-xl group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl">
                    <AlertTriangle size={24} />
                  </div>
                </div>
                <div className="text-4xl font-black italic tracking-tighter mb-1">{stats.criticalAlerts}</div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Alertas Recientes</div>
              </div>
              <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 shadow-xl group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                    <Timer size={24} />
                  </div>
                </div>
                <div className="text-4xl font-black italic tracking-tighter mb-1">{unidades.length}</div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Total Unidades Registradas</div>
              </div>
            </div>

            {/* Recent Alerts */}
            {alertas.length > 0 && (
              <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-xl bg-red-950/5">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-6 text-red-500 italic">
                  <AlertTriangle size={16} /> Monitor_de_Incidentes_Empresa
                </h3>
                <div className="space-y-4">
                   {alertas.slice(0, 5).map((a) => (
                     <div key={a.id} className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-red-500/10 hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                            <div>
                                <div className="text-[11px] font-black uppercase italic tracking-tight">{a.msj}</div>
                                <div className="text-[9px] text-slate-500 font-mono italic">{new Date(a.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="text-[10px] font-black bg-red-500 text-white px-3 py-1 rounded-full uppercase italic">U_{a.unidad}</div>
                     </div>
                   ))}
                </div>
              </div>
            )}
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
                          <h3 className="text-xs font-black uppercase tracking-widest leading-none mb-1">Radar de Flota Privado</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase italic">{stats.active} Unidades de {company?.nombre} Activas</p>
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
                              <div className="p-1 font-black text-xs uppercase tracking-tighter">Sede Central: Terminal 210</div>
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
                                      <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Empresa: {company?.nombre}</div>
                                      <div className="font-black text-emerald-400 text-lg italic">Unidad {u.numero}</div>
                                      <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold italic">Ruta: {u.ruta}</div>
                                      <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-slate-500 font-mono">Conductor: {u.conductor_nombre}</div>
                                  </div>
                              </Popup>
                          </SafeMarker>
                      ))}
                  </MapContainer>
              </div>
          </section>
        )}

        {activeTab === 'reportes' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 no-print">
             <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                   <h2 className="text-4xl font-black italic tracking-tighter uppercase italic">Centro_de_Informes</h2>
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Seleccione el tipo de auditoría para descarga o impresión</p>
                </div>
                <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
                   <button 
                     onClick={() => setReportType('operativo')}
                     className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${reportType === 'operativo' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
                   >
                     OPERACIONAL
                   </button>
                   <button 
                     onClick={() => setReportType('marcaciones')}
                     className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${reportType === 'marcaciones' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                   >
                     MARCACIONES
                   </button>
                </div>
             </div>

             <div className="flex gap-4 mb-4">
                {reportType === 'operativo' ? (
                  <>
                    <button 
                      onClick={() => exportToExcel(historial, `Reporte_Operacional_${companyCode}`)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Download size={16} /> DESCARGAR_EXCEL
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 border border-white/10"
                    >
                      <Activity size={16} /> IMPRIMIR_CONTROL
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => exportToExcel(historial.map(h => ({ 
                        Unidad: h.unidad, 
                        Ciclo: h.ciclo_actual || 1, 
                        P17: h.marcacion_P17, P17_Var: h.variacion_P17,
                        P24: h.marcacion_P24, P24_Var: h.variacion_P24,
                        P31: h.marcacion_P31, P31_Var: h.variacion_P31,
                        P48: h.marcacion_P48, P48_Var: h.variacion_P48,
                        P54: h.marcacion_P54, P54_Var: h.variacion_P54,
                        P66: h.marcacion_P66, P66_Var: h.variacion_P66,
                        P76: h.marcacion_P76, P76_Var: h.variacion_P76
                      })), `Reporte_Marcaciones_${companyCode}`)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Download size={16} /> DESCARGAR_CRONOGRAMA
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 border border-white/10"
                    >
                      <MapPin size={16} /> IMPRIMIR_AUDITORIA
                    </button>
                  </>
                )}
             </div>

             <div className="space-y-6 printable-report">
                {reportType === 'operativo' ? (
                  <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-2xl overflow-hidden relative print:shadow-none print:border-none print:p-0">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 mb-8 italic no-print">
                      <Activity className="text-emerald-500" size={16} /> I_CONTROL_OPERATIVO_FLOTA
                    </h3>
                    <div className="hidden print:block mb-6 border-b-2 border-black pb-4 text-black">
                      <h2 className="text-2xl font-black uppercase text-black">INFORME DE CONTROL OPERATIVO - {company?.nombre}</h2>
                      <p className="text-[10px] font-bold">Fecha de Generación: {new Date().toLocaleString()}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-separate border-spacing-y-2 print:border-collapse print:border-spacing-0">
                        <thead className="print:text-black">
                          <tr>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:text-black print:border-b">Fecha</th>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:text-black print:border-b">Unidad</th>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:text-black print:border-b">Conductor</th>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:text-black print:border-b">Salida</th>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:text-black print:border-b">Llegada</th>
                            <th className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center print:text-black print:border-b">Ciclo</th>
                          </tr>
                        </thead>
                        <tbody className="print:text-black">
                          {[...activeDispatches, ...historial].map((h) => (
                            <tr key={h.id} className="group bg-white/2 hover:bg-white/5 transition-colors print:bg-transparent print:border-b">
                              <td className="px-6 py-5 rounded-l-2xl text-[11px] font-mono text-slate-400 print:text-black">{h.fecha}</td>
                              <td className="px-6 py-5 text-sm font-black italic text-emerald-400 print:text-black">U_{h.unidad}</td>
                              <td className="px-6 py-5 text-xs font-bold text-slate-300 print:text-black">{h.conductor}</td>
                              <td className="px-6 py-5 text-xs font-black text-indigo-300 print:text-black">{h.hora_salida}</td>
                              <td className="px-6 py-5 text-xs font-black text-emerald-300 print:text-black">{h.hora_llegada || '--:--'}</td>
                              <td className="px-6 py-5 rounded-r-2xl text-center print:text-black">
                                <span className="bg-slate-900 border border-white/5 text-[10px] font-black px-4 py-1.5 rounded-full text-slate-400 print:border-none print:text-black">{h.ciclo_actual || 1}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-2xl overflow-hidden relative print:shadow-none print:border-none print:p-0">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 mb-8 italic no-print">
                      <MapPin className="text-indigo-500" size={16} /> II_CONTROL_MARCACIONES_RECORRIDO
                    </h3>
                    <div className="hidden print:block mb-6 border-b-2 border-black pb-4 text-black">
                      <h2 className="text-2xl font-black uppercase text-black">AUDITORÍA DE MARCACIONES AUTOMÁTICAS - {company?.nombre}</h2>
                      <p className="text-[10px] font-bold">Fecha de Generación: {new Date().toLocaleString()}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-separate border-spacing-y-2 print:border-collapse">
                        <thead>
                          <tr className="print:text-black">
                            <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:border-b">Unidad</th>
                            <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest print:border-b">Ciclo</th>
                            {['P17','P24','P31','P48','P54','P66','P76'].map(p => (
                              <th key={p} className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center print:border-b">{p}</th>
                            ))}
                              <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center print:border-b">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...activeDispatches, ...historial].map((h) => (
                              <tr key={h.id} className="group bg-white/2 hover:bg-white/5 transition-colors print:bg-transparent print:border-b">
                                <td className="px-4 py-5 rounded-l-2xl text-xs font-black italic underline decoration-indigo-500/30 print:text-black print:no-underline">U_{h.unidad}</td>
                                <td className="px-4 py-5 font-black text-[10px] text-slate-500 print:text-black">{h.ciclo_actual || 1}</td>
                                {['P17','P24','P31','P48','P54','P66','P76'].map(p => {
                                  const time = h[`marcacion_${p}`];
                                  const variance = h[`variacion_${p}`] || 0;
                                  const isLate = variance > 0;
                                  const isEarly = variance < 0;

                                  return (
                                    <td key={p} className="px-4 py-5 text-center print:text-black">
                                      <div className={`text-[10px] font-mono font-bold italic ${time ? (isLate ? 'text-red-500' : isEarly ? 'text-amber-500' : 'text-emerald-400') : 'text-slate-700'} print:text-black`}>
                                        {time || '--:--'}
                                      </div>
                                      {time && (
                                        <div className={`text-[8px] font-black ${isLate ? 'text-red-400' : isEarly ? 'text-amber-400' : 'text-emerald-500'} print:text-black`}>
                                          {variance === 0 ? 'OK' : (variance > 0 ? `+${variance}` : `${variance}`)}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-5 rounded-r-2xl text-center text-xs font-black text-indigo-400 print:text-black">
                                   {['P17','P24','P31','P48','P54','P66','P76'].filter(p => h[`marcacion_${p}`]).length}/7
                                </td>
                              </tr>
                            ))}
                          </tbody>
                      </table>
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
