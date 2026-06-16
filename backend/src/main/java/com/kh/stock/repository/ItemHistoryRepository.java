package com.kh.stock.repository;

import com.kh.stock.domain.ItemHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ItemHistoryRepository extends JpaRepository<ItemHistory, Long> {

    /** 이력 탭: 가구의 변동 이력(최신순, 페이지). HistoryResponse 가 stock·user 를 읽으므로 함께 fetch(N+1 방지). */
    @EntityGraph(attributePaths = {"stock", "user"})
    Page<ItemHistory> findByHouseholdIdOrderByCreatedAtDesc(Long householdId, Pageable pageable);

    /** 특정 묶음의 이력. stock·user 를 함께 fetch(N+1 방지). */
    @EntityGraph(attributePaths = {"stock", "user"})
    List<ItemHistory> findByStockIdOrderByCreatedAtDesc(Long stockId);

    /** 가구 삭제 시 정리. */
    void deleteByHouseholdId(Long householdId);
}
