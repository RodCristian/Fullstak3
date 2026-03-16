import type {
  AdminDashboardResponse,
  AuthMeResponse,
  BookingResultResponse,
  CompleteAppointmentPayload,
  CreateAppointmentPayload,
  DoctorCardResponse,
  DoctorDashboardResponse,
  MedicalReportResponse,
  PublicOverviewResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type RequestOptions = RequestInit & {
  authToken?: string
}

export function buildBasicAuthToken(email: string, password: string) {
  return `Basic ${btoa(`${email}:${password}`)}`
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (options.authToken) {
    headers.set('Authorization', options.authToken)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: options.cache ?? 'no-store',
    headers,
  })

  if (!response.ok) {
    let message = 'No fue posible completar la solicitud'

    try {
      const errorBody = (await response.json()) as { message?: string }
      if (errorBody.message) {
        message = errorBody.message
      }
    } catch {
      message = response.statusText || message
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export function fetchDoctors() {
  return requestJson<DoctorCardResponse[]>('/api/public/doctors')
}

export function fetchPublicOverview() {
  return requestJson<PublicOverviewResponse>('/api/public/overview')
}

export function createAppointment(payload: CreateAppointmentPayload) {
  return requestJson<BookingResultResponse>('/api/public/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCurrentUser(authToken: string) {
  return requestJson<AuthMeResponse>('/api/auth/me', {
    authToken,
  })
}

export function fetchAdminDashboard(authToken: string) {
  return requestJson<AdminDashboardResponse>('/api/admin/dashboard', {
    authToken,
  })
}

export function fetchDoctorDashboard(authToken: string) {
  return requestJson<DoctorDashboardResponse>('/api/doctor/dashboard', {
    authToken,
  })
}

export function submitMedicalReport(
  authToken: string,
  appointmentId: number,
  payload: CompleteAppointmentPayload,
) {
  return requestJson<MedicalReportResponse>(`/api/doctor/appointments/${appointmentId}/report`, {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  })
}
