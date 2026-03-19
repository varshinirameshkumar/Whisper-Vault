package com.vault.service;

import com.vault.model.ActivityLog;
import com.vault.repository.ActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepository;

    @Async
    public void log(String actor, String target, String secretId, ActivityLog.ActivityType type, String ip) {
        ActivityLog log = new ActivityLog();
        log.setActorUsername(actor);
        log.setTargetUsername(target);
        log.setSecretId(secretId);
        log.setType(type);
        log.setIpAddress(ip);
        activityRepository.save(log);
    }

    public List<ActivityLog> getActivityForUser(String username) {
        return activityRepository.findByActorUsernameOrderByTimestampDesc(username);
    }
}