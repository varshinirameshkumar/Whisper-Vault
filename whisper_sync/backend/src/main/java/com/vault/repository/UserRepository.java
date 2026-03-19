package com.vault.repository;

import com.vault.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    @Query("{ '$or': [ " +
           "{ 'username':    { '$regex': ?0, '$options': 'i' } }, " +
           "{ 'displayName': { '$regex': ?0, '$options': 'i' } } " +
           "] }")
    List<User> searchByUsernameOrDisplayName(String query);
}