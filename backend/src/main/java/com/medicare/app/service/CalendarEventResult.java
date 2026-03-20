package com.medicare.app.service;

public record CalendarEventResult(
        boolean created,
        String eventId,
        String htmlLink,
        String message,
        String calendarId,
        String serviceAccountEmail) {

    public static CalendarEventResult skipped(String message, String calendarId, String serviceAccountEmail) {
        return new CalendarEventResult(false, null, null, message, calendarId, serviceAccountEmail);
    }
}
