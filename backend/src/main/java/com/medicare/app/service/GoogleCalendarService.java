package com.medicare.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.medicare.app.model.Appointment;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class GoogleCalendarService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarService.class);
    private static final String CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

    private final RestClient restClient = RestClient.create();

    @Value("${app.calendar.enabled:false}")
    private boolean enabled;

    @Value("${app.calendar.calendar-id:primary}")
    private String calendarId;

    @Value("${app.calendar.service-account-key-path:}")
    private String serviceAccountKeyPath;

    @Value("${app.calendar.time-zone:America/Santiago}")
    private String timeZone;

    public boolean isCalendarConfigured() {
        if (!enabled || serviceAccountKeyPath == null || serviceAccountKeyPath.isBlank()) {
            return false;
        }

        return Files.exists(Path.of(serviceAccountKeyPath));
    }

    public String getCalendarStatusMessage() {
        if (!enabled) {
            return "Google Calendar deshabilitado. Activa APP_GOOGLE_CALENDAR_ENABLED=true.";
        }

        if (serviceAccountKeyPath == null || serviceAccountKeyPath.isBlank()) {
            return "Google Calendar incompleto. Falta APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH.";
        }

        if (!Files.exists(Path.of(serviceAccountKeyPath))) {
            return "Google Calendar incompleto. El archivo de credenciales no existe en la ruta configurada.";
        }

        return "Google Calendar listo para sincronizar eventos reales.";
    }

    public CalendarEventResult createEvent(Appointment appointment) {
        if (!enabled) {
            return CalendarEventResult.skipped("Integracion con Google Calendar deshabilitada");
        }

        if (serviceAccountKeyPath == null || serviceAccountKeyPath.isBlank()) {
            return CalendarEventResult.skipped("Falta la ruta al archivo de credenciales de Google");
        }

        Path credentialsPath = Path.of(serviceAccountKeyPath);
        if (!Files.exists(credentialsPath)) {
            return CalendarEventResult.skipped("No se encontro el archivo de credenciales de Google");
        }

        try (InputStream inputStream = Files.newInputStream(credentialsPath)) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(inputStream)
                    .createScoped(List.of(CALENDAR_SCOPE));
            credentials.refreshIfExpired();
            AccessToken accessToken = credentials.getAccessToken();
            if (accessToken == null) {
                accessToken = credentials.refreshAccessToken();
            }

            OffsetDateTime start = appointment.getScheduledAt().atZone(ZoneId.of(timeZone)).toOffsetDateTime();
            OffsetDateTime end = appointment.getScheduledAt()
                    .plusMinutes(appointment.getDurationMinutes())
                    .atZone(ZoneId.of(timeZone))
                    .toOffsetDateTime();

            JsonNode response = restClient.post()
                    .uri("https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events", calendarId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + accessToken.getTokenValue())
                    .body(Map.of(
                            "summary", "Consulta medica - " + appointment.getPatient().getFullName(),
                            "description", "Motivo: " + appointment.getReason() + "\nMedico: "
                                    + appointment.getDoctor().getFullName(),
                            "start", Map.of("dateTime", start.toString(), "timeZone", timeZone),
                            "end", Map.of("dateTime", end.toString(), "timeZone", timeZone),
                            "attendees", List.of(Map.of("email", appointment.getPatient().getEmail()))))
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return CalendarEventResult.skipped("Google Calendar no devolvio informacion del evento");
            }

            return new CalendarEventResult(
                    true,
                    response.path("id").asText(null),
                    response.path("htmlLink").asText(null),
                    "Evento creado correctamente");
        } catch (Exception exception) {
            log.warn("No fue posible crear el evento en Google Calendar", exception);
            return CalendarEventResult.skipped("No fue posible crear el evento en Google Calendar");
        }
    }
}
