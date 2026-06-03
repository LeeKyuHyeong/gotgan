package com.kh.stock.tenant;

import com.kh.stock.common.ApiException;

/** 요청 단위 현재 가구 컨텍스트(ThreadLocal). X-Household-Id 헤더로 결정. */
public final class TenantContext {

    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(Long householdId) {
        CURRENT.set(householdId);
    }

    /** 현재 가구 id. 없으면 null. */
    public static Long get() {
        return CURRENT.get();
    }

    /** 현재 가구가 반드시 있어야 하는 곳에서 사용. 없으면 예외. */
    public static Long require() {
        Long id = CURRENT.get();
        if (id == null) {
            throw ApiException.badRequest("현재 가구가 지정되지 않았습니다 (X-Household-Id 헤더 필요).");
        }
        return id;
    }

    public static void clear() {
        CURRENT.remove();
    }
}
