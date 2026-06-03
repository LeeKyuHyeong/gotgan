package com.kh.stock.location;

import com.kh.stock.location.dto.HomeResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 홈 화면 데이터(위치 카드 + 곧만료 배지). X-Household-Id 필요. */
@RestController
@RequestMapping("/api")
public class HomeController {

    private final LocationService locationService;

    public HomeController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping("/home")
    public HomeResponse home() {
        return locationService.getHome();
    }
}
