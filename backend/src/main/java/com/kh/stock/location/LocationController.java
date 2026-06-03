package com.kh.stock.location;

import com.kh.stock.location.dto.CreateLocationRequest;
import com.kh.stock.location.dto.LocationResponse;
import com.kh.stock.location.dto.UpdateLocationRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 위치 관리 — 가구 구성원 누구나. X-Household-Id 필요. */
@RestController
@RequestMapping("/api/locations")
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping
    public List<LocationResponse> list() {
        return locationService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LocationResponse create(@Valid @RequestBody CreateLocationRequest req) {
        return locationService.create(req);
    }

    @PatchMapping("/{locationId}")
    public LocationResponse update(@PathVariable Long locationId,
                                   @Valid @RequestBody UpdateLocationRequest req) {
        return locationService.update(locationId, req);
    }

    @DeleteMapping("/{locationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long locationId) {
        locationService.delete(locationId);
    }
}
