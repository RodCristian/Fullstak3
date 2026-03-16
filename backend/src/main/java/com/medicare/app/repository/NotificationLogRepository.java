package com.medicare.app.repository;

import com.medicare.app.model.NotificationLog;
import com.medicare.app.model.NotificationStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {

    List<NotificationLog> findByAppointmentIdOrderByCreatedAtDesc(Long appointmentId);

    List<NotificationLog> findTop10ByOrderByCreatedAtDesc();

    long countByStatus(NotificationStatus status);
}
