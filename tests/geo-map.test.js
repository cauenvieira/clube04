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
    assert.equal(api.validateGeocode(result(LatLng, true, "08700-001"), { zip: "08700-000" }).ok, true);
    assert.equal(api.validateGeocode(result(LatLng, true, "08500-000"), { zip: "08700-000" }).reason, "resultado_parcial");
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

test("renderPins ignores invalid coordinates before creating Google markers", () => {
    const createdPositions = [];
    class AdvancedMarkerElement {
        constructor(options) {
            const position = options.position;
            assert.equal(Number.isFinite(position.lat), true);
            assert.equal(Number.isFinite(position.lng), true);
            if (options.title !== "Clube04") createdPositions.push(position);
            this.map = null;
        }
        addListener() { return { remove() {} }; }
    }
    class MarkerClusterer {
        clearMarkers() {}
        setMap() {}
    }
    const element = () => ({ style: {}, appendChild() {}, textContent: "" });
    const config = {
        colors: { clientPin: "#000", scoreHigh: "#000", scoreGood: "#000", scoreMedium: "#000", scoreLow: "#000" },
        center: { lat: -23.5162, lng: -46.1961 },
        clusterRadius: 60
    };
    const context = {
        window: { C04GeoCore: core, C04GeoConfig: config },
        document: { createElement: element },
        google: { maps: { InfoWindow: class {}, marker: { AdvancedMarkerElement } } },
        markerClusterer: { MarkerClusterer },
        console,
        setTimeout,
        clearTimeout
    };
    Object.assign(context.window, { google: context.google, markerClusterer: context.markerClusterer });
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "modules", "geo", "c04-geo-map.js"), "utf8"), context);

    const base = { idPessoa: "1", name: "Cliente", score: 50, visits: 1, spend: 10, ticket: 10 };
    const inputs = [
        { ...base, lat: null, lng: -46.19 },
        { ...base, lat: undefined, lng: -46.19 },
        { ...base, lat: Number.NaN, lng: -46.19 },
        { ...base, lat: "invalida", lng: -46.19 },
        { ...base, lat: 91, lng: -46.19 },
        { ...base, lat: -23.52, lng: null },
        { ...base, lat: -23.52, lng: 181 },
        { ...base, lat: -23.52, lng: -46.19 }
    ];

    assert.doesNotThrow(() => context.window.C04GeoMap.renderPins(inputs, true, true));
    assert.equal(createdPositions.length, 1);
    assert.equal(createdPositions[0].lat, -23.52);
    assert.equal(createdPositions[0].lng, -46.19);
});

function customResult(LatLng, partial, zip, country = "Brasil", state = "SP", city = "Mogi das Cruzes", route = "Rua Santana") {
    return { partial_match: partial, geometry: { location: new LatLng(-23.52, -46.19) }, address_components: [
        { long_name: country, short_name: country === "Brasil" ? "BR" : country, types: ["country"] },
        { long_name: state, short_name: state, types: ["administrative_area_level_1"] },
        { long_name: city, short_name: city, types: ["administrative_area_level_2"] },
        { long_name: zip, short_name: zip, types: ["postal_code"] },
        { long_name: route, short_name: route, types: ["route"] }
    ] };
}

test("validateGeocode rejects country, state, and city mismatches", () => {
    const { api, LatLng } = mapApi();
    
    // Country mismatch
    const badCountry = customResult(LatLng, false, "08700-000", "Argentina", "SP", "Mogi das Cruzes");
    assert.equal(api.validateGeocode(badCountry, { country: "Brasil" }).reason, "pais_divergente");
    
    // State mismatch
    const badState = customResult(LatLng, false, "08700-000", "Brasil", "RJ", "Mogi das Cruzes");
    assert.equal(api.validateGeocode(badState, { state: "SP" }).reason, "estado_divergente");
    
    // City mismatch
    const badCity = customResult(LatLng, false, "08700-000", "Brasil", "SP", "Rio de Janeiro");
    assert.equal(api.validateGeocode(badCity, { city: "Mogi das Cruzes" }).reason, "cidade_divergente");
});

test("validateGeocode detects street similarities and typos using Levenshtein", () => {
    const { api, LatLng } = mapApi();
    
    // Exact match
    const exact = customResult(LatLng, false, "08700-000", "Brasil", "SP", "Mogi das Cruzes", "Rua Santana");
    const exactRes = api.validateGeocode(exact, { street: "Rua Santana" });
    assert.equal(exactRes.ok, true);
    assert.equal(exactRes.warningReason, undefined);
    
    // Typo (similar street - normalized similarity >= 0.7)
    // "Santana" vs "Santanna" - length 8, diff 1 -> similarity 7/8 = 0.875
    const typo = customResult(LatLng, false, "08700-000", "Brasil", "SP", "Mogi das Cruzes", "Rua Santanna");
    const typoRes = api.validateGeocode(typo, { street: "Rua Santana" });
    assert.equal(typoRes.ok, true);
    assert.equal(typoRes.warningReason, "rua_semelhante");
    
    // Completely different street (mismatch)
    const diff = customResult(LatLng, false, "08700-000", "Brasil", "SP", "Mogi das Cruzes", "Avenida Paulista");
    const diffRes = api.validateGeocode(diff, { street: "Rua Santana" });
    assert.equal(diffRes.ok, true);
    assert.equal(diffRes.warningReason, "rua_divergente");
});

