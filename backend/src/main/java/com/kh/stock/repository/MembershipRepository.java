package com.kh.stock.repository;

import com.kh.stock.domain.Membership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends JpaRepository<Membership, Long> {

    /** 현재 가구 컨텍스트 검증용: 이 사용자가 이 가구의 구성원인가. */
    Optional<Membership> findByUserIdAndHouseholdId(Long userId, Long householdId);

    boolean existsByUserIdAndHouseholdId(Long userId, Long householdId);

    /** 사용자가 속한 가구 목록(가구 전환 UI). */
    List<Membership> findByUserId(Long userId);

    /** 가구 멤버 목록 / 인원수(합류 시 max_members 체크). */
    List<Membership> findByHouseholdId(Long householdId);

    long countByHouseholdId(Long householdId);

    /** 가구 삭제 시 정리. */
    void deleteByHouseholdId(Long householdId);
}
