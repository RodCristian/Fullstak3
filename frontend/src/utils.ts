import type { CompleteAppointmentPayload } from './types'

export type BookingFormState = {
  patientName: string
  patientEmail: string
  patientPhone: string
  doctorId: number
  scheduledAt: string
  durationMinutes: number
  reason: string
}

export const STAFF_STORAGE_KEY = 'navycare-staff-token'

export const EMPTY_REPORT: CompleteAppointmentPayload = {
  diagnosis: '',
  prescription: '',
  exams: '',
  indications: '',
  followUpPlan: '',
}

export function createDefaultBookingForm(doctorId = 0): BookingFormState {
  return {
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    doctorId,
    scheduledAt: getDefaultSchedule(),
    durationMinutes: 30,
    reason: '',
  }
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getDefaultSchedule() {
  const base = new Date()
  base.setDate(base.getDate() + 1)
  base.setHours(9, 0, 0, 0)
  return toDateTimeLocal(base)
}

export function getMinSchedule() {
  const min = new Date()
  min.setMinutes(min.getMinutes() + 15)
  return toDateTimeLocal(min)
}

export function toDateTimeLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function formatCalendarSyncMessage(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('service accounts cannot invite attendees') ||
    normalized.includes('domain-wide delegation') ||
    normalized.includes('google calendar rechazo invitados')
  ) {
    return 'Google Calendar rechazo invitados. Para este MVP la cita se agenda sin attendees y las notificaciones se envian por correo SMTP.'
  }

  return message
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocurrio un error inesperado'
}
