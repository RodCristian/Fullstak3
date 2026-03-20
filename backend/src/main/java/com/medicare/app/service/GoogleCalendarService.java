package com.medicare.app.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.CalendarScopes;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.medicare.app.dto.ApiRequests.CalendarDebugTestRequest;
import com.medicare.app.dto.ApiResponses.CalendarDebugResponse;
import com.medicare.app.model.Appointment;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GoogleCalendarService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarService.class);
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String APPLICATION_NAME = "NavyCare Scheduler MVP2";
    private static final DateTimeFormatter DEBUG_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Value("${app.calendar.enabled:${app.google.calendar.enabled:${APP_GOOGLE_CALENDAR_ENABLED:false}}}")
    private boolean enabled;

    @Value("${app.calendar.calendar-id:${app.google.calendar.id:${APP_GOOGLE_CALENDAR_ID:primary}}}")
    private String calendarId;

    @Value("${app.calendar.service-account-key-path:${app.google.calendar.service-account-key-path:${APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH:}}}")
    private String serviceAccountKeyPath;

    @Value("${app.calendar.time-zone:${app.google.calendar.time-zone:${app.google.calendar.timezone:${APP_GOOGLE_CALENDAR_TIMEZONE:America/Santiago}}}}")
    private String timeZone;

    public boolean isCalendarConfigured() {
        if (!enabled || !hasText(calendarId)) {
            return false;
        }

        Path credentialsPath = resolveCredentialsPath();
        return credentialsPath != null && Files.exists(credentialsPath);
    }

    public String getCalendarStatusMessage() {
        if (!enabled) {
            return "Google Calendar deshabilitado. Activa la configuracion de Calendar.";
        }

        if (!hasText(calendarId)) {
            return "Google Calendar incompleto. Falta el calendar id.";
        }

        Path credentialsPath = resolveCredentialsPath();
        if (credentialsPath == null) {
            return "Google Calendar incompleto. Falta o es invalida la ruta al archivo de credenciales.";
        }

        if (!Files.exists(credentialsPath)) {
            return "Google Calendar incompleto. El archivo de credenciales no existe en la ruta configurada.";
        }

        return "Google Calendar listo para sincronizar eventos reales.";
    }

    public CalendarEventResult createEvent(Appointment appointment) {
        ZoneId zoneId = resolveZoneId();
        OffsetDateTime start = appointment.getScheduledAt().atZone(zoneId).toOffsetDateTime();
        OffsetDateTime end = appointment.getScheduledAt()
                .plusMinutes(appointment.getDurationMinutes())
                .atZone(zoneId)
                .toOffsetDateTime();

        CalendarInsertRequest request = new CalendarInsertRequest(
                "appointment#" + appointment.getId(),
                "Consulta medica - " + appointment.getPatient().getFullName(),
                "Motivo: " + appointment.getReason() + "\nMedico: " + appointment.getDoctor().getFullName(),
                start,
                end);

        return insertEvent(request);
    }

    public CalendarDebugResponse createDebugTestEvent(CalendarDebugTestRequest request) {
        LocalDateTime scheduledAt = request == null || request.scheduledAt() == null
                ? LocalDateTime.now().plusMinutes(20).withSecond(0).withNano(0)
                : request.scheduledAt().withSecond(0).withNano(0);
        int durationMinutes = request == null || request.durationMinutes() == null ? 30 : request.durationMinutes();
        String summary = request == null || !hasText(request.summary())
                ? "Prueba Calendar NavyCare " + scheduledAt.format(DEBUG_FORMATTER)
                : request.summary().trim();
        String description = request == null || !hasText(request.description())
                ? "Evento de prueba generado desde /api/debug/calendar/test"
                : request.description().trim();
        String attendeeEmail = request == null || !hasText(request.attendeeEmail()) ? null : request.attendeeEmail().trim();

        ZoneId zoneId = resolveZoneId();
        OffsetDateTime start = scheduledAt.atZone(zoneId).toOffsetDateTime();
        OffsetDateTime end = scheduledAt.plusMinutes(durationMinutes).atZone(zoneId).toOffsetDateTime();

        CalendarInsertRequest insertRequest = new CalendarInsertRequest(
                "debug-endpoint",
                summary,
                description,
                start,
                end);

        CalendarEventResult result = insertEvent(insertRequest);
        return new CalendarDebugResponse(
                enabled,
                normalizedCalendarId(),
                result.serviceAccountEmail(),
                normalizedKeyPath(),
                timeZone,
                result.created(),
                result.eventId(),
                result.htmlLink(),
                appendAttendeeNote(result.message(), attendeeEmail),
                summary,
                scheduledAt,
                scheduledAt.plusMinutes(durationMinutes),
                attendeeEmail);
    }

    private CalendarEventResult insertEvent(CalendarInsertRequest request) {
        String normalizedCalendarId = normalizedCalendarId();
        String normalizedPath = normalizedKeyPath();
        String source = request.sourceLabel();

        if (!enabled) {
            log.warn("Calendar insert skipped -> source={}, enabled=false, calendarId={}, keyPath={}, timezone={}",
                    source, normalizedCalendarId, normalizedPath, timeZone);
            return CalendarEventResult.skipped("Integracion con Google Calendar deshabilitada", normalizedCalendarId, null);
        }

        if (!hasText(normalizedCalendarId)) {
            log.warn("Calendar insert skipped -> source={}, missing calendarId, keyPath={}, timezone={}", source, normalizedPath, timeZone);
            return CalendarEventResult.skipped("Falta el calendar id configurado", normalizedCalendarId, null);
        }

        Path credentialsPath = resolveCredentialsPath();
        if (credentialsPath == null) {
            log.warn("Calendar insert skipped -> source={}, invalid credentials path={}, calendarId={}", source, normalizedPath, normalizedCalendarId);
            return CalendarEventResult.skipped("La ruta al archivo de credenciales es invalida o esta vacia", normalizedCalendarId, null);
        }

        if (!Files.exists(credentialsPath)) {
            log.warn("Calendar insert skipped -> source={}, missing credentials file={}, calendarId={}", source, credentialsPath, normalizedCalendarId);
            return CalendarEventResult.skipped("No se encontro el archivo de credenciales de Google", normalizedCalendarId, null);
        }

        try {
            ServiceAccountCredentials credentials = loadServiceAccountCredentials(credentialsPath);
            String serviceAccountEmail = credentials.getClientEmail();
            Calendar calendarClient = buildCalendarClient(credentials);
            Event event = buildGoogleEvent(request);

            log.info(
                    "Calendar insert start -> source={}, enabled={}, calendarId={}, serviceAccountEmail={}, keyPath={}, timezone={}, summary={}, attendeesMode=no-attendees, start={}, end={}",
                    source,
                    enabled,
                    normalizedCalendarId,
                    serviceAccountEmail,
                    credentialsPath,
                    timeZone,
                    request.summary(),
                    request.start(),
                    request.end());

            Event createdEvent = calendarClient.events().insert(normalizedCalendarId, event).execute();

            log.info(
                    "Calendar insert success -> source={}, calendarId={}, serviceAccountEmail={}, eventId={}, htmlLink={}",
                    source,
                    normalizedCalendarId,
                    serviceAccountEmail,
                    createdEvent.getId(),
                    createdEvent.getHtmlLink());

            return new CalendarEventResult(
                    true,
                    createdEvent.getId(),
                    createdEvent.getHtmlLink(),
                    "Evento creado correctamente en Google Calendar.",
                    normalizedCalendarId,
                    serviceAccountEmail);
        } catch (GoogleJsonResponseException exception) {
            String serviceAccountEmail = extractServiceAccountEmailQuietly();
            String message = buildGoogleApiErrorMessage(exception, normalizedCalendarId, serviceAccountEmail);
            log.error("Calendar insert failed with Google API error -> source={}, calendarId={}, keyPath={}, timezone={}",
                    source, normalizedCalendarId, normalizedPath, timeZone, exception);
            return CalendarEventResult.skipped(message, normalizedCalendarId, serviceAccountEmail);
        } catch (Exception exception) {
            String serviceAccountEmail = extractServiceAccountEmailQuietly();
            String message = "Error real de Google Calendar: " + exception.getClass().getSimpleName() + " - "
                    + safeMessage(exception) + ". " + shareHint(serviceAccountEmail);
            log.error("Calendar insert failed -> source={}, calendarId={}, keyPath={}, timezone={}",
                    source, normalizedCalendarId, normalizedPath, timeZone, exception);
            return CalendarEventResult.skipped(message, normalizedCalendarId, serviceAccountEmail);
        }
    }

    private ServiceAccountCredentials loadServiceAccountCredentials(Path credentialsPath) throws Exception {
        try (InputStream inputStream = Files.newInputStream(credentialsPath)) {
            GoogleCredentials credentials = ServiceAccountCredentials.fromStream(inputStream)
                    .createScoped(List.of(CalendarScopes.CALENDAR));
            credentials.refreshIfExpired();
            return (ServiceAccountCredentials) credentials;
        }
    }

    private Calendar buildCalendarClient(ServiceAccountCredentials credentials) throws Exception {
        return new Calendar.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                JSON_FACTORY,
                new HttpCredentialsAdapter(credentials))
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    private Event buildGoogleEvent(CalendarInsertRequest request) {
        return new Event()
                .setSummary(request.summary())
                .setDescription(request.description())
                .setStart(new EventDateTime()
                        .setDateTime(new DateTime(request.start().toInstant().toEpochMilli()))
                        .setTimeZone(timeZone))
                .setEnd(new EventDateTime()
                        .setDateTime(new DateTime(request.end().toInstant().toEpochMilli()))
                        .setTimeZone(timeZone));
    }

    private String buildGoogleApiErrorMessage(
            GoogleJsonResponseException exception,
            String normalizedCalendarId,
            String serviceAccountEmail) {
        String apiMessage = exception.getDetails() != null && hasText(exception.getDetails().getMessage())
                ? exception.getDetails().getMessage()
                : safeMessage(exception);
        String normalizedApiMessage = apiMessage.toLowerCase(Locale.ROOT);

        if (normalizedApiMessage.contains("service accounts cannot invite attendees")
                || normalizedApiMessage.contains("domain-wide delegation")) {
            return "Google Calendar rechazo invitados. Para este MVP la cita se crea sin attendees y las notificaciones salen por correo SMTP. "
                    + "Si mas adelante quieres invitaciones reales, necesitaremos OAuth de usuario o Google Workspace con Domain-Wide Delegation. "
                    + "Calendar ID usado: " + normalizedCalendarId + ". " + shareHint(serviceAccountEmail);
        }

        return "Google Calendar API respondio " + exception.getStatusCode() + ": " + apiMessage
                + ". Calendar ID usado: " + normalizedCalendarId + ". " + shareHint(serviceAccountEmail);
    }

    private String appendAttendeeNote(String message, String attendeeEmail) {
        if (!hasText(attendeeEmail)) {
            return message;
        }

        return message + " Nota MVP: attendeeEmail fue ignorado; las invitaciones reales requieren OAuth de usuario o Domain-Wide Delegation.";
    }

    private String shareHint(String serviceAccountEmail) {
        if (!hasText(serviceAccountEmail)) {
            return "Verifica que el calendario este compartido con la service account y tenga permisos para editar eventos.";
        }

        return "Verifica que el calendario este compartido con la service account " + serviceAccountEmail
                + " y tenga permisos para editar eventos.";
    }

    private String extractServiceAccountEmailQuietly() {
        Path credentialsPath = resolveCredentialsPath();
        if (credentialsPath == null || !Files.exists(credentialsPath)) {
            return null;
        }

        try {
            return loadServiceAccountCredentials(credentialsPath).getClientEmail();
        } catch (Exception exception) {
            log.debug("No fue posible extraer el client_email de la service account", exception);
            return null;
        }
    }

    private Path resolveCredentialsPath() {
        String normalizedPath = normalizedKeyPath();
        if (!hasText(normalizedPath)) {
            return null;
        }

        try {
            return Path.of(normalizedPath).normalize();
        } catch (InvalidPathException exception) {
            log.warn("La ruta configurada para Google Calendar no es valida: {}", normalizedPath, exception);
            return null;
        }
    }

    private String normalizedKeyPath() {
        if (!hasText(serviceAccountKeyPath)) {
            return null;
        }

        return stripQuotes(serviceAccountKeyPath.trim());
    }

    private String normalizedCalendarId() {
        return hasText(calendarId) ? calendarId.trim() : null;
    }

    private ZoneId resolveZoneId() {
        return ZoneId.of(hasText(timeZone) ? timeZone.trim() : "America/Santiago");
    }

    private String stripQuotes(String value) {
        if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String safeMessage(Exception exception) {
        return hasText(exception.getMessage()) ? exception.getMessage() : "sin detalle adicional";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record CalendarInsertRequest(
            String sourceLabel,
            String summary,
            String description,
            OffsetDateTime start,
            OffsetDateTime end) {
    }
}
