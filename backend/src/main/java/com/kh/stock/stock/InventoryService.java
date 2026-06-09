package com.kh.stock.stock;

import com.kh.stock.domain.Product;
import com.kh.stock.domain.Stock;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.stock.InventoryAssembler.ProductMeta;
import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 전체 보기: 활성 묶음 → 그룹/품목 합산 트리. q는 품목 이름 필터. */
@Service
public class InventoryService {

    private final StockRepository stockRepository;

    public InventoryService(StockRepository stockRepository) {
        this.stockRepository = stockRepository;
    }

    @Transactional(readOnly = true)
    public InventoryResponse inventory(String q) {
        Long hid = TenantContext.require();
        String query = (q == null || q.isBlank()) ? null : q.trim().toLowerCase();
        LocalDate today = LocalDate.now();

        List<Stock> stocks = stockRepository.findActiveByHousehold(hid);
        Map<Long, ProductMeta> meta = new HashMap<>();
        java.util.List<StockResponse> batches = new java.util.ArrayList<>();
        for (Stock s : stocks) {
            Product p = s.getProduct();
            if (query != null && !p.getName().toLowerCase().contains(query)) continue;
            meta.putIfAbsent(p.getId(), toMeta(p));
            batches.add(StockResponse.from(s, today));
        }
        return InventoryAssembler.assemble(batches, meta);
    }

    private ProductMeta toMeta(Product p) {
        var g = p.getProductGroup();
        var c = p.getCategory();
        return new ProductMeta(
                p.getId(), p.getName(), p.getUnit(),
                g == null ? null : g.getId(),
                g == null ? null : g.getName(),
                c == null ? null : c.getId(),
                c == null ? null : c.getName(),
                c == null ? null : c.getEmoji(),
                c == null ? null : c.getColor());
    }
}
