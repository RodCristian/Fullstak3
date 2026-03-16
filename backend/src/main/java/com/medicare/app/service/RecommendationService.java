package com.medicare.app.service;

import com.medicare.app.dto.ApiResponses.RecommendationResponse;
import com.medicare.app.model.Appointment;
import com.medicare.app.model.Doctor;
import com.medicare.app.model.MedicalReport;
import com.medicare.app.repository.DoctorRepository;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class RecommendationService {

    private final DoctorRepository doctorRepository;

    private final Map<String, List<String>> specialtyKeywords = Map.of(
            "Cardiologia", List.of("cardio", "corazon", "presion", "hipertension", "palpitacion", "toracico"),
            "Traumatologia", List.of("rodilla", "hombro", "fractura", "muscular", "espalda", "articulacion"),
            "Dermatologia", List.of("piel", "derma", "lesion", "alergia", "eczema", "acne"),
            "Neurologia", List.of("migra", "neurolog", "cefalea", "mareo", "vertigo", "convulsion"),
            "Medicina General", List.of("control", "chequeo", "fatiga", "fiebre", "dolor general"));

    public RecommendationService(DoctorRepository doctorRepository) {
        this.doctorRepository = doctorRepository;
    }

    public List<RecommendationResponse> buildRecommendations(Appointment appointment, MedicalReport medicalReport) {
        String clinicalText = normalize(String.join(" ",
                safe(appointment.getReason()),
                safe(medicalReport.getDiagnosis()),
                safe(medicalReport.getExams()),
                safe(medicalReport.getIndications()),
                safe(medicalReport.getFollowUpPlan())));

        Map<String, List<String>> matchedKeywords = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : specialtyKeywords.entrySet()) {
            List<String> matches = entry.getValue().stream()
                    .filter(clinicalText::contains)
                    .toList();
            if (!matches.isEmpty()) {
                matchedKeywords.put(entry.getKey(), matches);
            }
        }

        if (matchedKeywords.isEmpty()) {
            return List.of();
        }

        Set<Long> excludedDoctorIds = Set.of(appointment.getDoctor().getId());
        List<Doctor> doctors = doctorRepository.findAllByOrderBySpecialtyAscFullNameAsc();
        List<RecommendationResponse> recommendations = new ArrayList<>();

        for (Map.Entry<String, List<String>> entry : matchedKeywords.entrySet()) {
            doctors.stream()
                    .filter(doctor -> !excludedDoctorIds.contains(doctor.getId()))
                    .filter(doctor -> doctor.getSpecialty().equalsIgnoreCase(entry.getKey()))
                    .limit(2)
                    .map(doctor -> new RecommendationResponse(
                            doctor.getSpecialty(),
                            doctor.getFullName(),
                            doctor.getEmail(),
                            "Coincidencia con: " + entry.getValue().stream().distinct().collect(Collectors.joining(", "))))
                    .forEach(recommendations::add);
        }

        return recommendations.stream().limit(3).toList();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }
}
