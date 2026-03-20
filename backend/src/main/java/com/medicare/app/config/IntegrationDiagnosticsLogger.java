package com.medicare.app.config;

import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class IntegrationDiagnosticsLogger implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IntegrationDiagnosticsLogger.class);

    @Value("${app.notifications.mail-enabled:${app.mail.enabled:${APP_MAIL_ENABLED:false}}}")
    private boolean mailEnabled;

    @Value("${spring.mail.host:${MAIL_HOST:}}")
    private String mailHost;

    @Value("${spring.mail.username:${MAIL_USERNAME:}}")
    private String mailUsername;

    @Value("${app.notifications.from:${app.mail.from:${APP_MAIL_FROM:no-reply@navycare.local}}}")
    private String mailFrom;

    @Value("${app.calendar.enabled:${app.google.calendar.enabled:${APP_GOOGLE_CALENDAR_ENABLED:false}}}")
    private boolean calendarEnabled;

    @Value("${app.calendar.calendar-id:${app.google.calendar.id:${APP_GOOGLE_CALENDAR_ID:primary}}}")
    private String calendarId;

    @Value("${app.calendar.service-account-key-path:${app.google.calendar.service-account-key-path:${APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH:}}}")
    private String calendarJsonPath;

    @Value("${app.calendar.time-zone:${app.google.calendar.time-zone:${app.google.calendar.timezone:${APP_GOOGLE_CALENDAR_TIMEZONE:America/Santiago}}}}")
    private String calendarTimeZone;

    @Override
    public void run(ApplicationArguments args) {
        log.info(
                "Integrations -> mailEnabled={}, mailHost={}, mailUsernameConfigured={}, mailFromConfigured={}, calendarEnabled={}, calendarId={}, calendarJsonPath={}, calendarJsonExists={}, calendarTimeZone={}",
                mailEnabled,
                blankToNull(mailHost),
                hasText(mailUsername),
                hasText(mailFrom),
                calendarEnabled,
                blankToNull(calendarId),
                blankToNull(calendarJsonPath),
                pathExists(calendarJsonPath),
                blankToNull(calendarTimeZone));
    }

    private boolean pathExists(String value) {
        if (!hasText(value)) {
            return false;
        }

        try {
            return Files.exists(Path.of(value.trim()));
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
