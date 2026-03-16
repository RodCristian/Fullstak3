package com.medicare.app.service;

public record CalendarEventResult(
        boolean created,
        String eventId,
        String htmlLink,
        String message) {

    public static CalendarEventResult skipped(String message) {
        return new CalendarEventResult(false, null, null, message);
    }
}
