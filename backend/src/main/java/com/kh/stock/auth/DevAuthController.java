package com.kh.stock.auth;

import com.kh.stock.auth.dto.DevTokenRequest;
import com.kh.stock.auth.dto.LoginResponse;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로컬 개발 전용 — 카카오 없이 JWT 발급해 온보딩/API 테스트.
 * prod 프로파일에서는 빈이 등록되지 않음(@Profile("!prod")).
 */
@RestController
@RequestMapping("/api/auth")
@Profile("!prod")
public class DevAuthController {

    private final AuthService authService;

    public DevAuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/dev-token")
    public LoginResponse devToken(@Valid @RequestBody DevTokenRequest req) {
        return authService.devLogin(req);
    }
}
