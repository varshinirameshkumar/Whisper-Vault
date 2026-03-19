package com.vault.config;

import com.mongodb.client.MongoClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.beans.factory.annotation.Autowired;

@Slf4j
@Configuration
public class MongoConfig {

    @Autowired
    private MongoTemplate mongoTemplate;

    @EventListener(ContextRefreshedEvent.class)
    public void ensureTtlIndexes() {
        try {
            // TTL index on secrets.expiresAt — MongoDB daemon purges expired documents
            mongoTemplate.indexOps("secrets")
                .ensureIndex(new Index().on("expiresAt", Sort.Direction.ASC).expire(0));
            log.info("TTL index on secrets.expiresAt ensured");

            // TTL index on activity_logs
            mongoTemplate.indexOps("activity_logs")
                .ensureIndex(new Index().on("logExpiresAt", Sort.Direction.ASC).expire(0));
            log.info("TTL index on activity_logs.logExpiresAt ensured");
        } catch (Exception e) {
            log.error("Failed to ensure TTL indexes: {}", e.getMessage());
        }
    }
}