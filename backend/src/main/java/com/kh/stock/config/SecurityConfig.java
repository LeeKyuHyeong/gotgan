package com.kh.stock.config;

import com.kh.stock.repository.AppUserRepository;
import com.kh.stock.security.JwtAuthenticationFilter;
import com.kh.stock.security.JwtTokenProvider;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final AppProperties props;
    private final Environment env;

    public SecurityConfig(AppProperties props, Environment env) {
        this.props = props;
        this.env = env;
    }

    /** 운영(prod)에서 CORS 허용 origin 이 비었거나 localhost 면 즉시 기동 실패 — 잘못된 배포로 인증요청이 새지 않게. */
    @PostConstruct
    void validateCorsOrigins() {
        if (!env.matchesProfiles("prod")) return;
        var origins = props.cors().allowedOrigins();
        boolean invalid = origins == null || origins.isEmpty()
                || origins.stream().anyMatch(o -> o == null || o.contains("localhost"));
        if (invalid) {
            throw new IllegalStateException(
                    "운영 프로파일에는 CORS_ORIGINS 를 실제 도메인으로 주입해야 합니다 (현재: " + origins + ")");
        }
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtTokenProvider tokenProvider,
                                                   AppUserRepository userRepository) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 미인증 접근은 401, 권한부족(role)은 403 (둘을 명시 구분 — 프론트가 401에서만 로그아웃)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((req, res, e) -> res.sendError(HttpStatus.FORBIDDEN.value())))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // 에러 디스패치(/error)도 체인을 다시 타므로 허용 — 안 하면 403/예외가 /error 재인가 실패로 401로 덮임
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("SYSTEM_ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(new JwtAuthenticationFilter(tokenProvider, userRepository),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(props.cors().allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // credentials 동반 CORS 라 와일드카드 대신 실제 사용하는 헤더만 명시.
        config.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE, "X-Household-Id"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
