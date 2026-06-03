package com.kh.stock.auth;

import com.kh.stock.auth.dto.KakaoLoginRequest;
import com.kh.stock.auth.dto.LoginResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 카카오 로그인(방식 A, SPA): 프론트에서 받은 인가코드를 본문으로 전달 → 자체 JWT 발급. */
    @PostMapping("/kakao")
    public LoginResponse kakaoLogin(@Valid @RequestBody KakaoLoginRequest req) {
        return authService.kakaoLogin(req);
    }

    /**
     * 카카오 콜백(방식 B, 백엔드 직접 수신): 카카오가 redirect_uri 로 ?code= 를 붙여 호출.
     * 지금은 프론트가 없어 LoginResponse(JWT 포함)를 JSON 으로 반환해 바로 확인.
     * 프론트 생기면 토큰을 프론트로 리다이렉트하도록 바꿀 수 있음.
     */
    @GetMapping("/kakao/callback")
    public LoginResponse kakaoCallback(@RequestParam("code") String code) {
        return authService.kakaoLogin(new KakaoLoginRequest(code, null));
    }
}
