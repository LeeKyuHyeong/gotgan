package com.kh.stock.category;

import com.kh.stock.category.dto.CategoryResponse;
import com.kh.stock.domain.type.CategoryStatus;
import com.kh.stock.repository.CategoryRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 분류 선택 화면용 — 전역 공통 분류(활성, 정렬순). 가구 무관이라 테넌트 컨텍스트 불필요. */
@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;

    public CategoryController(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
    public List<CategoryResponse> list() {
        return categoryRepository.findByStatusOrderBySortOrderAsc(CategoryStatus.ACTIVE).stream()
                .map(CategoryResponse::from)
                .toList();
    }
}
