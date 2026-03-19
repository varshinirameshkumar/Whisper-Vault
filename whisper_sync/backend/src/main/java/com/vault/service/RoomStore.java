package com.vault.service;

import com.vault.model.ChatMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Vaijayanthi's Memory-Only Buffer.
 *
 * Stores the last N messages per roomUUID in a ConcurrentHashMap.
 * Tracks active subscriber counts per room.
 * NO data ever touches MongoDB or disk — pure JVM heap.
 */
@Slf4j
@Component
public class RoomStore {

    @Value("${app.room.max-messages:50}")
    private int maxMessages;

    /** roomId -> deque of recent messages (max 50) */
    private final ConcurrentHashMap<String, Deque<ChatMessage>> messageBuffer = new ConcurrentHashMap<>();

    /** roomId -> active subscriber count */
    private final ConcurrentHashMap<String, AtomicInteger> subscriberCounts = new ConcurrentHashMap<>();

    /** roomId -> set of subscriber usernames */
    private final ConcurrentHashMap<String, Set<String>> roomSubscribers = new ConcurrentHashMap<>();

    // ─── Message Buffer ────────────────────────────────────────────────────────

    public void addMessage(String roomId, ChatMessage message) {
        Deque<ChatMessage> deque = messageBuffer.computeIfAbsent(roomId, k -> new ArrayDeque<>());
        synchronized (deque) {
            deque.addLast(message);
            while (deque.size() > maxMessages) {
                deque.pollFirst();
            }
        }
    }

    public List<ChatMessage> getMessages(String roomId) {
        Deque<ChatMessage> deque = messageBuffer.get(roomId);
        if (deque == null) return Collections.emptyList();
        synchronized (deque) {
            return new ArrayList<>(deque);
        }
    }

    // ─── Subscriber Tracking ───────────────────────────────────────────────────

    public int addSubscriber(String roomId, String username) {
        roomSubscribers.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(username);
        return subscriberCounts.computeIfAbsent(roomId, k -> new AtomicInteger(0)).incrementAndGet();
    }

    public int removeSubscriber(String roomId, String username) {
        Set<String> subs = roomSubscribers.get(roomId);
        if (subs != null) subs.remove(username);
        AtomicInteger count = subscriberCounts.get(roomId);
        if (count == null) return 0;
        int remaining = count.decrementAndGet();
        if (remaining < 0) {
            count.set(0);
            return 0;
        }
        return remaining;
    }

    public int getSubscriberCount(String roomId) {
        AtomicInteger count = subscriberCounts.get(roomId);
        return count == null ? 0 : count.get();
    }

    public Set<String> getSubscribers(String roomId) {
        return roomSubscribers.getOrDefault(roomId, Collections.emptySet());
    }

    // ─── Omni-Burn Wipe ────────────────────────────────────────────────────────

    /**
     * Hard-wipe all in-memory data for this room.
     * Called by WipeRoomService when subscriber count hits 0.
     */
    public void wipeRoom(String roomId) {
        messageBuffer.remove(roomId);
        subscriberCounts.remove(roomId);
        roomSubscribers.remove(roomId);
        log.info("RoomStore: Physical memory flush complete for room {}", roomId);
    }

    public boolean hasRoom(String roomId) {
        return messageBuffer.containsKey(roomId);
    }
}
