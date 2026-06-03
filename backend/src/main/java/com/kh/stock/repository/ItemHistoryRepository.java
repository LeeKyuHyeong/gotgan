package com.kh.stock.repository;

import com.kh.stock.domain.ItemHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ItemHistoryRepository extends JpaRepository<ItemHistory, Long> {

    /** 이력 탭: 가구의 변동 이력(최신순, 페이지). */
    Page<ItemHistory> findByHouseholdIdOrderByCreatedAtDesc(Long householdId, Pageable pageable);

    /** 특정 아이템의 이력. */
    List<ItemHistory> findByItemIdOrderByCreatedAtDesc(Long itemId);

    /** 가구 삭제 시 정리. */
    void deleteByHouseholdId(Long householdId);
}
