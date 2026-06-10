package com.kh.stock.stock;

import com.kh.stock.domain.ItemHistory;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.item.dto.PageResponse;
import com.kh.stock.repository.ItemHistoryRepository;
import com.kh.stock.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가구 전체 변동 이력(최신순, 페이지). 스냅샷 기반이라 정규화 영향 적음. */
@Service
public class HistoryService {

    private final ItemHistoryRepository historyRepository;

    public HistoryService(ItemHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<HistoryResponse> history(Pageable pageable) {
        Long hid = TenantContext.require();
        Page<ItemHistory> page = historyRepository.findByHouseholdIdOrderByCreatedAtDesc(hid, pageable);
        return PageResponse.of(page, HistoryResponse::from);
    }
}
