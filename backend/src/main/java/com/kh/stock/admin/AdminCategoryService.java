package com.kh.stock.admin;

import com.kh.stock.admin.dto.*;
import com.kh.stock.common.ApiException;
import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.Category;
import com.kh.stock.domain.CategoryRequest;
import com.kh.stock.domain.type.CategoryStatus;
import com.kh.stock.domain.type.RequestStatus;
import com.kh.stock.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

/** 플랫폼 어드민(SYSTEM_ADMIN) — 분류 요청 승인/거절 + 공통 분류 마스터 관리. 가구 무관(테넌트 컨텍스트 없음). */
@Service
public class AdminCategoryService {

    private final CategoryRequestRepository requestRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final HouseholdRepository householdRepository;
    private final AppUserRepository userRepository;

    public AdminCategoryService(CategoryRequestRepository requestRepository,
                                CategoryRepository categoryRepository,
                                ProductRepository productRepository,
                                HouseholdRepository householdRepository,
                                AppUserRepository userRepository) {
        this.requestRepository = requestRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.householdRepository = householdRepository;
        this.userRepository = userRepository;
    }

    // ---------- 대시보드 ----------
    @Transactional(readOnly = true)
    public AdminStatsResponse stats() {
        return new AdminStatsResponse(
                requestRepository.countByStatus(RequestStatus.PENDING),
                categoryRepository.count(),
                householdRepository.count()
        );
    }

    // ---------- 분류 요청 ----------
    @Transactional(readOnly = true)
    public List<AdminCategoryRequestResponse> listRequests(RequestStatus status) {
        return requestRepository.findByStatusOrderByCreatedAtAsc(status).stream()
                .map(r -> AdminCategoryRequestResponse.from(
                        r, requestRepository.countByRequestedNameAndStatus(r.getRequestedName(), status)))
                .toList();
    }

    /** 승인: 공통 분류 생성(or 기존 재사용) + 요청 APPROVED. 동일 이름의 다른 대기 요청도 일괄 승인. */
    @Transactional
    public AdminCategoryResponse approve(Long adminId, Long requestId, ApproveRequestRequest req) {
        CategoryRequest cr = requestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));
        if (cr.getStatus() != RequestStatus.PENDING) {
            throw ApiException.conflict("이미 처리된 요청입니다.");
        }

        String name = StringUtils.hasText(req.name()) ? req.name().trim() : cr.getRequestedName();
        String emoji = StringUtils.hasText(req.emoji()) ? req.emoji() : cr.getSuggestedEmoji();
        String color = req.color();

        Category category = categoryRepository.findByName(name)
                .orElseGet(() -> createCategoryInternal(name, emoji, color, req.sortOrder()));

        AppUser admin = userRepository.getReferenceById(adminId);
        LocalDateTime now = LocalDateTime.now();

        // 대상 + 동일 이름의 다른 대기 요청 일괄 APPROVED (같은 분류로 연결)
        List<CategoryRequest> sameName =
                requestRepository.findByRequestedNameAndStatus(cr.getRequestedName(), RequestStatus.PENDING);
        for (CategoryRequest r : sameName) {
            r.setStatus(RequestStatus.APPROVED);
            r.setResolvedCategory(category);
            r.setResolvedBy(admin);
            r.setResolvedAt(now);
        }
        return AdminCategoryResponse.from(category);
    }

    @Transactional
    public void reject(Long adminId, Long requestId) {
        CategoryRequest cr = requestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));
        if (cr.getStatus() != RequestStatus.PENDING) {
            throw ApiException.conflict("이미 처리된 요청입니다.");
        }
        cr.setStatus(RequestStatus.REJECTED);
        cr.setResolvedBy(userRepository.getReferenceById(adminId));
        cr.setResolvedAt(LocalDateTime.now());
    }

    // ---------- 공통 분류 마스터 ----------
    @Transactional(readOnly = true)
    public List<AdminCategoryResponse> listCategories() {
        return categoryRepository.findAllByOrderBySortOrderAsc().stream()
                .map(AdminCategoryResponse::from)
                .toList();
    }

    @Transactional
    public AdminCategoryResponse createCategory(CreateCategoryRequest req) {
        String name = req.name().trim();
        if (categoryRepository.existsByName(name)) {
            throw ApiException.conflict("이미 있는 분류입니다.");
        }
        return AdminCategoryResponse.from(createCategoryInternal(name, req.emoji(), req.color(), req.sortOrder()));
    }

    @Transactional
    public AdminCategoryResponse updateCategory(Long categoryId, UpdateCategoryRequest req) {
        Category c = categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.notFound("분류를 찾을 수 없습니다."));
        if (StringUtils.hasText(req.name())) {
            String name = req.name().trim();
            if (!name.equals(c.getName()) && categoryRepository.existsByName(name)) {
                throw ApiException.conflict("이미 있는 분류입니다.");
            }
            c.setName(name);
        }
        if (req.emoji() != null) c.setEmoji(req.emoji());
        if (req.color() != null) c.setColor(StringUtils.hasText(req.color()) ? req.color() : null);
        if (req.sortOrder() != null) c.setSortOrder(req.sortOrder());
        if (req.status() != null) c.setStatus(req.status());
        return AdminCategoryResponse.from(c);
    }

    /** 삭제: 아이템/요청이력에서 사용 중이면 거부(숨김 처리 권장). */
    @Transactional
    public void deleteCategory(Long categoryId) {
        Category c = categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.notFound("분류를 찾을 수 없습니다."));
        if (productRepository.existsByCategory_Id(categoryId)) {
            throw ApiException.conflict("이 분류를 사용하는 품목이 있어 삭제할 수 없습니다. 대신 숨김 처리하세요.");
        }
        if (requestRepository.existsByResolvedCategory_Id(categoryId)) {
            throw ApiException.conflict("이 분류에 연결된 승인 이력이 있어 삭제할 수 없습니다. 대신 숨김 처리하세요.");
        }
        categoryRepository.delete(c);
    }

    private Category createCategoryInternal(String name, String emoji, String color, Integer sortOrder) {
        int order = sortOrder != null ? sortOrder
                : categoryRepository.findAll().stream().mapToInt(Category::getSortOrder).max().orElse(0) + 1;
        Category c = new Category();
        c.setName(name);
        c.setEmoji(emoji);
        c.setColor(StringUtils.hasText(color) ? color : null);
        c.setSortOrder(order);
        c.setStatus(CategoryStatus.ACTIVE);
        return categoryRepository.save(c);
    }
}
