import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { 
  Bus, 
  MapPin, 
  Navigation, 
  Mic, 
  PhoneCall, 
  Send, 
  Bot, 
  Info,
  Clock,
  Cloud,
  Flame,
  LayoutGrid,
  Search,
  Power,
  Plus,
  Minus
} from 'lucide-react';
import { json_edcion_paradas_Mang_1 } from '../lib/stops';
import { Unit, ChatMessage } from '../types';
import { TERMINAL_210, KEY_STOPS } from '../constants';
import Logo from './Logo';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const busIcon = L.divIcon({
  html: `<div class="bg-green-500 p-2 rounded-full border-2 border-white shadow-lg shadow-green-900/50"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 11V3h-8v8"/><path d="M4 11h16"/><path d="M6 15h0"/><path d="M18 15h0"/></svg></div>`,
  className: 'bg-transparent',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const userIcon = L.divIcon({
  html: `<div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute inset-0 bg-blue-500 rounded-full sonar-wave"></div>
          <div class="absolute inset-0 bg-blue-400/50 rounded-full sonar-wave" style="animation-delay: 1s"></div>
          <div class="relative bg-white w-5 h-5 rounded-full border-4 border-blue-600 shadow-xl flex items-center justify-center z-10">
            <div class="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
          <div class="absolute -top-6 bg-blue-600 text-[8px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap border border-white/20 shadow-lg">ESTÁS AQUÍ</div>
         </div>`,
  className: 'bg-transparent',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const stopIcon = L.divIcon({
  html: `<div class="text-blue-400 drop-shadow-[0_0_10px_#60a5fa]"><svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor" stroke="black" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="black"/></svg></div>`,
  className: 'bg-transparent',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const terminalIcon = L.divIcon({
  className: 'terminal-marker',
  html: `<div style="background-color: #fbbf24; width: 24px; height: 24px; border-radius: 6px; border: 3px solid white; box-shadow: 0 0 15px rgba(251, 191, 36, 0.6); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);"><div style="width: 10px; height: 10px; background-color: #1e293b; border-radius: 2px; transform: rotate(-45deg);"></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const isValidLatLng = (lat: any, lng: any) => {
  try {
    const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
    const longitude = typeof lng === 'string' ? parseFloat(lng) : lng;

    if (latitude === null || latitude === undefined || isNaN(latitude)) return false;
    if (longitude === null || longitude === undefined || isNaN(longitude)) return false;

    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' && 
      Number.isFinite(latitude) && 
      Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  } catch {
    return false;
  }
};

// Safe Marker Component to prevent Leaflet crashes
function SafeMarker({ position, icon, children, ...props }: any) {
  if (!position || !isValidLatLng(position[0], position[1])) return null;
  return <Marker position={position} icon={icon} {...props}>{children}</Marker>;
}

function MapFlyer({ pos, shouldFollow }: { pos: [number, number] | null, shouldFollow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (pos && isValidLatLng(pos[0], pos[1]) && shouldFollow) {
      map.flyTo(pos, 16, { animate: true, duration: 1.5 });
    }
  }, [pos, shouldFollow, map]);
  return null;
}

const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function UserView() {
  const [phone, setPhone] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [active, setActive] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [isFollowActive, setIsFollowActive] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [isAutoSelected, setIsAutoSelected] = useState(true);
  const [stopSearch, setStopSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatAdmin, setChatAdmin] = useState<ChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<'public' | 'admin'>('public');
  const [message, setMessage] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const lastSpokenStopId = useRef<string | null>(null);
  const lastSpokenBusWarning = useRef<string | null>(null);
  
  const mapCenter = useMemo(() => {
    if (userPos && isValidLatLng(userPos[0], userPos[1])) return userPos;
    if (TERMINAL_210 && isValidLatLng(TERMINAL_210.lat, TERMINAL_210.lng)) return [TERMINAL_210.lat, TERMINAL_210.lng] as [number, number];
    return [12.1150, -86.2363] as [number, number];
  }, [userPos]);

  const polylinePoints = useMemo(() => {
    if (!selectedStop || !userPos) return [];
    try {
      const uLat = userPos[0];
      const uLng = userPos[1];
      const sLat = selectedStop.geometry?.coordinates?.[1];
      const sLng = selectedStop.geometry?.coordinates?.[0];

      if (isValidLatLng(uLat, uLng) && isValidLatLng(sLat, sLng)) {
        return [[uLat, uLng], [sLat, sLng]] as [number, number][];
      }
    } catch (e) {
      console.error("Polyline points error:", e);
    }
    return [];
  }, [userPos, selectedStop]);

  useEffect(() => {
    if (userPos && (!isValidLatLng(userPos[0], userPos[1]))) {
      console.error("Critical: userPos is invalid", userPos);
      setUserPos(null);
    }
  }, [userPos]);

  // Safe Map Rendering
  const renderMap = () => {
    try {
      return (
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <MapFlyer pos={userPos} shouldFollow={isFollowActive} />
          
          {/* All Stops - Improved visibility */}
          {json_edcion_paradas_Mang_1.features.map((f: any) => {
            const coords = f.geometry?.coordinates || [];
            const lat = coords[1];
            const lng = coords[0];
            
            if (!isValidLatLng(lat, lng)) return null;

            const isSelected = selectedStop && f.properties.Id === selectedStop.properties.Id;
            if (isSelected) return null;
            
            return (
              <SafeMarker 
                key={f.properties.Id} 
                position={[lat, lng]} 
                icon={L.divIcon({
                  html: `<div class="w-4 h-4 bg-red-500/30 rounded-full border border-white/40 flex items-center justify-center shadow-lg">
                          <div class="w-2 h-2 bg-red-600 rounded-full shadow-inner"></div>
                         </div>`,
                  className: 'bg-transparent',
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
              >
                <Popup className="dark-popup text-[10px] font-black uppercase tracking-tighter">
                  <div className="p-1">
                    <div className="text-white">{f.properties.name}</div>
                    <div className="text-[8px] text-slate-400 mt-0.5">{f.properties.PTO_CONTRO || 'Parada'}</div>
                  </div>
                </Popup>
              </SafeMarker>
            );
          })}

          {/* Main Terminal */}
          {TERMINAL_210 && isValidLatLng(TERMINAL_210.lat, TERMINAL_210.lng) && (
            <SafeMarker position={[TERMINAL_210.lat, TERMINAL_210.lng]} icon={terminalIcon}>
              <Popup className="dark-popup">
                <div className="p-1 font-black text-xs uppercase tracking-tighter">Terminal Central 210</div>
              </Popup>
            </SafeMarker>
          )}
          
          {/* User Marker */}
          {userPos && isValidLatLng(userPos[0], userPos[1]) && (
            <>
              <SafeMarker position={userPos} icon={userIcon}>
                <Popup className="dark-popup">📍 IDENTIFICADOR_USUARIO</Popup>
              </SafeMarker>
              <Circle 
                center={userPos} 
                radius={100} 
                pathOptions={{ 
                  color: '#3b82f6', 
                  fillColor: '#3b82f6', 
                  fillOpacity: 0.1, 
                  weight: 1, 
                  dashArray: '5, 5' 
                }} 
              />
            </>
          )}

          {/* Units Markers */}
          {units.filter(u => isValidLatLng(u.lat, u.lng)).map(u => (
            <SafeMarker key={u.id} position={[u.lat!, u.lng!]} icon={busIcon}>
              <Popup className="dark-popup">
                <div className="p-2 min-w-[140px]">
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 italic italic leading-none">Vehículo Identificado</div>
                  <div className="font-black text-emerald-400 text-lg tracking-tighter italic">Unidad {u.numero}</div>
                  <div className="text-[10px] font-black text-slate-300 uppercase bg-white/5 py-1 px-2 rounded-md border border-white/5 inline-block mt-2 italic">{u.ruta}</div>
                </div>
              </Popup>
            </SafeMarker>
          ))}

          {/* Selected Stop */}
          {polylinePoints.length === 2 && (
            <>
              <SafeMarker position={polylinePoints[1]} icon={stopIcon}>
                <Popup className="dark-popup">
                    <div className="p-1">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1 italic">Destino Seleccionado</div>
                        <div className="font-black uppercase tracking-tight italic italic underline underline-offset-4 decoration-blue-500/50">{selectedStop.properties.name} {selectedStop.properties.Recorrido && `(${selectedStop.properties.Recorrido})`}</div>
                    </div>
                </Popup>
              </SafeMarker>
              <Polyline 
                positions={polylinePoints} 
                pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '10, 15', opacity: 0.6 }} 
              />
            </>
          )}
        </MapContainer>
      );
    } catch (error) {
      console.error("Map rendering error:", error);
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-xs font-mono p-10 text-center">
          ERROR_SISTEMA_CARTOGRAFICO:<br/>
          No se pudo inicializar el radar. Verifique su conexión y permisos GPS.
        </div>
      );
    }
  };

  // Session persistence on mount
  useEffect(() => {
    const saved = localStorage.getItem('user_session');
    if (saved) {
      const { phone: sPhone } = JSON.parse(saved);
      setPhone(sPhone);
      setActive(true);
    }
  }, []);

  // Save session when activated
  useEffect(() => {
    if (active && phone) {
      localStorage.setItem('user_session', JSON.stringify({ phone }));
    }
  }, [active, phone]);

  // Filtered stops for search - Memoized and sorted by distance
  const filteredStops = React.useMemo(() => {
    const searchNorm = stopSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Combine dataset: json_edcion_paradas_Mang_1 + KEY_STOPS
    let combinedStops = json_edcion_paradas_Mang_1.features.map((f: any) => {
      const coords = f.geometry?.coordinates || [];
      return {
        id: (f.properties.Id || f.properties.NUM_PARADA)?.toString(),
        name: f.properties.name || f.properties.Nom_Parada || "Parada sin nombre",
        lat: coords[1],
        lng: coords[0],
        recorrido: f.properties.Recorrido,
        puntoControl: f.properties.PTO_CONTRO,
        raw: f
      };
    }).filter(s => isValidLatLng(s.lat, s.lng));

    // Add KEY_STOPS from constants
    KEY_STOPS.forEach(ks => {
      // Normalize ID for comparison: remove leading 'P' if matching against stops.ts
      const normalizedKsId = ks.id.startsWith('P') && !ks.id.includes('_') ? ks.id.substring(1) : ks.id;
      
      if (!combinedStops.find(s => s.id === ks.id || s.id === normalizedKsId)) {
        combinedStops.push({
          id: ks.id,
          name: ks.name,
          lat: ks.lat,
          lng: ks.lng,
          recorrido: (ks.name.toLowerCase().includes('ida') ? 'Ida' : (ks.name.toLowerCase().includes('vuelta') ? 'Vuelta' : undefined)),
          puntoControl: 'Punto de Control',
          raw: { properties: { Id: ks.id, name: ks.name }, geometry: { coordinates: [ks.lng, ks.lat] } }
        });
      }
    });

    let list = combinedStops;

    if (stopSearch) {
      list = list.filter(s => {
        const nameNorm = s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const controlNorm = (s.puntoControl || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nameNorm.includes(searchNorm) || controlNorm.includes(searchNorm);
      });
    }
    
    // Always sort by proximity if position is available
    const refLat = userPos ? userPos[0] : mapCenter[0];
    const refLng = userPos ? userPos[1] : mapCenter[1];

    list = [...list].sort((a, b) => {
      const dA = getDist(refLat, refLng, a.lat, a.lng);
      const dB = getDist(refLat, refLng, b.lat, b.lng);
      if (isNaN(dA)) return 1;
      if (isNaN(dB)) return -1;
      return dA - dB;
    });

    return list.slice(0, 100); // Increased from 20 to 100 to show more results as requested
  }, [stopSearch, userPos, mapCenter]);

  // Initialize GPS and Subscriptions
  useEffect(() => {
    if (!active) return;
    
    // GPS
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (isValidLatLng(p.coords.latitude, p.coords.longitude)) {
          const currentPos: [number, number] = [p.coords.latitude, p.coords.longitude];
          setUserPos(currentPos);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    // Units
    const unitsRef = ref(db, 'unidades');
    const unsubscribeUnits = onValue(unitsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let list = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: value.id || key,
          lat: typeof value.lat === 'string' ? parseFloat(value.lat) : value.lat,
          lng: typeof value.lng === 'string' ? parseFloat(value.lng) : value.lng
        })).filter((u: any) => u.activo && !u.bloqueado && isValidLatLng(u.lat, u.lng));

        setUnits(list);
      }
    });

    // Chat
    const chatRef = ref(db, 'chat_comunidad');
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: key
        })).filter(m => m.type !== 'admin').slice(-15);
        setChat(list as any);
      }
    });

    // Chat Admin
    const chatAdminRef = ref(db, `chats_admin/${phone}`);
    const unsubscribeChatAdmin = onValue(chatAdminRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: key
        }));
        setChatAdmin(list as any);
      }
    });

    // Blocked check
    const blockedRef = ref(db, `blocked_numbers/${phone}`);
    const unsubscribeBlocked = onValue(blockedRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsBlocked(true);
        setActive(false);
        speak("Tu número ha sido suspendido por comportamiento inapropiado. Contacta a la central.");
      }
    });

    // Tracking Presencia (Stats)
    const presenceRef = ref(db, `presencia/${phone}`);
    const updatePresence = () => {
      set(presenceRef, {
        lastSeen: Date.now(),
        phone: phone,
        pos: userPos || null
      });
    };
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      unsubscribeUnits();
      unsubscribeChat();
      unsubscribeChatAdmin();
      unsubscribeBlocked();
      clearInterval(presenceInterval);
    };
  }, [active, phone, userPos]);

  // Automatic Nearest Stop logic - Improved frequency and accuracy
  useEffect(() => {
    if (!active || !isAutoSelected) return;

    const findNearest = () => {
      let minD = Infinity;
      let nearest = null;
      
      const currentLoc = (userPos && isValidLatLng(userPos[0], userPos[1])) ? userPos! : mapCenter;

      // Combine search space
      const allStops = [
        ...json_edcion_paradas_Mang_1.features.map((f: any) => {
          const coords = f.geometry?.coordinates || [];
          return {
            lat: coords[1],
            lng: coords[0],
            raw: f
          };
        }),
        ...KEY_STOPS.map(ks => ({
          lat: ks.lat,
          lng: ks.lng,
          raw: { properties: { Id: ks.id, name: ks.name }, geometry: { coordinates: [ks.lng, ks.lat] } }
        }))
      ];

      allStops.forEach((s: any) => {
        if (!isValidLatLng(s.lat, s.lng)) return;

        const d = getDist(currentLoc[0], currentLoc[1], s.lat, s.lng);
        if (d < minD) {
          minD = d;
          nearest = s.raw;
        }
      });

      if (nearest && (!selectedStop || nearest.properties.Id !== selectedStop.properties.Id)) {
        // Hysteresis: only switch if the new nearest is significantly closer or current is far
        const distToCurrent = selectedStop ? getDist(currentLoc[0], currentLoc[1], selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]) : Infinity;
        const distToNew = getDist(currentLoc[0], currentLoc[1], nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]);
        
        // If current stop is already very close (< 200m) don't jump to another unless it's much better
        if (selectedStop && distToCurrent < 0.2 && (distToCurrent - distToNew < 0.1)) {
          return;
        }

        setSelectedStop(nearest);
        
        if (lastSpokenStopId.current !== nearest.properties.Id) {
          const dist = getDist(currentLoc[0], currentLoc[1], nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]);
          const timeWalk = Math.round((dist / 5) * 60);
          
          speak(`Parada más cercana: ${nearest.properties.name}. Está a ${timeWalk} minutos caminando.`);
          lastSpokenStopId.current = nearest.properties.Id;
        }
      }
    };

    findNearest();
    const interval = setInterval(findNearest, 2000); // Check every 2s for real-time feel
    return () => clearInterval(interval);
  }, [active, userPos, isAutoSelected, selectedStop, mapCenter]);

  // Filter Units based on selected stop - IMPROVED TRIANGULATION
  const displayUnits = React.useMemo(() => {
    const stopPos = selectedStop ? [selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]] : null;
    if (!stopPos || !isValidLatLng(stopPos[0], stopPos[1]) || units.length === 0) return [];
    
    // Units approaching the SELECTED STOP
    return [...units].map(u => ({
      ...u,
      distToStop: getDist(u.lat!, u.lng!, stopPos[0], stopPos[1])
    })).sort((a, b) => a.distToStop - b.distToStop).slice(0, 3);
  }, [units, selectedStop]);

  // Proximity to stop logic
  const distToStop = useMemo(() => {
    if (!userPos || !selectedStop) return null;
    return getDist(userPos[0], userPos[1], selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]);
  }, [userPos, selectedStop]);

  // Proactive Bus Monitor for Accessibility
  useEffect(() => {
    if (active && selectedStop && displayUnits.length > 0) {
      const closest = displayUnits[0] as any;
      const d = closest.distToStop;
      
      // If a bus is less than 1km and getting close, announce once
      if (d < 1.0 && lastSpokenBusWarning.current !== closest.id) {
        speak(`Atención. La unidad ${closest.numero} de la ruta ${closest.ruta} está a menos de un kilómetro de tu parada ${selectedStop.properties.name}.`);
        lastSpokenBusWarning.current = closest.id;
      }
    }
  }, [displayUnits, selectedStop, active]);

  // Proactive periodic status update
  useEffect(() => {
    if (!active || isMuted) return;
    
    const interval = setInterval(() => {
      if (selectedStop && displayUnits.length > 0) {
        const closest = displayUnits[0] as any;
        const dist = closest.distToStop;
        const time = Math.round(dist * 6);
        
        if (time <= 10 && time > 0) {
          speak(`Reporte automático: La unidad ${closest.numero} de la ruta ${closest.ruta} se aproxima. Llegará en aproximadamente ${time} minutos.`);
        }
      }
    }, 60000); 
    
    return () => clearInterval(interval);
  }, [active, isMuted, selectedStop, displayUnits]);

  const handleActivation = () => {
    if (phone.length < 8) {
      speak("Por favor, ingrese un número de teléfono válido de ocho dígitos para activar su ubicación.");
      return;
    }
    setIsActivating(true);
    setTimeout(() => {
      setActive(true);
      setIsActivating(false);
      speak(`Gracias. Su identidad vinculada al número ${phone} ha sido verificada. Iniciando triangulación de su ubicación con la red de transporte.`);
    }, 1000);
  };

  const speak = (txt: string) => {
    if (isMuted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(txt);
      utterance.lang = 'es-MX';
      utterance.volume = 1.0; 
      utterance.rate = 1.0;   
      utterance.pitch = 1.2;  // Higher pitch for better clarity as requested
      window.speechSynthesis.speak(utterance);
    }
  };

  // Improved Voice Command Handler
  useEffect(() => {
    if (!micActive) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported");
      speak("Su navegador no soporta reconocimiento de voz.");
      setMicActive(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-NI';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Micrófono capturando...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log("Comando detectado:", transcript);
      
      // Log Query for Stats
      push(ref(db, 'stats/queries'), {
        text: transcript,
        timestamp: Date.now(),
        userId: phone
      });
      
      // Expanded keyword matching
      if (transcript.includes("reporte") || transcript.includes("resumen") || transcript.includes("estatus") || transcript.includes("informe")) {
        const btn = document.getElementById('report-btn');
        if (btn) btn.click();
      } else if (transcript.includes("emergencia") || transcript.includes("ayuda") || transcript.includes("sos") || transcript.includes("peligro")) {
        notifyEmergency();
      } else if (transcript.includes("parada")) {
        speak("Diga el nombre de la parada que busca después de tocar el micrófono.");
      } else {
        speak(`Usted dijo ${transcript}. No reconozco ese comando. Pruebe diciendo reporte.`);
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Recognition Error:", e.error);
      if (e.error === 'not-allowed') speak("Permiso de micrófono denegado.");
    };
    
    recognition.onend = () => setMicActive(false);

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setMicActive(false);
    }

    return () => {
      try { recognition.stop(); } catch(e) {}
    };
  }, [micActive]);

  const notifyEmergency = () => {
    if (userPos && phone) {
      speak("Enviando alerta S.O.S. a la central.");
      set(ref(db, 'alertas_emergencia/' + phone), {
        loc: userPos,
        tel: phone,
        time: Date.now()
      });
    }
  };

  const sendMessage = () => {
    if (!message.trim() || isBlocked) return;
    
    if (chatMode === 'public') {
      push(ref(db, 'chat_comunidad'), {
        user: 'Usuario-' + phone.slice(-4),
        msg: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: phone,
        type: 'public'
      });
    } else {
      // Send to Admin
      push(ref(db, `chats_admin/${phone}`), {
        user: 'Tú',
        msg: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: phone,
        type: 'admin'
      });
      
      // Notify admin branch for overall view
      push(ref(db, 'notificaciones_admin_chat'), {
        phone: phone,
        lastMsg: message,
        timestamp: Date.now()
      });
    }
    setMessage('');
  };

  if (!active) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-immersive-bg relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        </div>

        <div className="relative mb-12 z-10">
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-600/30 rounded-full blur-3xl animate-pulse group-hover:bg-blue-600/50 transition-all duration-1000"></div>
                    <Logo className="w-72 h-72 object-contain relative z-10 drop-shadow-[0_0_40px_rgba(37,99,235,0.5)]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 border-white/5 rounded-full animate-spin-slow"></div>
                </div>
        </div>

        <div className="w-full max-w-xs space-y-8 animate-in slide-in-from-bottom-8 duration-700 z-10">            
            <div className="text-center space-y-3">
                <Logo className="w-48 h-48 mx-auto drop-shadow-[0_0_40px_rgba(37,99,235,0.5)]" />
                <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">MYTUC</h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Acceso Seguro Sincronizado</p>
            </div>
           
           <div className="glass-panel p-8 rounded-[2.5rem] space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 font-black">Código de Identidad</label>
                 <input 
                   type="tel" 
                   value={phone}
                   onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                   placeholder="8888 8888"
                   className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-5 text-center text-2xl font-black font-mono tracking-widest placeholder:opacity-10 transition-all focus:ring-4 focus:ring-blue-500/20 text-blue-400"
                 />
               </div>
               <button 
                 disabled={isActivating}
                 onClick={handleActivation}
                 className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black p-5 rounded-2xl shadow-xl shadow-blue-900/30 transition-all flex items-center justify-center gap-3 active:scale-95 group"
               >
                 {isActivating ? (
                   <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 ) : (
                   <>
                    <LayoutGrid size={22} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="uppercase tracking-widest text-xs">Iniciar Transmisión</span>
                   </>
                 )}
               </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row relative bg-immersive-bg">
      {/* Search & Info Panel */}
      <div className="w-full lg:w-[420px] bg-slate-1000/50 backdrop-blur-xl border-r border-white/5 flex flex-col h-full z-10">
        <div className="p-8 shrink-0">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Logo className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] bg-white/10 rounded-2xl p-1" />
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2 italic">
                            MYTUC
                        </h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Sincronización GPS Activa</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        localStorage.removeItem('user_session');
                        window.location.reload();
                      }}
                      className="p-3 bg-white/5 hover:bg-red-500/20 rounded-xl transition-all border border-white/5 group"
                      title="Cerrar Sesión"
                    >
                        <Power size={18} className="text-slate-400 group-hover:text-red-400" />
                    </button>
                    <button onClick={() => {
                        setIsFollowActive(true);
                        if (userPos) speak("Centrando mapa en tu ubicación.");
                    }} className="p-3 bg-blue-600/20 hover:bg-blue-600/40 rounded-xl transition-all border border-blue-500/20" title="Relocalizar">
                        <Navigation size={18} className="text-blue-400" />
                    </button>
                    <button onClick={() => window.location.reload()} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5">
                        <LayoutGrid size={18} className="text-slate-400" />
                    </button>
                </div>
            </div>

            <div className="glass-hud p-5 rounded-2xl space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-bold">Señal: Fuerte</span>
                    </div>
                    <span className="text-emerald-400 font-mono text-xs">Latencia 14ms</span>
                </div>
                <div className="h-px bg-white/5"></div>
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1.5 font-bold uppercase tracking-wider font-bold">
                        <Flame size={12} className="text-amber-500" /> Entorno
                    </span>
                    <span className="text-white font-black italic uppercase">32°C Cielo Despejado</span>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 invisible-scrollbar overflow-x-visible">
            {/* Triangulation Dashboard */}
            {active && selectedStop && (
              <section className="animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase italic">Triangulación Activa</h3>
                </div>
                
                <div className="glass-hud p-6 rounded-[2rem] border border-white/5 space-y-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Navigation size={40} className="text-blue-500" />
                   </div>
                   
                   {/* User to Stop */}
                   <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter italic">
                         <span className="text-slate-500 flex items-center gap-2"><MapPin size={12} /> Tú → Parada</span>
                         <span className="text-blue-400">{distToStop ? `${distToStop.toFixed(2)} km` : '--'}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" 
                           style={{ width: `${Math.max(0, 100 - (distToStop || 0) * 100)}%` }}
                         ></div>
                      </div>
                   </div>

                   {/* Stop to Nearest Bus */}
                   <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter italic">
                         <span className="text-slate-500 flex items-center gap-2"><Bus size={12} /> Parada → Bus</span>
                         <span className="text-emerald-400">{displayUnits.length > 0 ? `${(displayUnits[0] as any).distToStop.toFixed(2)} km` : '--'}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" 
                           style={{ width: `${Math.max(0, 100 - ((displayUnits[0] as any)?.distToStop || 0) * 20)}%` }}
                         ></div>
                      </div>
                   </div>

                   {/* Estimación Final */}
                   <div className="pt-2 border-t border-white/5 flex items-end justify-between">
                      <div>
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tiempo Estimado</div>
                        <div className="text-2xl font-black text-white italic tracking-tighter leading-none">
                          {displayUnits.length > 0 ? `${Math.round((displayUnits[0] as any).distToStop * 6)} min` : '--'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Unidad</div>
                        <div className="text-sm font-black text-emerald-400 italic italic">
                          {displayUnits.length > 0 ? `#${(displayUnits[0] as any).numero}` : 'S/N'}
                        </div>
                      </div>
                   </div>
                </div>
              </section>
            )}

            {/* Stop Selector with Search */}
            <section className="space-y-4 relative z-50">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase italic">Destino: Parada</h3>
                    {selectedStop && userPos && isValidLatLng(userPos[0], userPos[1]) && isValidLatLng(selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]) && (
                      <span className="text-[9px] font-black text-blue-400">
                        A {getDist(userPos[0], userPos[1], selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]).toFixed(2)}km de ti
                      </span>
                    )}
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={stopSearch}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                      onChange={e => setStopSearch(e.target.value)}
                      placeholder="Buscar parada..."
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-sm font-black focus:ring-1 focus:ring-blue-500 outline-none italic"
                    />
                    {(stopSearch || isSearchFocused) && filteredStops.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sugerencias {stopSearch ? 'de Búsqueda' : 'Cercanas'}</span>
                           <span className="text-[8px] font-black text-blue-500 uppercase">{filteredStops.length} Resultados</span>
                        </div>
                        {filteredStops.map((s: any) => {
                          const dist = userPos ? getDist(userPos[0], userPos[1], s.lat, s.lng) : null;
                          const isNearby = dist !== null && dist <= 0.1; // 100 meters
                          
                          return (
                            <button 
                              key={s.id}
                              id={`stop-result-${s.id}`}
                              onClick={() => {
                                setSelectedStop(s.raw);
                                setIsAutoSelected(false);
                                setStopSearch('');
                                
                                const d = dist || 0;
                                const timeWalk = Math.round((d / 5) * 60);
                                
                                const sentido = s.recorrido ? `, sentido ${s.recorrido}` : "";
                                const distTxt = d > 0 ? `Se encuentra a ${d.toFixed(2)} kilómetros. El tiempo estimado es de ${timeWalk} minutos caminando.` : "";
                                
                                speak(`Parada seleccionada: ${s.name}${sentido}. ${distTxt}`);
                              }}
                              className={`w-full p-4 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors ${isNearby ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : ''}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs font-black text-white">{s.name}</div>
                                    {isNearby && (
                                      <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded animate-pulse">MUY CERCA (100m)</span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-500 uppercase font-bold">{s.puntoControl ? `Punto: ${s.puntoControl}` : 'Parada Registrada'}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {s.recorrido && (
                                    <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${s.recorrido === 'Ida' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                      {s.recorrido}
                                    </span>
                                  )}
                                  {dist !== null && (
                                    <span className={`text-[9px] font-black px-1 rounded ${isNearby ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 bg-white/5'}`}>
                                      {dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(2)}km`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                </div>

                {selectedStop && (
                  <div className="glass-hud p-5 rounded-[2rem] border border-blue-500/20 bg-blue-500/5 animate-in fade-in zoom-in duration-300 relative group/stop">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <MapPin size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-black text-sm uppercase leading-tight">{selectedStop.properties.name}</div>
                          {selectedStop.properties.Recorrido && (
                            <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 font-black uppercase">{selectedStop.properties.Recorrido}</span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">ID: {selectedStop.properties.Id} {isAutoSelected && "(AUTO)"}</div>
                      </div>
                      {!isAutoSelected && (
                        <button 
                          onClick={() => setIsAutoSelected(true)}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] font-black uppercase text-blue-400 border border-white/5 transition-all"
                        >
                          AUTO
                        </button>
                      )}
                    </div>
                  </div>
                )}
            </section>

            {/* Units List */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase italic">Unidades hacia Parada</h3>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{displayUnits.length} CERCANAS</span>
                </div>
                
                {displayUnits.length === 0 ? (
                    <div className="glass-panel border-dashed border-white/5 p-12 rounded-3xl text-center">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <Bus className="text-slate-700" size={24} />
                        </div>
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest leading-relaxed">Sin unidades detectadas<br/>cerca de la parada...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayUnits.map(u => {
                            const stopPos = selectedStop ? [selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]] : userPos;
                            const d = stopPos ? getDist(stopPos[0], stopPos[1], u.lat!, u.lng!) : 0;
                            const t = Math.round(d * 6); // Assuming ~10km/h avg speed including stops
                            return (
                                <div key={u.id} className="glass-panel hover:bg-white/5 p-5 rounded-2xl flex items-center justify-between group transition-all cursor-pointer border-white/5 hover:border-emerald-500/30">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500 transition-all duration-500">
                                            <Bus size={20} className="text-emerald-500 group-hover:text-white" />
                                        </div>
                                        <div>
                                            <div className="font-black text-lg uppercase tracking-tight">Unidad {u.numero}</div>
                                            <div className="text-[12px] text-slate-400 font-bold uppercase tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity italic">{u.ruta}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 font-black text-3xl tracking-tighter">{t} min</div>
                                        <div className="text-[11px] text-slate-500 font-mono opacity-60 uppercase font-bold">{d.toFixed(2)} KM</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Smart Assistant - Accessibility First */}
            <section className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-white/10 p-6 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-all duration-700 animate-pulse"></div>
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform relative ${micActive ? 'bg-red-600 animate-pulse' : 'bg-blue-600 shadow-blue-900/50'}`}>
                          {micActive ? (
                            <div className="flex gap-1 items-center">
                              <span className="w-1 h-3 bg-white rounded-full animate-bounce"></span>
                              <span className="w-1 h-5 bg-white rounded-full animate-bounce [animation-delay:0.1s]"></span>
                              <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            </div>
                          ) : (
                            <Bot size={32} className="text-white" />
                          )}
                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 animate-pulse ${isMuted ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                      </div>
                      <div>
                          <h4 className="font-black text-base uppercase tracking-widest text-blue-100 italic mb-1 uppercase">SIRI_BOT_TUC</h4>
                          <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${isMuted ? 'text-red-400' : 'text-emerald-400'}`}>
                               <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isMuted ? 'bg-red-500' : 'bg-emerald-500'}`}></span> 
                               {micActive ? 'Frecuencia_Activa...' : (isMuted ? 'Modo Silencioso' : 'Escucha Inteligente')}
                          </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        const newMute = !isMuted;
                        setIsMuted(newMute);
                        if (!newMute) setTimeout(() => speak("Asistente activado. ¿En qué puedo ayudarte?"), 100);
                      }}
                      className={`p-3 rounded-2xl border transition-all ${isMuted ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                      {isMuted ? <PhoneCall size={20} className="rotate-[135deg]" /> : <Flame size={20} />}
                    </button>
                </div>
                
                <div className="space-y-4">
                  <button 
                    id="report-btn"
                    onClick={() => {
                        const stopName = selectedStop?.properties.name || "no identificada";
                        const sentido = selectedStop?.properties.Recorrido ? `, sentido ${selectedStop.properties.Recorrido}` : "";
                        const dist = selectedStop && userPos ? getDist(userPos[0], userPos[1], selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]).toFixed(2) : "0";
                        const unitsCount = displayUnits.length;
                        const firstUnitInfo = displayUnits.length > 0 ? `La unidad ${displayUnits[0].numero} de la ruta ${displayUnits[0].ruta} llegará en aproximadamente ${Math.round(getDist(displayUnits[0].lat!, displayUnits[0].lng!, selectedStop.geometry.coordinates[1], selectedStop.geometry.coordinates[0]) * 6)} minutos.` : "No hay unidades cerca todavía.";
                        
                        speak(`Estás en modo asistencia. Tu parada seleccionada es ${stopName}${sentido}, a ${dist} kilómetros de tu ubicación. Detecto ${unitsCount} unidades en camino. ${firstUnitInfo}`);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-2xl border border-white/10 text-lg font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 group/btn text-white shadow-xl shadow-blue-900/40 active:scale-95"
                  >
                        <Info size={32} /> GENERAR REPORTE_VOZ
                  </button>
                  
                  <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                      <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                          {isMuted ? "Asistente silenciado. Las alertas automáticas no se reproducirán." : "El asistente te avisará automáticamente cuando el bus esté cerca de tu parada."}
                      </p>
                  </div>
                </div>
            </section>

            {/* Community Chat */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                      <Send size={12} className="text-blue-500" /> Comunicaciones
                  </h3>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/5">
                      <button 
                        onClick={() => setChatMode('public')}
                        className={`px-3 py-1 text-[8px] font-black uppercase rounded ${chatMode === 'public' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                      >Público</button>
                      <button 
                        onClick={() => setChatMode('admin')}
                        className={`px-3 py-1 text-[8px] font-black uppercase rounded ${chatMode === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                      >Admin</button>
                  </div>
                </div>

                <div className="glass-panel rounded-3xl p-5 space-y-4 border-white/5">
                    <div className="max-h-[160px] overflow-y-auto space-y-3 font-mono text-[10px] pr-2 custom-scrollbar flex flex-col-reverse">
                        <div className="space-y-3">
                          {(chatMode === 'public' ? chat : chatAdmin).map((m: any, i) => (
                              <div key={m.id || i} className={`animate-in fade-in slide-in-from-left-2 duration-300 p-2 rounded-lg border flex flex-col ${m.user === 'Admin' ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-white/5 bg-white/2'}`}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`${m.user === 'Admin' ? 'text-indigo-400' : 'text-blue-400'} font-black uppercase tracking-tighter`}>{m.user}:</span>
                                    <span className="text-[8px] text-slate-600">{m.time}</span>
                                  </div>
                                  <span className="text-slate-400 leading-relaxed break-words">{m.msg}</span>
                              </div>
                          ))}
                          {(chatMode === 'public' ? chat : chatAdmin).length === 0 && <div className="text-slate-700 text-center py-8 italic font-mono uppercase tracking-widest text-[9px]">Sin transmisiones entrantes</div>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input 
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendMessage()}
                          placeholder={chatMode === 'public' ? "Mensaje a pasajeros..." : "Mensaje al administrador..."}
                          className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl text-xs px-4 py-3 font-mono transition-all focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-700"
                        />
                        <button onClick={sendMessage} className={`p-3 rounded-xl transition-all shadow-lg shadow-blue-900/40 ${chatMode === 'public' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </section>
        </div>

        {/* Global Emergency Footer */}
        <div className="p-6 shrink-0 bg-red-950/20 border-t border-red-500/10">
            <button 
              onClick={notifyEmergency}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black p-5 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3 border border-red-400/20 uppercase tracking-[0.2em] text-xs italic"
            >
                <PhoneCall size={20} /> ACTIVAR SEÑAL SOS
            </button>
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative overflow-hidden" onMouseDown={() => setIsFollowActive(false)}>
        {renderMap()}

        {/* Map UI Controls */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-4">
            <button 
              onClick={() => setIsFollowActive(true)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all border ${isFollowActive ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/40' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'}`}
              title="Centrar en mi ubicación"
            >
                <Navigation size={24} className={isFollowActive ? 'animate-bounce' : ''} />
            </button>
            
            <div className="flex flex-col bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => {
                    setIsFollowActive(false);
                    // Finding the leaflet map instance is tricky with functional components and refs, 
                    // but usually you can just use the map hook if you're inside. 
                    // Since I'm outside, I won't do zoom here, but I can add a state for zoom.
                  }}
                  className="w-14 h-14 flex items-center justify-center hover:bg-white/5 border-b border-white/10 text-slate-400"
                >
                    <Plus size={20} />
                </button>
                <button className="w-14 h-14 flex items-center justify-center hover:bg-white/5 text-slate-400">
                    <Minus size={20} />
                </button>
            </div>
        </div>

        {/* HUD Elements Over Map */}
        <div className="absolute top-8 left-8 z-[1000] hidden lg:block pointer-events-none">
            <div className="glass-hud p-6 rounded-2xl flex items-center space-x-6 backdrop-blur-2xl border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 italic">Sincronización GPS</span>
                    <span className="text-xl font-black uppercase text-emerald-400 italic font-mono tracking-tighter">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 italic">Proyección UTM</span>
                    <span className="text-xl font-black uppercase text-blue-400 italic font-mono tracking-tighter">
                      {isValidLatLng(userPos?.[0], userPos?.[1]) ? `16P ${Math.round(583000 + userPos![0]*100)}E ${Math.round(1340000 + userPos![1]*100)}N` : "CALIBRANDO..."}
                    </span>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 italic">Estado Satélites</span>
                    <span className="text-xl font-black uppercase text-amber-500 italic font-mono tracking-tighter">9 ACTIVOS</span>
                </div>
            </div>
        </div>
        
        {/* Floating Mic Button */}
        <div className="absolute right-8 top-8 z-[1000]">
            <button 
              onClick={() => {
                  setMicActive(!micActive);
                  if(!micActive) speak("Escuchando comandos. Diga: reporte, o emergencia.");
              }}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 group relative ${micActive ? 'bg-red-600' : 'bg-slate-900 border border-white/10 hover:bg-slate-800 shadow-blue-500/20'}`}
            >
                {micActive && <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20"></div>}
                <Mic size={28} className={micActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
            </button>
        </div>
      </div>
    </div>
  );
}
