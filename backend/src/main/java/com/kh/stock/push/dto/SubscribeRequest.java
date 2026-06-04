package com.kh.stock.push.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 브라우저 PushSubscription.toJSON() 의 endpoint + keys. */
public record SubscribeRequest(
        @NotBlank @Size(max = 500) String endpoint,
        @NotBlank @Size(max = 255) String p256dh,
        @NotBlank @Size(max = 255) String auth
) {}
