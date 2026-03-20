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
  formatCalendarSyncMessage,
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

type AppView = 'home' | 'booking' | 'operations' | 'portal'

type ViewDefinition = {
  id: AppView
  label: string
  caption: string
  eyebrow: string
  title: string
  description: string
}

const DEFAULT_ADMIN_EMAIL = 'criswido0+admin@gmail.com'
const DEFAULT_ADMIN_PASSWORD = 'Admin123!'
const DEFAULT_DOCTOR_PASSWORD = 'Doctor123!'

const APP_VIEWS: ViewDefinition[] = [
  {
    id: 'home',
    label: 'Resumen',
    caption: 'Vista ejecutiva del MVP',
    eyebrow: 'Demo lista para presentar',
    title: 'Agenda clinica clara, moderna y lista para mostrar en clase.',
    description:
      'NavyCare ahora se presenta como un MVP mas ordenado: resumen ejecutivo, agenda publica, operacion interna y portal clinico separados en vistas de navegacion.',
  },
  {
    id: 'booking',
    label: 'Reservas',
    caption: 'Agenda publica del paciente',
    eyebrow: 'Experiencia de paciente',
    title: 'Reservar una consulta ahora se siente como una pantalla propia del producto.',
    description:
      'La reserva publica mantiene base de datos, tickets, correo SMTP y Google Calendar, pero en una vista dedicada para que la demo se vea mucho mas profesional.',
  },
  {
    id: 'operations',
    label: 'Operacion',
    caption: 'Trazabilidad y actividad',
    eyebrow: 'Seguimiento operativo',
    title: 'Todo lo importante del flujo queda visible sin mezclarlo con el formulario de reserva.',
    description:
      'Aqui ves crecimiento de citas, tickets, integraciones, actividad reciente y estado real de notificaciones para explicar el MVP con evidencia concreta.',
  },
  {
    id: 'portal',
    label: 'Portal',
    caption: 'Acceso admin y medico',
    eyebrow: 'Backoffice clinico',
    title: 'El panel interno queda separado para que admin y medico tengan su propio espacio.',
    description:
      'Puedes entrar al portal, revisar tickets, ver la agenda y cerrar la ficha medica sin competir visualmente con la reserva publica.',
  },
]

function resolveViewFromHash(hash: string): AppView {
  const candidate = hash.replace('#', '')
  return APP_VIEWS.some((view) => view.id === candidate) ? (candidate as AppView) : 'home'
}

function App() {
  const [activeView, setActiveView] = useState<AppView>(() =>
    typeof window === 'undefined' ? 'home' : resolveViewFromHash(window.location.hash),
  )
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
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_ADMIN_PASSWORD,
  })
  const [staffUser, setStaffUser] = useState<AuthMeResponse | null>(null)
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardResponse | null>(null)
  const [doctorDashboard, setDoctorDashboard] = useState<DoctorDashboardResponse | null>(null)
  const [reportDrafts, setReportDrafts] = useState<Record<number, CompleteAppointmentPayload>>({})
  const [activeReportId, setActiveReportId] = useState<number | null>(null)
  const [submittingReportId, setSubmittingReportId] = useState<number | null>(null)
  const [reportFeedback, setReportFeedback] = useState('')

  useEffect(() => {
    const handleHashChange = () => setActiveView(resolveViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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

  const currentView = APP_VIEWS.find((view) => view.id === activeView) ?? APP_VIEWS[0]
  const selectedDoctor = doctors.find((doctor) => doctor.id === bookingForm.doctorId) ?? doctors[0]
  const completedReports = doctorDashboard?.appointments.filter((appointment) => appointment.medicalReport) ?? []
  const recentAppointments = publicOverview?.recentAppointments ?? []
  const recentTickets = publicOverview?.recentTickets ?? []
  const recentNotifications = publicOverview?.recentNotifications ?? []

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

  function navigateTo(view: AppView) {
    setActiveView(view)
    if (typeof window !== 'undefined') {
      window.location.hash = view
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
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
    navigateTo('portal')
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
      setStaffForm({ email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD })
      return
    }

    setStaffForm({
      email: doctors[0]?.email ?? 'criswido0+valentina@gmail.com',
      password: DEFAULT_DOCTOR_PASSWORD,
    })
  }
  function renderHeroActions() {
    if (activeView === 'booking') {
      return (
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={() => navigateTo('booking')}>
            Nueva reserva
          </button>
          <button className="button button-secondary" type="button" onClick={() => navigateTo('operations')}>
            Ver operacion
          </button>
        </div>
      )
    }

    if (activeView === 'operations') {
      return (
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={() => void loadPublicOverview(true)}>
            Actualizar actividad
          </button>
          <button className="button button-secondary" type="button" onClick={() => navigateTo('portal')}>
            Abrir portal
          </button>
        </div>
      )
    }

    if (activeView === 'portal') {
      return (
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={() => setDemoStaff('ADMIN')}>
            Cargar acceso admin
          </button>
          <button className="button button-secondary" type="button" onClick={() => setDemoStaff('DOCTOR')}>
            Cargar acceso medico
          </button>
        </div>
      )
    }

    return (
      <div className="hero-actions">
        <button className="button button-primary" type="button" onClick={() => navigateTo('booking')}>
          Ir a reservas
        </button>
        <button className="button button-secondary" type="button" onClick={() => navigateTo('portal')}>
          Abrir portal interno
        </button>
      </div>
    )
  }

  function renderHeroAside() {
    if (activeView === 'portal') {
      return (
        <div className="aside-stack">
          <article className="surface-card aside-card">
            <span className="panel-chip">Acceso demo</span>
            <h3>{staffUser ? 'Sesion activa en el portal' : 'Credenciales listas para entrar'}</h3>
            {staffUser ? (
              <>
                <p className="aside-copy">{staffUser.displayName}</p>
                <div className="meta-pair-grid">
                  <span>{staffUser.role === 'ADMIN' ? 'Administrador' : 'Medico tratante'}</span>
                  <span>{staffUser.email}</span>
                </div>
              </>
            ) : (
              <>
                <p className="aside-copy">Usa un click para cargar usuarios demo y mostrar el panel sin escribir nada a mano.</p>
                <div className="credential-stack">
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('ADMIN')}>
                    Admin demo - {DEFAULT_ADMIN_EMAIL}
                  </button>
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('DOCTOR')}>
                    Medico demo - {doctors[0]?.email ?? 'criswido0+valentina@gmail.com'}
                  </button>
                </div>
              </>
            )}
          </article>

          <article className="surface-card aside-card">
            <span className="panel-chip panel-chip-soft">Cobertura del MVP</span>
            <ul className="clean-list compact-list">
              <li>Admin revisa citas, volumen y tickets.</li>
              <li>Medico completa ficha, receta y seguimiento.</li>
              <li>Paciente recibe correo y resumen post consulta.</li>
            </ul>
          </article>
        </div>
      )
    }

    if (activeView === 'booking' && selectedDoctor) {
      return (
        <div className="aside-stack">
          <article className="surface-card aside-card highlight-card">
            <div className="card-topline">
              <span className="panel-chip">Profesional destacado</span>
              <span className="status-dot is-live" />
            </div>
            <h3>{selectedDoctor.fullName}</h3>
            <p className="aside-copy">{selectedDoctor.bio}</p>
            <div className="meta-pair-grid">
              <span>{selectedDoctor.specialty}</span>
              <span>{selectedDoctor.office}</span>
            </div>
          </article>

          <article className="surface-card aside-card">
            <span className="panel-chip panel-chip-soft">Lo que ocurre al confirmar</span>
            <ul className="clean-list compact-list">
              <li>La cita se guarda en base de datos.</li>
              <li>Se crea el evento real en Google Calendar.</li>
              <li>Se generan tickets para admin y medico.</li>
              <li>Las notificaciones se resuelven por SMTP.</li>
            </ul>
          </article>
        </div>
      )
    }

    return (
      <div className="aside-stack">
        <article className="surface-card aside-card">
          <div className="card-topline">
            <span className="panel-chip">Estado actual</span>
            {publicOverviewRefreshedAt ? <span className="subtle-note">Actualizado {formatDateTime(publicOverviewRefreshedAt)}</span> : null}
          </div>
          <h3>Integraciones visibles para la demo</h3>
          <div className="integration-strip">
            <span className={`integration-pill ${publicOverview?.mailDeliveryConfigured ? 'is-ok' : 'is-warn'}`}>
              Correo {publicOverview?.mailDeliveryConfigured ? 'listo' : 'pendiente'}
            </span>
            <span className={`integration-pill ${publicOverview?.calendarConfigured ? 'is-ok' : 'is-warn'}`}>
              Calendar {publicOverview?.calendarConfigured ? 'listo' : 'pendiente'}
            </span>
          </div>
          <p className="aside-copy">{activeView === 'operations' ? publicOverview?.calendarStatusMessage : publicOverview?.mailStatusMessage}</p>
        </article>

        <article className="surface-card aside-card">
          <span className="panel-chip panel-chip-soft">Pulso del sistema</span>
          <div className="mini-metric-list">
            <div>
              <strong>{publicOverview?.totalAppointments ?? 0}</strong>
              <span>Citas registradas</span>
            </div>
            <div>
              <strong>{publicOverview?.openTickets ?? 0}</strong>
              <span>Tickets abiertos</span>
            </div>
            <div>
              <strong>{publicOverview?.sentNotifications ?? 0}</strong>
              <span>Notificaciones enviadas</span>
            </div>
          </div>
        </article>
      </div>
    )
  }

  function renderHomeView() {
    return (
      <div className="page-stack">
        <section className="metric-grid metric-grid-four">
          <MetricCard label="Medicos" value={doctors.length || 5} description="Equipo base listo para demo" />
          <MetricCard
            label="Citas registradas"
            value={publicOverview?.totalAppointments ?? 0}
            description="Reservas visibles en la plataforma"
          />
          <MetricCard
            label="Tickets abiertos"
            value={publicOverview?.openTickets ?? 0}
            description="Coordinacion admin y medico"
          />
          <MetricCard
            label="Correos enviados"
            value={publicOverview?.sentNotifications ?? 0}
            description="Trazabilidad real del flujo SMTP"
          />
        </section>

        <section className="page-columns two-up">
          <article className="surface-card narrative-card">
            <div className="section-intro">
              <span className="eyebrow">Ruta clinica</span>
              <h2>El recorrido principal ya esta completo de punta a punta.</h2>
            </div>
            <ol className="clean-list flow-list">
              <li>Paciente agenda una hora desde la vista publica.</li>
              <li>La cita se persiste y se crean tickets internos.</li>
              <li>Google Calendar registra el evento real sin attendees.</li>
              <li>SMTP envia confirmaciones y avisos internos.</li>
              <li>El medico completa la ficha y el paciente recibe su resumen.</li>
            </ol>
          </article>

          <article className="surface-card narrative-card">
            <div className="section-intro">
              <span className="eyebrow">Preparado para clase</span>
              <h2>La demo ahora se entiende por modulos y no como una sola pantalla larga.</h2>
            </div>
            <p className="section-copy">
              Usa Resumen para explicar el negocio, Reservas para mostrar el flujo del paciente, Operacion para
              evidenciar citas y tickets, y Portal para enseñar roles, seguimiento clinico y cierre de ficha.
            </p>
            <div className="quick-links">
              <button className="button button-secondary" type="button" onClick={() => navigateTo('booking')}>
                Mostrar reserva
              </button>
              <button className="button button-secondary" type="button" onClick={() => navigateTo('operations')}>
                Mostrar trazabilidad
              </button>
            </div>
          </article>
        </section>

        <section className="feature-grid">
          <FeatureCard title="Agenda operativa" description="Persistencia de pacientes y citas con validacion de solapamientos." />
          <FeatureCard title="Correo real" description="Confirmaciones al paciente y tickets internos por SMTP." />
          <FeatureCard title="Calendar real" description="Eventos creados en el calendario configurado, sin attendees para este MVP." />
          <FeatureCard title="Cierre clinico" description="Formulario medico con receta, examenes, indicaciones y seguimiento." />
        </section>

        <section className="page-columns overview-columns">
          <DashboardTable
            title="Actividad reciente"
            description="Las ultimas reservas creadas quedan visibles aqui para la demo."
            appointments={recentAppointments}
          />
          <NotificationPanel
            title="Notificaciones recientes"
            description="Permite mostrar al profesor si el correo salio, fallo o quedo omitido."
            notifications={recentNotifications}
          />
        </section>
      </div>
    )
  }
  function renderBookingView() {
    return (
      <div className="page-stack">
        <section className="page-columns booking-page-grid">
          <form className="surface-card booking-form-card" onSubmit={handleBookingSubmit}>
            <div className="card-heading-row">
              <div>
                <span className="eyebrow">Reserva publica</span>
                <h2>Registrar una nueva consulta</h2>
              </div>
              <p className="section-copy compact-copy">La cita crea persistencia, tickets, correo y sincronizacion de calendario en un mismo paso.</p>
            </div>

            <div className="form-grid">
              <label>
                Nombre del paciente
                <input
                  value={bookingForm.patientName}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientName: event.target.value }))}
                  placeholder="Ej. Martina Gonzalez"
                  required
                />
              </label>
              <label>
                Correo electronico
                <input
                  type="email"
                  value={bookingForm.patientEmail}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientEmail: event.target.value }))}
                  placeholder="paciente@correo.com"
                  required
                />
              </label>
              <label>
                Telefono
                <input
                  value={bookingForm.patientPhone}
                  onChange={(event) => setBookingForm((current) => ({ ...current, patientPhone: event.target.value }))}
                  placeholder="+56 9 5555 5555"
                  required
                />
              </label>
              <label>
                Medico tratante
                <select
                  value={bookingForm.doctorId}
                  onChange={(event) => setBookingForm((current) => ({ ...current, doctorId: Number(event.target.value) }))}
                  required
                >
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName} - {doctor.specialty}
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
                Duracion
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
                placeholder="Control general, dolor de espalda, revision dermatologica, etc."
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
                    Sync {bookingResult.calendarSyncStatus === 'SYNCED' ? 'realizada' : bookingResult.calendarConfigured ? 'fallida' : 'omitida'}
                  </span>
                </div>

                <p className="booking-result-title">Resultado inmediato de la reserva</p>
                <ul className="clean-list compact-list result-list">
                  <li>Paciente: {bookingResult.appointment.patientName}</li>
                  <li>Tickets creados: {bookingResult.tickets.length}</li>
                  <li>Correo: {bookingResult.mailStatusMessage}</li>
                  <li>Calendar: {bookingResult.calendarStatusMessage}</li>
                  <li>Sincronizacion de Calendar: {formatCalendarSyncMessage(bookingResult.calendarSyncMessage)}</li>
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

            <button className="button button-primary button-block" type="submit" disabled={bookingSubmitting || doctorsLoading}>
              {bookingSubmitting ? 'Reservando...' : 'Confirmar cita'}
            </button>
          </form>

          <div className="stack-grid">
            {selectedDoctor ? (
              <article className="surface-card clinician-card">
                <div className="card-topline">
                  <span className="panel-chip">Medico seleccionado</span>
                  <span className="subtle-note">{selectedDoctor.specialty}</span>
                </div>
                <h3>{selectedDoctor.fullName}</h3>
                <p className="section-copy compact-copy">{selectedDoctor.bio}</p>
                <div className="meta-pair-grid">
                  <span>{selectedDoctor.office}</span>
                  <span>{selectedDoctor.email}</span>
                </div>
              </article>
            ) : null}

            <article className="surface-card narrative-card">
              <div className="section-intro">
                <span className="eyebrow">Ventaja de demo</span>
                <h2>Todo lo que antes quedaba mezclado ahora aparece dentro del contexto de la reserva.</h2>
              </div>
              <ul className="clean-list compact-list">
                <li>Formateado para mostrar el flujo al paciente.</li>
                <li>Resultado visible con estado de Calendar y correo.</li>
                <li>Equipo medico seleccionable desde la misma vista.</li>
              </ul>
            </article>

            <div className="doctor-grid doctor-grid-single">
              {doctorsLoading ? (
                <div className="surface-card state-card">Cargando staff medico...</div>
              ) : (
                doctors.map((doctor) => (
                  <article className="surface-card doctor-card" key={doctor.id}>
                    <div className="doctor-card-top">
                      <span className="panel-chip panel-chip-soft">{doctor.specialty}</span>
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
            </div>
          </div>
        </section>
      </div>
    )
  }

  function renderOperationsView() {
    return (
      <div className="page-stack">
        <section className="metric-grid metric-grid-four">
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
            label="Completadas"
            value={publicOverview?.completedAppointments ?? 0}
            description="Fichas ya cerradas"
          />
          <MetricCard
            label="Tickets abiertos"
            value={publicOverview?.openTickets ?? 0}
            description="Visibles para admin y medico"
          />
        </section>

        <section className="status-grid">
          <article className="surface-card status-card-large">
            <div className="card-topline">
              <span className={`integration-pill ${publicOverview?.mailDeliveryConfigured ? 'is-ok' : 'is-warn'}`}>
                Correo {publicOverview?.mailDeliveryConfigured ? 'listo' : 'pendiente'}
              </span>
              {publicOverviewRefreshedAt ? <span className="subtle-note">Actualizado {formatDateTime(publicOverviewRefreshedAt)}</span> : null}
            </div>
            <h3>Estado de correo</h3>
            <p className="section-copy compact-copy">{publicOverview?.mailStatusMessage ?? 'Esperando estado de correo.'}</p>
          </article>

          <article className="surface-card status-card-large">
            <div className="card-topline">
              <span className={`integration-pill ${publicOverview?.calendarConfigured ? 'is-ok' : 'is-warn'}`}>
                Calendar {publicOverview?.calendarConfigured ? 'listo' : 'pendiente'}
              </span>
            </div>
            <h3>Estado de Google Calendar</h3>
            <p className="section-copy compact-copy">{publicOverview?.calendarStatusMessage ?? 'Esperando estado de Calendar.'}</p>
          </article>
        </section>

        {overviewLoading ? <div className="surface-card state-card">Cargando actividad del sistema...</div> : null}

        <DashboardTable
          title="Citas recientes"
          description="Cada nueva reserva queda visible aqui apenas se persiste."
          appointments={recentAppointments}
        />

        <section className="page-columns overview-columns">
          <TicketPanel
            title="Tickets recientes"
            description="Cada cita nueva genera tickets internos visibles para la operacion."
            tickets={recentTickets}
          />
          <NotificationPanel
            title="Notificaciones recientes"
            description="Aqui se ve si el correo salio, quedo pendiente o fallo."
            notifications={recentNotifications}
          />
        </section>
      </div>
    )
  }
  function renderAdminPortal() {
    if (!adminDashboard) {
      return null
    }

    return (
      <div className="page-stack">
        <section className="metric-grid metric-grid-four">
          <MetricCard label="Citas totales" value={adminDashboard.totalAppointments} description="Historico del sistema" />
          <MetricCard label="Proximas" value={adminDashboard.upcomingAppointments} description="Pendientes de atencion" />
          <MetricCard label="Completadas" value={adminDashboard.completedAppointments} description="Con ficha cerrada" />
          <MetricCard label="Tickets abiertos" value={adminDashboard.openTickets} description="Requieren seguimiento" />
        </section>

        <DashboardTable
          title="Vista administrativa"
          description="Supervision de citas, pacientes y coordinacion diaria."
          appointments={adminDashboard.appointments}
        />

        <TicketPanel
          title="Tickets administrativos"
          description="Cada reserva genera trazabilidad para el panel admin."
          tickets={adminDashboard.tickets}
        />
      </div>
    )
  }

  function renderDoctorPortal() {
    if (!doctorDashboard) {
      return null
    }

    return (
      <div className="page-stack">
        <section className="surface-card clinician-summary-card">
          <div className="section-intro">
            <span className="eyebrow">Panel medico</span>
            <h2>{doctorDashboard.doctor.fullName}</h2>
          </div>
          <p className="section-copy compact-copy">{doctorDashboard.doctor.bio}</p>
          <div className="metric-grid metric-grid-three compact-metrics">
            <MetricCard label="Citas" value={doctorDashboard.totalAppointments} description="Historico del medico" />
            <MetricCard label="Pendientes" value={doctorDashboard.pendingReports} description="Sin formulario final" />
            <MetricCard label="Informes" value={completedReports.length} description="Ya enviados al paciente" />
          </div>
        </section>

        <div className="doctor-appointments">
          {doctorDashboard.appointments.map((appointment) => (
            <article className="surface-card appointment-card" key={appointment.id}>
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
                    onClick={() => setActiveReportId((current) => (current === appointment.id ? null : appointment.id))}
                  >
                    {activeReportId === appointment.id ? 'Ocultar ficha' : 'Completar ficha'}
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
                    <strong>Diagnostico:</strong> {appointment.medicalReport.diagnosis}
                  </p>
                  <p>
                    <strong>Receta:</strong> {appointment.medicalReport.prescription}
                  </p>
                  <p>
                    <strong>Examenes:</strong> {appointment.medicalReport.exams}
                  </p>
                  <p>
                    <strong>Indicaciones:</strong> {appointment.medicalReport.indications}
                  </p>
                  {appointment.medicalReport.recommendations.length > 0 ? (
                    <div className="recommendation-box">
                      <p className="recommendation-title">Sugerencias de especialistas</p>
                      <ul className="clean-list compact-list">
                        {appointment.medicalReport.recommendations.map((recommendation) => (
                          <li key={`${appointment.id}-${recommendation.doctorEmail}`}>
                            {recommendation.specialty}: {recommendation.doctorName} - {recommendation.rationale}
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
                      Diagnostico
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
                      Examenes
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
                    className="button button-primary button-block"
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
          title="Tickets del medico"
          description="Cada cita nueva genera una alerta para el panel clinico."
          tickets={doctorDashboard.tickets}
        />
      </div>
    )
  }
  function renderPortalView() {
    return (
      <section className="page-columns portal-page-grid">
        <aside className="surface-card portal-access-card">
          <div className="portal-access-header">
            <div>
              <span className="eyebrow">Acceso interno</span>
              <h2>{staffUser ? 'Sesion activa' : 'Ingresar al portal'}</h2>
            </div>
            {staffUser ? (
              <button className="button button-secondary" type="button" onClick={clearSession}>
                Cerrar sesion
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
                  Contrasena
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(event) => setStaffForm((current) => ({ ...current, password: event.target.value }))}
                    required
                  />
                </label>
                {portalError ? <p className="feedback feedback-error">{portalError}</p> : null}
                <button className="button button-primary button-block" type="submit" disabled={portalLoading}>
                  {portalLoading ? 'Validando...' : 'Entrar al portal'}
                </button>
              </form>

              <div className="surface-subsection">
                <p className="demo-credentials-title">Credenciales sugeridas para la demo</p>
                <div className="credential-stack">
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('ADMIN')}>
                    Admin demo - {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}
                  </button>
                  <button className="credential-button" type="button" onClick={() => setDemoStaff('DOCTOR')}>
                    Medico demo - {doctors[0]?.email ?? 'criswido0+valentina@gmail.com'} / {DEFAULT_DOCTOR_PASSWORD}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="session-card">
              <p className="session-name">{staffUser.displayName}</p>
              <p className="session-role">{staffUser.role === 'ADMIN' ? 'Administrador' : 'Medico tratante'}</p>
              <p className="session-meta">{staffUser.email}</p>
              <button className="button button-secondary button-block" type="button" onClick={refreshCurrentDashboard}>
                Actualizar panel
              </button>
            </div>
          )}
        </aside>

        <section className="surface-card portal-stage-card">
          {portalLoading ? <div className="state-card">Sincronizando datos del portal...</div> : null}
          {portalError && staffUser ? <p className="feedback feedback-error">{portalError}</p> : null}
          {reportFeedback ? <p className="feedback feedback-success">{reportFeedback}</p> : null}

          {!portalLoading && !staffUser ? (
            <div className="state-card">
              <h3>Portal listo para demo</h3>
              <p>Inicia sesion para mostrar tickets, citas y el formulario clinico del medico.</p>
            </div>
          ) : null}

          {!portalLoading && staffUser?.role === 'ADMIN' ? renderAdminPortal() : null}
          {!portalLoading && staffUser?.role === 'DOCTOR' ? renderDoctorPortal() : null}
        </section>
      </section>
    )
  }

  function renderActiveView() {
    if (activeView === 'booking') {
      return renderBookingView()
    }

    if (activeView === 'operations') {
      return renderOperationsView()
    }

    if (activeView === 'portal') {
      return renderPortalView()
    }

    return renderHomeView()
  }

  return (
    <main className="app-shell">
      <div className="app-background" />

      <div className="app-frame">
        <header className="surface-card app-header">
          <div className="brand-lockup">
            <span className="brand-badge">NC</span>
            <div>
              <p className="brand-name">NavyCare Scheduler</p>
              <p className="brand-caption">MVP de agenda medica con correo, tickets, portal y Google Calendar</p>
            </div>
          </div>

          <div className="header-health-strip">
            <span className={`integration-pill ${publicOverview?.mailDeliveryConfigured ? 'is-ok' : 'is-warn'}`}>
              Mail {publicOverview?.mailDeliveryConfigured ? 'on' : 'off'}
            </span>
            <span className={`integration-pill ${publicOverview?.calendarConfigured ? 'is-ok' : 'is-warn'}`}>
              Calendar {publicOverview?.calendarConfigured ? 'on' : 'off'}
            </span>
            <span className="subtle-note">MVP full stack para demo academica</span>
          </div>
        </header>

        <nav className="nav-strip" aria-label="Vistas del MVP">
          {APP_VIEWS.map((view) => (
            <button
              key={view.id}
              className={`nav-pill ${activeView === view.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => navigateTo(view.id)}
            >
              <span className="nav-pill-label">{view.label}</span>
              <span className="nav-pill-caption">{view.caption}</span>
            </button>
          ))}
        </nav>

        <section className="hero-grid">
          <article className="surface-card hero-panel">
            <span className="eyebrow">{currentView.eyebrow}</span>
            <h1>{currentView.title}</h1>
            <p className="hero-description">{currentView.description}</p>
            {renderHeroActions()}
          </article>

          {renderHeroAside()}
        </section>

        <section className="view-stage">{renderActiveView()}</section>
      </div>
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

