package com.vault.repository;

import com.vault.model.GroupRoom;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface GroupRoomRepository extends MongoRepository<GroupRoom, String> {

    List<GroupRoom> findByInvitedUsernamesContainingAndStatusNot(
            String username, GroupRoom.RoomStatus status);

    List<GroupRoom> findByCreatorUsernameOrderByCreatedAtDesc(String username);

    /** All PUBLIC ACTIVE rooms — for spectator discovery */
    List<GroupRoom> findByModeAndStatus(GroupRoom.RoomMode mode, GroupRoom.RoomStatus status);
}
