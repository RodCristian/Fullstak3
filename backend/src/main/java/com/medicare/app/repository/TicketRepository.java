package com.medicare.app.repository;

import com.medicare.app.model.Ticket;
import com.medicare.app.model.TicketRecipient;
import com.medicare.app.model.TicketStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findAllByOrderByCreatedAtDesc();

    List<Ticket> findTop10ByOrderByCreatedAtDesc();

    List<Ticket> findByRecipientTypeOrderByCreatedAtDesc(TicketRecipient recipientType);

    List<Ticket> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);

    List<Ticket> findByAppointmentId(Long appointmentId);

    long countByStatus(TicketStatus status);
}
