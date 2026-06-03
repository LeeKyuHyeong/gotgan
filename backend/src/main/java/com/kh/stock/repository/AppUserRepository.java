package com.kh.stock.repository;

import com.kh.stock.domain.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByKakaoId(String kakaoId);

    boolean existsByKakaoId(String kakaoId);
}
