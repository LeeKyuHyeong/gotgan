package com.kh.stock.security;

import com.kh.stock.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authorization: Bearer &lt;jwt&gt; 를 읽어 SecurityContext 에 AuthUser 를 세팅.
 * role 은 토큰 claim 이 아니라 DB 에서 live 로 해석한다 — 운영자 부여/강등이 재로그인 없이 즉시 반영되고,
 * 삭제된 사용자의 토큰은 곧바로 무효가 된다(서명만 맞고 유저가 없으면 인증 안 함).
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final AppUserRepository userRepository;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, AppUserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            Long userId = tokenProvider.parseUserId(header.substring(BEARER.length()));
            if (userId != null) {
                userRepository.findById(userId).ifPresent(appUser -> {
                    AuthUser user = new AuthUser(appUser.getId(), appUser.getRole());
                    var authority = new SimpleGrantedAuthority("ROLE_" + appUser.getRole().name());
                    var authentication = new UsernamePasswordAuthenticationToken(user, null, List.of(authority));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
            }
        }
        chain.doFilter(request, response);
    }
}
