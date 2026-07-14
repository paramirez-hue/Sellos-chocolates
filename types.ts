
export enum UserRole {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
  AUXILIAR_SALIDA = 'AUXILIAR_SALIDA'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  password?: string; // Añadido para manejo de acceso
  role: UserRole;
  organization: string;
  city: string; // Sede asignada
}

export interface AppSettings {
  title: string;
  logo: string | null;
  sealTypes: string[];
  themeColor: string; // Color principal del tema
  zplConfig: string; // Configuración de etiqueta ZPL
}

export enum SealStatus {
  SALIDA_FABRICA = 'SALIDA_FABRICA',
  NO_INSTALADO = 'NO_INSTALADO',
  INSTALADO = 'INSTALADO',
  ENTREGADO = 'ENTREGADO',
  ENTRADA_INVENTARIO = 'ENTRADA_INVENTARIO',
  DESTRUIDO = 'DESTRUIDO',
  ASIGNADO = 'ASIGNADO',
  ASIGNACION_INSTALACION = 'ASIGNACION_INSTALACION',
  DESPACHADO = 'DESPACHADO'
}

export interface MovementHistory {
  date: string;
  fromStatus: SealStatus | null;
  toStatus: SealStatus;
  user: string;
  details: string;
}

export interface Seal {
  id: string;
  type: string;
  status: SealStatus;
  creationDate: string;
  lastMovement: string;
  entryUser: string;
  orderNumber: string;
  containerId: string;
  notes: string;
  city: string; // Ciudad a la que pertenece el precinto
  history: MovementHistory[];
  vehiclePlate?: string;
  trailerContainer?: string;
  deliveredSub?: string;
  requester?: string;
}

export interface FilterOptions {
  idSello: string;
  estado: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
}
