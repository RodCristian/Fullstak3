package com.medicare.app.repository;

import com.medicare.app.model.Patient;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientRepository extends JpaRepository<Patient, Long> {

    Optional<Patient> findByEmailIgnoreCase(String email);
}
