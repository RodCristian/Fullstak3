package com.medicare.app;

import com.medicare.app.dto.ApiRequests.CreateAppointmentRequest;
import com.medicare.app.repository.DoctorRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=LEGACY",
		"spring.datasource.driverClassName=org.h2.Driver",
		"spring.jpa.hibernate.ddl-auto=create-drop",
		"app.notifications.mail-enabled=false",
		"app.calendar.enabled=false"
})
@AutoConfigureMockMvc
class BackendApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private DoctorRepository doctorRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void bookingFlowReturnsTicketsNotificationsAndUpdatedOverview() throws Exception {
		long doctorId = doctorRepository.findAll().get(0).getId();
		CreateAppointmentRequest request = new CreateAppointmentRequest(
				"Paciente Test",
				"paciente.test@example.com",
				"+56 9 1234 5678",
				doctorId,
				LocalDateTime.now().plusDays(2).withHour(10).withMinute(0).withSecond(0).withNano(0),
				30,
				"Control general"
		);
		String body = """
				{
				  "patientName": "%s",
				  "patientEmail": "%s",
				  "patientPhone": "%s",
				  "doctorId": %s,
				  "scheduledAt": "%s",
				  "durationMinutes": %s,
				  "reason": "%s"
				}
				""".formatted(
				request.patientName(),
				request.patientEmail(),
				request.patientPhone(),
				request.doctorId(),
				request.scheduledAt(),
				request.durationMinutes(),
				request.reason());

		mockMvc.perform(post("/api/public/appointments")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.appointment.id").exists())
				.andExpect(jsonPath("$.tickets.length()").value(2))
				.andExpect(jsonPath("$.notifications.length()").value(3))
				.andExpect(jsonPath("$.notifications[0].status").value("SKIPPED"))
				.andExpect(jsonPath("$.calendarSyncStatus").value("SKIPPED"));

		mockMvc.perform(get("/api/public/overview"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalAppointments").value(1))
				.andExpect(jsonPath("$.openTickets").value(2))
				.andExpect(jsonPath("$.recentTickets.length()").value(2))
				.andExpect(jsonPath("$.recentNotifications.length()").value(3));
	}

}
