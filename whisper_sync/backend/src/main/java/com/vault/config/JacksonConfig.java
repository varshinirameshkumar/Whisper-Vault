package com.vault.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Raises Jackson's default max string length from 5MB to 20MB
 * so large Base64-encoded encrypted file/voice payloads can be deserialized.
 */
@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Raise max string size to 20 MB — needed for encrypted file payloads
        mapper.getFactory().setStreamReadConstraints(
            StreamReadConstraints.builder()
                .maxStringLength(20 * 1024 * 1024)
                .build()
        );
        return mapper;
    }
}
