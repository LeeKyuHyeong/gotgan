package com.kh.stock.admin;

import com.kh.stock.admin.dto.*;
import com.kh.stock.domain.type.RequestStatus;
import com.kh.stock.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 플랫폼 어드민 — SecurityConfig 에서 /api/admin/** 는 hasRole(SYSTEM_ADMIN).
 * 가구 무관(전역)이라 X-Household-Id 불필요.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminCategoryService service;

    public AdminController(AdminCategoryService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return service.stats();
    }

    // ---------- 분류 요청 ----------
    @GetMapping("/category-requests")
    public List<AdminCategoryRequestResponse> listRequests(
            @RequestParam(defaultValue = "PENDING") RequestStatus status) {
        return service.listRequests(status);
    }

    @PostMapping("/category-requests/{id}/approve")
    public AdminCategoryResponse approve(@AuthenticationPrincipal AuthUser me,
                                         @PathVariable Long id,
                                         @Valid @RequestBody(required = false) ApproveRequestRequest req) {
        return service.approve(me.id(), id, req != null ? req : new ApproveRequestRequest(null, null, null, null));
    }

    @PostMapping("/category-requests/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reject(@AuthenticationPrincipal AuthUser me, @PathVariable Long id) {
        service.reject(me.id(), id);
    }

    // ---------- 공통 분류 마스터 ----------
    @GetMapping("/categories")
    public List<AdminCategoryResponse> listCategories() {
        return service.listCategories();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminCategoryResponse createCategory(@Valid @RequestBody CreateCategoryRequest req) {
        return service.createCategory(req);
    }

    @PatchMapping("/categories/{id}")
    public AdminCategoryResponse updateCategory(@PathVariable Long id,
                                                @Valid @RequestBody UpdateCategoryRequest req) {
        return service.updateCategory(id, req);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        service.deleteCategory(id);
    }
}
