package com.kh.stock.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/** application.yml 의 app.* 설정 바인딩. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Kakao kakao, Jwt jwt, Cors cors) {

    public record Kakao(
            String restApiKey,
            String clientSecret,
            String redirectUri
    ) {}

    public record Jwt(
            String secret,
            long accessTokenValiditySeconds
    ) {}

    public record Cors(
            List<String> allowedOrigins
    ) {}
}
