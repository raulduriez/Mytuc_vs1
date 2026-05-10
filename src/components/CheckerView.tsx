import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, update, onValue, get, remove } from 'firebase/database';
import { Bus, User, Phone, MapPin, Search, ArrowRight, ArrowLeft, Clock, ShieldCheck, CheckCircle2, Power, Navigation } from 'lucide-react';
import { Dispatch, Unit } from '../types';
import Logo from './Logo';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TERMINAL_210, KEY_STOPS } from '../constants';

const busIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f59e0b; width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); border: 2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="17" cy="18" r="2"/></svg></div>`,
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

export default function CheckerView() {
  const [empresaCode, setEmpresaCode] = useState('');
  const [checkerName, setCheckerName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [unitNum, setUnitNum] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setPhone] = useState('');
  const [ciclo, setCiclo] = useState('1');
  
  const [searchQuery, setSearchSearchQuery] = useState('');
  const [searchResult, setSearchSearchResult] = useState<Dispatch | null>(null);
  const [lastEvents, setLastEvents] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unit[]>([]);

  useEffect(() => {
    if (!empresaCode) return;
    
    // Fleet live tracking
    const unitsRef = ref(db, 'unidades');
    const unsubUnits = onValue(unitsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const all = Object.entries(data).map(([id, val]: [string, any]) => ({ 
          ...val, 
          id,
          lat: typeof val.lat === 'string' ? parseFloat(val.lat) : val.lat,
          lng: typeof val.lng === 'string' ? parseFloat(val.lng) : val.lng
        }));
        setUnidades(all.filter(u => 
          String(u.cooperativa).trim() === String(empresaCode).trim() && 
          isValidLatLng(u.lat, u.lng)
        ));
      }
    });

    const q = ref(db, `despachos_activos`);
    const unsub = onValue(q, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ ...val, id }))
          .filter((d: any) => d.empresa === empresaCode)
          .sort((a: any, b: any) => (b.ultima_actualizacion || 0) - (a.ultima_actualizacion || 0));
        setLastEvents(list);
      }
    });
    return () => {
      unsubUnits();
      unsub();
    };
  }, [isLogged, empresaCode]);

  const login = async () => {
    if (!empresaCode) return alert("CÓDIGO EMPRESA REQUERIDO");
    setLoading(true);
    try {
      // Validar empresa
      const snap = await get(ref(db, `cooperativas/${empresaCode}`));
      if (!snap.exists()) {
        setLoading(false);
        return alert(`LA EMPRESA [${empresaCode}] NO EXISTE EN EL SISTEMA`);
      }

      setIsLogged(true);
      // Log presence
      await set(ref(db, 'presencia_chequeadores/' + empresaCode + '/' + (checkerName || 'anon')), { 
        activa: true, 
        ultima_conexion: Date.now(),
        nombre: checkerName
      });
    } catch (e) {
      alert("Error de conexión");
    }
    setLoading(false);
  };

  const registrarSalida = () => {
    if (!unitNum || !driverName) return alert("COMPLETE DATOS DE UNIDAD");
    
    const id = unitNum.padStart(3, '0');
    const busId = 'bus-' + id;
    const ahora = Date.now();
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const data: Dispatch = {
      unidad: id,
      conductor: driverName,
      telefono: driverPhone,
      fecha: new Date().toLocaleDateString(),
      hora_salida: hora,
      timestamp_salida: ahora,
      ciclo_actual: parseInt(ciclo),
      estado: "En Ruta",
      empresa: empresaCode,
      supervisor_despacho: checkerName || "Chequeador",
      ultima_actualizacion: ahora,
      despacho_activo: true
    };

    set(ref(db, 'buses/' + busId), data);
    set(ref(db, 'despachos_activos/' + id), data);
    
    alert(`UNIDAD ${id} EN RUTA`);
    setUnitNum('');
    setDriverName('');
    setPhone('');
  };

  const buscarUnidad = async () => {
    if (!searchQuery) return;
    const id = searchQuery.padStart(3, '0');
    const snapshot = await get(ref(db, 'buses/bus-' + id));
    const data = snapshot.val() as Dispatch;
    if (data && data.empresa === empresaCode && data.despacho_activo) {
      setSearchSearchResult(data);
    } else {
      setSearchSearchResult(null);
    }
  };

  const registrarLlegada = async (id: string) => {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const busId = 'bus-' + id;
    
    // Get current dispatch data before finishing
    const snapshot = await get(ref(db, 'buses/' + busId));
    const data = snapshot.val() as Dispatch;

    if (data) {
      const finalData = {
        ...data,
        hora_llegada: hora,
        timestamp_llegada: Date.now(),
        estado: "Finalizado",
        despacho_activo: false,
        ultima_actualizacion: Date.now()
      };

      // Archive in history
      const historyId = `${id}-${data.timestamp_salida}`;
      await set(ref(db, `historial_operativo/${historyId}`), finalData);
      
      // Update bus state
      await update(ref(db, 'buses/' + busId), {
        estado: "En Terminal",
        despacho_activo: false,
        ultima_actualizacion: Date.now(),
        hora_llegada: hora
      });

      // Update unit in global list too if active
      const unitSnap = await get(ref(db, 'unidades'));
      if (unitSnap.exists()) {
        const units = unitSnap.val();
        const unitKey = Object.keys(units).find(k => String(units[k].numero) === String(id) && String(units[k].cooperativa) === String(empresaCode));
        if (unitKey) {
          update(ref(db, 'unidades/' + unitKey), { activo: false });
        }
      }
    }

    remove(ref(db, 'despachos_activos/' + id));
    alert("LLEGADA REGISTRADA Y ARCHIVADA");
    setSearchSearchResult(null);
    setSearchSearchQuery('');
  };

  if (!isLogged) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-immersive-bg relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(rgba(251, 191, 36, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="relative mb-8 z-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse group-hover:bg-amber-500/40 transition-all duration-1000"></div>
            <Logo className="w-44 mx-auto relative z-10 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
          </div>
        </div>

        <div className="w-full max-w-sm glass-panel p-10 rounded-[3rem] space-y-8 z-10 border-white/5 shadow-2xl relative">
          <div className="text-center">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">MYTUC_CHECKER</h2>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] mt-2">Autenticación de Despacho Activa</p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 font-black">Identificador Empresa</label>
                    <input 
                      type="text" 
                      value={empresaCode}
                      onChange={(e) => setEmpresaCode(e.target.value)}
                      placeholder="ej. 210"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-center text-xl font-black transition-all focus:ring-4 focus:ring-amber-500/20 text-amber-500 italic"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">ID Supervisor</label>
                    <input 
                      type="text" 
                      value={checkerName}
                      onChange={(e) => setCheckerName(e.target.value)}
                      placeholder="Nombre Supervisor"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 text-center text-sm font-black focus:ring-4 focus:ring-amber-500/20 outline-none"
                    />
                </div>
            </div>
            <button 
              onClick={login}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black p-5 rounded-2xl shadow-xl shadow-amber-900/30 transition-all flex items-center justify-center gap-3 active:scale-95 group font-black uppercase tracking-widest text-xs italic disabled:opacity-50"
            >
              <Power size={20} className="group-hover:rotate-12 transition-transform" /> {loading ? 'Identificando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 lg:p-10 overflow-y-auto invisible-scrollbar bg-immersive-bg relative">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div className="flex items-center gap-6">
            <Logo className="w-20 h-20 bg-white/5 rounded-2xl p-2 border border-white/5" />
            <div>
                 <div className="flex items-center gap-3 mb-2">
                    <div className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-amber-500/20">Sector Operativo: {empresaCode}</div>
                    <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse italic"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Obteniendo Datos</div>
                </div>
                <h1 className="text-5xl font-black italic tracking-tighter italic uppercase underline underline-offset-8 decoration-amber-500/30">MYTUC</h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-4">Observador Verificado: <span className="text-white italic">{checkerName || 'ROOT_ACCESS'}</span></p>
            </div>
          </div>
          
          <div className="bg-emerald-500/5 text-emerald-400 px-6 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 border border-emerald-500/10 shadow-inner">
            <CheckCircle2 size={18} /> Sincronización Maestra: En Línea
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* Map Integration */}
          <section className="glass-panel rounded-[3rem] p-4 border-white/5 shadow-2xl relative overflow-hidden h-[600px] xl:h-auto animate-in slide-in-from-left-8 duration-700">
             <div className="absolute top-8 left-8 z-[1000] pointer-events-none">
                  <div className="glass-hud p-4 rounded-2xl flex items-center gap-4">
                      <div className="bg-amber-500 p-2 rounded-xl text-slate-950 font-black">
                          <Navigation size={20} className="rotate-45" />
                      </div>
                      <div>
                          <h3 className="text-xs font-black uppercase tracking-widest leading-none mb-1">Radar de Sección Local</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase italic">{unidades.filter(u => u.activo).length} Unidades en Red</p>
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
                              <div className="p-1 font-black text-xs uppercase tracking-tighter text-amber-500">Punto de Control: Terminal 210</div>
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
                                  <div className="p-3">
                                      <div className="text-[10px] text-amber-500 font-black uppercase mb-1">Unidad_ACTIVA</div>
                                      <div className="font-black text-slate-200 text-lg italic">U_{u.numero}</div>
                                      <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold italic">Ruta: {u.ruta}</div>
                                      <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-slate-500 font-mono italic">Piloto: {u.conductor_nombre}</div>
                                  </div>
                              </Popup>
                          </SafeMarker>
                      ))}
                  </MapContainer>
              </div>
          </section>

          {/* Departure Section */}
          <section className="glass-panel rounded-[3rem] p-10 space-y-8 border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-amber-500/10 transition-all duration-700"></div>
            <h2 className="text-2xl font-black italic flex items-center gap-3 text-amber-500 uppercase tracking-tight italic">
              <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform duration-500" /> Salida_Vehículo
            </h2>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 font-black">Referencia Unidad</label>
                <input 
                  type="number" 
                  value={unitNum} 
                  onChange={e => setUnitNum(e.target.value)} 
                  placeholder="000" 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-2xl font-black font-mono tracking-widest focus:ring-1 focus:ring-amber-500 outline-none italic" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Ciclo_Misión</label>
                <div className="relative">
                    <select 
                      value={ciclo} 
                      onChange={e => setCiclo(e.target.value)} 
                      className="w-full h-[76px] bg-slate-950/50 border border-white/5 rounded-2xl px-6 font-black italic tracking-widest appearance-none outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-sm font-black"
                    >
                      <option value="1" className="bg-slate-900 uppercase underline">CICLO_01 (ALFA)</option>
                      <option value="2" className="bg-slate-900 uppercase underline">CICLO_02 (BRAVO)</option>
                      <option value="3" className="bg-slate-900 uppercase underline">CICLO_03 (GAMMA)</option>
                      <option value="4" className="bg-slate-900 uppercase underline">CICLO_04 (DELTA)</option>
                      <option value="5" className="bg-slate-900 uppercase underline">CICLO_05 (EPSILON)</option>
                    </select>
                    <Clock className="absolute right-6 top-7 text-slate-600 pointer-events-none" size={20} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Designación Piloto</label>
                <div className="relative group/input">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-amber-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={driverName} 
                      onChange={e => setDriverName(e.target.value)} 
                      placeholder="Nombre Conductor" 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic transition-all focus:ring-1 focus:ring-amber-500 outline-none" 
                    />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Enlace Comunicaciones</label>
                <div className="relative group/input">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-amber-500 transition-colors" size={18} />
                    <input 
                      type="tel" 
                      value={driverPhone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="No. Registro" 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black font-mono focus:ring-1 focus:ring-amber-500 outline-none" 
                    />
                </div>
              </div>
            </div>

            <button 
              onClick={registrarSalida}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black p-6 rounded-[2rem] shadow-2xl shadow-amber-900/30 active:scale-95 transition-all flex items-center justify-center gap-4 mt-4 uppercase tracking-[0.3em] text-xs font-black italic"
            >
              <Bus size={24} /> INICIALIZAR_SALIDA
            </button>
          </section>

          {/* Arrival Section */}
          <section className="space-y-10">
            <div className="glass-panel rounded-[3rem] p-10 space-y-8 border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-all duration-700"></div>
              <h2 className="text-2xl font-black italic flex items-center gap-3 text-blue-400 uppercase tracking-tight italic">
                <ArrowLeft size={24} className="group-hover:translate-x-[-8px] transition-transform duration-500" /> Registro_Llegada
              </h2>
              
              <div className="flex gap-3">
                <div className="relative flex-1 group/search">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/search:text-blue-400 transition-colors" size={20} />
                    <input 
                      type="number" 
                      value={searchQuery} 
                      onChange={e => setSearchSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && buscarUnidad()}
                      placeholder="Escanear unidad..." 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-16 pr-6 py-5 font-black italic tracking-widest text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                    />
                </div>
                <button 
                  onClick={buscarUnidad}
                  className="bg-blue-600 hover:bg-blue-500 p-5 rounded-2xl shadow-xl shadow-blue-900/40 active:scale-90 transition-all border-none"
                >
                  <Search size={24} />
                </button>
              </div>

              {searchResult && (
                <div className="glass-hud bg-blue-500/5 border-white/10 p-8 rounded-[2rem] flex flex-col gap-6 border-l-8 border-blue-500 animate-in slide-in-from-right-8 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="text-2xl font-black italic tracking-tighter italic text-white flex items-center gap-3 underline decoration-blue-500/30 underline-offset-4">
                          <Bus size={24} className="text-blue-400" /> UNIDAD_{searchResult.unidad}
                      </div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">{searchResult.conductor}</div>
                      <div className="flex gap-2 mt-2">
                         <div className="text-[9px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-md border border-blue-500/20 font-black italic">HORA_SALIDA: {searchResult.hora_salida}</div>
                         <div className="text-[9px] bg-amber-500/10 text-amber-400 px-3 py-1 rounded-md border border-amber-500/20 font-black italic">CICLO: {searchResult.ciclo_actual}/5</div>
                         <div className="text-[9px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-md border border-emerald-500/20 font-black italic">PUNTOS: {['P17','P24','P31','P48','P54','P66','P76'].filter(p => (searchResult as any)[`marcacion_${p}`]).length}/7</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => registrarLlegada(searchResult.unidad)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-xl shadow-2xl shadow-emerald-900/40 active:scale-95 transition-all text-[10px] uppercase tracking-widest italic"
                    >
                      TERMINAR_CICLO
                    </button>
                  </div>

                  <div className="p-6 bg-slate-950/50 rounded-2xl border border-white/5 space-y-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <MapPin size={14} className="text-amber-500" /> Monitoreo de Escalas Automáticas (Geofencing)
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-2">
                       {['P17','P24','P31','P48','P54','P66','P76'].map(p => {
                         const time = (searchResult as any)[`marcacion_${p}`];
                         const variance = (searchResult as any)[`variacion_${p}`] || 0;
                         const isLate = variance > 0;
                         const isEarly = variance < 0;

                         return (
                           <div key={p} className={`p-2 rounded-lg text-[9px] font-mono text-center border transition-all ${ 
                             time 
                               ? (isLate ? 'bg-red-500/10 border-red-500/20 text-red-500' : isEarly ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400') 
                               : 'bg-slate-900/50 border-white/5 text-slate-600' 
                           }`}>
                              <div className="font-black mb-1">{p}</div>
                              <div className="font-bold">{time || '--:--'}</div>
                              {time && (
                                <div className="text-[7px] font-black mt-1 uppercase">
                                  {variance === 0 ? 'OK' : (variance > 0 ? `+${variance}` : `${variance}`)}
                                </div>
                              )}
                           </div>
                         );
                       })}
                    </div>
                    <p className="text-[8px] text-slate-600 italic mt-2 uppercase font-bold tracking-tighter">* Marcación automática activada por aproximación GPS de la unidad</p>
                  </div>
                </div>
              )}
            </div>

            {/* Connected Drivers Feed */}
            <div className="glass-panel bg-white/2 border-white/5 rounded-[3rem] p-10 shadow-inner">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 flex items-center gap-3 italic">
                <Clock size={16} className="text-amber-500" /> Flujo_Log_Transaccional
              </h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar text-[10px] font-mono">
                 {lastEvents.length === 0 ? (
                   <div className="text-slate-700 py-12 text-center uppercase tracking-[0.2em] italic bg-white/1 border border-dashed border-white/5 rounded-2xl">Esperando actualizaciones del sistema...</div>
                 ) : (
                   lastEvents.map((evt) => (
                     <div key={evt.id} className="bg-white/2 border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="text-emerald-500 font-black italic">U_{evt.unidad}</div>
                           <div className="w-px h-4 bg-white/10" />
                           <div className="text-slate-500">{evt.conductor}</div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 lowercase">ciclo {evt.ciclo_actual}</div>
                           <div className="text-slate-600 italic">{new Date(evt.ultima_actualizacion || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                     </div>
                   ))
                 )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
