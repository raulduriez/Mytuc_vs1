export interface Cooperative {
  id: string;
  nombre: string;
  codigo: string;
  bloqueado: boolean;
}

export interface Unit {
  id: string;
  cooperativa: string;
  numero: string;
  ruta: string;
  codigo_acceso: number;
  activo: boolean;
  bloqueado: boolean;
  conductor_nombre: string;
  conductor_tel: string;
  ultima_conexion?: string;
  lat?: number;
  lng?: number;
}

export interface Dispatch {
  unidad: string;
  conductor: string;
  telefono: string;
  fecha: string;
  hora_salida: string;
  hora_llegada?: string;
  timestamp_salida: number;
  timestamp_llegada?: number;
  ciclo_actual: number;
  estado: string;
  empresa: string;
  supervisor_despacho: string;
  ultima_actualizacion: number;
  despacho_activo: boolean;
  marcacion_P17?: string;
  marcacion_P24?: string;
  marcacion_P31?: string;
  marcacion_P48?: string;
  marcacion_P54?: string;
  marcacion_P66?: string;
  marcacion_P76?: string;
  variacion_P17?: number;
  variacion_P24?: number;
  variacion_P31?: number;
  variacion_P48?: number;
  variacion_P54?: number;
  variacion_P66?: number;
  variacion_P76?: number;
}

export interface ChatMessage {
  id?: string;
  user: string;
  msg: string;
  time: string;
  type?: 'public' | 'admin';
  phone?: string;
}

export interface BlockedNumber {
  phone: string;
  reason: string;
  timestamp: number;
}

export interface EmergencyAlert {
  loc: [number, number];
  tel: string;
  time: number;
}
