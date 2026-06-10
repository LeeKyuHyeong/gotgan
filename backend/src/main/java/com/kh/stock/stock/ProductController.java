package com.kh.stock.stock;

import com.kh.stock.repository.ProductRepository;
import com.kh.stock.stock.dto.ProductResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 재고 있는 품목 picker. */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ProductResponse> list(@RequestParam(required = false) String q) {
        Long hid = TenantContext.require();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        return productRepository.findActiveWithStock(hid, query).stream()
                .map(ProductResponse::from).toList();
    }
}
