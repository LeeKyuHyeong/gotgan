package com.kh.stock.tenant;

import com.kh.stock.common.ApiException;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * X-Household-Id 헤더가 있으면 현재 사용자가 그 가구의 구성원인지 검증 후 TenantContext 에 세팅.
 * 헤더가 없으면 비워둠(가구 컨텍스트가 필요 없는 엔드포인트용: /api/me, 온보딩 등).
 */
@Component
public class TenantInterceptor implements HandlerInterceptor {

    public static final String HEADER = "X-Household-Id";

    private final MembershipRepository membershipRepository;

    public TenantInterceptor(MembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String raw = request.getHeader(HEADER);
        if (raw == null || raw.isBlank()) {
            return true;
        }
        Long householdId;
        try {
            householdId = Long.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("잘못된 " + HEADER + " 값입니다.");
        }

        AuthUser user = currentUser();
        if (user == null) {
            throw ApiException.unauthorized("인증이 필요합니다.");
        }
        if (!membershipRepository.existsByUserIdAndHouseholdId(user.id(), householdId)) {
            throw ApiException.forbidden("해당 가구의 구성원이 아닙니다.");
        }
        TenantContext.set(householdId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear();
    }

    private AuthUser currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser u) {
            return u;
        }
        return null;
    }
}
