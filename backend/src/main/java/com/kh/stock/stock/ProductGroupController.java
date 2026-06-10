package com.kh.stock.stock;

import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.stock.dto.ProductGroupResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 그룹 picker(활성). */
@RestController
@RequestMapping("/api/product-groups")
public class ProductGroupController {

    private final ProductGroupRepository groupRepository;

    public ProductGroupController(ProductGroupRepository groupRepository) {
        this.groupRepository = groupRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ProductGroupResponse> list() {
        Long hid = TenantContext.require();
        return groupRepository
                .findByHousehold_IdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(hid).stream()
                .map(ProductGroupResponse::from).toList();
    }
}
