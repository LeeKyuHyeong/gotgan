package com.kh.stock.stock;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.Category;
import com.kh.stock.domain.Product;
import com.kh.stock.domain.ProductGroup;
import com.kh.stock.repository.CategoryRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.repository.ProductRepository;
import com.kh.stock.stock.dto.NewProductInput;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 품목/그룹 해석·생성·되살리기 + 0재고 cascade 정리. */
@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductGroupRepository groupRepository;
    private final CategoryRepository categoryRepository;
    private final HouseholdRepository householdRepository;

    public ProductService(ProductRepository productRepository,
                          ProductGroupRepository groupRepository,
                          CategoryRepository categoryRepository,
                          HouseholdRepository householdRepository) {
        this.productRepository = productRepository;
        this.groupRepository = groupRepository;
        this.categoryRepository = categoryRepository;
        this.householdRepository = householdRepository;
    }

    /** 기존 품목 로드(가구 소유 + 활성 검증). */
    @Transactional
    public Product requireOwnedActive(Long hid, Long productId) {
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("품목을 찾을 수 없습니다."));
        if (!p.getHousehold().getId().equals(hid) || p.getDeletedAt() != null) {
            throw ApiException.notFound("품목을 찾을 수 없습니다.");
        }
        return p;
    }

    /** 새 품목 해석: 같은 이름 활성/소프트삭제 product 재사용·되살리기, 없으면 신규. */
    @Transactional
    public Product resolveOrCreate(Long hid, NewProductInput in) {
        String name = in.name().trim();
        String unit = StringUtils.hasText(in.unit()) ? in.unit().trim() : null; // (V-4) 공백 정규화
        Product existing = productRepository.findByHousehold_IdAndName(hid, name).orElse(null);
        ProductGroup group = resolveGroup(hid, in.groupId(), in.groupName());
        Category category = resolveCategory(in.categoryId());

        if (existing != null) {
            // 되살리기(소프트삭제였다면) + 속성은 새 입력으로 갱신(되살리기 시 최신 입력 우선)
            existing.setDeletedAt(null);
            existing.setUnit(unit);
            if (category != null) existing.setCategory(category);
            if (group != null) existing.setProductGroup(group);
            return existing;
        }
        Product p = new Product();
        p.setHousehold(householdRepository.getReferenceById(hid));
        p.setName(name);
        p.setUnit(unit);
        p.setCategory(category);
        p.setProductGroup(group);
        try {
            // (C-3) 같은 이름 품목 동시 생성 경합 — UNIQUE(household_id, name) 위반을
            // 커밋 전에 노출시켜 500 대신 재시도 가능한 409 로 변환.
            return productRepository.saveAndFlush(p);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("같은 이름의 품목이 방금 추가됐어요. 다시 시도해 주세요.");
        }
    }

    private ProductGroup resolveGroup(Long hid, Long groupId, String groupName) {
        // (V-2) 기존 그룹 선택과 새 그룹 이름을 동시에 주면 의도가 모호 — 하나만 허용.
        if (groupId != null && StringUtils.hasText(groupName)) {
            throw ApiException.badRequest("그룹은 기존 선택 또는 새 이름 중 하나만 지정하세요.");
        }
        if (groupId != null) {
            ProductGroup g = groupRepository.findById(groupId)
                    .orElseThrow(() -> ApiException.badRequest("존재하지 않는 그룹입니다."));
            if (!g.getHousehold().getId().equals(hid)) {
                throw ApiException.badRequest("현재 가구의 그룹이 아닙니다.");
            }
            if (g.getDeletedAt() != null) g.setDeletedAt(null); // 되살리기
            return g;
        }
        if (StringUtils.hasText(groupName)) {
            String name = groupName.trim();
            ProductGroup g = groupRepository.findByHousehold_IdAndName(hid, name).orElse(null);
            if (g != null) {
                g.setDeletedAt(null);
                return g;
            }
            ProductGroup ng = new ProductGroup();
            ng.setHousehold(householdRepository.getReferenceById(hid));
            ng.setName(name);
            return groupRepository.save(ng);
        }
        return null;
    }

    private Category resolveCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.badRequest("존재하지 않는 분류입니다."));
    }

    /** product 활성묶음 0 → 소프트삭제. 반환: 소프트삭제됐고 그룹 점검이 필요하면 그룹, 아니면 null. */
    @Transactional
    public ProductGroup softDeleteIfEmpty(Product product, long activeStockCount) {
        if (activeStockCount > 0 || product.getDeletedAt() != null) return null;
        product.setDeletedAt(java.time.LocalDateTime.now());
        return product.getProductGroup();
    }

    /** group 활성 품목 0 → 소프트삭제. */
    @Transactional
    public void softDeleteGroupIfEmpty(ProductGroup group) {
        if (group == null || group.getDeletedAt() != null) return;
        long active = productRepository.countByProductGroup_IdAndDeletedAtIsNull(group.getId());
        if (active == 0) group.setDeletedAt(java.time.LocalDateTime.now());
    }
}
