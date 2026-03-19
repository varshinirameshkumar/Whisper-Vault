package com.vault.repository;

import com.vault.model.ActivityLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActivityRepository extends MongoRepository<ActivityLog, String> {
    List<ActivityLog> findByActorUsernameOrderByTimestampDesc(String actorUsername);
    List<ActivityLog> findByTargetUsernameOrderByTimestampDesc(String targetUsername);
}
