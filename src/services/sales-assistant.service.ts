import APIBase from './httpBase'

export type SalesGroup = 'CALIENTE' | 'TIBIO' | 'REBOTO' | 'FRIO' | 'POSTVENTA' | 'TAREA'
export type MarkStatus = 'GESTIONADO' | 'NO_GESTIONAR' | null

export interface SalesMark {
  read: boolean
  status: MarkStatus
  by?: string
  at?: string
}

export interface SalesItem {
  key: string
  group: SalesGroup
  source: 'crm' | 'app'
  marca: 'nicole' | 'sucree'
  cliente: string
  telefono?: string
  ultimoMensaje?: string
  ultimoMensajeDe?: 'cliente' | 'equipo'
  recibido?: string
  motivo: string
  puntaje?: number
  prioridad?: 'ALTA' | 'MEDIA' | 'BAJA'
  paso?: string
  senales?: string[]
  falta?: string
  seguimiento?: string
  tarea?: string
  detalle?: string
  mensaje: string
  conversationId?: string
  orderId?: string
  mark: SalesMark | null
}

export interface SalesAnalysis {
  _id: string
  status: 'RUNNING' | 'DONE' | 'ERROR'
  from: string
  to: string
  by: { id?: string; name: string }
  items: SalesItem[]
  conversationsRead: number
  warnings: string[]
  createdAt: string
}

export interface SalesAnalysisSummary {
  _id: string
  createdAt: string
  from: string
  to: string
  by: { name: string }
  conversationsRead: number
  counts: Partial<Record<SalesGroup, number>>
}

interface AnalysisResponse {
  analysis: SalesAnalysis | null
  running?: { by?: { name: string }; createdAt: string } | null
  aiConfigured: boolean
}

class SalesAssistantService extends APIBase {
  async latest(): Promise<AnalysisResponse> {
    const response = await this.get<AnalysisResponse>('sales-assistant/latest')
    return response.data
  }

  async history(): Promise<SalesAnalysisSummary[]> {
    const response = await this.get<{ analyses: SalesAnalysisSummary[] }>('sales-assistant/history')
    return response.data.analyses
  }

  async byId(id: string): Promise<AnalysisResponse> {
    const response = await this.get<AnalysisResponse>(`sales-assistant/analyses/${id}`)
    return response.data
  }

  /** Lee el CRM y llama a la IA: puede tardar uno o dos minutos. */
  async analyze(): Promise<AnalysisResponse> {
    const response = await this.post<AnalysisResponse>('sales-assistant/analyze', {}, undefined, { timeout: 300000 })
    return response.data
  }

  async setMark(key: string, mark: { read: boolean; status: MarkStatus }): Promise<SalesMark> {
    const response = await this.put<{ mark: SalesMark }>(`sales-assistant/marks/${encodeURIComponent(key)}`, mark)
    return response.data.mark
  }
}

export default new SalesAssistantService()
