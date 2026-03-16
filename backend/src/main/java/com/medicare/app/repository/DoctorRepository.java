package com.medicare.app.repository;

import com.medicare.app.model.Doctor;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    List<Doctor> findAllByOrderBySpecialtyAscFullNameAsc();
}
