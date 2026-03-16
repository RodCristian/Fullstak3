package com.medicare.app.repository;

import com.medicare.app.model.StaffAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffAccountRepository extends JpaRepository<StaffAccount, Long> {

    Optional<StaffAccount> findByEmailIgnoreCase(String email);
}
