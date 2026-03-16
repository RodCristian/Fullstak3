package com.medicare.app.controller;

import com.medicare.app.dto.ApiResponses.AuthMeResponse;
import com.medicare.app.service.AppointmentService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppointmentService appointmentService;

    public AuthController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping("/me")
    public AuthMeResponse me(Authentication authentication) {
        return appointmentService.getCurrentUser(authentication.getName());
    }
}
