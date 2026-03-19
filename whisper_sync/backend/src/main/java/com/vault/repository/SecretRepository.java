package com.vault.repository;

import com.vault.model.Secret;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SecretRepository extends MongoRepository<Secret, String> {
    List<Secret> findByRecipientUsernameAndBurnedFalseOrderByCreatedAtDesc(String recipientUsername);
    List<Secret> findBySenderUsernameOrderByCreatedAtDesc(String senderUsername);
    long countByRecipientUsernameAndBurnedFalse(String recipientUsername);
}