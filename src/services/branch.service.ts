import APIBase from './httpBase'

export interface Branch {
  _id: string
  name: string
  isActive: boolean
  sortOrder: number
  /** Empresa dueña: 'nicole' = La Finestra, 'sucree' = Sucrenda (mismos valores que la marca del pedido). */
  company: BranchCompany
}

export type BranchCompany = 'nicole' | 'sucree'

export const BRANCH_COMPANY_LABELS: Record<BranchCompany, string> = {
  nicole: 'La Finestra (Nicole)',
  sucree: 'Sucrenda (Sucrée)',
}

class BranchService extends APIBase {
  async getBranches(): Promise<Branch[]> {
    const res = await this.get<{ data: Branch[] }>('/branches')
    return res.data.data || []
  }

  async createBranch(data: { name: string; isActive?: boolean; sortOrder?: number; company?: BranchCompany }): Promise<Branch> {
    const res = await this.post<{ data: Branch }>('/branches', data)
    return res.data.data
  }

  async updateBranch(id: string, data: Partial<{ name: string; isActive: boolean; sortOrder: number; company: BranchCompany }>): Promise<Branch> {
    const res = await this.put<{ data: Branch }>(`/branches/${id}`, data)
    return res.data.data
  }

  /** Con historial el back no la borra: la desactiva (`deactivated: true`). */
  async deleteBranch(id: string): Promise<{ deactivated: boolean; message: string }> {
    const res = await this.delete<{ deactivated?: boolean; message?: string }>(`/branches/${id}`)
    return { deactivated: !!res.data?.deactivated, message: res.data?.message || '' }
  }
}

export default new BranchService()
