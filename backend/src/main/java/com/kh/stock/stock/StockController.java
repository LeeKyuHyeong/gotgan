package com.kh.stock.stock;

import com.kh.stock.item.dto.AdjustQuantityRequest;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.security.AuthUser;
import com.kh.stock.stock.dto.CreateStockRequest;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.stock.dto.UpdateStockRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 재고 묶음 — X-Household-Id 필요. 모든 변경은 이력 자동 기록. */
@RestController
@RequestMapping("/api/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    /** 위치 상세: locationId 필수. */
    @GetMapping
    public List<StockResponse> list(@RequestParam Long locationId) {
        return stockService.listByLocation(locationId);
    }

    @GetMapping("/{stockId}")
    public StockResponse get(@PathVariable Long stockId) {
        return stockService.get(stockId);
    }

    @GetMapping("/{stockId}/history")
    public List<HistoryResponse> history(@PathVariable Long stockId) {
        return stockService.stockHistory(stockId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StockResponse create(@AuthenticationPrincipal AuthUser me,
                                @Valid @RequestBody CreateStockRequest req) {
        return stockService.create(me.id(), req);
    }

    @PatchMapping("/{stockId}")
    public StockResponse update(@AuthenticationPrincipal AuthUser me,
                                @PathVariable Long stockId,
                                @Valid @RequestBody UpdateStockRequest req) {
        return stockService.update(me.id(), stockId, req);
    }

    @PostMapping("/{stockId}/adjust")
    public StockResponse adjust(@AuthenticationPrincipal AuthUser me,
                                @PathVariable Long stockId,
                                @Valid @RequestBody AdjustQuantityRequest req) {
        return stockService.adjust(me.id(), stockId, req);
    }

    @DeleteMapping("/{stockId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable Long stockId) {
        stockService.delete(me.id(), stockId);
    }
}
