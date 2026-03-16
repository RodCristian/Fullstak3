import {
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import './App.css'
import {
  buildBasicAuthToken,
  createAppointment,
  fetchAdminDashboard,
  fetchCurrentUser,
  fetchDoctorDashboard,
  fetchDoctors,
  fetchPublicOverview,
  submitMedicalReport,
} from './api'
import { DashboardTable } from './components/DashboardTable'
import { FeatureCard } from './components/FeatureCard'
import { MetricCard } from './components/MetricCard'
import { NotificationPanel } from './components/NotificationPanel'
import { StatusBadge } from './components/StatusBadge'
import { TicketPanel } from './components/TicketPanel'
import type {
  AdminDashboardResponse,
  AuthMeResponse,
  BookingResultResponse,
  CompleteAppointmentPayload,
  DoctorCardResponse,
  DoctorDashboardResponse,
  MedicalReportResponse,
  PublicOverviewResponse,
} from './types'
import {
  createDefaultBookingForm,
  EMPTY_REPORT,
  formatDateTime,
  getErrorMessage,
  getMinSchedule,
  STAFF_STORAGE_KEY,
  type BookingFormState,
} from './utils'

type StaffFormState = {
  email: string
  password: string
}

function App() {
  const [doctors, setDoctors] = useState<DoctorCardResponse[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [bookingForm, setBookingForm] = useState<BookingFormState>(createDefaultBookingForm())
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [bookingResult, setBookingResult] = useState<BookingResultResponse | null>(null)
  const [portalError, setPortalError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [publicOverview, setPublicOverview] = useState<PublicOverviewResponse | null>(null)
  const [publicOverviewRefreshedAt, setPublicOverviewRefreshedAt] = useState<string | null>(null)
  const [staffToken, setStaffToken] = useState('')
  const [staffForm, setStaffForm] = useState<StaffFormState>({
    email: 'admin@navycare.local',
    password: 'Admin123!',
  })
  const [staffUser, setStaffUser] = useState<AuthMeResponse | null>(null)
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardResponse | null>(null)
  const [doctorDashboard, setDoctorDashboard] = useState<DoctorDashboardResponse | null>(null)
  const [reportDrafts, setReportDrafts] = useState<Record<number, CompleteAppointmentPayload>>({})
  const [activeReportId, setActiveReportId] = useState<number | null>(null)
  const [submittingReportId, setSubmittingReportId] = useState<number | null>(null)
  const [reportFeedback, setReportFeedback] = useState('')

  useEffect(() => {
    void loadDoctors()
  }, [])

  useEffect(() => {
    void loadPublicOverview(true)

    const intervalId = window.setInterval(() => {
      void loadPublicOverview(false)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const savedToken = window.localStorage.getItem(STAFF_STORAGE_KEY)
    if (savedToken) {
      void hydrateStaffSession(savedToken)
    }
  }, [])

  useEffect(() => {
    if (doctors.length > 0 && bookingForm.doctorId === 0) {
      setBookingForm((current) => ({ ...current, doctorId: doctors[0].id }))
    }
  }, [doctors, bookingForm.doctorId])

  useEffect(() => {
    if (!doctorDashboard) {
      return
    }

    setReportDrafts((current) => {
      const next = { ...current }
      for (const appointment of doctorDashboard.appointments) {
        if (appointment.status === 'CONFIRMED' && !next[appointment.id]) {
          next[appointment.id] = { ...EMPTY_REPORT }
        }
      }
      return next
    })
  }, [doctorDashboard])

  useEffect(() => {
    if (!staffUser || !staffToken) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshCurrentDashboard()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [staffToken, staffUser])

  const selectedDoctor = doctors.find((doctor) => doctor.id === bookingForm.doctorId) ?? doctors[0]
  const completedReports = doctorDashboard?.appointments.filter((appointment) => appointment.medicalReport) ?? []

  async function loadDoctors() {
    setDoctorsLoading(true)
    try {
      const data = await fetchDoctors()
      startTransition(() => setDoctors(data))
    } catch (error) {
      setBookingError(getErrorMessage(error))
    } finally {
      setDoctorsLoading(false)
    }
  }

  async function loadPublicOverview(showLoader: boolean) {
    if (showLoader) {
      setOverviewLoading(true)
    }

    try {
      const data = await fetchPublicOverview()
      startTransition(() => {
        setPublicOverview(data)
        setPublicOverviewRefreshedAt(new Date().toISOString())
      })
    } catch (error) {
      setBookingError(getErrorMessage(error))
    } finally {
      if (showLoader) {
        setOverviewLoading(false)
      }
    }
  }

  async function hydrateStaffSession(token: string) {
    setPortalError('')
    setPortalLoading(true)

    try {
      const user = await fetchCurrentUser(token)
      window.localStorage.setItem(STAFF_STORAGE_KEY, token)
      setStaffToken(token)

      if (user.role === 'ADMIN') {
        const dashboard = await fetchAdminDashboard(token)
        startTransition(() => {
          setStaffUser(user)
          setAdminDashboard(dashboard)
          setDoctorDashboard(null)
        })
      } else {
        const dashboard = await fetchDoctorDashboard(token)
        startTransition(() => {
          setStaffUser(user)
          setDoctorDashboard(dashboard)
          setAdminDashboard(null)
        })
      }
    } catch (error) {
      clearSession()
      setPortalError(getErrorMessage(error))
    } finally {
      setPortalLoading(false)
    }
  }

  async function refreshCurrentDashboard() {
    if (!staffToken || !staffUser) {
      return
    }

    setPortalLoading(true)
    setPortalError('')

    try {
      if (staffUser.role === 'ADMIN') {
        const dashboard = await fetchAdminDashboard(staffToken)
        startTransition(() => setAdminDashboard(dashboard))
      } else {
        const dashboard = await fetchDoctorDashboard(staffToken)
        startTransition(() => setDoctorDashboard(dashboard))
      }
    } catch (error) {
      setPortalError(getErrorMessage(error))
    } finally {
      setPortalLoading(false)
    }
  }

  function clearSession() {
    window.localStorage.removeItem(STAFF_STORAGE_KEY)
    setStaffToken('')
    setStaffUser(null)
    setAdminDashboard(null)
    setDoctorDashboard(null)
    setPortalError('')
    setReportFeedback('')
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBookingError('')
    setBookingSuccess('')
    setBookingResult(null)
    setBookingSubmitting(true)

    try {
      const response = await createAppointment(bookingForm)
      setBookingSuccess(
        `${response.appointment.patientName} quedo agendado con ${response.appointment.doctorName} para el ${formatDateTime(response.appointment.scheduledAt)}.`,
      )
      setBookingResult(response)
      setBookingForm(createDefaultBookingForm(bookingForm.doctorId))
      await loadPublicOverview(false)
      if (staffUser) {
        void refreshCurrentDashboard()
      }
    } catch (error) {
      setBookingError(getErrorMessage(error))
    } finally {
      setBookingSubmitting(false)
    }
  }

  async function handlePortalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = buildBasicAuthToken(staffForm.email.trim(), staffForm.password)
    await hydrateStaffSession(token)
  }

  async function handleReportSubmit(appointmentId: number) {
    if (!staffToken || !reportDrafts[appointmentId]) {
      return
    }

    setSubmittingReportId(appointmentId)
    setPortalError('')
    setReportFeedback('')

    try {
      const report = await submitMedicalReport(staffToken, appointmentId, reportDrafts[appointmentId])
      setReportFeedback(buildReportFeedback(report))
      setReportDrafts((current) => ({ ...current, [appointmentId]: { ...EMPTY_REPORT } }))
      setActiveReportId(null)
      await refreshCurrentDashboard()
    } catch (error) {
      setPortalError(getErrorMessage(error))
    } finally {
      setSubmittingReportId(null)
    }
  }

  function setDemoStaff(role: 'ADMIN' | 'DOCTOR') {
    if (role === 'ADMIN') {
      setStaffForm({ email: 'admin@navycare.local', password: 'Admin123!' })
      return
    }

    setStaffForm({
      email: doctors[0]?.email ?? 'valentina.rojas@navycare.local',
      password: 'Doctor123!',
    })
  }

  return (
    <main className="app-shell">
      <div className="app-background" />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-badge">NC</span>
          <div>
            <p className="brand-name">NavyCare Scheduler</p>
            <p className="brand-caption">MVP de agenda médica con automatizaciones clave</p>
          </div>
        </div>

        <nav className="topbar-nav">
          <a href="#reserva">Reserva</a>
          <a href="#funcionalidades">Flujo</a>
          <a href="#portal">Portal interno</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Agenda, confirma y cierra la atención en un solo flujo</span>
          <h1>Aplicación web moderna para gestionar citas médicas, tickets clínicos y seguimiento post consulta.</h1>
          <p className="hero-description">
            Este MVP ya contempla reserva por paciente, persistencia en base de datos, correo de confirmación,
            Google Calendar configurable, panel administrativo, portal médico y envío del resumen clínico con
            recomendaciones de especialistas.
          </p>

          <div className="hero-actions">
            <a className="button button-primary" href="#reserva">
              Reservar una hora
            </a>
            <a className="button button-secondary" href="#portal">
              Ir al portal interno
            </a>
          </div>

          <div className="hero-metrics">
            <MetricCard label="Medicos" value={doctors.length || 5} description="Staff base listo para demo" />
            <MetricCard
              label="Citas creadas"
              value={publicOverview?.totalAppointments ?? 0}
              description="Se actualiza en tiempo real"
            />
            <MetricCard
              label="Correos enviados"
              value={publicOverview?.sentNotifications ?? 0}
              description="Solo sube si SMTP esta activo"
            />
          </div>
        </div>

        <div className="hero-spotlight">
          <div className="glass-card spotlight-card">
            <span className="panel-chip">Flujo MVP</span>
            <h2>De la reserva al cierre clínico, sin salir de la plataforma.</h2>
            <ul className="timeline-list">
              <li>Paciente reserva una hora y queda confirmada en base de datos.</li>
              <li>El sistema crea tickets internos para admin y médico.</li>
              <li>Con credenciales configuradas, registra también el evento en Google Calendar.</li>
              <li>El médico cierra la cita con su formulario y el paciente recibe el resumen por correo.</li>
            </ul>
          </div>

          {selectedDoctor ? (
            <div className="glass-card doctor-highlight">
              <div className="doctor-highlight-header">
                <span className="panel-chip muted">{selectedDoctor.specialty}</span>
                <span className="availability-dot" />
              </div>
              <h3>{selectedDoctor.fullName}</h3>
              <p>{selectedDoctor.bio}</p>
              <div className="doctor-highlight-meta">
                <span>{selectedDoctor.office}</span>
                <span>{selectedDoctor.email}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-grid" id="reserva">
        <div className="section-heading">
          <span className="eyebrow">Reserva pública</span>
          <h2>Agenda una consulta con una experiencia clara y profesional.</h2>
          <p>
            El formulario guarda pacientes y citas en la base H2 persistente. Si activas SMTP y Google Calendar, el
            sistema además enviará correos reales y creará eventos reales en el calendario compartido.
          </p>
        </div>

        <div className="booking-layout">
          <form className="glass-card booking-form" onSubmit={handleBookingSubmit}>
            <div className="form-grid">
              <label>
                Nombre del paciente
                <input
                  value={bookingForm.patientName}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientName: event.target.value }))}
                  placeholder="Ej. Martina González"
                  required
                />
              </label>
              <label>
                Correo electrónico
                <input
                  type="email"
                  value={bookingForm.patientEmail}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientEmail: event.target.value }))}
                  placeholder="paciente@correo.com"
                  required
                />
              </label>
              <label>
                Teléfono
                <input
                  value={bookingForm.patientPhone}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientPhone: event.target.value }))}
                  placeholder="+56 9 5555 5555"
                  required
                />
              </label>
              <label>
                Médico tratante
                <select
                  value={bookingForm.doctorId}
                  onChange={(event) => setBookingForm((current) => ({ ...current, doctorId: Number(event.target.value) }))}
                  required
                >
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName} · {doctor.specialty}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha y hora
                <input
                  type="datetime-local"
                  min={getMinSchedule()}
                  value={bookingForm.scheduledAt}
                  onChange={(event) => setBookingForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                  required
                />
              </label>
              <label>
                Duración
                <select
                  value={bookingForm.durationMinutes}
                  onChange={(event) =>
                    setBookingForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))
                  }
                >
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos</option>
                </select>
              </label>
            </div>

            <label>
              Motivo de la consulta
              <textarea
                value={bookingForm.reason}
                onChange={(event) => setBookingForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Dolor de espalda, control anual, revisión dermatológica, etc."
                required
              />
            </label>

            {bookingError ? <p className="feedback feedback-error">{bookingError}</p> : null}
            {bookingSuccess ? <p className="feedback feedback-success">{bookingSuccess}</p> : null}

            {bookingResult ? (
              <div className="booking-result-card">
                <div className="integration-strip">
                  <span className={`integration-pill ${bookingResult.mailDeliveryConfigured ? 'is-ok' : 'is-warn'}`}>
                    Correo {bookingResult.mailDeliveryConfigured ? 'configurado' : 'pendiente'}
                  </span>
                  <span className={`integration-pill ${bookingResult.calendarConfigured ? 'is-ok' : 'is-warn'}`}>
                    Calendar {bookingResult.calendarConfigured ? 'configurado' : 'pendiente'}
                  </span>
                  <span
                    className={`integration-pill ${
                      bookingResult.calendarSyncStatus === 'SYNCED' ? 'is-ok' : 'is-warn'
                    }`}
                  >
                    Sync {bookingResult.calendarSyncStatus === 'SYNCED' ? 'realizada' : 'omitida'}
                  </span>
                </div>

                <p className="booking-result-title">Resultado inmediato de la reserva</p>
                <ul className="compact-list">
                  <li>Tickets creados: {bookingResult.tickets.length}</li>
                  <li>Correo: {bookingResult.mailStatusMessage}</li>
                  <li>Calendar: {bookingResult.calendarStatusMessage}</li>
                  <li>Sincronizacion de Calendar: {bookingResult.calendarSyncMessage}</li>
                </ul>

                <div className="booking-notification-grid">
                  {bookingResult.notifications.map((notification) => (
                    <article className="booking-notification-item" key={notification.id}>
                      <div className="ticket-card-header">
                        <StatusBadge status={notification.status} />
                        <span className="ticket-date">{notification.recipientEmail}</span>
                      </div>
                      <p className="booking-notification-subject">{notification.subject}</p>
                      <p>{notification.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <button className="button button-primary" type="submit" disabled={bookingSubmitting || doctorsLoading}>
              {bookingSubmitting ? 'Reservando...' : 'Confirmar cita'}
            </button>
          </form>

          <aside className="doctor-grid">
            {doctorsLoading ? (
              <div className="glass-card state-card">Cargando disponibilidad médica...</div>
            ) : (
              doctors.map((doctor) => (
                <article className="glass-card doctor-card" key={doctor.id}>
                  <div className="doctor-card-top">
                    <span className="panel-chip">{doctor.specialty}</span>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => setBookingForm((current) => ({ ...current, doctorId: doctor.id }))}
                    >
                      Seleccionar
                    </button>
                  </div>
                  <h3>{doctor.fullName}</h3>
                  <p>{doctor.bio}</p>
                  <div className="doctor-card-footer">
                    <span>{doctor.office}</span>
                    <span>{doctor.email}</span>
                  </div>
                </article>
              ))
            )}
          </aside>
        </div>
      </section>

      <section className="feature-strip" id="funcionalidades">
        <FeatureCard title="Agenda operativa" description="Persistencia de pacientes y citas con validación de solapamientos." />
        <FeatureCard title="Notificaciones" description="Correos al paciente y avisos internos para administración y staff médico." />
        <FeatureCard title="Cierre clínico" description="Formulario del médico con receta, exámenes, indicaciones y seguimiento." />
        <FeatureCard title="Recomendación opcional" description="Sugerencias de especialistas basadas en los hallazgos clínicos." />
      </section>

      <section className="section-grid">
        <div className="section-heading">
          <span className="eyebrow">Estado operativo</span>
          <h2>La app ahora deja evidencia visible de lo que va ocurriendo.</h2>
          <p>
            Este bloque cambia aunque no entres al portal interno: muestra crecimiento de citas, tickets abiertos y
            trazabilidad de correos generados por cada reserva.
          </p>
        </div>

        <div className="dashboard-stack">
          <div className="dashboard-metrics">
            <MetricCard
              label="Citas totales"
              value={publicOverview?.totalAppointments ?? 0}
              description="Reservas persistidas en la base"
            />
            <MetricCard
              label="Proximas"
              value={publicOverview?.upcomingAppointments ?? 0}
              description="Pendientes de atencion"
            />
            <MetricCard
              label="Tickets abiertos"
              value={publicOverview?.openTickets ?? 0}
              description="Admin y medico"
            />
            <MetricCard
              label="Integraciones"
              value={`${publicOverview?.mailDeliveryConfigured ? 'Mail on' : 'Mail off'} / ${
                publicOverview?.calendarConfigured ? 'Cal on' : 'Cal off'
              }`}
              description="Estado actual de correo y Calendar"
            />
          </div>

          {publicOverview ? (
            <div className="integration-status-grid">
              <article className="glass-card integration-status-card">
                <div className="ticket-card-header">
                  <span className={`integration-pill ${publicOverview.mailDeliveryConfigured ? 'is-ok' : 'is-warn'}`}>
                    Correo {publicOverview.mailDeliveryConfigured ? 'listo' : 'pendiente'}
                  </span>
                  {publicOverviewRefreshedAt ? (
                    <span className="ticket-date">Actualizado {formatDateTime(publicOverviewRefreshedAt)}</span>
                  ) : null}
                </div>
                <h3>Estado de correo</h3>
                <p>{publicOverview.mailStatusMessage}</p>
              </article>

              <article className="glass-card integration-status-card">
                <div className="ticket-card-header">
                  <span className={`integration-pill ${publicOverview.calendarConfigured ? 'is-ok' : 'is-warn'}`}>
                    Calendar {publicOverview.calendarConfigured ? 'listo' : 'pendiente'}
                  </span>
                </div>
                <h3>Estado de Google Calendar</h3>
                <p>{publicOverview.calendarStatusMessage}</p>
              </article>
            </div>
          ) : null}

          {overviewLoading ? <div className="glass-card state-card">Cargando actividad del sistema...</div> : null}

          {publicOverview ? (
            <>
              <DashboardTable
                title="Citas recientes"
                description="Cada nueva reserva queda visible aqui apenas se persiste."
                appointments={publicOverview.recentAppointments}
              />
              <TicketPanel
                title="Tickets recientes"
                description="Cada cita nueva genera tickets internos visibles aqui."
                tickets={publicOverview.recentTickets}
              />
              <NotificationPanel
                title="Notificaciones recientes"
                description="Aqui veras si el correo salio, quedo pendiente o fallo."
                notifications={publicOverview.recentNotifications}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="section-grid portal-section" id="portal">
        <div className="section-heading">
          <span className="eyebrow">Portal interno</span>
          <h2>Un panel para administración y otro para el médico, con credenciales demo incluidas.</h2>
          <p>El acceso usa autenticación básica simple para acelerar el MVP sin dejar fuera el control de roles.</p>
        </div>

        <div className="portal-layout">
          <aside className="glass-card portal-access">
            <div className="portal-access-header">
              <div>
                <span className="panel-chip">Acceso</span>
                <h3>{staffUser ? 'Sesión activa' : 'Ingresar al panel'}</h3>
              </div>
              {staffUser ? (
                <button className="button button-secondary" type="button" onClick={clearSession}>
                  Cerrar sesión
                </button>
              ) : null}
            </div>

            {!staffUser ? (
              <>
                <form className="portal-form" onSubmit={handlePortalSubmit}>
                  <label>
                    Correo
                    <input
                      type="email"
                      value={staffForm.email}
                      onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Contraseña
                    <input
                      type="password"
                      value={staffForm.password}
                      onChange={(event) => setStaffForm((current) => ({ ...current, password: event.target.value }))}
                      required
                    />
                  </label>
                  {portalError ? <p className="feedback feedback-error">{portalError}</p> : null}
                  <button className="button button-primary" type="submit" disabled={portalLoading}>
                    {portalLoading ? 'Validando...' : 'Entrar al portal'}
                  </button>
                </form>

                <div className="demo-credentials">
                  <p className="demo-credentials-title">Credenciales sugeridas</p>
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('ADMIN')}>
                    Admin demo · admin@navycare.local / Admin123!
                  </button>
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('DOCTOR')}>
                    Médico demo · {doctors[0]?.email ?? 'valentina.rojas@navycare.local'} / Doctor123!
                  </button>
                </div>
              </>
            ) : (
              <div className="session-card">
                <p className="session-name">{staffUser.displayName}</p>
                <p className="session-role">{staffUser.role === 'ADMIN' ? 'Administrador' : 'Médico tratante'}</p>
                <p className="session-meta">{staffUser.email}</p>
                <button className="button button-secondary" type="button" onClick={refreshCurrentDashboard}>
                  Actualizar panel
                </button>
              </div>
            )}
          </aside>

          <section className="glass-card portal-content">
            {portalLoading ? <div className="state-card">Sincronizando datos del portal...</div> : null}
            {portalError && staffUser ? <p className="feedback feedback-error">{portalError}</p> : null}
            {reportFeedback ? <p className="feedback feedback-success">{reportFeedback}</p> : null}

            {!portalLoading && !staffUser ? (
              <div className="state-card">
                <h3>Panel listo para demo</h3>
                <p>Inicia sesión para ver tickets, citas y completar el formulario post consulta del médico.</p>
              </div>
            ) : null}

            {!portalLoading && staffUser?.role === 'ADMIN' && adminDashboard ? (
              <div className="dashboard-stack">
                <div className="dashboard-metrics">
                  <MetricCard label="Citas totales" value={adminDashboard.totalAppointments} description="Histórico en la base" />
                  <MetricCard label="Próximas" value={adminDashboard.upcomingAppointments} description="Pendientes de atención" />
                  <MetricCard label="Completadas" value={adminDashboard.completedAppointments} description="Con ficha cerrada" />
                  <MetricCard label="Tickets abiertos" value={adminDashboard.openTickets} description="Requieren seguimiento" />
                </div>
                <DashboardTable
                  title="Citas recientes"
                  description="Vista operativa para coordinación y seguimiento."
                  appointments={adminDashboard.appointments}
                />
                <TicketPanel
                  title="Tickets administrativos"
                  description="Cada reserva crea un ticket visible para el panel admin."
                  tickets={adminDashboard.tickets}
                />
              </div>
            ) : null}

            {!portalLoading && staffUser?.role === 'DOCTOR' && doctorDashboard ? (
              <div className="dashboard-stack">
                <div className="dashboard-header">
                  <div>
                    <span className="panel-chip">{doctorDashboard.doctor.specialty}</span>
                    <h3>{doctorDashboard.doctor.fullName}</h3>
                    <p>{doctorDashboard.doctor.bio}</p>
                  </div>
                  <div className="dashboard-doctor-metrics">
                    <MetricCard label="Citas" value={doctorDashboard.totalAppointments} description="Histórico del médico" />
                    <MetricCard label="Pendientes" value={doctorDashboard.pendingReports} description="Sin formulario final" />
                    <MetricCard label="Informes" value={completedReports.length} description="Ya enviados al paciente" />
                  </div>
                </div>

                <div className="doctor-appointments">
                  {doctorDashboard.appointments.map((appointment) => (
                    <article className="appointment-card" key={appointment.id}>
                      <div className="appointment-card-header">
                        <div>
                          <StatusBadge status={appointment.status} />
                          <h4>{appointment.patientName}</h4>
                          <p>{formatDateTime(appointment.scheduledAt)}</p>
                        </div>
                        {appointment.status === 'CONFIRMED' ? (
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() =>
                              setActiveReportId((current) => (current === appointment.id ? null : appointment.id))
                            }
                          >
                            {activeReportId === appointment.id ? 'Cerrar ficha' : 'Completar ficha'}
                          </button>
                        ) : null}
                      </div>

                      <p className="appointment-reason">{appointment.reason}</p>
                      <div className="appointment-meta">
                        <span>{appointment.patientEmail}</span>
                        <span>{appointment.patientPhone}</span>
                      </div>

                      {appointment.medicalReport ? (
                        <div className="report-summary">
                          <h5>Resumen enviado al paciente</h5>
                          <p>
                            <strong>Diagnóstico:</strong> {appointment.medicalReport.diagnosis}
                          </p>
                          <p>
                            <strong>Receta:</strong> {appointment.medicalReport.prescription}
                          </p>
                          {appointment.medicalReport.recommendations.length > 0 ? (
                            <div className="recommendation-box">
                              <p className="recommendation-title">Sugerencias de especialistas</p>
                              <ul className="compact-list">
                                {appointment.medicalReport.recommendations.map((recommendation) => (
                                  <li key={`${appointment.id}-${recommendation.doctorEmail}`}>
                                    {recommendation.specialty}: {recommendation.doctorName} · {recommendation.rationale}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {appointment.status === 'CONFIRMED' && activeReportId === appointment.id ? (
                        <div className="report-form-card">
                          <div className="form-grid">
                            <label>
                              Diagnóstico
                              <textarea
                                value={reportDrafts[appointment.id]?.diagnosis ?? ''}
                                onChange={(event) =>
                                  updateReportDraft(setReportDrafts, appointment.id, 'diagnosis', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Receta
                              <textarea
                                value={reportDrafts[appointment.id]?.prescription ?? ''}
                                onChange={(event) =>
                                  updateReportDraft(setReportDrafts, appointment.id, 'prescription', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Exámenes
                              <textarea
                                value={reportDrafts[appointment.id]?.exams ?? ''}
                                onChange={(event) =>
                                  updateReportDraft(setReportDrafts, appointment.id, 'exams', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Indicaciones
                              <textarea
                                value={reportDrafts[appointment.id]?.indications ?? ''}
                                onChange={(event) =>
                                  updateReportDraft(setReportDrafts, appointment.id, 'indications', event.target.value)
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Plan de seguimiento
                            <textarea
                              value={reportDrafts[appointment.id]?.followUpPlan ?? ''}
                              onChange={(event) =>
                                updateReportDraft(setReportDrafts, appointment.id, 'followUpPlan', event.target.value)
                              }
                            />
                          </label>
                          <button
                            className="button button-primary"
                            type="button"
                            onClick={() => void handleReportSubmit(appointment.id)}
                            disabled={submittingReportId === appointment.id}
                          >
                            {submittingReportId === appointment.id ? 'Enviando...' : 'Cerrar cita y enviar resumen'}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>

                <TicketPanel
                  title="Tickets del médico"
                  description="Cada nueva cita genera una alerta para el panel clínico."
                  tickets={doctorDashboard.tickets}
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  )
}

function updateReportDraft(
  setReportDrafts: Dispatch<SetStateAction<Record<number, CompleteAppointmentPayload>>>,
  appointmentId: number,
  field: keyof CompleteAppointmentPayload,
  value: string,
) {
  setReportDrafts((current) => ({
    ...current,
    [appointmentId]: {
      ...(current[appointmentId] ?? EMPTY_REPORT),
      [field]: value,
    },
  }))
}

function buildReportFeedback(report: MedicalReportResponse) {
  if (report.recommendations.length === 0) {
    return 'La ficha fue enviada al paciente correctamente.'
  }

  return `La ficha fue enviada al paciente y se generaron ${report.recommendations.length} sugerencias de especialistas.`
}

export default App
