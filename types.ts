
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  COMPANY_USER = 'COMPANY_USER'
}

export interface OdooCredential {
  id: string;
  companyName: string;
  url: string;
  db: string;
  username: string;
  isActive: boolean;
  lastSync?: string;
}

export interface SalesSummary {
  ventas_totales: number;
  costos_totales: number;
  utilidad_bruta: number;
  margen_global: number;
  ordenes_totales: number;
  ticket_promedio: number;
  items_vendidos: number;
}

export interface ProductSold {
  product_id: number;
  nombre: string;
  cantidad_vendida: number;
  ventas_totales: number;
  veces_vendido: number;
  precio_promedio: number;
}

export interface MonthlyData {
  mes: string;
  ventas: number;
  ordenes: number;
  ticket_promedio: number;
}

export interface CategoryData {
  nombre: string;
  ventas: number;
  cantidad: number;
}

export interface CustomerData {
  cliente_id: number;
  nombre: string;
  ventas_totales: number;
  ordenes: number;
  ticket_promedio: number;
  ultima_compra: string;
}
