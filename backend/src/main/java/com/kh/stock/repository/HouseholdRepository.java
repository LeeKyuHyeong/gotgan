package com.kh.stock.repository;

import com.kh.stock.domain.Household;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HouseholdRepository extends JpaRepository<Household, Long> {

    /** 초대코드로 합류할 가구 조회. */
    Optional<Household> findByInviteCode(String inviteCode);

    /**
     * (D2) 합류용 — 가구 행에 쓰기 락을 걸어 같은 가구로의 동시 합류를 직렬화한다.
     * 정원 카운트 체크와 멤버십 insert 사이의 경합으로 max_members 가 초과되던 문제 방지.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from Household h where h.inviteCode = :code")
    Optional<Household> findByInviteCodeForUpdate(@Param("code") String code);

    boolean existsByInviteCode(String inviteCode);
}
