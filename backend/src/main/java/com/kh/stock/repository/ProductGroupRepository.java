package com.kh.stock.repository;

import com.kh.stock.domain.ProductGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductGroupRepository extends JpaRepository<ProductGroup, Long> {

    Optional<ProductGroup> findByHousehold_IdAndName(Long householdId, String name);

    List<ProductGroup> findByHousehold_IdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(Long householdId);

    void deleteByHousehold_Id(Long householdId);
}
