package com.medicare.app.config;

import com.medicare.app.model.Doctor;
import com.medicare.app.model.StaffAccount;
import com.medicare.app.model.StaffRole;
import com.medicare.app.repository.DoctorRepository;
import com.medicare.app.repository.StaffAccountRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SeedDataConfig {

    @Bean
    ApplicationRunner seedData(
            DoctorRepository doctorRepository,
            StaffAccountRepository staffAccountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.security.demo-admin-email}") String adminEmail,
            @Value("${app.security.demo-admin-password}") String adminPassword,
            @Value("${app.security.demo-doctor-password}") String doctorPassword) {
        return args -> {
            if (doctorRepository.count() == 0) {
                doctorRepository.saveAll(List.of(
                        doctor("Dra. Valentina Rojas", "criswido0+valentina@gmail.com", "Medicina General",
                                "Enfoque preventivo y seguimiento integral para pacientes adultos.",
                                "Consulta 201"),
                        doctor("Dr. Tomas Fuentes", "criswido0+tomas@gmail.com", "Cardiologia",
                                "Especialista en evaluacion cardiovascular y control de presion arterial.",
                                "Consulta 305"),
                        doctor("Dra. Camila Soto", "criswido0+camila@gmail.com", "Dermatologia",
                                "Tratamiento y seguimiento de patologias cutaneas frecuentes.",
                                "Consulta 118"),
                        doctor("Dr. Diego Araya", "criswido0+diego@gmail.com", "Traumatologia",
                                "Atencion enfocada en lesiones musculoesqueleticas y rehabilitacion.",
                                "Consulta 410"),
                        doctor("Dra. Sofia Mendez", "criswido0+sofia@gmail.com", "Neurologia",
                                "Manejo inicial y derivacion de sintomas neurologicos y cefaleas complejas.",
                                "Consulta 512")));
            }

            if (staffAccountRepository.count() == 0) {
                StaffAccount admin = new StaffAccount();
                admin.setEmail(adminEmail);
                admin.setDisplayName("Administrador NavyCare");
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
                admin.setRole(StaffRole.ADMIN);
                staffAccountRepository.save(admin);

                for (Doctor doctor : doctorRepository.findAll()) {
                    StaffAccount account = new StaffAccount();
                    account.setEmail(doctor.getEmail());
                    account.setDisplayName(doctor.getFullName());
                    account.setPasswordHash(passwordEncoder.encode(doctorPassword));
                    account.setRole(StaffRole.DOCTOR);
                    account.setDoctor(doctor);
                    staffAccountRepository.save(account);
                }
            }
        };
    }

    private Doctor doctor(String fullName, String email, String specialty, String bio, String office) {
        Doctor doctor = new Doctor();
        doctor.setFullName(fullName);
        doctor.setEmail(email);
        doctor.setSpecialty(specialty);
        doctor.setBio(bio);
        doctor.setOffice(office);
        return doctor;
    }
}
