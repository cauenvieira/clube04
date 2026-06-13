"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../modules/geo/c04-geo-core.js");

function mapApi() {
    class LatLng {
        constructor(lat, lng) { this.valueLat = lat; this.valueLng = lng; }
        lat() { return this.valueLat; }
        lng() { return this.valueLng; }
    }
    const context = { window: { C04GeoCore: core, C04GeoConfig: {
        center: new LatLng(-23.5162, -46.1961), geocodeMaxDistanceKm: 60, geocodeValidationVersion: 3
    } }, console, setTimeout, clearTimeout };
    context.google = { maps: { geometry: { spherical: { computeDistanceBetween: () => 2 } } } };
    context.window.google = context.google;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-map.js"), "utf8"), context);
    return { api: context.window.C04GeoMap, LatLng };
}

function result(LatLng, partial, zip) {
    return { partial_match: partial, geometry: { location: new LatLng(-23.52, -46.19) }, address_components: [
        { long_name: "Brasil", short_name: "BR", types: ["country"] },
        { long_name: "Sao Paulo", short_name: "SP", types: ["administrative_area_level_1"] },
        { long_name: zip, short_name: zip, types: ["postal_code"] }
    ] };
}

test("accepts partial geocode only when postal code confirms it", () => {
    const { api, LatLng } = mapApi();
    const accepted = api.validateGeocode(result(LatLng, true, "08700-000"), { zip: "08700-000" });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.distanceKm, 0.002);
    assert.equal(accepted.quality, "postal_code_confirmed");
    assert.equal(api.validateGeocode(result(LatLng, true, "08700-001"), { zip: "08700-000" }).reason, "resultado_parcial");
});

test("map source persists and reuses failed geocodes unless forced", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-map.js"), "utf8");
    assert.match(source, /previous\.status === "failed"/);
    assert.match(source, /!options\.forceFailed/);
    assert.match(source, /failureRow/);
    assert.match(source, /quality: validation\.quality/);
});

test("map loader rejects a partial Google Maps namespace", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-map.js"), "utf8");
    assert.match(source, /typeof root\.google\.maps\.Map === "function"/);
    assert.match(source, /root\.google\.maps\.geometry && root\.google\.maps\.marker/);
    assert.match(source, /waitUntil\(ready, src\)/);
});
