package com.kh.stock.repository;

import com.kh.stock.domain.StorageLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {

    /** 홈/목록: 가구의 활성 위치(정렬순). 소프트삭제된 위치 제외. */
    List<StorageLocation> findByHouseholdIdAndDeletedAtIsNullOrderBySortOrderAsc(Long householdId);

    /** 가구 삭제 시 정리(소프트삭제 포함 전부 하드삭제 — 가구 자체가 사라지므로). */
    void deleteByHouseholdId(Long householdId);
}
