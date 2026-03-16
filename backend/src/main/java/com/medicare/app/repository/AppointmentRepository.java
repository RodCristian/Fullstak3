package com.medicare.app.repository;

import com.medicare.app.model.Appointment;
import com.medicare.app.model.AppointmentStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    boolean existsByDoctorIdAndScheduledAtBetweenAndStatusIn(
            Long doctorId,
            LocalDateTime start,
            LocalDateTime end,
            Collection<AppointmentStatus> statuses);

    List<Appointment> findAllByOrderByScheduledAtDesc();

    List<Appointment> findTop10ByOrderByScheduledAtDesc();

    List<Appointment> findByDoctorIdOrderByScheduledAtDesc(Long doctorId);

    long countByStatus(AppointmentStatus status);

    long countByScheduledAtAfter(LocalDateTime scheduledAt);

    long countByStatusAndScheduledAtAfter(AppointmentStatus status, LocalDateTime scheduledAt);

    long countByDoctorIdAndStatus(Long doctorId, AppointmentStatus status);
}
