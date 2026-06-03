package com.kh.stock.auth;

import com.kh.stock.auth.dto.*;
import com.kh.stock.domain.AppUser;
import com.kh.stock.domain.type.UserRole;
import com.kh.stock.household.dto.HouseholdSummary;
import com.kh.stock.repository.AppUserRepository;
import com.kh.stock.repository.MembershipRepository;
import com.kh.stock.security.JwtTokenProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class AuthService {

    private final KakaoOAuthClient kakaoClient;
    private final AppUserRepository userRepository;
    private final MembershipRepository membershipRepository;
    private final JwtTokenProvider tokenProvider;

    public AuthService(KakaoOAuthClient kakaoClient,
                       AppUserRepository userRepository,
                       MembershipRepository membershipRepository,
                       JwtTokenProvider tokenProvider) {
        this.kakaoClient = kakaoClient;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.tokenProvider = tokenProvider;
    }

    /** 카카오 인가코드로 로그인/가입. */
    @Transactional
    public LoginResponse kakaoLogin(KakaoLoginRequest req) {
        KakaoTokenResponse token = kakaoClient.exchangeToken(req.code(), req.redirectUri());
        KakaoUserInfo info = kakaoClient.getUserInfo(token.accessToken());
        AppUser user = upsertUser(String.valueOf(info.id()), info.nickname(), info.profileImageUrl());
        return buildResponse(user);
    }

    /** 로컬 개발용: 카카오 없이 kakaoId 로 사용자 발급. admin=true 면 SYSTEM_ADMIN. */
    @Transactional
    public LoginResponse devLogin(DevTokenRequest req) {
        AppUser user = upsertUser(req.kakaoId(), req.nickname(), null);
        if (Boolean.TRUE.equals(req.admin())) {
            user.setRole(UserRole.SYSTEM_ADMIN);
        }
        return buildResponse(user);
    }

    private AppUser upsertUser(String kakaoId, String nickname, String profileImageUrl) {
        return userRepository.findByKakaoId(kakaoId)
                .map(existing -> {
                    if (StringUtils.hasText(nickname)) existing.setNickname(nickname);
                    if (StringUtils.hasText(profileImageUrl)) existing.setProfileImageUrl(profileImageUrl);
                    return existing;
                })
                .orElseGet(() -> {
                    AppUser u = new AppUser();
                    u.setKakaoId(kakaoId);
                    u.setNickname(nickname);
                    u.setProfileImageUrl(profileImageUrl);
                    u.setRole(UserRole.USER);
                    return userRepository.save(u);
                });
    }

    private LoginResponse buildResponse(AppUser user) {
        String jwt = tokenProvider.createAccessToken(user.getId(), user.getRole());
        List<HouseholdSummary> households = membershipRepository.findByUserId(user.getId()).stream()
                .map(HouseholdSummary::from)
                .toList();
        return new LoginResponse(
                jwt,
                tokenProvider.getValiditySeconds(),
                UserDto.from(user),
                households,
                households.isEmpty()
        );
    }
}
