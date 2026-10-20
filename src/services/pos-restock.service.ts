import APIBase from './httpBase';

export interface RestockItem {
  productName: string;
  unit: string;
  isGeneral?: boolean;
  requiresMinimum?: boolean;
  category?: 'Producción' | 'Bodega';
  stockObjectiveTomorrow: number;
  stockObjectiveToday: number;
  lastEntry?: {
    stockFinal: number;
    bajas: number;
    pedidoSugerido: number;
    pedidoFinal?: number;
    date: string;
    detailedLosses?: DetailedLoss[];
  };
}

export interface DailyFormData {
  branch: string;
  formDate: string;
  targetDate: string;
  items: RestockItem[];
  upcomingOrders?: any[];
}

/** Venta del día según Contífico (porciones vendidas por producto). */
export interface DailySales {
  branch: string;
  date: string;
  available: boolean;
  puntos: string[];
  products: Record<string, number>;
}

export type LossCategory = "Transport" | "Storage" | "Production" | "Other";

export interface DetailedLoss {
  quantity: number;
  reason: string;
  category: LossCategory;
}

export interface RestockEntryItem {
  productName: string;
  unit: string;
  isGeneral?: boolean;
  requiresMinimum?: boolean;
  category?: 'Producción' | 'Bodega';
  bajas: number;
  bajasNote?: string;
  stockFinal: number; // This is the 'excedente'
  pedidoFinal: number;
  detailedLosses?: DetailedLoss[];
  deliveryRounds?: Array<{ label: string; quantity: number }>;
}

export interface RestockEntryPayload {
  branch: string;
  date: string;
  submittedBy: string;
  items: RestockEntryItem[];
}

export interface WeeklyObjectives {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface LeftoverRow {
  date: string;
  branch: string;
  productName: string;
  unit: string;
  stockInicial: number | null;
  recibido: number;
  bajas: number;
  bajasNote?: string;
  stockFinal: number;
  stockObjectiveTomorrow: number;
  pedidoFinal: number;
  ventaImplicita: number | null;
  submittedBy: string;
  submittedAt: string;
}

export interface LeftoversReport {
  rows: LeftoverRow[];
  totals: { rows: number; stockFinal: number; bajas: number; recibido: number; ventaImplicita: number };
  branches: string[];
  missing: Array<{ date: string; branch: string }>;
}

class POSRestockService extends APIBase {
  /**
   * Get the daily form data for a specific branch.
   */
  async getDailyForm(branch: string): Promise<DailyFormData> {
    const { data } = await this.get<any>('pos/restock/daily-form', undefined, { params: { branch } });
    return data.data;
  }

  /**
   * Venta del día de la sucursal según Contífico. Se pide aparte del
   * formulario porque Contífico tarda ~10-15s la primera vez por día.
   */
  async getDailySales(branch: string, date?: string): Promise<DailySales> {
    const { data } = await this.get<any>('pos/restock/daily-sales', undefined, { params: { branch, date } });
    return data.data;
  }

  /**
   * Submit the daily restock entry.
   */
  async submitDailyEntry(payload: RestockEntryPayload): Promise<any> {
    const { data } = await this.post<any>('pos/restock/daily-entry', payload);
    return data;
  }

  // TODO: Add real endpoints
  async getRestockConfiguration(branch: string): Promise<any[]> {
    const { data } = await this.get<any>('pos/restock/objectives', undefined, { params: { branch } });
    return data.data || [];
  }

  async upsertObjective(payload: any): Promise<void> {
    await this.post('pos/restock/objectives', payload);
  }

  /**
   * F10 — Sobrantes de cierre por día y sucursal (reporte de bodega).
   * `branch` omitido o 'all' devuelve todas las sucursales.
   */
  async getLeftovers(params: { from: string; to: string; branch?: string }): Promise<LeftoversReport> {
    const { data } = await this.get<any>('pos/restock/leftovers', undefined, { params });
    return {
      rows: data.rows || [],
      totals: data.totals || { rows: 0, stockFinal: 0, bajas: 0, recibido: 0, ventaImplicita: 0 },
      branches: data.branches || [],
      missing: data.missing || [],
    };
  }

  async deleteObjective(branch: string, productName: string): Promise<void> {
    await this.delete(`pos/restock/objectives/${productName}`, { params: { branch } });
  }
}

export const posRestockService = new POSRestockService();
