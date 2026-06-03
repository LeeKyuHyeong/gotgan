package com.kh.stock.repository;

import com.kh.stock.domain.Category;
import com.kh.stock.domain.type.CategoryStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    /** 분류 선택 화면: 활성 공통 분류(정렬순). */
    List<Category> findByStatusOrderBySortOrderAsc(CategoryStatus status);

    /** 어드민 마스터: 전체(숨김 포함) 정렬순. */
    List<Category> findAllByOrderBySortOrderAsc();

    boolean existsByName(String name);

    Optional<Category> findByName(String name);
}
