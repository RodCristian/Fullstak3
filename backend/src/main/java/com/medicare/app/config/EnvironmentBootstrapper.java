package com.medicare.app.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class EnvironmentBootstrapper {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentBootstrapper.class);

    private static final Map<String, List<String>> PROPERTY_ALIASES = Map.ofEntries(
            Map.entry("server.port", List.of("server.port", "SERVER_PORT")),
            Map.entry(
                    "app.notifications.mail-enabled",
                    List.of("app.notifications.mail-enabled", "app.mail.enabled", "APP_MAIL_ENABLED")),
            Map.entry(
                    "app.notifications.from",
                    List.of("app.notifications.from", "app.mail.from", "APP_MAIL_FROM")),
            Map.entry(
                    "app.notifications.admin-email",
                    List.of("app.notifications.admin-email", "app.admin.email", "APP_ADMIN_EMAIL")),
            Map.entry("spring.mail.host", List.of("spring.mail.host", "MAIL_HOST")),
            Map.entry("spring.mail.port", List.of("spring.mail.port", "MAIL_PORT")),
            Map.entry("spring.mail.username", List.of("spring.mail.username", "MAIL_USERNAME")),
            Map.entry("spring.mail.password", List.of("spring.mail.password", "MAIL_PASSWORD")),
            Map.entry(
                    "spring.mail.properties.mail.smtp.auth",
                    List.of("spring.mail.properties.mail.smtp.auth", "MAIL_SMTP_AUTH")),
            Map.entry(
                    "spring.mail.properties.mail.smtp.starttls.enable",
                    List.of("spring.mail.properties.mail.smtp.starttls.enable", "MAIL_SMTP_STARTTLS")),
            Map.entry(
                    "app.calendar.enabled",
                    List.of("app.calendar.enabled", "app.google.calendar.enabled", "APP_GOOGLE_CALENDAR_ENABLED")),
            Map.entry(
                    "app.calendar.calendar-id",
                    List.of("app.calendar.calendar-id", "app.google.calendar.id", "APP_GOOGLE_CALENDAR_ID")),
            Map.entry(
                    "app.calendar.service-account-key-path",
                    List.of(
                            "app.calendar.service-account-key-path",
                            "app.google.calendar.service-account-key-path",
                            "APP_GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_PATH")),
            Map.entry(
                    "app.calendar.time-zone",
                    List.of(
                            "app.calendar.time-zone",
                            "app.google.calendar.time-zone",
                            "app.google.calendar.timezone",
                            "APP_GOOGLE_CALENDAR_TIMEZONE")));

    private EnvironmentBootstrapper() {
    }

    public static void bootstrap() {
        bootstrap(Path.of("").toAbsolutePath().normalize(), System.getenv(), System.getProperties());
    }

    static void bootstrap(Path workingDirectory, Map<String, String> environment, Properties systemProperties) {
        Map<String, String> fileValues = loadFileValues(workingDirectory);
        PROPERTY_ALIASES.forEach((canonicalName, aliases) -> {
            if (hasText(systemProperties.getProperty(canonicalName))) {
                return;
            }

            String resolvedValue = resolveValue(aliases, systemProperties, environment, fileValues);
            if (!hasText(resolvedValue)) {
                return;
            }

            systemProperties.setProperty(
                    canonicalName,
                    normalizeValue(canonicalName, resolvedValue, systemProperties, environment, fileValues));
        });
    }

    private static String resolveValue(
            List<String> aliases,
            Properties systemProperties,
            Map<String, String> environment,
            Map<String, String> fileValues) {
        for (String alias : aliases) {
            String systemPropertyValue = systemProperties.getProperty(alias);
            if (hasText(systemPropertyValue)) {
                return systemPropertyValue;
            }
        }

        for (String alias : aliases) {
            String environmentValue = environment.get(alias);
            if (hasText(environmentValue)) {
                return environmentValue;
            }
        }

        for (String alias : aliases) {
            String fileValue = fileValues.get(alias);
            if (hasText(fileValue)) {
                return fileValue;
            }
        }

        return null;
    }

    private static String normalizeValue(
            String canonicalName,
            String value,
            Properties systemProperties,
            Map<String, String> environment,
            Map<String, String> fileValues) {
        String trimmedValue = value.trim();
        if (!"spring.mail.password".equals(canonicalName)) {
            return trimmedValue;
        }

        String host = resolveValue(List.of("spring.mail.host", "MAIL_HOST"), systemProperties, environment, fileValues);
        if (host != null && host.trim().equalsIgnoreCase("smtp.gmail.com")) {
            String normalizedPassword = trimmedValue.replaceAll("\\s+", "");
            if (!normalizedPassword.equals(trimmedValue)) {
                log.info("Se normalizo la App Password de Gmail removiendo espacios en blanco.");
            }
            return normalizedPassword;
        }

        return trimmedValue;
    }

    private static Map<String, String> loadFileValues(Path workingDirectory) {
        Map<String, String> values = new LinkedHashMap<>();
        for (Path candidate : buildCandidateFiles(workingDirectory)) {
            if (!Files.exists(candidate) || !Files.isRegularFile(candidate)) {
                continue;
            }

            try {
                for (String rawLine : Files.readAllLines(candidate)) {
                    String line = rawLine.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }

                    int separator = line.indexOf('=');
                    if (separator < 1) {
                        continue;
                    }

                    String key = line.substring(0, separator).trim();
                    String value = stripQuotes(line.substring(separator + 1).trim());
                    values.putIfAbsent(key, value);
                }
                log.info("Se cargo configuracion local desde {}", candidate.toAbsolutePath().normalize());
            } catch (IOException exception) {
                log.warn(
                        "No fue posible leer el archivo de configuracion {}",
                        candidate.toAbsolutePath().normalize(),
                        exception);
            }
        }
        return values;
    }

    private static List<Path> buildCandidateFiles(Path workingDirectory) {
        Set<Path> candidates = new LinkedHashSet<>();
        Path current = workingDirectory;
        for (int depth = 0; depth < 4 && current != null; depth++) {
            candidates.add(current.resolve(".env.local"));
            candidates.add(current.resolve(".env"));
            candidates.add(current.resolve("backend").resolve(".env.local"));
            candidates.add(current.resolve("backend").resolve(".env"));
            current = current.getParent();
        }
        return new ArrayList<>(candidates);
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
