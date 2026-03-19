package com.vault.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.converter.DefaultContentTypeResolver;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.config.annotation.*;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final int MAX_MSG_BYTES = 10 * 1024 * 1024; // 10 MB

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setHeartbeatTime(25_000)
                .setDisconnectDelay(5_000)
                .setStreamBytesLimit(MAX_MSG_BYTES)
                .setHttpMessageCacheSize(1000);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(MAX_MSG_BYTES);
        registration.setSendBufferSizeLimit(MAX_MSG_BYTES);
        registration.setSendTimeLimit(120 * 1000);
    }

    /**
     * Override STOMP's message converter with a properly configured ObjectMapper.
     * THIS is what actually serializes/deserializes ChatMessage over WebSocket —
     * NOT the @Primary ObjectMapper bean.
     */
    @Override
    public boolean configureMessageConverters(List<MessageConverter> messageConverters) {
        DefaultContentTypeResolver resolver = new DefaultContentTypeResolver();
        resolver.setDefaultMimeType(MimeTypeUtils.APPLICATION_JSON);

        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // Raise string length limit so large encrypted file payloads pass through
        mapper.getFactory().setStreamReadConstraints(
            StreamReadConstraints.builder()
                .maxStringLength(20 * 1024 * 1024) // 20 MB
                .build()
        );

        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(mapper);
        converter.setContentTypeResolver(resolver);

        messageConverters.add(converter);
        return false; // false = also add defaults after ours
    }
}
