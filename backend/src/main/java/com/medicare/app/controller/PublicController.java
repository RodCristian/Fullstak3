package com.medicare.app.controller;

import com.medicare.app.dto.ApiRequests.CreateAppointmentRequest;
import com.medicare.app.dto.ApiResponses.BookingResultResponse;
import com.medicare.app.dto.ApiResponses.DoctorCardResponse;
import com.medicare.app.dto.ApiResponses.PublicOverviewResponse;
import com.medicare.app.service.AppointmentService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final AppointmentService appointmentService;

    public PublicController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping("/doctors")
    public List<DoctorCardResponse> listDoctors() {
        return appointmentService.getDoctors();
    }

    @GetMapping("/overview")
    public PublicOverviewResponse overview() {
        return appointmentService.getPublicOverview();
    }

    @PostMapping("/appointments")
    public BookingResultResponse createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        return appointmentService.createAppointment(request);
    }
}
