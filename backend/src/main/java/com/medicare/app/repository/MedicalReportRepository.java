package com.medicare.app.repository;

import com.medicare.app.model.MedicalReport;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicalReportRepository extends JpaRepository<MedicalReport, Long> {

    Optional<MedicalReport> findByAppointmentId(Long appointmentId);
}
