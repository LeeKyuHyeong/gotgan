package com.kh.stock.auth;

import com.kh.stock.auth.dto.KakaoTokenResponse;
import com.kh.stock.auth.dto.KakaoUserInfo;
import com.kh.stock.common.ApiException;
import com.kh.stock.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** 카카오 OAuth: 인가코드 → 토큰 → 사용자정보. */
@Component
public class KakaoOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(KakaoOAuthClient.class);

    private static final String TOKEN_URI = "https://kauth.kakao.com/oauth/token";
    private static final String USER_URI = "https://kapi.kakao.com/v2/user/me";

    private final AppProperties props;
    // 타임아웃 고정 — 카카오가 응답을 안 줘도 요청 스레드/DB 커넥션이 무한정 묶이지 않게.
    private final RestClient restClient = RestClient.builder()
            .requestFactory(timeoutFactory())
            .build();

    public KakaoOAuthClient(AppProperties props) {
        this.props = props;
    }

    private static SimpleClientHttpRequestFactory timeoutFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        return factory;
    }

    /** 인가코드를 액세스토큰으로 교환. */
    public KakaoTokenResponse exchangeToken(String code, String redirectUriOverride) {
        if (!StringUtils.hasText(props.kakao().restApiKey())) {
            throw ApiException.badRequest("카카오 REST API 키가 설정되지 않았습니다 (KAKAO_REST_API_KEY).");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", props.kakao().restApiKey());
        form.add("redirect_uri", StringUtils.hasText(redirectUriOverride)
                ? redirectUriOverride : props.kakao().redirectUri());
        form.add("code", code);
        if (StringUtils.hasText(props.kakao().clientSecret())) {
            form.add("client_secret", props.kakao().clientSecret());
        }

        try {
            return restClient.post()
                    .uri(TOKEN_URI)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoTokenResponse.class);
        } catch (Exception e) {
            // 상세(카카오 응답 본문·내부 URL 등)는 서버 로그로만, 클라이언트엔 일반 메시지.
            log.warn("카카오 토큰 교환 실패", e);
            throw ApiException.unauthorized("카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
    }

    /** 액세스토큰으로 사용자 정보 조회. */
    public KakaoUserInfo getUserInfo(String kakaoAccessToken) {
        try {
            return restClient.get()
                    .uri(USER_URI)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + kakaoAccessToken)
                    .retrieve()
                    .body(KakaoUserInfo.class);
        } catch (Exception e) {
            log.warn("카카오 사용자 조회 실패", e);
            throw ApiException.unauthorized("카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
    }
}
