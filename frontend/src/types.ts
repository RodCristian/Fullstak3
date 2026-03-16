export type DoctorCardResponse = {
  id: number
  fullName: string
  email: string
  specialty: string
  bio: string
  office: string
}

export type RecommendationResponse = {
  specialty: string
  doctorName: string
  doctorEmail: string
  rationale: string
}

export type MedicalReportResponse = {
  id: number
  diagnosis: string
  prescription: string
  exams: string
  indications: string
  followUpPlan: string
  completedAt: string
  recommendations: RecommendationResponse[]
}

export type AppointmentResponse = {
  id: number
  patientName: string
  patientEmail: string
  patientPhone: string
  doctorName: string
  doctorEmail: string
  specialty: string
  scheduledAt: string
  durationMinutes: number
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  reason: string
  calendarEventId: string | null
  calendarHtmlLink: string | null
  medicalReport: MedicalReportResponse | null
}

export type TicketResponse = {
  id: number
  appointmentId: number
  recipientType: 'ADMIN' | 'DOCTOR'
  status: 'OPEN' | 'RESOLVED'
  subject: string
  description: string
  doctorName: string | null
  createdAt: string
}

export type NotificationLogResponse = {
  id: number
  appointmentId: number
  type: 'APPOINTMENT_CONFIRMATION' | 'ADMIN_TICKET' | 'DOCTOR_TICKET' | 'MEDICAL_REPORT'
  recipientEmail: string
  subject: string
  status: 'SENT' | 'SKIPPED' | 'FAILED'
  detail: string
  createdAt: string
}

export type AdminDashboardResponse = {
  totalAppointments: number
  upcomingAppointments: number
  completedAppointments: number
  openTickets: number
  doctors: DoctorCardResponse[]
  appointments: AppointmentResponse[]
  tickets: TicketResponse[]
}

export type DoctorDashboardResponse = {
  doctor: DoctorCardResponse
  totalAppointments: number
  pendingReports: number
  appointments: AppointmentResponse[]
  tickets: TicketResponse[]
}

export type BookingResultResponse = {
  appointment: AppointmentResponse
  tickets: TicketResponse[]
  notifications: NotificationLogResponse[]
  calendarSyncStatus: 'SYNCED' | 'SKIPPED'
  calendarSyncMessage: string
  mailStatusMessage: string
  calendarStatusMessage: string
  mailDeliveryConfigured: boolean
  calendarConfigured: boolean
}

export type PublicOverviewResponse = {
  totalAppointments: number
  upcomingAppointments: number
  completedAppointments: number
  openTickets: number
  sentNotifications: number
  mailStatusMessage: string
  calendarStatusMessage: string
  mailDeliveryConfigured: boolean
  calendarConfigured: boolean
  recentAppointments: AppointmentResponse[]
  recentTickets: TicketResponse[]
  recentNotifications: NotificationLogResponse[]
}

export type AuthMeResponse = {
  email: string
  displayName: string
  role: 'ADMIN' | 'DOCTOR'
  doctorId: number | null
}

export type CreateAppointmentPayload = {
  patientName: string
  patientEmail: string
  patientPhone: string
  doctorId: number
  scheduledAt: string
  durationMinutes: number
  reason: string
}

export type CompleteAppointmentPayload = {
  diagnosis: string
  prescription: string
  exams: string
  indications: string
  followUpPlan: string
}
