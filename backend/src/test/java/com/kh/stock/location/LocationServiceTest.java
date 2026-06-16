package com.kh.stock.location;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.Household;
import com.kh.stock.domain.StorageLocation;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.repository.StorageLocationRepository;
import com.kh.stock.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocationServiceTest {

    @Mock StorageLocationRepository locationRepository;
    @Mock StockRepository stockRepository;
    @Mock HouseholdRepository householdRepository;

    @InjectMocks LocationService service;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private StorageLocation location(long id, long householdId) {
        Household h = new Household();
        h.setId(householdId);
        StorageLocation l = new StorageLocation();
        l.setId(id);
        l.setHousehold(h);
        l.setName("냉장고");
        return l;
    }

    /** 활성 재고가 없으면 하드삭제가 아니라 소프트삭제(deletedAt 세팅) — FK(RESTRICT) 위반 회피. */
    @Test
    void delete_softDeletes_notHardDelete() {
        TenantContext.set(1L);
        StorageLocation l = location(9L, 1L);
        when(locationRepository.findById(9L)).thenReturn(Optional.of(l));
        when(stockRepository.existsByLocation_IdAndDeletedAtIsNull(9L)).thenReturn(false);

        service.delete(9L);

        assertThat(l.getDeletedAt()).isNotNull();
        verify(locationRepository, never()).delete(any());
    }

    /** 활성 재고가 남아있으면 409 충돌, 소프트삭제도 하지 않음. */
    @Test
    void delete_withActiveStock_conflict() {
        TenantContext.set(1L);
        StorageLocation l = location(9L, 1L);
        when(locationRepository.findById(9L)).thenReturn(Optional.of(l));
        when(stockRepository.existsByLocation_IdAndDeletedAtIsNull(9L)).thenReturn(true);

        ApiException ex = catchThrowableOfType(ApiException.class, () -> service.delete(9L));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(l.getDeletedAt()).isNull();
    }

    /** 다른 가구의 위치는 not found(테넌트 격리). */
    @Test
    void delete_otherHousehold_notFound() {
        TenantContext.set(2L);
        StorageLocation l = location(9L, 1L); // 가구 1 소유
        when(locationRepository.findById(9L)).thenReturn(Optional.of(l));

        ApiException ex = catchThrowableOfType(ApiException.class, () -> service.delete(9L));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(l.getDeletedAt()).isNull();
    }

    /** 이미 소프트삭제된 위치는 다시 다룰 수 없음(not found). */
    @Test
    void delete_alreadyDeleted_notFound() {
        TenantContext.set(1L);
        StorageLocation l = location(9L, 1L);
        l.setDeletedAt(java.time.LocalDateTime.now());
        when(locationRepository.findById(9L)).thenReturn(Optional.of(l));

        ApiException ex = catchThrowableOfType(ApiException.class, () -> service.delete(9L));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
