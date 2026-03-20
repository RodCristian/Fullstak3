package com.medicare.app.controller;

import com.medicare.app.dto.ApiRequests.CalendarDebugTestRequest;
import com.medicare.app.dto.ApiResponses.CalendarDebugResponse;
import com.medicare.app.service.GoogleCalendarService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/debug/calendar")
public class DebugController {

    private final GoogleCalendarService googleCalendarService;

    public DebugController(GoogleCalendarService googleCalendarService) {
        this.googleCalendarService = googleCalendarService;
    }

    @PostMapping("/test")
    public CalendarDebugResponse createCalendarTestEvent(
            @Valid @RequestBody(required = false) CalendarDebugTestRequest request) {
        return googleCalendarService.createDebugTestEvent(request);
    }
}
