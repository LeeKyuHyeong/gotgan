package com.kh.stock.item;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.*;
import com.kh.stock.domain.type.ItemAction;
import com.kh.stock.item.dto.*;
import com.kh.stock.repository.*;
import com.kh.stock.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ItemHistoryRepository historyRepository;
    private final StorageLocationRepository locationRepository;
    private final CategoryRepository categoryRepository;
    private final HouseholdRepository householdRepository;
    private final AppUserRepository userRepository;

    public ItemService(ItemRepository itemRepository,
                       ItemHistoryRepository historyRepository,
                       StorageLocationRepository locationRepository,
                       CategoryRepository categoryRepository,
                       HouseholdRepository householdRepository,
                       AppUserRepository userRepository) {
        this.itemRepository = itemRepository;
        this.historyRepository = historyRepository;
        this.locationRepository = locationRepository;
        this.categoryRepository = categoryRepository;
        this.householdRepository = householdRepository;
        this.userRepository = userRepository;
    }

    /** 위치(optional)·검색(optional) 목록, 유통기한 임박순. */
    @Transactional(readOnly = true)
    public List<ItemResponse> list(Long locationId, String q) {
        Long hid = TenantContext.require();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        LocalDate today = LocalDate.now();
        return itemRepository.search(hid, locationId, query).stream()
                .map(i -> ItemResponse.from(i, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public ItemResponse get(Long itemId) {
        return ItemResponse.from(requireOwnedItem(itemId), LocalDate.now());
    }

    @Transactional
    public ItemResponse create(Long userId, CreateItemRequest req) {
        Long hid = TenantContext.require();
        StorageLocation location = requireOwnedLocation(req.locationId(), hid);
        Category category = resolveCategory(req.categoryId());

        Item item = new Item();
        item.setHousehold(householdRepository.getReferenceById(hid));
        item.setLocation(location);
        item.setCategory(category);
        item.setName(req.name());
        item.setQuantity(req.quantity());
        item.setUnit(req.unit());
        item.setExpiryDate(req.expiryDate());
        item.setMemo(req.memo());
        itemRepository.save(item);

        recordHistory(item, userId, ItemAction.CREATE, req.quantity(), req.quantity());
        return ItemResponse.from(item, LocalDate.now());
    }

    @Transactional
    public ItemResponse update(Long userId, Long itemId, UpdateItemRequest req) {
        Long hid = TenantContext.require();
        Item item = requireOwnedItem(itemId);
        StorageLocation location = requireOwnedLocation(req.locationId(), hid);
        Category category = resolveCategory(req.categoryId());

        BigDecimal oldQty = item.getQuantity();
        item.setName(req.name());
        item.setLocation(location);
        item.setCategory(category);
        item.setQuantity(req.quantity());
        item.setUnit(req.unit());
        item.setExpiryDate(req.expiryDate());
        item.setMemo(req.memo());

        BigDecimal delta = req.quantity().subtract(oldQty);
        recordHistory(item, userId, ItemAction.UPDATE,
                delta.signum() == 0 ? null : delta, req.quantity());
        return ItemResponse.from(item, LocalDate.now());
    }

    /** 수량 증감(+/-). 결과 음수 거부. */
    @Transactional
    public ItemResponse adjust(Long userId, Long itemId, AdjustQuantityRequest req) {
        Item item = requireOwnedItem(itemId);
        BigDecimal delta = req.delta();
        if (delta.signum() == 0) {
            throw ApiException.badRequest("변화량이 0입니다.");
        }
        BigDecimal newQty = item.getQuantity().add(delta);
        if (newQty.signum() < 0) {
            throw ApiException.badRequest("수량은 0보다 작을 수 없습니다.");
        }
        item.setQuantity(newQty);
        ItemAction action = delta.signum() > 0 ? ItemAction.INCREASE : ItemAction.DECREASE;
        recordHistory(item, userId, action, delta, newQty);
        return ItemResponse.from(item, LocalDate.now());
    }

    /** 소프트 삭제 + 이력. */
    @Transactional
    public void delete(Long userId, Long itemId) {
        Item item = requireOwnedItem(itemId);
        item.setDeletedAt(LocalDateTime.now());
        recordHistory(item, userId, ItemAction.DELETE, null, null);
    }

    private void recordHistory(Item item, Long userId, ItemAction action,
                               BigDecimal delta, BigDecimal quantityAfter) {
        ItemHistory h = new ItemHistory();
        h.setHousehold(item.getHousehold());
        h.setItem(item);
        h.setUser(userRepository.getReferenceById(userId));
        h.setAction(action);
        h.setDelta(delta);
        h.setQuantityAfter(quantityAfter);
        h.setItemNameSnapshot(item.getName());
        historyRepository.save(h);
    }

    private Category resolveCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.badRequest("존재하지 않는 분류입니다."));
    }

    private StorageLocation requireOwnedLocation(Long locationId, Long hid) {
        StorageLocation l = locationRepository.findById(locationId)
                .orElseThrow(() -> ApiException.badRequest("존재하지 않는 위치입니다."));
        if (!l.getHousehold().getId().equals(hid)) {
            throw ApiException.badRequest("현재 가구의 위치가 아닙니다.");
        }
        return l;
    }

    private Item requireOwnedItem(Long itemId) {
        Long hid = TenantContext.require();
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> ApiException.notFound("아이템을 찾을 수 없습니다."));
        if (!item.getHousehold().getId().equals(hid) || item.getDeletedAt() != null) {
            throw ApiException.notFound("아이템을 찾을 수 없습니다.");
        }
        return item;
    }

    /** 특정 아이템의 변동 이력(최신순). 아이템 소유(테넌트) 검증 후 반환. */
    @Transactional(readOnly = true)
    public List<HistoryResponse> itemHistory(Long itemId) {
        requireOwnedItem(itemId);
        return historyRepository.findByItemIdOrderByCreatedAtDesc(itemId).stream()
                .map(HistoryResponse::from)
                .toList();
    }

    /** 이력 목록(최신순, 페이지). */
    @Transactional(readOnly = true)
    public PageResponse<HistoryResponse> history(Pageable pageable) {
        Long hid = TenantContext.require();
        Page<ItemHistory> page = historyRepository.findByHouseholdIdOrderByCreatedAtDesc(hid, pageable);
        return PageResponse.of(page, HistoryResponse::from);
    }
}
