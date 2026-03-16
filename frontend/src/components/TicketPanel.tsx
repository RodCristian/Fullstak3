import type { TicketResponse } from '../types'
import { formatDateTime } from '../utils'
import { StatusBadge } from './StatusBadge'

type TicketPanelProps = {
  title: string
  description: string
  tickets: TicketResponse[]
}

export function TicketPanel({ title, description, tickets }: TicketPanelProps) {
  return (
    <section className="data-section">
      <div className="data-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="ticket-grid">
        {tickets.length === 0 ? (
          <div className="state-card state-card-compact">
            <h3>Sin tickets todavia</h3>
            <p>Cuando se cree una cita, los tickets internos apareceran aqui.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <article className="ticket-card" key={ticket.id}>
              <div className="ticket-card-header">
                <StatusBadge status={ticket.status} />
                <span className="ticket-date">{formatDateTime(ticket.createdAt)}</span>
              </div>
              <h4>{ticket.subject}</h4>
              <p>{ticket.description}</p>
              <div className="ticket-card-footer">
                <span>Cita #{ticket.appointmentId}</span>
                {ticket.doctorName ? <span>{ticket.doctorName}</span> : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
