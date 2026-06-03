package com.kh.stock.repository;

import com.kh.stock.domain.Household;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HouseholdRepository extends JpaRepository<Household, Long> {

    /** 초대코드로 합류할 가구 조회. */
    Optional<Household> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
