package com.kh.stock.stock;

import com.kh.stock.stock.dto.CreateStockRequest;
import com.kh.stock.stock.dto.UpdateStockRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** (BE-1/V-3) 묶음 수량 0 거부가 create/update 양쪽에서 일관되는지 검증. */
class StockRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private boolean violatesQuantity(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("quantity"));
    }

    @Test
    void updateStock_rejectsZeroQuantity() {
        var violations = validator.validate(new UpdateStockRequest(BigDecimal.ZERO, null, null, 1L));
        assertThat(violatesQuantity(violations)).isTrue();
    }

    @Test
    void createStock_rejectsZeroQuantity() {
        var violations = validator.validate(new CreateStockRequest(null, null, 1L, BigDecimal.ZERO, null, null));
        assertThat(violatesQuantity(violations)).isTrue();
    }

    @Test
    void updateStock_acceptsPositiveQuantity() {
        var violations = validator.validate(new UpdateStockRequest(BigDecimal.ONE, null, null, 1L));
        assertThat(violations).isEmpty();
    }
}
