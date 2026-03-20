package com.medicare.app.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class ApiResponses {

    private ApiResponses() {
    }

    public record DoctorCardResponse(
            Long id,
            String fullName,
            String email,
            String specialty,
            String bio,
            String office) {
    }

    public record RecommendationResponse(
            String specialty,
            String doctorName,
            String doctorEmail,
            String rationale) {
    }

    public record MedicalReportResponse(
            Long id,
            String diagnosis,
            String prescription,
            String exams,
            String indications,
            String followUpPlan,
            LocalDateTime completedAt,
            List<RecommendationResponse> recommendations) {
    }

    public record AppointmentResponse(
            Long id,
            String patientName,
            String patientEmail,
            String patientPhone,
            String doctorName,
            String doctorEmail,
            String specialty,
            LocalDateTime scheduledAt,
            Integer durationMinutes,
            String status,
            String reason,
            String calendarEventId,
            String calendarHtmlLink,
            MedicalReportResponse medicalReport) {
    }

    public record NotificationLogResponse(
            Long id,
            Long appointmentId,
            String type,
            String recipientEmail,
            String subject,
            String status,
            String detail,
            LocalDateTime createdAt) {
    }

    public record TicketResponse(
            Long id,
            Long appointmentId,
            String recipientType,
            String status,
            String subject,
            String description,
            String doctorName,
            LocalDateTime createdAt) {
    }

    public record AdminDashboardResponse(
            long totalAppointments,
            long upcomingAppointments,
            long completedAppointments,
            long openTickets,
            List<DoctorCardResponse> doctors,
            List<AppointmentResponse> appointments,
            List<TicketResponse> tickets) {
    }

    public record DoctorDashboardResponse(
            DoctorCardResponse doctor,
            long totalAppointments,
            long pendingReports,
            List<AppointmentResponse> appointments,
            List<TicketResponse> tickets) {
    }

    public record BookingResultResponse(
            AppointmentResponse appointment,
            List<TicketResponse> tickets,
            List<NotificationLogResponse> notifications,
            String calendarSyncStatus,
            String calendarSyncMessage,
            String mailStatusMessage,
            String calendarStatusMessage,
            boolean mailDeliveryConfigured,
            boolean calendarConfigured) {
    }

    public record PublicOverviewResponse(
            long totalAppointments,
            long upcomingAppointments,
            long completedAppointments,
            long openTickets,
            long sentNotifications,
            String mailStatusMessage,
            String calendarStatusMessage,
            boolean mailDeliveryConfigured,
            boolean calendarConfigured,
            List<AppointmentResponse> recentAppointments,
            List<TicketResponse> recentTickets,
            List<NotificationLogResponse> recentNotifications) {
    }

    public record CalendarDebugResponse(
            boolean enabled,
            String calendarId,
            String serviceAccountEmail,
            String jsonPath,
            String timeZone,
            boolean created,
            String eventId,
            String htmlLink,
            String message,
            String summary,
            LocalDateTime start,
            LocalDateTime end,
            String attendeeEmail) {
    }

    public record AuthMeResponse(
            String email,
            String displayName,
            String role,
            Long doctorId) {
    }

    public record MessageResponse(String message) {
    }
}
