(function (root) {
    "use strict";
    root.C04GeoConfig = {
        googleMapsApiKey: "AIzaSyCn6I3BaCjIh0yD8wZ_GAx4VkDW0uDyI7o",
        googleMapId: "4e6ccbfcdcfa97ebec8daf1e",
        defaultMonths: 4,
        overlapDays: 7,
        logRetentionMonths: 12,
        batchSize: 150,
        franchiseAverageTicket: 240,
        weights: { recurrence: 60, ticket: 40 },
        recurrenceLimits: { excellent: 7, good: 15, improve: 30 },
        layers: { pins: true, visits: true, spend: true, score: true },
        heatmaps: { opacity: 0.42, radius: 48, intensity: 0.8 },
        colors: {
            clientPin: "#343434", storePin: "#f97316", cluster: "#3f3f46",
            scoreLow: "#7f1d1d", scoreMedium: "#c2410c", scoreGood: "#f97316", scoreHigh: "#fb923c",
            heatVisitsLow: "#ffedd5", heatVisitsHigh: "#ea580c", heatSpendLow: "#fed7aa", heatSpendHigh: "#9a3412",
            heatScoreLow: "#fff7ed", heatScoreHigh: "#f97316"
        },
        clusterRadius: 70,
        geocodeMaxDistanceKm: 60,
        geocodeValidationVersion: 3,
        geocodeConfirmationThreshold: 999,
        center: { lat: -23.516201329036555, lng: -46.19610921939864 },
        zoom: 12
    };
    root.C04GeoDefaultSettings = JSON.parse(JSON.stringify({
        franchiseAverageTicket: root.C04GeoConfig.franchiseAverageTicket,
        weights: root.C04GeoConfig.weights,
        recurrenceLimits: root.C04GeoConfig.recurrenceLimits,
        heatmaps: root.C04GeoConfig.heatmaps,
        colors: root.C04GeoConfig.colors,
        clusterRadius: root.C04GeoConfig.clusterRadius
    }));
})(window);
