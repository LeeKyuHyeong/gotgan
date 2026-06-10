package com.kh.stock.stock;

import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.item.dto.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 변동 이력 탭 — 최신순 페이지. X-Household-Id 필요. */
@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping
    public PageResponse<HistoryResponse> history(@PageableDefault(size = 20) Pageable pageable) {
        return historyService.history(pageable);
    }
}
