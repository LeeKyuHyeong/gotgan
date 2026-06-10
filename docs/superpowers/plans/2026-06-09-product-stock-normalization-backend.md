# 품목/재고 정규화 — 백엔드 + 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평평한 `item` 테이블을 `product_group → product → stock` 3계층으로 정규화하고, 운영 데이터를 Java 기반 Flyway 마이그레이션(V6/V7/V8)으로 보존 이관하며, `/api/items`를 `/api/inventory`·`/api/stock`·`/api/products`·`/api/product-groups`로 대체한다.

**Architecture:** Spring Boot 4 + JPA(`ddl-auto: validate`) + Flyway. 스키마 소유는 Flyway. **핵심 제약: `validate` 때문에 모든 `@Entity` 매핑은 그 시점 DB 스키마와 일치해야 한다.** 따라서 (1) 신규 스키마·엔티티를 *추가만* 하는 안전 단계와 (2) `item` → `item_legacy` rename + `item_history` FK 교체 + 구코드 제거를 한 번에 끊는 *컷오버 단계*로 나눈다. 테스트는 사용자 결정에 따라 **단위 테스트만**(DB 비의존 순수 로직) + **수동 검증**(로컬 MariaDB 3306에 `bootRun`).

**Tech Stack:** Java 17, Spring Boot 4.0.6, Spring Data JPA, Flyway(`flyway-mysql`), MariaDB, Lombok, JUnit 5. 설계 스펙: `docs/superpowers/specs/2026-06-09-product-stock-normalization-design.md`.

**미해결 #1 확정 (inventory DTO 형태):** **부분 중첩** — `InventoryResponse{ groups: [그룹+소속 product+batch], ungrouped: [product+batch] }`. 그룹 합산·minDDay는 백엔드가 계산. 그룹/단독 간 정렬 병합은 프론트(별도 계획)에서.

---

## 사전 조건 (실행 전 1회 확인)

- [ ] 로컬 MariaDB(3306, DB `stock`)가 떠 있고 운영 스키마(V1~V5 적용 완료)와 동일한지 확인.
- [ ] 운영 정크 행 `뭉치`(item id=2)와 그 `item_history`는 **이미 운영 DB에서 삭제됨(2026-06-09)**. 로컬 DB에도 동일 행이 있으면 같은 방식으로 삭제(`DELETE FROM item_history WHERE item_id=2; DELETE FROM item WHERE id=2;`). V7 코드에는 선삭제 로직을 넣지 않는다.
- [ ] 빌드/테스트 명령: `cd backend && ./gradlew test` (단위 테스트), `./gradlew bootRun` (수동 검증). Windows PowerShell에선 `.\gradlew.bat`.

---

## File Structure

**신규 (도메인/리포지토리):**
- `backend/src/main/resources/db/migration/V6__product_stock_schema.sql` — 3계층 테이블 + `item.migrated_stock_id`
- `backend/src/main/java/db/migration/V7__migrate_items_to_stock.java` — 데이터 이관(Java). **반드시 `src/main/java`** 아래(컴파일돼 classpath 클래스가 돼야 Flyway가 발견). resources에 두면 컴파일 안 돼 조용히 스킵됨.
- `backend/src/main/resources/db/migration/V8__history_fk_and_legacy_rename.sql` — 이력 FK 재배선 + `item`→`item_legacy`
- `backend/src/main/java/com/kh/stock/domain/ProductGroup.java`
- `backend/src/main/java/com/kh/stock/domain/Product.java`
- `backend/src/main/java/com/kh/stock/domain/Stock.java`
- `backend/src/main/java/com/kh/stock/repository/ProductGroupRepository.java`
- `backend/src/main/java/com/kh/stock/repository/ProductRepository.java`
- `backend/src/main/java/com/kh/stock/repository/StockRepository.java`

**신규 (서비스/컨트롤러/DTO) — 패키지 `com.kh.stock.stock`:**
- `stock/dto/CreateStockRequest.java`, `NewProductInput.java`, `UpdateStockRequest.java`
- `stock/dto/StockResponse.java`, `InventoryResponse.java`, `ProductResponse.java`, `ProductGroupResponse.java`
- `stock/InventoryAssembler.java` (순수 로직 — 단위 테스트 대상)
- `stock/ProductService.java`, `stock/StockService.java`, `stock/InventoryService.java`, `stock/HistoryService.java`
- `stock/StockController.java`, `stock/InventoryController.java`, `stock/ProductController.java`, `stock/ProductGroupController.java`
- `stock/HistoryController.java` (기존 `item/HistoryController.java` 대체)
- `backend/src/test/java/com/kh/stock/stock/InventoryAssemblerTest.java`

**수정:**
- `domain/ItemHistory.java` — `Item item` → `Stock stock` (테이블 컬럼 `stock_id`)
- `item/dto/HistoryResponse.java` — `h.getItem()` → `h.getStock()` (패키지는 유지 또는 `stock/dto`로 이동; 본 계획은 *유지*)
- `location/LocationService.java` — `ItemRepository` → `StockRepository`
- `admin/AdminCategoryService.java` — 분류 삭제 가드 `ItemRepository` → `ProductRepository`
- `household/HouseholdService.java` — 삭제 cascade에 stock/product/group 정리 추가
- `push/ExpiryPushScheduler.java` — `Item` → `Stock`(품목명 = `stock.getProduct().getName()`)

**삭제 (컷오버 시):**
- `domain/Item.java`, `repository/ItemRepository.java`
- `item/ItemController.java`, `item/ItemService.java`
- `item/dto/CreateItemRequest.java`, `item/dto/UpdateItemRequest.java`, `item/dto/ItemResponse.java`
- (유지: `item/dto/AdjustQuantityRequest.java`, `item/dto/HistoryResponse.java`, `item/dto/PageResponse.java`)

---

# Phase 1 — 추가형 스키마 + 엔티티 + 리포지토리 (앱 무중단)

> 이 단계가 끝나도 `/api/items`는 그대로 동작한다. 신규 테이블은 비어 있고 미사용. 매 커밋에서 앱이 부팅된다.

## Task 1: V6 스키마 마이그레이션

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__product_stock_schema.sql`

- [ ] **Step 1: V6 SQL 작성**

```sql
-- 품목/재고 정규화 — 신규 3계층 스키마 (Flyway V6, 스키마 변경만)
-- 설계: docs/superpowers/specs/2026-06-09-product-stock-normalization-design.md
-- MariaDB / InnoDB / utf8mb4. 멀티테넌트: household_id 격리.

CREATE TABLE product_group (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  household_id BIGINT      NOT NULL,
  name         VARCHAR(50) NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  deleted_at   DATETIME    NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_name (household_id, name),
  KEY idx_group_active (household_id, deleted_at),
  CONSTRAINT fk_group_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  household_id     BIGINT       NOT NULL,
  product_group_id BIGINT       NULL,
  category_id      BIGINT       NULL,
  name             VARCHAR(100) NOT NULL,
  unit             VARCHAR(20)  NULL,
  sort_order       INT          NOT NULL DEFAULT 0,
  deleted_at       DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_name (household_id, name),
  KEY idx_product_active (household_id, deleted_at),
  KEY idx_product_group (product_group_id),
  CONSTRAINT fk_product_household FOREIGN KEY (household_id)     REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_group     FOREIGN KEY (product_group_id) REFERENCES product_group (id),
  CONSTRAINT fk_product_category  FOREIGN KEY (category_id)      REFERENCES category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  household_id BIGINT        NOT NULL,
  product_id   BIGINT        NOT NULL,
  location_id  BIGINT        NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
  expiry_date  DATE          NULL,
  memo         VARCHAR(255)  NULL,
  deleted_at   DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_active (household_id, deleted_at),
  KEY idx_stock_location (location_id, deleted_at),
  KEY idx_stock_expiry (household_id, expiry_date),
  KEY idx_stock_product (product_id),
  CONSTRAINT fk_stock_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_product   FOREIGN KEY (product_id)  REFERENCES product (id),
  CONSTRAINT fk_stock_location  FOREIGN KEY (location_id) REFERENCES storage_location (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- V7(Java)가 stock.id를 역참조 기록하는 임시 컬럼. V8 이후에도 롤백 안전망으로 보존.
ALTER TABLE item ADD COLUMN migrated_stock_id BIGINT NULL;
```

> **stock에 DB 유니크 없음**: `(product_id, location_id, expiry_date)` 합산은 앱 로직 전용(스펙). NULL이 유니크에서 distinct로 취급돼 `(…, NULL)` 중복을 못 막으므로 의도적으로 인덱스만 둔다.

- [ ] **Step 2: 마이그레이션 적용 확인 (수동)**

Run: `cd backend && ./gradlew bootRun` (로컬 MariaDB 3306 기동 상태)
Expected: 부팅 로그에 `Migrating schema ... to version "6 - product stock schema"` 후 정상 기동. `flyway_schema_history`에 V6 행 추가. `SHOW TABLES;`에 `product_group`, `product`, `stock` 존재. `DESCRIBE item;`에 `migrated_stock_id` 컬럼 존재. 기존 `GET /api/items`는 여전히 200.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V6__product_stock_schema.sql
git commit -m "feat(db): V6 — product/product_group/stock 스키마 + item.migrated_stock_id"
```

## Task 2: ProductGroup / Product / Stock 엔티티

**Files:**
- Create: `backend/src/main/java/com/kh/stock/domain/ProductGroup.java`
- Create: `backend/src/main/java/com/kh/stock/domain/Product.java`
- Create: `backend/src/main/java/com/kh/stock/domain/Stock.java`

- [ ] **Step 1: ProductGroup 작성**

```java
package com.kh.stock.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 품목 그룹 (선택적). 같은 품목의 규격(캔/병)을 묶어 합산 표시. 가구 범위, 소프트삭제. */
@Entity
@Table(name = "product_group")
@Getter
@Setter
@NoArgsConstructor
public class ProductGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 2: Product 작성**

```java
package com.kh.stock.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 품목 = 재고 단위(맥주 캔). 같은 이름은 항상 하나(가구 내) → 위치 가로지른 합산 성립. 소프트삭제. */
@Entity
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    /** 선택적 그룹. NULL = 그룹 없음(단독 품목). 필드명은 HQL 예약어 'group' 회피로 productGroup. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_group_id")
    private ProductGroup productGroup;

    /** 전역 공통 분류. NULL = 미분류. (기존 item.category 에서 품목 레벨로 이동) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 20)
    private String unit;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 3: Stock 작성**

```java
package com.kh.stock.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 재고 묶음(batch) = 실재고. (product, location, expiry_date) 당 하나 의도(앱 로직 합산). 소프트삭제. */
@Entity
@Table(name = "stock")
@Getter
@Setter
@NoArgsConstructor
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 격리/조회 편의용 비정규화. product.household 와 항상 일치. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    private StorageLocation location;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(length = 255)
    private String memo;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 4: 부팅 검증 (수동)**

Run: `cd backend && ./gradlew bootRun`
Expected: `ddl-auto: validate`가 신규 3개 엔티티를 V6 스키마와 대조 → 오류 없이 기동. (불일치 시 `Schema-validation` 예외로 즉시 실패 — 컬럼/타입 확인.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/kh/stock/domain/ProductGroup.java backend/src/main/java/com/kh/stock/domain/Product.java backend/src/main/java/com/kh/stock/domain/Stock.java
git commit -m "feat(domain): ProductGroup/Product/Stock 엔티티 추가"
```

## Task 3: 신규 리포지토리

**Files:**
- Create: `backend/src/main/java/com/kh/stock/repository/ProductGroupRepository.java`
- Create: `backend/src/main/java/com/kh/stock/repository/ProductRepository.java`
- Create: `backend/src/main/java/com/kh/stock/repository/StockRepository.java`

- [ ] **Step 1: ProductGroupRepository**

```java
package com.kh.stock.repository;

import com.kh.stock.domain.ProductGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductGroupRepository extends JpaRepository<ProductGroup, Long> {

    /** 이름으로 그룹 조회(소프트삭제 포함) — 유니크 (household,name) 충돌 회피 + 되살리기용. */
    Optional<ProductGroup> findByHousehold_IdAndName(Long householdId, String name);

    /** picker: 활성 그룹. */
    List<ProductGroup> findByHousehold_IdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(Long householdId);

    /** 그룹의 활성 품목 수(cascade 판단). */
    long countByProductGroup_IdAndDeletedAtIsNull(Long groupId);

    /** 가구 삭제 정리(소프트삭제 무관). */
    void deleteByHousehold_Id(Long householdId);
}
```

> 마지막 메서드명 충돌 주의: `countByProductGroup_IdAndDeletedAtIsNull`은 **Product** 기준이므로 ProductRepository에 둔다. (아래 Step 2 참조) — ProductGroupRepository에서는 이 메서드를 제거하고 ProductRepository로 옮길 것.

정정된 ProductGroupRepository:

```java
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
```

- [ ] **Step 2: ProductRepository**

```java
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
```

- [ ] **Step 3: StockRepository**

```java
package com.kh.stock.repository;

import com.kh.stock.domain.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockRepository extends JpaRepository<Stock, Long> {

    /** 위치 상세: 활성 묶음(유통기한 임박순, NULL 뒤). product/location/category fetch. */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.category
              join fetch s.location
            where s.location.id = :locationId and s.deletedAt is null
            order by case when s.expiryDate is null then 1 else 0 end, s.expiryDate asc
            """)
    List<Stock> findActiveByLocation(@Param("locationId") Long locationId);

    /** 전체/홈: 가구의 활성 묶음(유통기한 임박순). product/group/location fetch. */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.productGroup
              left join fetch p.category
              join fetch s.location
            where s.household.id = :householdId and s.deletedAt is null
            order by case when s.expiryDate is null then 1 else 0 end, s.expiryDate asc
            """)
    List<Stock> findActiveByHousehold(@Param("householdId") Long householdId);

    /** 합산 키 매칭(null-safe 유통기한): 같은 (product, location, expiry) 활성 묶음. */
    @Query("""
            select s from Stock s
            where s.product.id = :productId and s.location.id = :locationId
              and s.deletedAt is null
              and ((:expiry is null and s.expiryDate is null) or s.expiryDate = :expiry)
            """)
    Optional<Stock> findActiveMergeTarget(@Param("productId") Long productId,
                                          @Param("locationId") Long locationId,
                                          @Param("expiry") LocalDate expiry);

    /** 되살리기: 같은 키의 소프트삭제 묶음(있으면 재사용). */
    @Query("""
            select s from Stock s
            where s.product.id = :productId and s.location.id = :locationId
              and s.deletedAt is not null
              and ((:expiry is null and s.expiryDate is null) or s.expiryDate = :expiry)
            order by s.deletedAt desc
            """)
    List<Stock> findDeletedMergeCandidates(@Param("productId") Long productId,
                                           @Param("locationId") Long locationId,
                                           @Param("expiry") LocalDate expiry);

    /** product의 활성 묶음 수(product cascade 판단). */
    long countByProduct_IdAndDeletedAtIsNull(Long productId);

    /** 위치 삭제 가드: 활성 묶음 존재 여부. */
    boolean existsByLocation_IdAndDeletedAtIsNull(Long locationId);

    /** 곧만료(D-3) 푸시: 전 가구 활성 묶음. product/household fetch, 가구·임박순. */
    @Query("""
            select s from Stock s
              join fetch s.household
              join fetch s.product
            where s.deletedAt is null and s.expiryDate between :from and :to
            order by s.household.id, s.expiryDate asc
            """)
    List<Stock> findAllExpiringForNotify(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 단건 + 연관 fetch(응답/이력용). */
    @Query("""
            select s from Stock s
              join fetch s.product p
              left join fetch p.category
              join fetch s.location
            where s.id = :id
            """)
    Optional<Stock> findByIdWithRefs(@Param("id") Long id);

    /** 가구 삭제 정리. */
    void deleteByHousehold_Id(Long householdId);
}
```

- [ ] **Step 4: 컴파일 + 부팅 검증 (수동)**

Run: `cd backend && ./gradlew bootRun`
Expected: 정상 기동(쿼리 파생/JPQL 파싱 오류 없음). 기존 API 정상.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/kh/stock/repository/ProductGroupRepository.java backend/src/main/java/com/kh/stock/repository/ProductRepository.java backend/src/main/java/com/kh/stock/repository/StockRepository.java
git commit -m "feat(repo): ProductGroup/Product/Stock 리포지토리"
```

---

# Phase 2 — Inventory 조립 순수 로직 (단위 테스트)

> DB 비의존 순수 로직을 먼저 TDD로 굳힌다. 이게 본 계획의 유일한 자동화 테스트 대상.

## Task 4: InventoryResponse DTO + InventoryAssembler (TDD)

**Files:**
- Create: `backend/src/main/java/com/kh/stock/stock/dto/StockResponse.java`
- Create: `backend/src/main/java/com/kh/stock/stock/dto/InventoryResponse.java`
- Create: `backend/src/main/java/com/kh/stock/stock/InventoryAssembler.java`
- Test: `backend/src/test/java/com/kh/stock/stock/InventoryAssemblerTest.java`

- [ ] **Step 1: StockResponse 작성**

```java
package com.kh.stock.stock.dto;

import com.kh.stock.domain.Category;
import com.kh.stock.domain.Stock;
import com.kh.stock.domain.StorageLocation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** 재고 묶음 응답(위치 상세/단건). dDay=남은 일수(만료없음 null), expiringSoon=D-3 이내. */
public record StockResponse(
        Long id,
        Long productId,
        String productName,
        String unit,
        BigDecimal quantity,
        LocalDate expiryDate,
        String memo,
        Long locationId,
        String locationName,
        String locationEmoji,
        Long categoryId,
        String categoryName,
        String categoryEmoji,
        String categoryColor,
        Long dDay,
        boolean expiringSoon
) {
    public static StockResponse from(Stock s, LocalDate today) {
        var p = s.getProduct();
        StorageLocation loc = s.getLocation();
        Category cat = p.getCategory();
        Long dDay = s.getExpiryDate() == null ? null : ChronoUnit.DAYS.between(today, s.getExpiryDate());
        boolean soon = dDay != null && dDay >= 0 && dDay <= 3;
        return new StockResponse(
                s.getId(), p.getId(), p.getName(), p.getUnit(), s.getQuantity(),
                s.getExpiryDate(), s.getMemo(),
                loc.getId(), loc.getName(), loc.getEmoji(),
                cat == null ? null : cat.getId(),
                cat == null ? null : cat.getName(),
                cat == null ? null : cat.getEmoji(),
                cat == null ? null : cat.getColor(),
                dDay, soon);
    }
}
```

- [ ] **Step 2: InventoryResponse 작성**

```java
package com.kh.stock.stock.dto;

import java.math.BigDecimal;
import java.util.List;

/** 전체 보기: 그룹(소속 품목+묶음) + 그룹 없는 단독 품목. 그룹/단독 간 정렬 병합은 프론트. */
public record InventoryResponse(
        List<Group> groups,
        List<Product> ungrouped
) {
    /** 그룹 합산 행. totalQuantity=소속 품목 합, minDDay=가장 임박(null=만료없음만). */
    public record Group(
            Long groupId,
            String groupName,
            BigDecimal totalQuantity,
            Long minDDay,
            boolean expiringSoon,
            List<Product> products
    ) {}

    /** 품목 합산 행 + 펼침 묶음. */
    public record Product(
            Long productId,
            String name,
            String unit,
            Long categoryId,
            String categoryName,
            String categoryEmoji,
            String categoryColor,
            BigDecimal totalQuantity,
            Long minDDay,
            boolean expiringSoon,
            List<StockResponse> batches
    ) {}
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`InventoryAssembler.assemble(List<StockResponse> batches, today)` 는 묶음 평면 목록(같은 productId가 위치별로 여러 개, 그룹 정보는 별도 맵)을 받아 `InventoryResponse`로 조립한다. 그룹 정보 전달을 위해 입력 묶음에 productId만 있으므로, 그룹/품목 메타는 별도 인자 `Map<Long, ProductMeta>`로 받는다.

```java
package com.kh.stock.stock;

import com.kh.stock.stock.InventoryAssembler.ProductMeta;
import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryAssemblerTest {

    private final LocalDate today = LocalDate.of(2026, 6, 9);

    private StockResponse batch(long id, long productId, String name, String qty, LocalDate expiry,
                                long locId, String locName) {
        Long dDay = expiry == null ? null : (long) (expiry.toEpochDay() - today.toEpochDay());
        boolean soon = dDay != null && dDay >= 0 && dDay <= 3;
        return new StockResponse(id, productId, name, "개", new BigDecimal(qty), expiry, null,
                locId, locName, null, null, null, null, null, dDay, soon);
    }

    @Test
    void groups_products_sum_quantity_and_min_dday() {
        // 맥주(group 1): 캔(product 10) 냉장고1 + 뒷베란다2, 병(product 11) 냉장고2
        // 우유(product 20, group 없음) 1
        List<StockResponse> batches = List.of(
                batch(1, 10, "맥주 캔", "1", LocalDate.of(2026, 6, 12), 1, "냉장고"),
                batch(2, 10, "맥주 캔", "2", null, 2, "뒷베란다"),
                batch(3, 11, "맥주 병", "2", null, 1, "냉장고"),
                batch(4, 20, "우유", "1", LocalDate.of(2026, 6, 10), 3, "냉장고")
        );
        Map<Long, ProductMeta> meta = Map.of(
                10L, new ProductMeta(10L, "맥주 캔", "개", 1L, "맥주", null, null, null, null),
                11L, new ProductMeta(11L, "맥주 병", "개", 1L, "맥주", null, null, null, null),
                20L, new ProductMeta(20L, "우유", "개", null, null, null, null, null, null)
        );

        InventoryResponse res = InventoryAssembler.assemble(batches, meta);

        assertThat(res.groups()).hasSize(1);
        InventoryResponse.Group beer = res.groups().get(0);
        assertThat(beer.groupId()).isEqualTo(1L);
        assertThat(beer.totalQuantity()).isEqualByComparingTo("5");      // 1+2+2
        assertThat(beer.minDDay()).isEqualTo(3L);                         // 6/12 - 6/9
        assertThat(beer.expiringSoon()).isTrue();
        assertThat(beer.products()).hasSize(2);
        // 그룹 내 품목은 이름 오름차순(스펙 "그룹 내 품목은 이름/정렬순"): 맥주 병(ㅂ) < 맥주 캔(ㅋ)
        assertThat(beer.products()).extracting(InventoryResponse.Product::name)
                .containsExactly("맥주 병", "맥주 캔");
        InventoryResponse.Product can = beer.products().stream()
                .filter(p -> p.productId() == 10L).findFirst().orElseThrow();
        assertThat(can.totalQuantity()).isEqualByComparingTo("3");
        assertThat(can.batches()).hasSize(2);

        assertThat(res.ungrouped()).hasSize(1);
        InventoryResponse.Product milk = res.ungrouped().get(0);
        assertThat(milk.productId()).isEqualTo(20L);
        assertThat(milk.minDDay()).isEqualTo(1L);
        assertThat(milk.expiringSoon()).isTrue();
        assertThat(milk.totalQuantity()).isEqualByComparingTo("1");
    }

    @Test
    void product_with_only_null_expiry_has_null_minDDay_and_not_soon() {
        List<StockResponse> batches = List.of(batch(1, 30, "휴지", "2", null, 1, "창고"));
        Map<Long, ProductMeta> meta = Map.of(
                30L, new ProductMeta(30L, "휴지", "개", null, null, null, null, null, null));

        InventoryResponse res = InventoryAssembler.assemble(batches, meta);

        assertThat(res.groups()).isEmpty();
        assertThat(res.ungrouped()).hasSize(1);
        assertThat(res.ungrouped().get(0).minDDay()).isNull();
        assertThat(res.ungrouped().get(0).expiringSoon()).isFalse();
    }

    @Test
    void expired_batch_yields_negative_minDDay_consistent_with_app_dDay_convention() {
        // 만료 지난 묶음(dDay<0)은 음수 minDDay로 노출(기존 앱 dDay 관례: "지났으면 음수"), expiringSoon=false
        List<StockResponse> batches = List.of(
                batch(1, 40, "계란", "1", LocalDate.of(2026, 6, 4), 1, "냉장고"),   // D-5(지남)
                batch(2, 40, "계란", "1", LocalDate.of(2026, 6, 20), 1, "냉장고")   // D+11
        );
        Map<Long, ProductMeta> meta = Map.of(
                40L, new ProductMeta(40L, "계란", "개", null, null, null, null, null, null));

        InventoryResponse res = InventoryAssembler.assemble(batches, meta);

        InventoryResponse.Product egg = res.ungrouped().get(0);
        assertThat(egg.minDDay()).isEqualTo(-5L);
        assertThat(egg.expiringSoon()).isFalse();
    }
}
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.kh.stock.stock.InventoryAssemblerTest"`
Expected: 컴파일 실패 — `InventoryAssembler`/`ProductMeta` 미정의. (assertj는 spring-boot-starter-*-test 전이의존성으로 이미 클래스패스에 있음.)

- [ ] **Step 5: InventoryAssembler 구현**

```java
package com.kh.stock.stock;

import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** 묶음 평면 목록 + 품목 메타 → 그룹/품목 합산 트리. 순수 함수(DB 비의존).
 *  계약: meta는 batches의 모든 productId를 포함해야 함(누락 시 명확한 예외). */
public final class InventoryAssembler {

    private InventoryAssembler() {}

    /** 품목 메타(그룹·분류). groupId/groupName 둘 다 있으면 그룹 소속. */
    public record ProductMeta(
            Long productId, String name, String unit,
            Long groupId, String groupName,
            Long categoryId, String categoryName, String categoryEmoji, String categoryColor
    ) {}

    public static InventoryResponse assemble(List<StockResponse> batches, Map<Long, ProductMeta> meta) {
        // 1) productId 별 묶음 모으기(입력 순서 = 임박순 유지)
        Map<Long, List<StockResponse>> byProduct = new LinkedHashMap<>();
        for (StockResponse b : batches) {
            byProduct.computeIfAbsent(b.productId(), k -> new ArrayList<>()).add(b);
        }

        // 2) 품목 합산 행 만들기
        Map<Long, InventoryResponse.Product> products = new LinkedHashMap<>();
        for (var e : byProduct.entrySet()) {
            ProductMeta m = Objects.requireNonNull(meta.get(e.getKey()),
                    () -> "missing ProductMeta for productId=" + e.getKey());
            List<StockResponse> bs = e.getValue();
            BigDecimal total = bs.stream().map(StockResponse::quantity)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Long minDDay = bs.stream().map(StockResponse::dDay)
                    .filter(d -> d != null).min(Comparator.naturalOrder()).orElse(null);
            boolean soon = bs.stream().anyMatch(StockResponse::expiringSoon);
            products.put(e.getKey(), new InventoryResponse.Product(
                    m.productId(), m.name(), m.unit(),
                    m.categoryId(), m.categoryName(), m.categoryEmoji(), m.categoryColor(),
                    total, minDDay, soon, List.copyOf(bs)));
        }

        // 3) 그룹 묶기
        Map<Long, List<InventoryResponse.Product>> byGroup = new LinkedHashMap<>();
        Map<Long, String> groupName = new LinkedHashMap<>();
        List<InventoryResponse.Product> ungrouped = new ArrayList<>();
        for (var e : products.entrySet()) {
            ProductMeta m = Objects.requireNonNull(meta.get(e.getKey()),
                    () -> "missing ProductMeta for productId=" + e.getKey());
            if (m.groupId() != null) {
                byGroup.computeIfAbsent(m.groupId(), k -> new ArrayList<>()).add(e.getValue());
                groupName.putIfAbsent(m.groupId(), m.groupName());
            } else {
                ungrouped.add(e.getValue());
            }
        }

        // 4) 그룹 합산 + 품목 이름순 정렬
        List<InventoryResponse.Group> groups = new ArrayList<>();
        for (var e : byGroup.entrySet()) {
            List<InventoryResponse.Product> ps = e.getValue();
            ps.sort(Comparator.comparing(InventoryResponse.Product::name));
            BigDecimal total = ps.stream().map(InventoryResponse.Product::totalQuantity)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Long minDDay = ps.stream().map(InventoryResponse.Product::minDDay)
                    .filter(d -> d != null).min(Comparator.naturalOrder()).orElse(null);
            boolean soon = ps.stream().anyMatch(InventoryResponse.Product::expiringSoon);
            groups.add(new InventoryResponse.Group(e.getKey(), groupName.get(e.getKey()),
                    total, minDDay, soon, ps));
        }
        // 그룹/단독 각각 minDDay 임박순(null 뒤) 정렬
        Comparator<Long> dday = Comparator.nullsLast(Comparator.naturalOrder());
        groups.sort(Comparator.comparing(InventoryResponse.Group::minDDay, dday));
        ungrouped.sort(Comparator.comparing(InventoryResponse.Product::minDDay, dday));

        return new InventoryResponse(groups, ungrouped);
    }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.kh.stock.stock.InventoryAssemblerTest"`
Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/kh/stock/stock/dto/StockResponse.java backend/src/main/java/com/kh/stock/stock/dto/InventoryResponse.java backend/src/main/java/com/kh/stock/stock/InventoryAssembler.java backend/src/test/java/com/kh/stock/stock/InventoryAssemblerTest.java
git commit -m "feat(inventory): InventoryAssembler 합산 트리 조립 + 단위 테스트"
```

---

# Phase 3 — 컷오버 (V7/V8 + 신규 서비스 + 구코드 제거)

> **⚠️ 단일 논리 단위.** `ddl-auto: validate`가 스키마-엔티티 일치를 강제하므로, V8(테이블 rename)과 `ItemHistory` 엔티티 변경·`Item` 삭제·blast-radius 재배선은 **한 커밋**으로 끊어야 앱이 부팅된다. 아래 Task 5~12를 작업 트리에서 모두 완료한 뒤 **마지막에 한 번 부팅 검증 + 한 커밋**한다. (중간 커밋은 부팅되지 않을 수 있음.)

## Task 5: V7 데이터 이관 (Java)

**Files:**
- Create: `backend/src/main/java/db/migration/V7__migrate_items_to_stock.java` (⚠️ `src/main/java`, NOT resources — Java 마이그레이션은 컴파일된 클래스여야 Flyway가 발견)

- [ ] **Step 1: V7 Java 마이그레이션 작성**

```java
package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * 기존 item → product/stock 이관. 그룹핑 키 = (household_id, name)로 product 유니크와 일치
 * (운영 실측상 (household_id, name) 중복 0건). unit/category는 그룹의 첫 행 값.
 * 그룹의 모든 원본 item이 소프트삭제면 product.deleted_at도 설정(cascade 불변식 보존).
 * item_history 재배선은 V8에서(FK 제약 때문에).
 */
public class V7__migrate_items_to_stock extends BaseJavaMigration {

    @Override
    public void migrate(Context context) {
        JdbcTemplate jdbc = new JdbcTemplate(
                new SingleConnectionDataSource(context.getConnection(), true));

        List<Map<String, Object>> items = jdbc.queryForList("""
                select id, household_id, location_id, category_id, name, quantity, unit,
                       expiry_date, memo, deleted_at
                from item
                order by household_id, name, id
                """);

        // 1) (household_id, name) → product_id (생성/재사용). 첫 행 unit/category 사용.
        record ProdKey(long household, String name) {}
        java.util.Map<ProdKey, Long> productIds = new java.util.HashMap<>();
        // 그룹의 모든 행 소프트삭제 여부 추적
        java.util.Map<ProdKey, Boolean> allDeleted = new java.util.HashMap<>();
        java.util.Map<ProdKey, Timestamp> anyDeletedAt = new java.util.HashMap<>();

        for (Map<String, Object> it : items) {
            long household = ((Number) it.get("household_id")).longValue();
            String name = (String) it.get("name");
            ProdKey key = new ProdKey(household, name);
            Timestamp deletedAt = (Timestamp) it.get("deleted_at");
            allDeleted.merge(key, deletedAt != null, (a, b) -> a && b);
            // 그룹 전체가 소프트삭제일 때 product.deleted_at에 쓸 대표 시각.
            // cascade 불변식엔 non-null이기만 하면 되므로 첫 값으로 충분(정확한 시각 불요).
            if (deletedAt != null) anyDeletedAt.putIfAbsent(key, deletedAt);

            if (!productIds.containsKey(key)) {
                Long categoryId = it.get("category_id") == null ? null
                        : ((Number) it.get("category_id")).longValue();
                String unit = (String) it.get("unit");
                KeyHolder kh = new GeneratedKeyHolder();
                jdbc.update(con -> {
                    PreparedStatement ps = con.prepareStatement("""
                            insert into product (household_id, product_group_id, category_id, name, unit, sort_order)
                            values (?, NULL, ?, ?, ?, 0)
                            """, Statement.RETURN_GENERATED_KEYS);
                    ps.setLong(1, household);
                    if (categoryId == null) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, categoryId);
                    ps.setString(3, name);
                    if (unit == null) ps.setNull(4, java.sql.Types.VARCHAR); else ps.setString(4, unit);
                    return ps;
                }, kh);
                productIds.put(key, kh.getKey().longValue());
            }
        }

        // 2) 각 item → stock, item.migrated_stock_id 기록
        for (Map<String, Object> it : items) {
            long itemId = ((Number) it.get("id")).longValue();
            long household = ((Number) it.get("household_id")).longValue();
            String name = (String) it.get("name");
            long productId = productIds.get(new ProdKey(household, name));
            Long locationId = ((Number) it.get("location_id")).longValue();
            Timestamp deletedAt = (Timestamp) it.get("deleted_at");

            KeyHolder kh = new GeneratedKeyHolder();
            jdbc.update(con -> {
                PreparedStatement ps = con.prepareStatement("""
                        insert into stock (household_id, product_id, location_id, quantity, expiry_date, memo, deleted_at)
                        values (?, ?, ?, ?, ?, ?, ?)
                        """, Statement.RETURN_GENERATED_KEYS);
                ps.setLong(1, household);
                ps.setLong(2, productId);
                ps.setLong(3, locationId);
                ps.setBigDecimal(4, (java.math.BigDecimal) it.get("quantity"));
                Object expiry = it.get("expiry_date");
                if (expiry == null) ps.setNull(5, java.sql.Types.DATE);
                else ps.setDate(5, java.sql.Date.valueOf(expiry.toString()));
                String memo = (String) it.get("memo");
                if (memo == null) ps.setNull(6, java.sql.Types.VARCHAR); else ps.setString(6, memo);
                if (deletedAt == null) ps.setNull(7, java.sql.Types.TIMESTAMP); else ps.setTimestamp(7, deletedAt);
                return ps;
            }, kh);
            long stockId = kh.getKey().longValue();
            jdbc.update("update item set migrated_stock_id = ? where id = ?", stockId, itemId);
        }

        // 3) 그룹의 모든 행이 소프트삭제면 product.deleted_at 설정
        for (var e : allDeleted.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue())) {
                Long pid = productIds.get(e.getKey());
                jdbc.update("update product set deleted_at = ? where id = ?",
                        anyDeletedAt.get(e.getKey()), pid);
            }
        }

        // 4) 검증
        Long itemCount = jdbc.queryForObject("select count(*) from item", Long.class);
        Long stockCount = jdbc.queryForObject("select count(*) from stock", Long.class);
        if (!itemCount.equals(stockCount)) {
            throw new IllegalStateException("이관 검증 실패: item=" + itemCount + " stock=" + stockCount);
        }
        Long unmapped = jdbc.queryForObject(
                "select count(*) from item where migrated_stock_id is null", Long.class);
        if (unmapped != 0) {
            throw new IllegalStateException("이관 검증 실패: migrated_stock_id 미기록 " + unmapped + "건");
        }
        java.math.BigDecimal itemSum = jdbc.queryForObject("select coalesce(sum(quantity),0) from item", java.math.BigDecimal.class);
        java.math.BigDecimal stockSum = jdbc.queryForObject("select coalesce(sum(quantity),0) from stock", java.math.BigDecimal.class);
        if (itemSum.compareTo(stockSum) != 0) {
            throw new IllegalStateException("이관 검증 실패: 수량 합 item=" + itemSum + " stock=" + stockSum);
        }
    }
}
```

> Flyway는 `classpath:db/migration` 아래의 **컴파일된** `BaseJavaMigration` 구현 클래스를 자동 발견한다. ⚠️ **파일 위치는 `src/main/java/db/migration/`** (소스가 컴파일돼 `build/classes/.../db/migration/V7__...class`로 classpath에 올라가야 함). `src/main/resources/`에 두면 Gradle이 텍스트로 복사만 하고 컴파일하지 않아 Flyway가 **조용히 스킵**하고 V6→V8로 건너뛴다(검증 없이 V8이 NULL `migrated_stock_id`로 실패). 패키지 선언은 반드시 `package db.migration;`. SQL 마이그레이션(V6/V8)은 그대로 `src/main/resources/db/migration/`.

(부팅 검증은 Task 12에서 V8과 함께.)

## Task 6: V8 이력 FK 재배선 + legacy rename

**Files:**
- Create: `backend/src/main/resources/db/migration/V8__history_fk_and_legacy_rename.sql`

- [ ] **Step 1: V8 SQL 작성**

```sql
-- 이력 FK를 item → stock 으로 재배선 + item → item_legacy 백업 rename.
-- 순서 중요: FK가 item을 가리키는 동안엔 stock.id 로 repoint 불가(FK 위반) → drop 선행.

-- 1) 기존 FK/인덱스 제거
ALTER TABLE item_history DROP FOREIGN KEY fk_history_item;
ALTER TABLE item_history DROP KEY idx_history_item;

-- 2) item_id 값을 매핑된 stock.id 로 repoint
UPDATE item_history h JOIN item i ON h.item_id = i.id
SET h.item_id = i.migrated_stock_id;

-- 3) 컬럼명 변경 item_id → stock_id
ALTER TABLE item_history CHANGE COLUMN item_id stock_id BIGINT NOT NULL;

-- 4) 새 FK + 인덱스
ALTER TABLE item_history ADD CONSTRAINT fk_history_stock FOREIGN KEY (stock_id) REFERENCES stock (id);
ALTER TABLE item_history ADD KEY idx_history_stock (stock_id);

-- 5) item → item_legacy 백업 rename (즉시 드롭 안 함, 롤백 안전망). migrated_stock_id 컬럼 보존.
RENAME TABLE item TO item_legacy;

-- 6) item_legacy(백업)의 RESTRICT FK 제거.
--    legacy 행이 storage_location/category 행을 RESTRICT로 붙들고 있으면, 가구 삭제 시
--    locationRepository.deleteByHouseholdId(가구 삭제 전 단계)가 FK 위반으로 실패한다.
--    household FK(ON DELETE CASCADE)만 남겨 가구 삭제 시 legacy 행이 자동 정리되게 한다.
ALTER TABLE item_legacy DROP FOREIGN KEY fk_item_location;
ALTER TABLE item_legacy DROP FOREIGN KEY fk_item_category;
```

> `item_legacy`는 `fk_item_household`(ON DELETE CASCADE)만 유지한다. 가구 삭제 시 DB가 legacy 행을 함께 정리한다. 위치/분류 FK는 제거(백업 데이터 보존이 목적이라 참조무결성 불필요). 완전 롤백 시엔 두 FK를 재추가해야 한다.

## Task 7: ItemHistory 엔티티 — Stock 참조로 변경

**Files:**
- Modify: `backend/src/main/java/com/kh/stock/domain/ItemHistory.java`

- [ ] **Step 1: `Item item` → `Stock stock` 로 교체**

`ItemHistory.java`의 import와 필드를 다음으로 교체:

```java
// import 교체: (com.kh.stock.domain 패키지 내부라 Item/Stock 모두 같은 패키지 → import 불필요)

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;
```

즉, 기존:
```java
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;
```
를 위 `stock` 필드로 바꾼다. 클래스 주석은 그대로 두되 "item_id" 언급을 "stock_id"로 수정. Lombok `@Getter/@Setter`가 `getStock()/setStock()`을 생성한다.

## Task 8: HistoryResponse — getStock() 로 변경

**Files:**
- Modify: `backend/src/main/java/com/kh/stock/item/dto/HistoryResponse.java`

- [ ] **Step 1: 매핑 변경**

`HistoryResponse.from`에서 `h.getItem().getId()` → `h.getStock().getId()`로 변경. 필드명 `itemId`는 외부 계약이므로 유지(프론트 타입과 호환). 즉:

```java
    public static HistoryResponse from(ItemHistory h) {
        return new HistoryResponse(
                h.getId(),
                h.getStock().getId(),     // ← 변경 (묶음 id)
                h.getItemNameSnapshot(),
                h.getAction(),
                h.getDelta(),
                h.getQuantityAfter(),
                h.getUser().getNickname(),
                h.getCreatedAt()
        );
    }
```

## Task 9: 요청 DTO + Product/Group 응답 DTO

**Files:**
- Create: `backend/src/main/java/com/kh/stock/stock/dto/NewProductInput.java`
- Create: `backend/src/main/java/com/kh/stock/stock/dto/CreateStockRequest.java`
- Create: `backend/src/main/java/com/kh/stock/stock/dto/UpdateStockRequest.java`
- Create: `backend/src/main/java/com/kh/stock/stock/dto/ProductResponse.java`
- Create: `backend/src/main/java/com/kh/stock/stock/dto/ProductGroupResponse.java`

- [ ] **Step 1: NewProductInput**

```java
package com.kh.stock.stock.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 새 품목 생성 입력. groupId(기존 그룹) 또는 groupName(새 그룹) 중 하나(optional). */
public record NewProductInput(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 20) String unit,
        Long categoryId,
        Long groupId,
        @Size(max = 50) String groupName
) {}
```

- [ ] **Step 2: CreateStockRequest**

```java
package com.kh.stock.stock.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 재고 추가: productId(기존 선택) XOR newProduct(새 품목). 서비스에서 정확히 하나 검증. */
public record CreateStockRequest(
        Long productId,
        @Valid NewProductInput newProduct,
        @NotNull Long locationId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity,
        LocalDate expiryDate,
        @Size(max = 255) String memo
) {}
```

- [ ] **Step 3: UpdateStockRequest**

```java
package com.kh.stock.stock.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 묶음 편집(PATCH) — 단순 갱신. 자동 합치기 없음(스펙). */
public record UpdateStockRequest(
        @NotNull @DecimalMin("0") BigDecimal quantity,
        LocalDate expiryDate,
        @Size(max = 255) String memo,
        @NotNull Long locationId
) {}
```

- [ ] **Step 4: ProductResponse**

```java
package com.kh.stock.stock.dto;

import com.kh.stock.domain.Product;

/** 품목 picker 응답. */
public record ProductResponse(
        Long id,
        String name,
        String unit,
        Long groupId,
        String groupName,
        Long categoryId,
        String categoryName
) {
    public static ProductResponse from(Product p) {
        var g = p.getProductGroup();
        var c = p.getCategory();
        return new ProductResponse(
                p.getId(), p.getName(), p.getUnit(),
                g == null ? null : g.getId(),
                g == null ? null : g.getName(),
                c == null ? null : c.getId(),
                c == null ? null : c.getName());
    }
}
```

- [ ] **Step 5: ProductGroupResponse**

```java
package com.kh.stock.stock.dto;

import com.kh.stock.domain.ProductGroup;

public record ProductGroupResponse(Long id, String name) {
    public static ProductGroupResponse from(ProductGroup g) {
        return new ProductGroupResponse(g.getId(), g.getName());
    }
}
```

## Task 10: ProductService (해석/생성/되살리기 + cascade)

**Files:**
- Create: `backend/src/main/java/com/kh/stock/stock/ProductService.java`

- [ ] **Step 1: ProductService 작성**

```java
package com.kh.stock.stock;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.Category;
import com.kh.stock.domain.Product;
import com.kh.stock.domain.ProductGroup;
import com.kh.stock.repository.CategoryRepository;
import com.kh.stock.repository.HouseholdRepository;
import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.repository.ProductRepository;
import com.kh.stock.stock.dto.NewProductInput;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 품목/그룹 해석·생성·되살리기 + 0재고 cascade 정리. */
@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductGroupRepository groupRepository;
    private final CategoryRepository categoryRepository;
    private final HouseholdRepository householdRepository;

    public ProductService(ProductRepository productRepository,
                          ProductGroupRepository groupRepository,
                          CategoryRepository categoryRepository,
                          HouseholdRepository householdRepository) {
        this.productRepository = productRepository;
        this.groupRepository = groupRepository;
        this.categoryRepository = categoryRepository;
        this.householdRepository = householdRepository;
    }

    /** 기존 품목 로드(가구 소유 + 활성 검증). */
    @Transactional
    public Product requireOwnedActive(Long hid, Long productId) {
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("품목을 찾을 수 없습니다."));
        if (!p.getHousehold().getId().equals(hid) || p.getDeletedAt() != null) {
            throw ApiException.notFound("품목을 찾을 수 없습니다.");
        }
        return p;
    }

    /** 새 품목 해석: 같은 이름 활성/소프트삭제 product 재사용·되살리기, 없으면 신규. */
    @Transactional
    public Product resolveOrCreate(Long hid, NewProductInput in) {
        String name = in.name().trim();
        Product existing = productRepository.findByHousehold_IdAndName(hid, name).orElse(null);
        ProductGroup group = resolveGroup(hid, in.groupId(), in.groupName());
        Category category = resolveCategory(in.categoryId());

        if (existing != null) {
            // 되살리기(소프트삭제였다면) + 속성은 새 입력으로 갱신(되살리기 시 최신 입력 우선)
            existing.setDeletedAt(null);
            existing.setUnit(in.unit());
            if (category != null) existing.setCategory(category);
            if (group != null) existing.setProductGroup(group);
            return existing;
        }
        Product p = new Product();
        p.setHousehold(householdRepository.getReferenceById(hid));
        p.setName(name);
        p.setUnit(in.unit());
        p.setCategory(category);
        p.setProductGroup(group);
        return productRepository.save(p);
    }

    private ProductGroup resolveGroup(Long hid, Long groupId, String groupName) {
        if (groupId != null) {
            ProductGroup g = groupRepository.findById(groupId)
                    .orElseThrow(() -> ApiException.badRequest("존재하지 않는 그룹입니다."));
            if (!g.getHousehold().getId().equals(hid)) {
                throw ApiException.badRequest("현재 가구의 그룹이 아닙니다.");
            }
            if (g.getDeletedAt() != null) g.setDeletedAt(null); // 되살리기
            return g;
        }
        if (StringUtils.hasText(groupName)) {
            String name = groupName.trim();
            ProductGroup g = groupRepository.findByHousehold_IdAndName(hid, name).orElse(null);
            if (g != null) {
                g.setDeletedAt(null);
                return g;
            }
            ProductGroup ng = new ProductGroup();
            ng.setHousehold(householdRepository.getReferenceById(hid));
            ng.setName(name);
            return groupRepository.save(ng);
        }
        return null;
    }

    private Category resolveCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.badRequest("존재하지 않는 분류입니다."));
    }

    /** 묶음 소프트삭제 후 호출: 활성 묶음 0개면 product 소프트삭제, 그 그룹 활성 품목 0개면 group 소프트삭제. */
    @Transactional
    public void cascadeAfterStockRemoval(Product product) {
        // StockRepository 주입을 피하려고 count는 StockService가 넘겨줄 수도 있으나,
        // 응집을 위해 여기서 직접 카운트(StockRepository 주입).
        // → 본 메서드는 StockService.removeStock 에서 호출되며, 카운트는 StockService가 판단해 위임한다.
        throw new UnsupportedOperationException("StockService.applyCascade 로 대체 — 본 메서드 미사용");
    }

    /** product 활성묶음 0 → 소프트삭제. 반환: 소프트삭제됐고 그룹 점검이 필요하면 그룹, 아니면 null. */
    @Transactional
    public ProductGroup softDeleteIfEmpty(Product product, long activeStockCount) {
        if (activeStockCount > 0 || product.getDeletedAt() != null) return null;
        product.setDeletedAt(java.time.LocalDateTime.now());
        return product.getProductGroup();
    }

    /** group 활성 품목 0 → 소프트삭제. */
    @Transactional
    public void softDeleteGroupIfEmpty(ProductGroup group) {
        if (group == null || group.getDeletedAt() != null) return;
        if (groupRepository == null) return;
        long active = productRepository.countByProductGroup_IdAndDeletedAtIsNull(group.getId());
        if (active == 0) group.setDeletedAt(java.time.LocalDateTime.now());
    }
}
```

> 정리: `cascadeAfterStockRemoval`는 설계 혼선을 막기 위한 의도적 미사용 표식이다. **구현 시 이 메서드는 삭제**하고, `softDeleteIfEmpty(product, activeStockCount)` + `softDeleteGroupIfEmpty(group)`만 남긴다. cascade 호출 흐름은 StockService가 주도(아래).

- [ ] **Step 2: 위 주석대로 `cascadeAfterStockRemoval` 메서드 삭제**

`ProductService`에서 `cascadeAfterStockRemoval(...)` 메서드 전체를 제거한다(미사용 표식 제거). `softDeleteGroupIfEmpty` 내 불필요한 `if (groupRepository == null) return;` 줄도 제거한다.

## Task 11: StockService + InventoryService + HistoryService

**Files:**
- Create: `backend/src/main/java/com/kh/stock/stock/StockService.java`
- Create: `backend/src/main/java/com/kh/stock/stock/InventoryService.java`
- Create: `backend/src/main/java/com/kh/stock/stock/HistoryService.java`

- [ ] **Step 1: StockService**

```java
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
```

- [ ] **Step 2: InventoryService**

```java
package com.kh.stock.stock;

import com.kh.stock.domain.Product;
import com.kh.stock.domain.Stock;
import com.kh.stock.repository.StockRepository;
import com.kh.stock.stock.InventoryAssembler.ProductMeta;
import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 전체 보기: 활성 묶음 → 그룹/품목 합산 트리. q는 품목 이름 필터. */
@Service
public class InventoryService {

    private final StockRepository stockRepository;

    public InventoryService(StockRepository stockRepository) {
        this.stockRepository = stockRepository;
    }

    @Transactional(readOnly = true)
    public InventoryResponse inventory(String q) {
        Long hid = TenantContext.require();
        String query = (q == null || q.isBlank()) ? null : q.trim().toLowerCase();
        LocalDate today = LocalDate.now();

        List<Stock> stocks = stockRepository.findActiveByHousehold(hid);
        Map<Long, ProductMeta> meta = new HashMap<>();
        java.util.List<StockResponse> batches = new java.util.ArrayList<>();
        for (Stock s : stocks) {
            Product p = s.getProduct();
            if (query != null && !p.getName().toLowerCase().contains(query)) continue;
            meta.putIfAbsent(p.getId(), toMeta(p));
            batches.add(StockResponse.from(s, today));
        }
        return InventoryAssembler.assemble(batches, meta);
    }

    private ProductMeta toMeta(Product p) {
        var g = p.getProductGroup();
        var c = p.getCategory();
        return new ProductMeta(
                p.getId(), p.getName(), p.getUnit(),
                g == null ? null : g.getId(),
                g == null ? null : g.getName(),
                c == null ? null : c.getId(),
                c == null ? null : c.getName(),
                c == null ? null : c.getEmoji(),
                c == null ? null : c.getColor());
    }
}
```

- [ ] **Step 3: HistoryService (가구 전체 이력)**

```java
package com.kh.stock.stock;

import com.kh.stock.domain.ItemHistory;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.item.dto.PageResponse;
import com.kh.stock.repository.ItemHistoryRepository;
import com.kh.stock.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가구 전체 변동 이력(최신순, 페이지). 스냅샷 기반이라 정규화 영향 적음. */
@Service
public class HistoryService {

    private final ItemHistoryRepository historyRepository;

    public HistoryService(ItemHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<HistoryResponse> history(Pageable pageable) {
        Long hid = TenantContext.require();
        Page<ItemHistory> page = historyRepository.findByHouseholdIdOrderByCreatedAtDesc(hid, pageable);
        return PageResponse.of(page, HistoryResponse::from);
    }
}
```

- [ ] **Step 4: ItemHistoryRepository에 stock 메서드 추가 + item 메서드 제거**

`ItemHistoryRepository`에서 `findByItemIdOrderByCreatedAtDesc` → `findByStockIdOrderByCreatedAtDesc`로 교체:

```java
    /** 특정 묶음의 이력. */
    List<ItemHistory> findByStockIdOrderByCreatedAtDesc(Long stockId);
```
나머지(`findByHouseholdIdOrderByCreatedAtDesc`, `deleteByHouseholdId`)는 유지.

## Task 12: 컨트롤러 신설 + blast-radius 재배선 + 구코드 제거 + 컷오버 검증

**Files:**
- Create: `backend/src/main/java/com/kh/stock/stock/StockController.java`
- Create: `backend/src/main/java/com/kh/stock/stock/InventoryController.java`
- Create: `backend/src/main/java/com/kh/stock/stock/ProductController.java`
- Create: `backend/src/main/java/com/kh/stock/stock/ProductGroupController.java`
- Create: `backend/src/main/java/com/kh/stock/stock/HistoryController.java`
- Modify: `backend/src/main/java/com/kh/stock/location/LocationService.java`
- Modify: `backend/src/main/java/com/kh/stock/admin/AdminCategoryService.java`
- Modify: `backend/src/main/java/com/kh/stock/household/HouseholdService.java`
- Modify: `backend/src/main/java/com/kh/stock/push/ExpiryPushScheduler.java`
- Delete: `domain/Item.java`, `repository/ItemRepository.java`, `item/ItemController.java`, `item/ItemService.java`, `item/HistoryController.java`, `item/dto/CreateItemRequest.java`, `item/dto/UpdateItemRequest.java`, `item/dto/ItemResponse.java`

- [ ] **Step 1: StockController**

```java
package com.kh.stock.stock;

import com.kh.stock.item.dto.AdjustQuantityRequest;
import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.security.AuthUser;
import com.kh.stock.stock.dto.CreateStockRequest;
import com.kh.stock.stock.dto.StockResponse;
import com.kh.stock.stock.dto.UpdateStockRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 재고 묶음 — X-Household-Id 필요. 모든 변경은 이력 자동 기록. */
@RestController
@RequestMapping("/api/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    /** 위치 상세: locationId 필수. */
    @GetMapping
    public List<StockResponse> list(@RequestParam Long locationId) {
        return stockService.listByLocation(locationId);
    }

    @GetMapping("/{stockId}")
    public StockResponse get(@PathVariable Long stockId) {
        return stockService.get(stockId);
    }

    @GetMapping("/{stockId}/history")
    public List<HistoryResponse> history(@PathVariable Long stockId) {
        return stockService.stockHistory(stockId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StockResponse create(@AuthenticationPrincipal AuthUser me,
                                @Valid @RequestBody CreateStockRequest req) {
        return stockService.create(me.id(), req);
    }

    @PatchMapping("/{stockId}")
    public StockResponse update(@AuthenticationPrincipal AuthUser me,
                                @PathVariable Long stockId,
                                @Valid @RequestBody UpdateStockRequest req) {
        return stockService.update(me.id(), stockId, req);
    }

    @PostMapping("/{stockId}/adjust")
    public StockResponse adjust(@AuthenticationPrincipal AuthUser me,
                                @PathVariable Long stockId,
                                @Valid @RequestBody AdjustQuantityRequest req) {
        return stockService.adjust(me.id(), stockId, req);
    }

    @DeleteMapping("/{stockId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable Long stockId) {
        stockService.delete(me.id(), stockId);
    }
}
```

- [ ] **Step 2: InventoryController**

```java
package com.kh.stock.stock;

import com.kh.stock.stock.dto.InventoryResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 전체 보기(그룹/품목 합산 트리). X-Household-Id 필요. */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public InventoryResponse inventory(@RequestParam(required = false) String q) {
        return inventoryService.inventory(q);
    }
}
```

- [ ] **Step 3: ProductController + ProductGroupController**

```java
package com.kh.stock.stock;

import com.kh.stock.repository.ProductRepository;
import com.kh.stock.stock.dto.ProductResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 재고 있는 품목 picker. */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ProductResponse> list(@RequestParam(required = false) String q) {
        Long hid = TenantContext.require();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        return productRepository.findActiveWithStock(hid, query).stream()
                .map(ProductResponse::from).toList();
    }
}
```

```java
package com.kh.stock.stock;

import com.kh.stock.repository.ProductGroupRepository;
import com.kh.stock.stock.dto.ProductGroupResponse;
import com.kh.stock.tenant.TenantContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 그룹 picker(활성). */
@RestController
@RequestMapping("/api/product-groups")
public class ProductGroupController {

    private final ProductGroupRepository groupRepository;

    public ProductGroupController(ProductGroupRepository groupRepository) {
        this.groupRepository = groupRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ProductGroupResponse> list() {
        Long hid = TenantContext.require();
        return groupRepository
                .findByHousehold_IdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(hid).stream()
                .map(ProductGroupResponse::from).toList();
    }
}
```

- [ ] **Step 4: HistoryController (신규, 기존 item/HistoryController 대체)**

```java
package com.kh.stock.stock;

import com.kh.stock.item.dto.HistoryResponse;
import com.kh.stock.item.dto.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 변동 이력 탭 — 최신순 페이지. X-Household-Id 필요. */
@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping
    public PageResponse<HistoryResponse> history(@PageableDefault(size = 20) Pageable pageable) {
        return historyService.history(pageable);
    }
}
```

- [ ] **Step 5: LocationService 재배선 (ItemRepository → StockRepository)**

`LocationService.java`에서 `import com.kh.stock.domain.Item;` → `import com.kh.stock.domain.Stock;`, `import com.kh.stock.repository.ItemRepository;` → `import com.kh.stock.repository.StockRepository;`. 필드/생성자의 `ItemRepository itemRepository` → `StockRepository stockRepository`. `getHome()` 내부:

```java
        List<Stock> items = stockRepository.findActiveByHousehold(hid);
        // ... countByLoc / expiringByLoc: i.getLocation().getId(), isExpiringSoon(i, ...)는 Stock에도 동일 시그니처
```
`isExpiringSoon(Item i, ...)` → `isExpiringSoon(Stock s, ...)`로 시그니처 변경(본문 `s.getExpiryDate()` 동일). `delete()`의 가드 `itemRepository.existsByLocation_IdAndDeletedAtIsNull` → `stockRepository.existsByLocation_IdAndDeletedAtIsNull`. (홈 itemCount/expiringSoonCount는 이제 "묶음 수" 기준 — 현재와 동일 의미.)

- [ ] **Step 6: AdminCategoryService 재배선**

`AdminCategoryService.java`: `import ItemRepository` → `import ProductRepository`. 필드/생성자 `ItemRepository itemRepository` → `ProductRepository productRepository`. `deleteCategory`의 `itemRepository.existsByCategory_Id(categoryId)` → `productRepository.existsByCategory_Id(categoryId)`. 메시지 "아이템" → "품목"으로 수정(선택).

- [ ] **Step 7: HouseholdService.delete 재배선 (cascade에 stock/product/group 추가)**

`HouseholdService.java`: `ItemRepository itemRepository` 필드를 `StockRepository stockRepository`, `ProductRepository productRepository`, `ProductGroupRepository groupRepository`로 교체(생성자 인자도). `delete()` 본문을 FK 순서대로:

```java
    @Transactional
    public void delete(Long userId, Long householdId) {
        Household h = requireOwner(userId, householdId);
        itemHistoryRepository.deleteByHouseholdId(householdId);   // FK → stock
        stockRepository.deleteByHousehold_Id(householdId);        // FK → product
        productRepository.deleteByHousehold_Id(householdId);      // FK → product_group
        groupRepository.deleteByHousehold_Id(householdId);
        locationRepository.deleteByHouseholdId(householdId);
        categoryRequestRepository.deleteByHousehold_Id(householdId);
        membershipRepository.deleteByHouseholdId(householdId);
        householdRepository.delete(h);  // item_legacy 는 DB FK CASCADE 로 함께 정리
    }
```
import 정리: `com.kh.stock.repository.*` 와일드카드면 추가 import 불필요.

- [ ] **Step 8: ExpiryPushScheduler 재배선 (Item → Stock)**

`ExpiryPushScheduler.java`: `import com.kh.stock.domain.Item;` → `import com.kh.stock.domain.Stock;`, `import ItemRepository` → `import StockRepository`. 필드/생성자 교체. `notifyExpiring()`의 `List<Item> items` → `List<Stock> items`, `itemRepository.findAllExpiringForNotify(...)` → `stockRepository.findAllExpiringForNotify(...)`. `groupingBy(Item::getHousehold, ...)` → `Stock::getHousehold`. `Map<Household, List<Item>>` → `Map<Household, List<Stock>>`. `buildPayload(Household, List<Stock>, today)`로 시그니처 변경. 품목명: `i.getName()` → `i.getProduct().getName()`.

- [ ] **Step 9: 구코드 삭제**

```bash
git rm backend/src/main/java/com/kh/stock/domain/Item.java \
       backend/src/main/java/com/kh/stock/repository/ItemRepository.java \
       backend/src/main/java/com/kh/stock/item/ItemController.java \
       backend/src/main/java/com/kh/stock/item/ItemService.java \
       backend/src/main/java/com/kh/stock/item/HistoryController.java \
       backend/src/main/java/com/kh/stock/item/dto/CreateItemRequest.java \
       backend/src/main/java/com/kh/stock/item/dto/UpdateItemRequest.java \
       backend/src/main/java/com/kh/stock/item/dto/ItemResponse.java
```

- [ ] **Step 10: 전체 컴파일 + 단위 테스트**

Run: `cd backend && ./gradlew compileJava test`
Expected: BUILD SUCCESSFUL. 남은 `Item`/`ItemRepository`/`ItemService` 참조가 있으면 컴파일 에러로 드러난다 — 모두 위 재배선으로 제거됐는지 확인. `InventoryAssemblerTest` 통과.

- [ ] **Step 11: 컷오버 부팅 + 마이그레이션 검증 (수동, 로컬 DB 백업 후)**

먼저 로컬 DB를 백업(롤백 대비):
Run: `mysqldump -h127.0.0.1 -P3306 -uroot -p1234 stock > D:\tmp\stock_before_v6v8.sql` (PowerShell에서 경로 조정)

Run: `cd backend && ./gradlew bootRun`
Expected:
- Flyway 로그에 V6 → V7 → V8 순차 적용. V7에서 검증 예외 없이 통과("이관 검증 실패" 로그 없음).
- `ddl-auto: validate` 통과(ItemHistory→stock_id, 신규 엔티티 모두 일치). 정상 기동.
- DB 확인:
  - `SELECT count(*) FROM stock;` == 이관 전 `item` 행 수(뭉치 삭제 후 기준).
  - `SELECT count(*) FROM product;` == 가구별 distinct name 수.
  - `SHOW TABLES;`에 `item_legacy` 존재, `item` 없음.
  - `SELECT stock_id FROM item_history LIMIT 5;` — 모두 유효한 stock.id.
  - `DESCRIBE item_history;` — `stock_id` 컬럼 + `fk_history_stock`.

- [ ] **Step 12: API 스모크 테스트 (수동, curl/HTTPie)**

`bootRun` 상태에서 (토큰·X-Household-Id는 dev-token 로그인으로 확보):
- `GET /api/inventory` → 그룹/단독 트리 200.
- `GET /api/stock?locationId={loc}` → 묶음 평면 200.
- `POST /api/stock` (newProduct로 새 품목 + 위치/수량) → 201, 다시 같은 키로 POST → 합산(INCREASE) 확인.
- `POST /api/stock/{id}/adjust` (수량을 0으로) → 묶음 사라지고, 그 품목 활성묶음 0이면 `GET /api/products`에서 제외 확인(cascade).
- `GET /api/products?q=`, `GET /api/product-groups` → picker 200.
- `GET /api/history` → 페이지 200, itemName 스냅샷 표시.
- `GET /api/items` → 404(제거됨).

- [ ] **Step 13: 컷오버 단일 커밋**

```bash
git add -A
git commit -m "feat: 품목/재고 정규화 컷오버 — V7/V8 이관, stock/inventory/products API, item 제거"
```

---

## Self-Review 체크리스트 (작성자 수행 완료)

- **스펙 커버리지:** 데이터 모델(product_group/product/stock/item_history) ✔ Task 1·2·7 / 동작규칙(합산·되살리기·null-safe·PATCH 단순갱신·adjust 0 cascade) ✔ Task 11 / cascade ✔ Task 10·11 / 조회·화면(inventory·stock·D-3) ✔ Task 4·11, Step 8 / API 표면 10개 ✔ Task 12 / 마이그레이션 V6·V7·V8 ✔ Task 1·5·6 / 테넌트 격리(수동 household_id) ✔ 각 서비스 `TenantContext.require()` + 소유검증.
- **미해결 #1:** inventory DTO = groups+ungrouped 부분중첩으로 확정(상단).
- **타입 일관성:** `StockResponse`/`InventoryResponse.Product`/`ProductMeta` 시그니처가 Assembler·테스트·Service에서 일치. `ItemHistory.getStock()`이 HistoryResponse·StockService·repository(`findByStockId...`)에서 일관.
- **주의(실행자):** Task 10의 `cascadeAfterStockRemoval` 미사용 메서드는 Step 2에서 반드시 삭제. ExpiryPushScheduler·LocationService의 메서드 시그니처 변경(Item→Stock) 누락 시 컴파일 에러로 드러남(Step 10).

## 리스크 / 롤백

- **마이그레이션 비가역(운영):** V8가 `item`을 rename. 운영 반영 전 반드시 운영 DB 덤프 백업. 문제 시 `item_legacy` → `item` 역rename + V6~V8 `flyway_schema_history` 행 제거로 복구(수동).
- **통합 테스트 부재(사용자 결정):** 마이그레이션 정확성·쿼리·유니크·null-safe 합산은 **로컬 MariaDB 수동 검증(Step 11·12)**으로만 보증. 운영 반영 전 운영 DB 복제본에 V6~V8를 1회 리허설 적용할 것을 강력 권장.
</content>
</invoke>
