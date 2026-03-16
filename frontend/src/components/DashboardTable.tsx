import type { AppointmentResponse } from '../types'
import { formatDateTime } from '../utils'
import { StatusBadge } from './StatusBadge'

type DashboardTableProps = {
  title: string
  description: string
  appointments: AppointmentResponse[]
}

export function DashboardTable({ title, description, appointments }: DashboardTableProps) {
  return (
    <section className="data-section">
      <div className="data-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="table-grid">
        {appointments.length === 0 ? (
          <div className="state-card state-card-compact">
            <h3>Sin citas registradas</h3>
            <p>Las nuevas reservas apareceran aqui apenas se creen.</p>
          </div>
        ) : (
          appointments.map((appointment) => (
            <article className="table-row" key={appointment.id}>
              <div>
                <StatusBadge status={appointment.status} />
                <h4>{appointment.patientName}</h4>
                <p>
                  {appointment.doctorName} · {appointment.specialty}
                </p>
              </div>
              <div>
                <p>{formatDateTime(appointment.scheduledAt)}</p>
                <p>{appointment.reason}</p>
              </div>
              <div>
                <p>{appointment.patientEmail}</p>
                <p>{appointment.patientPhone}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
