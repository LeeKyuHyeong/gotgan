package com.kh.stock.repository;

import com.kh.stock.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    /** 이름으로 품목 조회(소프트삭제 포함) — 재사용/되살리기 + 유니크 (household,name) 충돌 회피. */
    Optional<Product> findByHousehold_IdAndName(Long householdId, String name);

    /** 그룹의 활성 품목 수(group cascade 판단). */
    long countByProductGroup_IdAndDeletedAtIsNull(Long groupId);

    /** 분류 삭제 가드: 이 분류를 쓰는 품목이 있는지(소프트삭제 포함 — 기존 item 가드와 동일 의미). */
    boolean existsByCategory_Id(Long categoryId);

    /** picker: 활성 재고가 1개 이상인 활성 품목(이름 검색 optional, 이름순). */
    @Query("""
            select distinct p from Product p
            left join fetch p.productGroup
            left join fetch p.category
            where p.household.id = :householdId and p.deletedAt is null
              and exists (select 1 from Stock s where s.product = p and s.deletedAt is null)
              and (:q is null or lower(p.name) like lower(concat('%', :q, '%')))
            order by p.name asc
            """)
    List<Product> findActiveWithStock(@Param("householdId") Long householdId, @Param("q") String q);

    /** 가구 삭제 정리. */
    void deleteByHousehold_Id(Long householdId);
}
