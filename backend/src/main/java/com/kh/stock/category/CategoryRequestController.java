package com.kh.stock.category;

import com.kh.stock.category.dto.CategoryRequestResponse;
import com.kh.stock.category.dto.CreateCategoryRequestRequest;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 분류 추가 요청 — 가구 구성원 누구나. X-Household-Id 필요. */
@RestController
@RequestMapping("/api/category-requests")
public class CategoryRequestController {

    private final CategoryRequestService service;

    public CategoryRequestController(CategoryRequestService service) {
        this.service = service;
    }

    @GetMapping
    public List<CategoryRequestResponse> list() {
        return service.listMine();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryRequestResponse create(@AuthenticationPrincipal AuthUser me,
                                          @Valid @RequestBody CreateCategoryRequestRequest req) {
        return service.create(me.id(), req);
    }
}
