package com.kh.stock.tenant;

import com.kh.stock.common.ApiException;
import com.kh.stock.domain.type.UserRole;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantInterceptorTest {

    private static final String HEADER = "X-Household-Id";

    @Mock MembershipRepository membershipRepository;
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private TenantInterceptor interceptor() {
        return new TenantInterceptor(membershipRepository);
    }

    private void authenticateAs(long userId) {
        var principal = new AuthUser(userId, UserRole.USER);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    /** 헤더 없으면 통과(가구 컨텍스트 불필요 엔드포인트) — TenantContext 는 비어있음. */
    @Test
    void noHeader_passesWithoutContext() {
        when(request.getHeader(HEADER)).thenReturn(null);

        boolean result = interceptor().preHandle(request, response, new Object());

        assertThat(result).isTrue();
        assertThat(TenantContext.get()).isNull();
    }

    /** 숫자가 아닌 헤더 값은 400. */
    @Test
    void nonNumericHeader_badRequest() {
        when(request.getHeader(HEADER)).thenReturn("abc");

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> interceptor().preHandle(request, response, new Object()));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    /** 인증 없이 가구 헤더만 보내면 401. */
    @Test
    void headerWithoutAuth_unauthorized() {
        when(request.getHeader(HEADER)).thenReturn("5");

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> interceptor().preHandle(request, response, new Object()));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    /** 구성원이 아닌 가구 id 를 위조해 보내면 403 (TenantContext 미설정). */
    @Test
    void nonMemberHousehold_forbidden() {
        when(request.getHeader(HEADER)).thenReturn("5");
        authenticateAs(7L);
        when(membershipRepository.existsByUserIdAndHouseholdId(7L, 5L)).thenReturn(false);

        ApiException ex = catchThrowableOfType(ApiException.class,
                () -> interceptor().preHandle(request, response, new Object()));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(TenantContext.get()).isNull();
    }

    /** 구성원인 가구는 통과하며 TenantContext 에 세팅. */
    @Test
    void memberHousehold_setsContext() {
        when(request.getHeader(HEADER)).thenReturn("5");
        authenticateAs(7L);
        when(membershipRepository.existsByUserIdAndHouseholdId(7L, 5L)).thenReturn(true);

        boolean result = interceptor().preHandle(request, response, new Object());

        assertThat(result).isTrue();
        assertThat(TenantContext.get()).isEqualTo(5L);
    }
}
