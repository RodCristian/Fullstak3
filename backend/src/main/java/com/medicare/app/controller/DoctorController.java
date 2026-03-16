package com.medicare.app.controller;

import com.medicare.app.dto.ApiRequests.CompleteAppointmentRequest;
import com.medicare.app.dto.ApiResponses.DoctorDashboardResponse;
import com.medicare.app.dto.ApiResponses.MedicalReportResponse;
import com.medicare.app.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor")
public class DoctorController {

    private final AppointmentService appointmentService;

    public DoctorController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping("/dashboard")
    public DoctorDashboardResponse dashboard(Authentication authentication) {
        Long doctorId = appointmentService.resolveDoctorId(authentication.getName());
        return appointmentService.getDoctorDashboard(doctorId);
    }

    @PostMapping("/appointments/{appointmentId}/report")
    public MedicalReportResponse completeAppointment(
            @PathVariable Long appointmentId,
            @Valid @RequestBody CompleteAppointmentRequest request,
            Authentication authentication) {
        Long doctorId = appointmentService.resolveDoctorId(authentication.getName());
        return appointmentService.completeAppointment(doctorId, appointmentId, request);
    }
}
