package com.kh.stock.stock;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.*;
import com.kh.stock.domain.type.ItemAction;
import com.kh.stock.item.dto.AdjustQuantityRequest;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.repository.*;
import com.kh.stock.stock.dto.CreateStockRequest;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.stock.dto.UpdateStockRequest;
import com.kh.stock.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 재고 묶음 CRUD + 합산/되살리기 + 수량증감 + cascade 정리 + 이력. */
@Service
public class StockService {

    private final StockRepository stockRepository;
    private final ItemHistoryRepository historyRepository;
    private final StorageLocationRepository locationRepository;
    private final HouseholdRepository householdRepository;
    private final AppUserRepository userRepository;
    private final ProductService productService;

    public StockService(StockRepository stockRepository,
                        ItemHistoryRepository historyRepository,
                        StorageLocationRepository locationRepository,
                        HouseholdRepository householdRepository,
                        AppUserRepository userRepository,
                        ProductService productService) {
        this.stockRepository = stockRepository;
        this.historyRepository = historyRepository;
        this.locationRepository = locationRepository;
        this.householdRepository = householdRepository;
        this.userRepository = userRepository;
        this.productService = productService;
    }

    /** 위치 상세: 묶음 평면 목록. */
    @Transactional(readOnly = true)
    public List<StockResponse> listByLocation(Long locationId) {
        Long hid = TenantContext.require();
        requireOwnedLocation(locationId, hid);
        LocalDate today = LocalDate.now();
        return stockRepository.findActiveByLocation(locationId).stream()
                .map(s -> StockResponse.from(s, today)).toList();
    }

    @Transactional(readOnly = true)
    public StockResponse get(Long stockId) {
        return StockResponse.from(requireOwned(stockId), LocalDate.now());
    }

    /** 재고 추가: 품목 해석 → 묶음 합산/되살리기/생성 + 이력. */
    @Transactional
    public StockResponse create(Long userId, CreateStockRequest req) {
        Long hid = TenantContext.require();
        validateProductSelector(req);
        StorageLocation location = requireOwnedLocation(req.locationId(), hid);

        Product product = req.productId() != null
                ? productService.requireOwnedActive(hid, req.productId())
                : productService.resolveOrCreate(hid, req.newProduct());

        // 합산 대상(활성) 탐색
        Stock target = stockRepository
                .findActiveMergeTarget(product.getId(), location.getId(), req.expiryDate())
                .orElse(null);
        if (target != null) {
            BigDecimal after = target.getQuantity().add(req.quantity());
            target.setQuantity(after);
            recordHistory(target, userId, ItemAction.INCREASE, req.quantity(), after);
            return StockResponse.from(target, LocalDate.now());
        }

        // 소프트삭제된 동일 키 묶음 되살리기
        List<Stock> revivable = stockRepository
                .findDeletedMergeCandidates(product.getId(), location.getId(), req.expiryDate());
        Stock stock;
        ItemAction action;
        if (!revivable.isEmpty()) {
            stock = revivable.get(0);
            stock.setDeletedAt(null);
            stock.setQuantity(req.quantity());
            stock.setMemo(req.memo());
            action = ItemAction.CREATE;
        } else {
            stock = new Stock();
            stock.setHousehold(householdRepository.getReferenceById(hid));
            stock.setProduct(product);
            stock.setLocation(location);
            stock.setQuantity(req.quantity());
            stock.setExpiryDate(req.expiryDate());
            stock.setMemo(req.memo());
            stockRepository.save(stock);
            action = ItemAction.CREATE;
        }
        recordHistory(stock, userId, action, req.quantity(), req.quantity());
        return StockResponse.from(stock, LocalDate.now());
    }

    /** 묶음 편집(PATCH) — 단순 갱신, 자동 합치기 없음. */
    @Transactional
    public StockResponse update(Long userId, Long stockId, UpdateStockRequest req) {
        Long hid = TenantContext.require();
        Stock stock = requireOwned(stockId);
        StorageLocation location = requireOwnedLocation(req.locationId(), hid);

        BigDecimal oldQty = stock.getQuantity();
        stock.setQuantity(req.quantity());
        stock.setExpiryDate(req.expiryDate());
        stock.setMemo(req.memo());
        stock.setLocation(location);

        BigDecimal delta = req.quantity().subtract(oldQty);
        recordHistory(stock, userId, ItemAction.UPDATE, delta.signum() == 0 ? null : delta, req.quantity());
        return StockResponse.from(stock, LocalDate.now());
    }

    /** 수량 증감(+/-). 결과 음수 거부. 0이면 묶음 소프트삭제 + cascade. */
    @Transactional
    public StockResponse adjust(Long userId, Long stockId, AdjustQuantityRequest req) {
        Stock stock = requireOwned(stockId);
        BigDecimal delta = req.delta();
        if (delta.signum() == 0) throw ApiException.badRequest("변화량이 0입니다.");
        BigDecimal newQty = stock.getQuantity().add(delta);
        if (newQty.signum() < 0) throw ApiException.badRequest("수량은 0보다 작을 수 없습니다.");
        stock.setQuantity(newQty);
        ItemAction action = delta.signum() > 0 ? ItemAction.INCREASE : ItemAction.DECREASE;
        recordHistory(stock, userId, action, delta, newQty);
        if (newQty.signum() == 0) {
            softDeleteAndCascade(stock, userId, false);
        }
        return StockResponse.from(stock, LocalDate.now());
    }

    /** 묶음 삭제: 소프트삭제 + 이력(DELETE) + cascade. */
    @Transactional
    public void delete(Long userId, Long stockId) {
        Stock stock = requireOwned(stockId);
        softDeleteAndCascade(stock, userId, true);
    }

    private void softDeleteAndCascade(Stock stock, Long userId, boolean recordDelete) {
        stock.setDeletedAt(LocalDateTime.now());
        if (recordDelete) {
            recordHistory(stock, userId, ItemAction.DELETE, null, null);
        }
        Product product = stock.getProduct();
        long active = stockRepository.countByProduct_IdAndDeletedAtIsNull(product.getId());
        ProductGroup group = productService.softDeleteIfEmpty(product, active);
        if (group != null) {
            productService.softDeleteGroupIfEmpty(group);
        }
    }

    private void recordHistory(Stock stock, Long userId, ItemAction action,
                               BigDecimal delta, BigDecimal quantityAfter) {
        ItemHistory h = new ItemHistory();
        h.setHousehold(stock.getHousehold());
        h.setStock(stock);
        h.setUser(userRepository.getReferenceById(userId));
        h.setAction(action);
        h.setDelta(delta);
        h.setQuantityAfter(quantityAfter);
        h.setItemNameSnapshot(stock.getProduct().getName());
        historyRepository.save(h);
    }

    private void validateProductSelector(CreateStockRequest req) {
        boolean hasId = req.productId() != null;
        boolean hasNew = req.newProduct() != null;
        if (hasId == hasNew) {
            throw ApiException.badRequest("productId 또는 newProduct 중 정확히 하나가 필요합니다.");
        }
    }

    private StorageLocation requireOwnedLocation(Long locationId, Long hid) {
        StorageLocation l = locationRepository.findById(locationId)
                .orElseThrow(() -> ApiException.badRequest("존재하지 않는 위치입니다."));
        if (!l.getHousehold().getId().equals(hid)) {
            throw ApiException.badRequest("현재 가구의 위치가 아닙니다.");
        }
        return l;
    }

    private Stock requireOwned(Long stockId) {
        Long hid = TenantContext.require();
        Stock s = stockRepository.findByIdWithRefs(stockId)
                .orElseThrow(() -> ApiException.notFound("재고를 찾을 수 없습니다."));
        if (!s.getHousehold().getId().equals(hid) || s.getDeletedAt() != null) {
            throw ApiException.notFound("재고를 찾을 수 없습니다.");
        }
        return s;
    }

    /** 묶음 변동 이력(최신순). */
    @Transactional(readOnly = true)
    public List<HistoryResponse> stockHistory(Long stockId) {
        requireOwned(stockId);
        return historyRepository.findByStockIdOrderByCreatedAtDesc(stockId).stream()
                .map(HistoryResponse::from).toList();
    }
}
