import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, query, orderByChild, equalTo, get, set, push, remove } from 'firebase/database';
import { Radio, Satellite, MapPin, Power, User, Phone, CheckCircle2, AlertTriangle, Timer, Navigation } from 'lucide-react';
import { Unit } from '../types';
import { KEY_STOPS } from '../constants';
import Logo from './Logo';

function getDistanceInMeters(lat1: any, lon1: any, lat2: any, lon2: any) {
  const latitude1 = typeof lat1 === 'string' ? parseFloat(lat1) : lat1;
  const longitude1 = typeof lon1 === 'string' ? parseFloat(lon1) : lon1;
  const latitude2 = typeof lat2 === 'string' ? parseFloat(lat2) : lat2;
  const longitude2 = typeof lon2 === 'string' ? parseFloat(lon2) : lon2;

  if (isNaN(latitude1) || isNaN(longitude1) || isNaN(latitude2) || isNaN(longitude2)) return 999999;

  const R = 6371e3; // metres
  const φ1 = latitude1 * Math.PI / 180;
  const φ2 = latitude2 * Math.PI / 180;
  const Δφ = (latitude2 - latitude1) * Math.PI / 180;
  const Δλ = (longitude2 - longitude1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DriverView() {
  const [empresaCode, setEmpresaCode] = useState('');
  const [unitNum, setUnitNum] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isActive, setIsActive] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [currentViajeId, setCurrentViajeId] = useState<string | null>(null);
  const markedStops = useRef<Set<string>>(new Set());
  const lastPosTime = useRef<number>(Date.now());
  const stoppedAlertActive = useRef(false);

  // Persistence check on mount
  useEffect(() => {
    const saved = localStorage.getItem('driver_session');
    if (saved) {
      try {
        const { empresaCode: sEmpresa, unitNum: sUnitNum, name: sName, phone: sPhone, voyageId: sVoyageId, unit: sUnit } = JSON.parse(saved);
        setEmpresaCode(sEmpresa);
        setUnitNum(sUnitNum);
        setName(sName);
        setPhone(sPhone);
        setCurrentViajeId(sVoyageId);
        setCurrentUnit(sUnit);
        setIsActive(true);
        
        // Load already marked stops from firebase for this voyage
        const voyageRef = ref(db, `viajes_activos/${sVoyageId}`);
        get(voyageRef).then(snap => {
          if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(key => {
              if (key.startsWith('marcacion_')) {
                const stopId = key.replace('marcacion_', '');
                markedStops.current.add(stopId);
              }
            });
          }
        });
      } catch (e) {
        console.error("Error loading saved session", e);
        localStorage.removeItem('driver_session');
      }
    }
  }, []);

  useEffect(() => {
    let watchId: number;
    let stopCheckInterval: any;

    if (isActive && currentUnit && currentViajeId) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const now = Date.now();

            // Update main telemetery
            if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude) && Number.isFinite(latitude) && Number.isFinite(longitude)) {
              update(ref(db, 'unidades/' + currentUnit.id), {
                lat: latitude,
                lng: longitude,
                ultima_conexion: new Date().toLocaleTimeString()
              });
            }

            // Stop Check logic (> 10 meters movement resets timer)
            // Or use speed if available
            const isMoving = speed && speed > 0.5;
            if (isMoving) {
              lastPosTime.current = now;
              stoppedAlertActive.current = false;
            }

            // Proximity to KEY STOPS check
            KEY_STOPS.forEach(async (stop) => {
              if (markedStops.current.has(stop.id)) return;
              
              const dist = getDistanceInMeters(latitude, longitude, stop.lat, stop.lng);
              if (dist <= 10) { // Precision threshold set to 10 meters as requested
                markedStops.current.add(stop.id);
                const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                
                // Get departure time to calculate variance
                const snap = await get(ref(db, `viajes_activos/${currentViajeId}`));
                const data = snap.val();
                let variance = 0;
                
                if (data && data.hora_salida) {
                  const [sH, sM] = data.hora_salida.split(':').map(Number);
                  const [aH, aM] = hora.split(':').map(Number);
                  const salidaTotal = sH * 60 + sM;
                  const actualTotal = aH * 60 + aM;
                  const expectedTotal = salidaTotal + stop.offset;
                  variance = actualTotal - expectedTotal;
                }

                const dbUpdates = {
                  [`marcacion_${stop.id}`]: hora,
                  [`variacion_${stop.id}`]: variance,
                  ultima_actualizacion: Date.now()
                };

                // Sync across all relevant entities
                update(ref(db, `viajes_activos/${currentViajeId}`), dbUpdates);
                if (currentUnit?.numero) {
                  update(ref(db, `despachos_activos/${currentUnit.numero}`), dbUpdates);
                  update(ref(db, `buses/bus-${currentUnit.numero}`), dbUpdates);
                }
                
                console.log(`Marcada parada ${stop.id} con variacion ${variance} (Dist: ${dist.toFixed(1)}m)`);
              }
            });
          },
          (err) => {
            console.error(err);
            alert("ERROR DE GPS: " + err.message + ". Por favor asegúrese de tener activado el GPS y dar permisos de ubicación.");
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );

        // Check for 3-minute stop alert
        stopCheckInterval = setInterval(() => {
          const now = Date.now();
          if (now - lastPosTime.current > 180000 && !stoppedAlertActive.current) { // 3 minutes
            stoppedAlertActive.current = true;
            // Push alert to firebase for Admin
            push(ref(db, `alertas_flota`), {
              unidad: currentUnit.numero,
              coop: currentUnit.cooperativa,
              tipo: 'TIEMPO_DETENIDO',
              msj: `Unidad ${currentUnit.numero} detenida por más de 3 minutos`,
              timestamp: Date.now()
            });
            console.warn("ALERTA: Bus detenido > 3 min");
          }
        }, 30000); // Check every 30s
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (stopCheckInterval) clearInterval(stopCheckInterval);
    };
  }, [isActive, currentUnit, currentViajeId]);

  const activarRadar = async () => {
    if (!empresaCode || !unitNum || !name || !phone) {
      return alert("Por favor complete todos los datos");
    }

    setLoading(true);
    try {
      // 1. Validar primero que la empresa exista
      const coopSnap = await get(ref(db, `cooperativas/${empresaCode}`));
      if (!coopSnap.exists()) {
        setLoading(false);
        return alert(`ERROR DE ACCESO:\n\nEl Código de Empresa [${empresaCode}] NO existe en el sistema.\n\nVerifique el código asignado por su administrador.`);
      }

      const unitsRef = ref(db, 'unidades');
      console.log('Intentando conectar:', { empresaCode, unitNum, name, phone });

      // Search directly for the unit belonging to this company with this unit number
      const allUnitsSnap = await get(unitsRef);
      let foundUnit: Unit | null = null;
      let foundKey: string | null = null;

      if (allUnitsSnap.exists()) {
        const allUnits = allUnitsSnap.val();
        const searchUnitNum = unitNum.trim().toUpperCase();
        const searchCoopCode = empresaCode.trim().toUpperCase();
        
        let companyUnitsFound = 0;
        const availableNums: string[] = [];

        Object.entries(allUnits).forEach(([key, val]: [string, any]) => {
          const dbUnitNum = String(val.numero || '').trim().toUpperCase();
          const dbCoopCode = String(val.cooperativa || '').trim().toUpperCase();

          if (dbCoopCode === searchCoopCode) {
            companyUnitsFound++;
            availableNums.push(dbUnitNum);
            if (dbUnitNum === searchUnitNum) {
              foundUnit = val as Unit;
              foundKey = key;
            }
          }
        });

        if (!foundUnit) {
          setLoading(false);
          if (companyUnitsFound === 0) {
            return alert(`ERROR DE EMPRESA:\n\nLa empresa [${empresaCode}] NO tiene unidades registradas.\n\nContacte a su administrador.`);
          } else {
            return alert(`ERROR DE UNIDAD:\n\nLa unidad [${unitNum}] no existe para esta empresa.\n\nUnidades registradas en su empresa: ${availableNums.join(', ')}`);
          }
        }
      } else {
        setLoading(false);
        return alert("ERROR DE SISTEMA:\n\nNo se encontraron unidades en el servidor.");
      }

      console.log('Unidad validada:', foundUnit.numero);
      if ((foundUnit as Unit).bloqueado) {
        alert("ESTA UNIDAD SE ENCUENTRA BLOQUEADA POR EL ADMIN");
        setLoading(false);
        return;
      }

      // Create a new active trip/session
      const newViajeRef = push(ref(db, 'viajes_activos'));
      const startTime = new Date().toLocaleTimeString();
      await set(newViajeRef, {
        unidadId: foundKey,
        unidad: foundUnit.numero,
        cooperativa: empresaCode,
        conductor: name,
        fecha: new Date().toLocaleDateString(),
        hora_salida: startTime,
        ciclo_actual: 1,
        timestamp_salida: Date.now()
      });

      await update(ref(db, 'unidades/' + foundKey), {
        activo: true,
        conductor_nombre: name,
        conductor_tel: phone,
        ultima_conexion: startTime,
        viaje_id: newViajeRef.key
      });

      setCurrentViajeId(newViajeRef.key);
      const updatedUnit = { ...foundUnit, id: foundKey };
      setCurrentUnit(updatedUnit);
      setIsActive(true);

      // Persistence
      localStorage.setItem('driver_session', JSON.stringify({
        empresaCode,
        unitNum,
        name,
        phone,
        voyageId: newViajeRef.key,
        unit: updatedUnit
      }));

      // Immediate broadcast to make it visible to Admin right away
      update(ref(db, 'unidades/' + foundKey), {
        activo: true,
        conductor_nombre: name,
        conductor_tel: phone,
        ultima_conexion: startTime,
        lat: foundUnit.lat || 0,
        lng: foundUnit.lng || 0
      });
    } catch (error) {
      console.error('ERROR EN ACTIVACIÓN DE RADAR:', error);
      alert("Error de conexión: " + (error instanceof Error ? error.message : "No se pudo conectar con el servidor."));
    }
    setLoading(false);
  };

  const desactivar = async () => {
    if (confirm("¿Estás seguro de que deseas FINALIZAR LA TRANSMISIÓN?")) {
      if (currentUnit && currentViajeId) {
        const endTime = new Date().toLocaleTimeString();
        
        // Move active trip to history
        const tripDataSnap = await get(ref(db, `viajes_activos/${currentViajeId}`));
        const tripData = tripDataSnap.val();
        
        if (tripData) {
          await push(ref(db, 'historial_operativo'), {
            ...tripData,
            hora_llegada: endTime,
            timestamp_llegada: Date.now()
          });
        }

        await remove(ref(db, `viajes_activos/${currentViajeId}`));
        await update(ref(db, 'unidades/' + currentUnit.id), {
          activo: false,
          viaje_id: null
        });
        
        localStorage.removeItem('driver_session');
      }
      window.location.reload();
    }
  };

  if (isActive && currentUnit) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-immersive-bg relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[140px] animate-pulse"></div>
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
        </div>

        <div className="w-full max-w-md glass-panel p-10 rounded-[3.5rem] text-center space-y-10 shadow-2xl relative border-white/5 z-10 accent-glow-emerald">
          <div className="relative">
             <div className="w-32 h-32 bg-slate-900 border-2 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                <Radio size={56} className="text-emerald-500 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping opacity-10" />
             </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-4xl font-black italic tracking-tighter italic uppercase text-emerald-400 underline underline-offset-8 decoration-emerald-500/20">RADAR_ACTIVO</h2>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.3em] font-medium leading-relaxed">
              Transmitiendo telemetría GPS precisa a MYTUC<br/>
              {currentUnit.lat ? "CONEXIÓN ESTABLE" : "ADQUIRIENDO POSICIÓN..."}
            </p>
          </div>

          <div className="glass-hud p-6 rounded-2xl space-y-4 border-white/10 shadow-inner">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">ID Vehículo:</span>
              <span className="font-black text-white italic">UNIDAD_{currentUnit.numero}</span>
            </div>
            <div className="h-px bg-white/5"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic font-bold">Sector Asignado:</span>
              <span className="font-black text-emerald-400 italic italic">{currentUnit.ruta}</span>
            </div>
            <div className="h-px bg-white/5"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">ID Conductor:</span>
              <span className="font-black text-white italic">{name}</span>
            </div>
          </div>

          <button 
            onClick={desactivar}
            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 p-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-xs italic"
          >
            <Power size={18} /> FINALIZAR_TRANSMISIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-immersive-bg relative overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="w-full max-w-sm space-y-10 py-12 animate-in slide-in-from-bottom-8 duration-700 z-10">
        <div className="text-center space-y-3">
          <div className="relative group mb-10">
            <div className="absolute inset-0 bg-blue-600/30 rounded-full blur-3xl animate-pulse group-hover:bg-blue-600/50 transition-all duration-1000"></div>
            <Logo className="w-48 mx-auto relative z-10 drop-shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
          </div>
          <h2 className="text-4xl font-black italic tracking-tighter italic uppercase underline underline-offset-4 decoration-blue-500/30">MYTUC_DEEP</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Protocolo Sincronización GPS v2.5.0</p>
        </div>

        <div className="glass-panel p-8 rounded-[3rem] space-y-6 border-white/5 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Código Empresa</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={empresaCode}
                  onChange={(e) => setEmpresaCode(e.target.value.slice(0, 8))}
                  placeholder="CODE"
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-4 text-center font-mono text-xl focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Número Unidad</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={unitNum}
                  onChange={(e) => setUnitNum(e.target.value.slice(0, 8))}
                  placeholder="NUM"
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-4 text-center font-mono text-xl focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Identidad Conductor</label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre Completo"
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-sm font-black focus:ring-1 focus:ring-blue-500 outline-none italic"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Enlace Móvil</label>
              <div className="relative group">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Teléfono Registro"
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-sm font-black focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <button 
            disabled={loading}
            onClick={activarRadar}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 border border-blue-500/20 text-white font-black p-5 rounded-[2rem] shadow-xl shadow-blue-900/30 transition-all flex items-center justify-center gap-3 active:scale-95 group"
          >
            {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    <Radio size={22} className="group-hover:scale-125 transition-transform" /> 
                    <span className="uppercase tracking-[0.2em] text-xs">Inicializar Radar</span>
                </>
            )}
          </button>
        </div>

        <div className="glass-hud flex items-center gap-4 p-5 rounded-2xl border-white/5 bg-amber-500/5 shadow-inner">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <span className="text-[9px] leading-relaxed font-black text-slate-400 uppercase tracking-widest opacity-60">
            Advertencia: El protocolo dicta el intercambio de telemetría activa con la red pública. Mantenga la seguridad operativa.
          </span>
        </div>
      </div>
    </div>
  );
}
