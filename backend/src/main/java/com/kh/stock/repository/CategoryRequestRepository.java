package com.kh.stock.repository;

import com.kh.stock.domain.CategoryRequest;
import com.kh.stock.domain.type.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRequestRepository extends JpaRepository<CategoryRequest, Long> {

    /** 어드민: 상태별 요청 목록(대기 요청 처리). */
    List<CategoryRequest> findByStatusOrderByCreatedAtAsc(RequestStatus status);

    long countByStatus(RequestStatus status);

    /** 내 가구의 분류 요청 목록(최신순). */
    List<CategoryRequest> findByHousehold_IdOrderByCreatedAtDesc(Long householdId);

    /** 같은 가구에서 동일 이름의 대기중 요청 중복 방지. */
    boolean existsByHousehold_IdAndRequestedNameAndStatus(Long householdId, String requestedName, RequestStatus status);

    /** 어드민 승인 시 동일 이름의 다른 대기 요청 일괄 처리. */
    List<CategoryRequest> findByRequestedNameAndStatus(String requestedName, RequestStatus status);

    /** 동일 이름 요청 수(어드민 목록의 "N명 요청" 표시용). */
    long countByRequestedNameAndStatus(String requestedName, RequestStatus status);

    /** 공통 분류 삭제 가드: 이 분류로 승인된 요청 이력이 있는지. */
    boolean existsByResolvedCategory_Id(Long categoryId);

    /** 가구 삭제 시 정리. */
    void deleteByHousehold_Id(Long householdId);
}
