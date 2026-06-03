package com.kh.stock.item;

import com.kh.stock.item.dto.AdjustQuantityRequest;
import com.kh.stock.item.dto.CreateItemRequest;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.item.dto.ItemResponse;
import com.kh.stock.item.dto.UpdateItemRequest;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 아이템 — X-Household-Id 필요. 모든 변경은 변동이력 자동 기록. */
@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    /** 목록: locationId(위치 상세) / q(검색) optional. 둘 다 없으면 전체. */
    @GetMapping
    public List<ItemResponse> list(@RequestParam(required = false) Long locationId,
                                   @RequestParam(required = false) String q) {
        return itemService.list(locationId, q);
    }

    @GetMapping("/{itemId}")
    public ItemResponse get(@PathVariable Long itemId) {
        return itemService.get(itemId);
    }

    /** 이 아이템의 변동 이력(최신순). */
    @GetMapping("/{itemId}/history")
    public List<HistoryResponse> itemHistory(@PathVariable Long itemId) {
        return itemService.itemHistory(itemId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItemResponse create(@AuthenticationPrincipal AuthUser me,
                               @Valid @RequestBody CreateItemRequest req) {
        return itemService.create(me.id(), req);
    }

    @PatchMapping("/{itemId}")
    public ItemResponse update(@AuthenticationPrincipal AuthUser me,
                               @PathVariable Long itemId,
                               @Valid @RequestBody UpdateItemRequest req) {
        return itemService.update(me.id(), itemId, req);
    }

    /** 수량 증감(+/-) 버튼용. */
    @PostMapping("/{itemId}/adjust")
    public ItemResponse adjust(@AuthenticationPrincipal AuthUser me,
                               @PathVariable Long itemId,
                               @Valid @RequestBody AdjustQuantityRequest req) {
        return itemService.adjust(me.id(), itemId, req);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable Long itemId) {
        itemService.delete(me.id(), itemId);
    }
}
