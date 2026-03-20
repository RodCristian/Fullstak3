package com.medicare.app.service;

import com.medicare.app.dto.ApiResponses.RecommendationResponse;
import com.medicare.app.model.Appointment;
import com.medicare.app.model.MedicalReport;
import com.medicare.app.model.NotificationLog;
import com.medicare.app.model.NotificationStatus;
import com.medicare.app.model.NotificationType;
import com.medicare.app.model.Ticket;
import com.medicare.app.repository.NotificationLogRepository;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd 'de' MMMM yyyy 'a las' HH:mm", new Locale("es", "CL"));

    private final JavaMailSender mailSender;
    private final NotificationLogRepository notificationLogRepository;

    @Value("${app.notifications.mail-enabled:${app.mail.enabled:${APP_MAIL_ENABLED:false}}}")
    private boolean mailEnabled;

    @Value("${spring.mail.host:${MAIL_HOST:}}")
    private String mailHost;

    @Value("${spring.mail.username:${MAIL_USERNAME:}}")
    private String mailUsername;

    @Value("${spring.mail.password:${MAIL_PASSWORD:}}")
    private String mailPassword;

    @Value("${app.notifications.from:${app.mail.from:${APP_MAIL_FROM:no-reply@navycare.local}}}")
    private String fromAddress;

    @Value("${app.notifications.admin-email:${app.admin.email:${APP_ADMIN_EMAIL:admin@navycare.local}}}")
    private String adminEmail;

    public NotificationService(JavaMailSender mailSender, NotificationLogRepository notificationLogRepository) {
        this.mailSender = mailSender;
        this.notificationLogRepository = notificationLogRepository;
    }

    public NotificationLog sendAppointmentConfirmation(Appointment appointment) {
        String calendarLink = appointment.getCalendarHtmlLink() == null
                ? "La cita quedo registrada internamente. Configura Google Calendar para adjuntar el enlace."
                : "<p><a href=\"" + appointment.getCalendarHtmlLink() + "\">Abrir evento en Google Calendar</a></p>";

        String html = """
                <h2>Tu cita fue confirmada</h2>
                <p>Hola %s, tu hora con %s (%s) fue agendada para %s.</p>
                <p><strong>Motivo:</strong> %s</p>
                %s
                <p>Si necesitas cambios, responde este correo o contacta al equipo administrativo.</p>
                """.formatted(
                appointment.getPatient().getFullName(),
                appointment.getDoctor().getFullName(),
                appointment.getDoctor().getSpecialty(),
                appointment.getScheduledAt().format(DATE_FORMATTER),
                appointment.getReason(),
                calendarLink);

        return sendEmail(
                appointment,
                NotificationType.APPOINTMENT_CONFIRMATION,
                appointment.getPatient().getEmail(),
                "Confirmacion de cita medica",
                html);
    }

    public List<NotificationLog> sendTicketNotifications(Appointment appointment, List<Ticket> tickets) {
        return tickets.stream()
                .map(ticket -> sendTicketNotification(appointment, ticket))
                .toList();
    }

    private NotificationLog sendTicketNotification(Appointment appointment, Ticket ticket) {
        String recipient = ticket.getRecipientType().name().equals("ADMIN")
                ? adminEmail
                : appointment.getDoctor().getEmail();
        String html = """
                <h2>Nuevo ticket de cita</h2>
                <p>%s</p>
                <p><strong>Paciente:</strong> %s</p>
                <p><strong>Fecha:</strong> %s</p>
                <p><strong>Descripcion:</strong> %s</p>
                """.formatted(
                ticket.getSubject(),
                appointment.getPatient().getFullName(),
                appointment.getScheduledAt().format(DATE_FORMATTER),
                ticket.getDescription());
        NotificationType type = ticket.getRecipientType().name().equals("ADMIN")
                ? NotificationType.ADMIN_TICKET
                : NotificationType.DOCTOR_TICKET;
        return sendEmail(appointment, type, recipient, "Nuevo ticket de agenda", html);
    }

    public NotificationLog sendMedicalReport(Appointment appointment, MedicalReport report, List<RecommendationResponse> recommendations) {
        String recommendationBlock = recommendations.isEmpty()
                ? "<p>No se generaron derivaciones sugeridas para este caso.</p>"
                : "<ul>" + recommendations.stream()
                .map(item -> "<li><strong>" + item.specialty() + ":</strong> " + item.doctorName()
                        + " (" + item.rationale() + ")</li>")
                .reduce("", String::concat) + "</ul>";

        String html = """
                <h2>Resumen posterior a tu consulta</h2>
                <p>Hola %s, compartimos la informacion registrada por %s.</p>
                <p><strong>Diagnostico:</strong> %s</p>
                <p><strong>Receta:</strong> %s</p>
                <p><strong>Examenes:</strong> %s</p>
                <p><strong>Indicaciones:</strong> %s</p>
                <p><strong>Seguimiento:</strong> %s</p>
                <h3>Recomendaciones de especialistas</h3>
                %s
                """.formatted(
                appointment.getPatient().getFullName(),
                appointment.getDoctor().getFullName(),
                report.getDiagnosis(),
                report.getPrescription(),
                report.getExams(),
                report.getIndications(),
                report.getFollowUpPlan(),
                recommendationBlock);

        return sendEmail(
                appointment,
                NotificationType.MEDICAL_REPORT,
                appointment.getPatient().getEmail(),
                "Resumen de atencion medica",
                html);
    }

    public boolean isMailDeliveryConfigured() {
        return mailEnabled
                && hasText(mailHost)
                && hasText(mailUsername)
                && hasText(mailPassword)
                && hasText(fromAddress);
    }

    public String getMailStatusMessage() {
        if (!mailEnabled) {
            return "Correo deshabilitado. Activa la configuracion de mail para envio real.";
        }

        if (!hasText(mailHost) || !hasText(mailUsername) || !hasText(mailPassword) || !hasText(fromAddress)) {
            return "SMTP incompleto. Configura host, username, password y remitente para envio real.";
        }

        return "SMTP listo para enviar correos reales.";
    }

    private NotificationLog sendEmail(
            Appointment appointment,
            NotificationType type,
            String to,
            String subject,
            String html) {
        NotificationLog logEntry = new NotificationLog();
        logEntry.setAppointment(appointment);
        logEntry.setType(type);
        logEntry.setRecipientEmail(to);
        logEntry.setSubject(subject);

        if (!mailEnabled) {
            log.info("Correo omitido porque la integracion de mail esta deshabilitada. Destino: {}, Asunto: {}", to, subject);
            logEntry.setStatus(NotificationStatus.SKIPPED);
            logEntry.setDetail(getMailStatusMessage());
            return notificationLogRepository.save(logEntry);
        }

        if (!hasText(mailHost) || !hasText(mailUsername) || !hasText(mailPassword) || !hasText(fromAddress)) {
            logEntry.setStatus(NotificationStatus.SKIPPED);
            logEntry.setDetail(getMailStatusMessage());
            return notificationLogRepository.save(logEntry);
        }

        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            logEntry.setStatus(NotificationStatus.SENT);
            logEntry.setDetail("Correo enviado correctamente.");
        } catch (Exception exception) {
            log.warn("No fue posible enviar el correo a {}", to, exception);
            logEntry.setStatus(NotificationStatus.FAILED);
            logEntry.setDetail("No fue posible enviar el correo. Revisa SMTP y credenciales.");
        }

        return notificationLogRepository.save(logEntry);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
