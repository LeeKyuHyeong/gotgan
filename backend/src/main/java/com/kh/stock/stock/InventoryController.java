package com.kh.stock.stock;

import com.kh.stock.stock.dto.InventoryResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 전체 보기(그룹/품목 합산 트리). X-Household-Id 필요. */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public InventoryResponse inventory(@RequestParam(required = false) String q) {
        return inventoryService.inventory(q);
    }
}
