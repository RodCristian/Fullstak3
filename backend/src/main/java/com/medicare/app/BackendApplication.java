package com.medicare.app;

import com.medicare.app.config.EnvironmentBootstrapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		EnvironmentBootstrapper.bootstrap();
		SpringApplication.run(BackendApplication.class, args);
	}

}
