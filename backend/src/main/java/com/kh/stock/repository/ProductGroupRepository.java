package com.kh.stock.repository;

import com.kh.stock.domain.ProductGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductGroupRepository extends JpaRepository<ProductGroup, Long> {

    /** 이름으로 그룹 조회 — 소프트삭제 포함(되살리기/유니크 충돌 회피용). */
    Optional<ProductGroup> findByHousehold_IdAndName(Long householdId, String name);

    List<ProductGroup> findByHousehold_IdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(Long householdId);

    /** 가구 삭제 정리. */
    void deleteByHousehold_Id(Long householdId);
}
