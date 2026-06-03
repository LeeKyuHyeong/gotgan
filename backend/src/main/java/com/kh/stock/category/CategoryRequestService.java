package com.kh.stock.category;

import com.kh.stock.category.dto.CategoryRequestResponse;
import com.kh.stock.category.dto.CreateCategoryRequestRequest;
import com.kh.stock.common.ApiException;
import com.kh.stock.domain.CategoryRequest;
import com.kh.stock.domain.type.RequestStatus;
import com.kh.stock.repository.CategoryRepository;
import com.kh.stock.repository.CategoryRequestRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.AppUserRepository;
import com.kh.stock.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 분류 추가 요청(커뮤니티 → 운영자 승인). 요청 생성/내 가구 요청 조회. */
@Service
public class CategoryRequestService {

    private final CategoryRequestRepository requestRepository;
    private final CategoryRepository categoryRepository;
    private final HouseholdRepository householdRepository;
    private final AppUserRepository userRepository;

    public CategoryRequestService(CategoryRequestRepository requestRepository,
                                  CategoryRepository categoryRepository,
                                  HouseholdRepository householdRepository,
                                  AppUserRepository userRepository) {
        this.requestRepository = requestRepository;
        this.categoryRepository = categoryRepository;
        this.householdRepository = householdRepository;
        this.userRepository = userRepository;
    }

    /** 내 가구의 분류 요청 목록(최신순). */
    @Transactional(readOnly = true)
    public List<CategoryRequestResponse> listMine() {
        Long hid = TenantContext.require();
        return requestRepository.findByHousehold_IdOrderByCreatedAtDesc(hid).stream()
                .map(CategoryRequestResponse::from)
                .toList();
    }

    @Transactional
    public CategoryRequestResponse create(Long userId, CreateCategoryRequestRequest req) {
        Long hid = TenantContext.require();
        String name = req.name().trim();

        if (categoryRepository.existsByName(name)) {
            throw ApiException.conflict("이미 등록된 분류입니다. 분류 목록에서 선택하세요.");
        }
        if (requestRepository.existsByHousehold_IdAndRequestedNameAndStatus(hid, name, RequestStatus.PENDING)) {
            throw ApiException.conflict("이미 요청한 분류입니다. 운영자 승인을 기다려주세요.");
        }

        CategoryRequest cr = new CategoryRequest();
        cr.setHousehold(householdRepository.getReferenceById(hid));
        cr.setRequestedBy(userRepository.getReferenceById(userId));
        cr.setRequestedName(name);
        cr.setSuggestedEmoji(req.emoji());
        cr.setStatus(RequestStatus.PENDING);
        requestRepository.save(cr);
        return CategoryRequestResponse.from(cr);
    }
}
