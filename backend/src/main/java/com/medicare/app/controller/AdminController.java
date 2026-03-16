package com.medicare.app.controller;

import com.medicare.app.dto.ApiResponses.AdminDashboardResponse;
import com.medicare.app.service.AppointmentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AppointmentService appointmentService;

    public AdminController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard() {
        return appointmentService.getAdminDashboard();
    }
}
