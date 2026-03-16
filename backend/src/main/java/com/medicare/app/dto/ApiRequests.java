package com.medicare.app.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class ApiRequests {

    private ApiRequests() {
    }

    public record CreateAppointmentRequest(
            @NotBlank(message = "El nombre del paciente es obligatorio")
            @Size(max = 120, message = "El nombre del paciente es demasiado largo")
            String patientName,
            @NotBlank(message = "El correo del paciente es obligatorio")
            @Email(message = "Debes ingresar un correo valido")
            String patientEmail,
            @NotBlank(message = "El telefono del paciente es obligatorio")
            @Size(max = 30, message = "El telefono es demasiado largo")
            String patientPhone,
            @NotNull(message = "Debes seleccionar un medico")
            Long doctorId,
            @NotNull(message = "Debes seleccionar una fecha y hora")
            @Future(message = "La cita debe agendarse en el futuro")
            LocalDateTime scheduledAt,
            @Min(value = 30, message = "La duracion minima es de 30 minutos")
            @Max(value = 60, message = "La duracion maxima es de 60 minutos")
            Integer durationMinutes,
            @NotBlank(message = "Debes indicar el motivo de la consulta")
            @Size(max = 600, message = "El motivo es demasiado largo")
            String reason) {
    }

    public record CompleteAppointmentRequest(
            @NotBlank(message = "El diagnostico es obligatorio")
            @Size(max = 1200, message = "El diagnostico es demasiado largo")
            String diagnosis,
            @NotBlank(message = "La receta es obligatoria")
            @Size(max = 1600, message = "La receta es demasiado larga")
            String prescription,
            @NotBlank(message = "Debes indicar los examenes")
            @Size(max = 1600, message = "El detalle de examenes es demasiado largo")
            String exams,
            @NotBlank(message = "Las indicaciones son obligatorias")
            @Size(max = 1600, message = "Las indicaciones son demasiado largas")
            String indications,
            @NotBlank(message = "Debes indicar el plan de seguimiento")
            @Size(max = 1600, message = "El plan de seguimiento es demasiado largo")
            String followUpPlan) {
    }
}
