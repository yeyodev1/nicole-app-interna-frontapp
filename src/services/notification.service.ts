import APIBase from './httpBase'

export interface AppNotification {
  _id: string
  type: string
  title: string
  message: string
  orderId?: string
  readAt?: string | null
  createdAt: string
}

class NotificationService extends APIBase {
  async list(limit = 30): Promise<{ notifications: AppNotification[]; unread: number }> {
    const response = await this.get<{ notifications: AppNotification[]; unread: number }>(
      'notifications',
      undefined,
      { params: { limit } }
    )
    return response.data
  }

  async markRead(id: string): Promise<void> {
    await this.patch(`notifications/${id}/read`, {})
  }

  async markAllRead(): Promise<void> {
    await this.post('notifications/read-all', {})
  }
}

export default new NotificationService()
