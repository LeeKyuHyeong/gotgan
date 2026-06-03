package com.kh.stock.repository;

import com.kh.stock.domain.StorageLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {

    /** 홈 화면: 가구의 위치 목록(정렬순). */
    List<StorageLocation> findByHouseholdIdOrderBySortOrderAsc(Long householdId);

    /** 가구 삭제 시 정리. */
    void deleteByHouseholdId(Long householdId);
}
