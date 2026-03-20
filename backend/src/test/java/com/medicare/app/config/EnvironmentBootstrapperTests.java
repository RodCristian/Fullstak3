package com.medicare.app.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EnvironmentBootstrapperTests {

    @TempDir
    Path tempDir;

    @Test
    void bootstrapMapsEnvStyleKeysToCanonicalSpringProperties() throws Exception {
        Files.writeString(
                tempDir.resolve(".env.local"),
                """
                APP_MAIL_ENABLED=true
                MAIL_HOST=smtp.gmail.com
                MAIL_USERNAME=demo@gmail.com
                MAIL_PASSWORD=abcd efgh ijkl mnop
                APP_MAIL_FROM=demo@gmail.com
                APP_GOOGLE_CALENDAR_ENABLED=true
                APP_GOOGLE_CALENDAR_ID=calendar@test
                APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH=C:/tmp/calendar.json
                APP_GOOGLE_CALENDAR_TIMEZONE=America/Santiago
                """);

        Properties properties = new Properties();
        EnvironmentBootstrapper.bootstrap(tempDir, Map.of(), properties);

        assertEquals("true", properties.getProperty("app.notifications.mail-enabled"));
        assertEquals("smtp.gmail.com", properties.getProperty("spring.mail.host"));
        assertEquals("demo@gmail.com", properties.getProperty("spring.mail.username"));
        assertEquals("abcdefghijklmnop", properties.getProperty("spring.mail.password"));
        assertEquals("demo@gmail.com", properties.getProperty("app.notifications.from"));
        assertEquals("true", properties.getProperty("app.calendar.enabled"));
        assertEquals("calendar@test", properties.getProperty("app.calendar.calendar-id"));
        assertEquals("C:/tmp/calendar.json", properties.getProperty("app.calendar.service-account-key-path"));
        assertEquals("America/Santiago", properties.getProperty("app.calendar.time-zone"));
    }

    @Test
    void bootstrapSupportsAlternativeDotStyleKeys() throws Exception {
        Files.writeString(
                tempDir.resolve(".env.local"),
                """
                app.mail.enabled=true
                app.mail.from=demo@gmail.com
                app.admin.email=admin@navycare.local
                app.google.calendar.enabled=true
                app.google.calendar.id=calendar@test
                app.google.calendar.service-account-key-path=C:/tmp/calendar.json
                app.google.calendar.timezone=America/Santiago
                """);

        Properties properties = new Properties();
        EnvironmentBootstrapper.bootstrap(tempDir, Map.of(), properties);

        assertEquals("true", properties.getProperty("app.notifications.mail-enabled"));
        assertEquals("demo@gmail.com", properties.getProperty("app.notifications.from"));
        assertEquals("admin@navycare.local", properties.getProperty("app.notifications.admin-email"));
        assertEquals("true", properties.getProperty("app.calendar.enabled"));
        assertEquals("calendar@test", properties.getProperty("app.calendar.calendar-id"));
        assertEquals("C:/tmp/calendar.json", properties.getProperty("app.calendar.service-account-key-path"));
        assertEquals("America/Santiago", properties.getProperty("app.calendar.time-zone"));
    }
}
