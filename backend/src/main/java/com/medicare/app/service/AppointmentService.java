package com.medicare.app.service;

import com.medicare.app.dto.ApiRequests.CompleteAppointmentRequest;
import com.medicare.app.dto.ApiRequests.CreateAppointmentRequest;
import com.medicare.app.dto.ApiResponses.AdminDashboardResponse;
import com.medicare.app.dto.ApiResponses.AppointmentResponse;
import com.medicare.app.dto.ApiResponses.AuthMeResponse;
import com.medicare.app.dto.ApiResponses.BookingResultResponse;
import com.medicare.app.dto.ApiResponses.DoctorCardResponse;
import com.medicare.app.dto.ApiResponses.DoctorDashboardResponse;
import com.medicare.app.dto.ApiResponses.MedicalReportResponse;
import com.medicare.app.dto.ApiResponses.NotificationLogResponse;
import com.medicare.app.dto.ApiResponses.PublicOverviewResponse;
import com.medicare.app.dto.ApiResponses.RecommendationResponse;
import com.medicare.app.dto.ApiResponses.TicketResponse;
import com.medicare.app.model.Appointment;
import com.medicare.app.model.AppointmentStatus;
import com.medicare.app.model.Doctor;
import com.medicare.app.model.MedicalReport;
import com.medicare.app.model.NotificationLog;
import com.medicare.app.model.NotificationStatus;
import com.medicare.app.model.Patient;
import com.medicare.app.model.StaffAccount;
import com.medicare.app.model.Ticket;
import com.medicare.app.model.TicketRecipient;
import com.medicare.app.model.TicketStatus;
import com.medicare.app.repository.AppointmentRepository;
import com.medicare.app.repository.DoctorRepository;
import com.medicare.app.repository.MedicalReportRepository;
import com.medicare.app.repository.NotificationLogRepository;
import com.medicare.app.repository.PatientRepository;
import com.medicare.app.repository.StaffAccountRepository;
import com.medicare.app.repository.TicketRepository;
import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppointmentService {

    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final TicketRepository ticketRepository;
    private final MedicalReportRepository medicalReportRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final StaffAccountRepository staffAccountRepository;
    private final GoogleCalendarService googleCalendarService;
    private final NotificationService notificationService;
    private final RecommendationService recommendationService;

    public AppointmentService(
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            PatientRepository patientRepository,
            TicketRepository ticketRepository,
            MedicalReportRepository medicalReportRepository,
            NotificationLogRepository notificationLogRepository,
            StaffAccountRepository staffAccountRepository,
            GoogleCalendarService googleCalendarService,
            NotificationService notificationService,
            RecommendationService recommendationService) {
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.ticketRepository = ticketRepository;
        this.medicalReportRepository = medicalReportRepository;
        this.notificationLogRepository = notificationLogRepository;
        this.staffAccountRepository = staffAccountRepository;
        this.googleCalendarService = googleCalendarService;
        this.notificationService = notificationService;
        this.recommendationService = recommendationService;
    }

    @Transactional
    public BookingResultResponse createAppointment(CreateAppointmentRequest request) {
        Doctor doctor = doctorRepository.findById(request.doctorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "El medico seleccionado no existe"));

        LocalDateTime scheduledAt = request.scheduledAt().withSecond(0).withNano(0);
        int duration = request.durationMinutes() == null ? 30 : request.durationMinutes();
        if (scheduledAt.isBefore(LocalDateTime.now().plusMinutes(15))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cita debe agendarse con al menos 15 minutos de anticipacion");
        }

        boolean occupied = appointmentRepository.existsByDoctorIdAndScheduledAtBetweenAndStatusIn(
                doctor.getId(),
                scheduledAt.minusMinutes(duration - 1L),
                scheduledAt.plusMinutes(duration - 1L),
                List.of(AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED));

        if (occupied) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese horario ya fue tomado. Elige otro bloque");
        }

        Patient patient = patientRepository.findByEmailIgnoreCase(request.patientEmail())
                .orElseGet(Patient::new);
        patient.setFullName(request.patientName().trim());
        patient.setEmail(request.patientEmail().trim().toLowerCase());
        patient.setPhone(request.patientPhone().trim());
        patient = patientRepository.save(patient);

        Appointment appointment = new Appointment();
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setScheduledAt(scheduledAt);
        appointment.setDurationMinutes(duration);
        appointment.setReason(request.reason().trim());
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment = appointmentRepository.save(appointment);

        List<Ticket> tickets = ticketRepository.saveAll(List.of(
                buildTicket(appointment, TicketRecipient.ADMIN),
                buildTicket(appointment, TicketRecipient.DOCTOR)));

        log.info(
                "Reservation flow -> invoking Google Calendar for appointmentId={}, doctor={}, patientEmail={}, scheduledAt={}",
                appointment.getId(),
                appointment.getDoctor().getFullName(),
                appointment.getPatient().getEmail(),
                appointment.getScheduledAt());
        CalendarEventResult eventResult = googleCalendarService.createEvent(appointment);
        log.info(
                "Reservation flow -> Google Calendar result for appointmentId={}: created={}, calendarId={}, eventId={}, htmlLink={}, message={}",
                appointment.getId(),
                eventResult.created(),
                eventResult.calendarId(),
                eventResult.eventId(),
                eventResult.htmlLink(),
                eventResult.message());
        if (eventResult.created()) {
            appointment.setCalendarEventId(eventResult.eventId());
            appointment.setCalendarHtmlLink(eventResult.htmlLink());
            appointment = appointmentRepository.save(appointment);
        }

        List<NotificationLog> notifications = new java.util.ArrayList<>();
        notifications.add(notificationService.sendAppointmentConfirmation(appointment));
        notifications.addAll(notificationService.sendTicketNotifications(appointment, tickets));

        return new BookingResultResponse(
                toAppointmentResponse(appointment),
                tickets.stream().map(this::toTicketResponse).toList(),
                notifications.stream().map(this::toNotificationLogResponse).toList(),
                eventResult.created() ? "SYNCED" : "SKIPPED",
                eventResult.message(),
                notificationService.getMailStatusMessage(),
                googleCalendarService.getCalendarStatusMessage(),
                notificationService.isMailDeliveryConfigured(),
                googleCalendarService.isCalendarConfigured());
    }

    @Transactional
    public MedicalReportResponse completeAppointment(Long doctorId, Long appointmentId, CompleteAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La cita no existe"));

        if (!appointment.getDoctor().getId().equals(doctorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes cerrar una cita asignada a otro medico");
        }

        MedicalReport report = medicalReportRepository.findByAppointmentId(appointmentId).orElseGet(MedicalReport::new);
        report.setAppointment(appointment);
        report.setDiagnosis(request.diagnosis().trim());
        report.setPrescription(request.prescription().trim());
        report.setExams(request.exams().trim());
        report.setIndications(request.indications().trim());
        report.setFollowUpPlan(request.followUpPlan().trim());
        report = medicalReportRepository.save(report);

        appointment.setMedicalReport(report);
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointmentRepository.save(appointment);

        List<Ticket> tickets = ticketRepository.findByAppointmentId(appointmentId);
        tickets.forEach(ticket -> ticket.setStatus(TicketStatus.RESOLVED));
        ticketRepository.saveAll(tickets);

        List<RecommendationResponse> recommendations = recommendationService.buildRecommendations(appointment, report);
        notificationService.sendMedicalReport(appointment, report, recommendations);
        return toMedicalReportResponse(report, recommendations);
    }

    @Transactional
    public AuthMeResponse getCurrentUser(String email) {
        StaffAccount account = staffAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontro la cuenta"));

        Long doctorId = account.getDoctor() == null ? null : account.getDoctor().getId();
        return new AuthMeResponse(account.getEmail(), account.getDisplayName(), account.getRole().name(), doctorId);
    }

    @Transactional
    public Long resolveDoctorId(String email) {
        StaffAccount account = staffAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontro la cuenta"));
        if (account.getDoctor() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La cuenta no pertenece a un medico");
        }
        return account.getDoctor().getId();
    }

    @Transactional
    public List<DoctorCardResponse> getDoctors() {
        return doctorRepository.findAllByOrderBySpecialtyAscFullNameAsc()
                .stream()
                .map(this::toDoctorCardResponse)
                .toList();
    }

    @Transactional
    public PublicOverviewResponse getPublicOverview() {
        List<AppointmentResponse> recentAppointments = appointmentRepository.findTop10ByOrderByScheduledAtDesc()
                .stream()
                .map(this::toAppointmentResponse)
                .toList();

        List<TicketResponse> recentTickets = ticketRepository.findTop10ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toTicketResponse)
                .toList();

        List<NotificationLogResponse> recentNotifications = notificationLogRepository.findTop10ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toNotificationLogResponse)
                .toList();

        return new PublicOverviewResponse(
                appointmentRepository.count(),
                appointmentRepository.countByStatusAndScheduledAtAfter(AppointmentStatus.CONFIRMED, LocalDateTime.now()),
                appointmentRepository.countByStatus(AppointmentStatus.COMPLETED),
                ticketRepository.countByStatus(TicketStatus.OPEN),
                notificationLogRepository.countByStatus(NotificationStatus.SENT),
                notificationService.getMailStatusMessage(),
                googleCalendarService.getCalendarStatusMessage(),
                notificationService.isMailDeliveryConfigured(),
                googleCalendarService.isCalendarConfigured(),
                recentAppointments,
                recentTickets,
                recentNotifications);
    }

    @Transactional
    public AdminDashboardResponse getAdminDashboard() {
        List<AppointmentResponse> appointments = appointmentRepository.findAllByOrderByScheduledAtDesc()
                .stream()
                .map(this::toAppointmentResponse)
                .toList();
        List<TicketResponse> tickets = ticketRepository.findByRecipientTypeOrderByCreatedAtDesc(TicketRecipient.ADMIN)
                .stream()
                .map(this::toTicketResponse)
                .toList();

        long upcomingAppointments = appointments.stream()
                .filter(appointment -> "CONFIRMED".equals(appointment.status()))
                .filter(appointment -> appointment.scheduledAt().isAfter(LocalDateTime.now()))
                .count();

        return new AdminDashboardResponse(
                appointmentRepository.count(),
                upcomingAppointments,
                appointmentRepository.countByStatus(AppointmentStatus.COMPLETED),
                ticketRepository.countByStatus(TicketStatus.OPEN),
                getDoctors(),
                appointments,
                tickets);
    }

    @Transactional
    public DoctorDashboardResponse getDoctorDashboard(Long doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontro el medico"));

        List<AppointmentResponse> appointments = appointmentRepository.findByDoctorIdOrderByScheduledAtDesc(doctorId)
                .stream()
                .map(this::toAppointmentResponse)
                .toList();

        long pendingReports = appointments.stream()
                .filter(appointment -> "CONFIRMED".equals(appointment.status()))
                .count();

        List<TicketResponse> tickets = ticketRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId)
                .stream()
                .map(this::toTicketResponse)
                .toList();

        return new DoctorDashboardResponse(
                toDoctorCardResponse(doctor),
                appointments.size(),
                pendingReports,
                appointments,
                tickets);
    }

    private Ticket buildTicket(Appointment appointment, TicketRecipient recipient) {
        Ticket ticket = new Ticket();
        ticket.setAppointment(appointment);
        ticket.setDoctor(appointment.getDoctor());
        ticket.setRecipientType(recipient);
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setSubject(recipient == TicketRecipient.ADMIN
                ? "Nueva cita para validacion administrativa"
                : "Nueva cita asignada al medico");
        ticket.setDescription("Paciente " + appointment.getPatient().getFullName()
                + " agendo una consulta para " + appointment.getScheduledAt()
                + ". Motivo: " + appointment.getReason());
        return ticket;
    }

    private AppointmentResponse toAppointmentResponse(Appointment appointment) {
        return new AppointmentResponse(
                appointment.getId(),
                appointment.getPatient().getFullName(),
                appointment.getPatient().getEmail(),
                appointment.getPatient().getPhone(),
                appointment.getDoctor().getFullName(),
                appointment.getDoctor().getEmail(),
                appointment.getDoctor().getSpecialty(),
                appointment.getScheduledAt(),
                appointment.getDurationMinutes(),
                appointment.getStatus().name(),
                appointment.getReason(),
                appointment.getCalendarEventId(),
                appointment.getCalendarHtmlLink(),
                appointment.getMedicalReport() == null
                        ? null
                        : toMedicalReportResponse(
                                appointment.getMedicalReport(),
                                recommendationService.buildRecommendations(appointment, appointment.getMedicalReport())));
    }

    private MedicalReportResponse toMedicalReportResponse(MedicalReport report, List<RecommendationResponse> recommendations) {
        return new MedicalReportResponse(
                report.getId(),
                report.getDiagnosis(),
                report.getPrescription(),
                report.getExams(),
                report.getIndications(),
                report.getFollowUpPlan(),
                report.getCompletedAt(),
                recommendations);
    }

    private DoctorCardResponse toDoctorCardResponse(Doctor doctor) {
        return new DoctorCardResponse(
                doctor.getId(),
                doctor.getFullName(),
                doctor.getEmail(),
                doctor.getSpecialty(),
                doctor.getBio(),
                doctor.getOffice());
    }

    private TicketResponse toTicketResponse(Ticket ticket) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getAppointment().getId(),
                ticket.getRecipientType().name(),
                ticket.getStatus().name(),
                ticket.getSubject(),
                ticket.getDescription(),
                ticket.getDoctor() == null ? null : ticket.getDoctor().getFullName(),
                ticket.getCreatedAt());
    }

    private NotificationLogResponse toNotificationLogResponse(NotificationLog notificationLog) {
        return new NotificationLogResponse(
                notificationLog.getId(),
                notificationLog.getAppointment().getId(),
                notificationLog.getType().name(),
                notificationLog.getRecipientEmail(),
                notificationLog.getSubject(),
                notificationLog.getStatus().name(),
                notificationLog.getDetail(),
                notificationLog.getCreatedAt());
    }
}


