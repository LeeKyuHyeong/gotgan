package com.kh.stock.stock;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.Household;
import com.kh.stock.domain.Product;
import com.kh.stock.repository.CategoryRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.repository.ProductRepository;
import com.kh.stock.stock.dto.NewProductInput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock ProductRepository productRepository;
    @Mock ProductGroupRepository groupRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock HouseholdRepository householdRepository;

    @InjectMocks ProductService service;

    private NewProductInput input(String unit, Long groupId, String groupName) {
        return new NewProductInput("맥주", unit, null, groupId, groupName);
    }

    /** (V-2) 기존 그룹(groupId)과 새 그룹 이름(groupName)을 동시에 주면 거부. */
    @Test
    void resolveOrCreate_rejectsBothGroupIdAndName() {
        when(productRepository.findByHousehold_IdAndName(1L, "맥주")).thenReturn(Optional.empty());

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> service.resolveOrCreate(1L, input("캔", 5L, "주류")));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    /** (C-3) 같은 이름 동시 생성 경합(UNIQUE 위반) → 재시도 가능한 409. */
    @Test
    void resolveOrCreate_duplicateRace_throwsConflict() {
        when(productRepository.findByHousehold_IdAndName(1L, "맥주")).thenReturn(Optional.empty());
        when(householdRepository.getReferenceById(1L)).thenReturn(new Household());
        when(productRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("dup"));

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> service.resolveOrCreate(1L, input("캔", null, null)));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    /** (V-4) 공백만 있는 unit 은 null 로 정규화해 저장. */
    @Test
    void resolveOrCreate_normalizesBlankUnitToNull() {
        when(productRepository.findByHousehold_IdAndName(1L, "맥주")).thenReturn(Optional.empty());
        when(householdRepository.getReferenceById(1L)).thenReturn(new Household());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        when(productRepository.saveAndFlush(captor.capture())).thenReturn(new Product());

        service.resolveOrCreate(1L, input("   ", null, null));

        assertThat(captor.getValue().getUnit()).isNull();
    }
}
