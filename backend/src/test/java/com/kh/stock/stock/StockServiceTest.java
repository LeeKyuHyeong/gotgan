package com.kh.stock.stock;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.Household;
import com.kh.stock.domain.Product;
import com.kh.stock.domain.Stock;
import com.kh.stock.domain.StorageLocation;
import com.kh.stock.item.dto.AdjustQuantityRequest;
import com.kh.stock.repository.AppUserRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ItemHistoryRepository;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.repository.StorageLocationRepository;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockServiceTest {

    @Mock StockRepository stockRepository;
    @Mock ItemHistoryRepository historyRepository;
    @Mock StorageLocationRepository locationRepository;
    @Mock HouseholdRepository householdRepository;
    @Mock AppUserRepository userRepository;
    @Mock ProductService productService;

    @InjectMocks StockService service;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private Stock stock(long id, long householdId, BigDecimal qty) {
        Household h = new Household();
        h.setId(householdId);
        Product p = new Product();
        p.setId(100L);
        p.setName("맥주");
        p.setUnit("캔");
        StorageLocation loc = new StorageLocation();
        loc.setId(9L);
        loc.setName("냉장고");
        loc.setEmoji("🧊");
        Stock s = new Stock();
        s.setId(id);
        s.setHousehold(h);
        s.setProduct(p);
        s.setLocation(loc);
        s.setQuantity(qty);
        return s;
    }

    /** (C-2) 증감은 락 조회(findByIdForUpdate)를 써야 동시 호출 lost update 가 안 난다. */
    @Test
    void adjust_usesLockingFetch_andIncrements() {
        TenantContext.set(1L);
        Stock s = stock(5L, 1L, new BigDecimal("100"));
        when(stockRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(s));
        when(userRepository.getReferenceById(7L)).thenReturn(new AppUser());

        StockResponse res = service.adjust(7L, 5L, new AdjustQuantityRequest(new BigDecimal("10")));

        assertThat(res.quantity()).isEqualByComparingTo("110");
        verify(stockRepository).findByIdForUpdate(5L);
        verify(stockRepository, never()).findByIdWithRefs(any());
        verify(historyRepository).save(any());
    }

    /** 결과 0 이면 소프트삭제 + cascade 정리. */
    @Test
    void adjust_toZero_softDeletesAndCascades() {
        TenantContext.set(1L);
        Stock s = stock(5L, 1L, new BigDecimal("10"));
        when(stockRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(s));
        when(userRepository.getReferenceById(7L)).thenReturn(new AppUser());
        when(stockRepository.countByProduct_IdAndDeletedAtIsNull(100L)).thenReturn(0L);
        when(productService.softDeleteIfEmpty(any(), eq(0L))).thenReturn(null);

        StockResponse res = service.adjust(7L, 5L, new AdjustQuantityRequest(new BigDecimal("-10")));

        assertThat(res.quantity()).isEqualByComparingTo("0");
        assertThat(s.getDeletedAt()).isNotNull();
        verify(productService).softDeleteIfEmpty(any(), eq(0L));
    }

    /** 결과 음수면 거부. */
    @Test
    void adjust_negativeResult_rejected() {
        TenantContext.set(1L);
        Stock s = stock(5L, 1L, new BigDecimal("3"));
        when(stockRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(s));

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> service.adjust(7L, 5L, new AdjustQuantityRequest(new BigDecimal("-10"))));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(historyRepository, never()).save(any());
    }

    /** 다른 가구의 묶음은 not found(테넌트 격리). */
    @Test
    void adjust_otherHousehold_notFound() {
        TenantContext.set(2L);
        Stock s = stock(5L, 1L, new BigDecimal("10")); // 가구 1 소유
        when(stockRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(s));

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> service.adjust(7L, 5L, new AdjustQuantityRequest(new BigDecimal("1"))));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
