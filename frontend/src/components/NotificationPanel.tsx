import type { NotificationLogResponse } from '../types'
import { formatDateTime } from '../utils'
import { StatusBadge } from './StatusBadge'

type NotificationPanelProps = {
  title: string
  description: string
  notifications: NotificationLogResponse[]
}

export function NotificationPanel({ title, description, notifications }: NotificationPanelProps) {
  return (
    <section className="data-section">
      <div className="data-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="notification-grid">
        {notifications.length === 0 ? (
          <div className="state-card state-card-compact">
            <h3>Sin notificaciones registradas</h3>
            <p>Las trazas de correo y avisos internos apareceran aqui.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <article className="notification-card" key={notification.id}>
              <div className="ticket-card-header">
                <StatusBadge status={notification.status} />
                <span className="ticket-date">{formatDateTime(notification.createdAt)}</span>
              </div>
              <h4>{notification.subject}</h4>
              <p>{notification.recipientEmail}</p>
              <p>{notification.detail}</p>
              <div className="ticket-card-footer">
                <span>Cita #{notification.appointmentId}</span>
                <span>{notification.type}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
