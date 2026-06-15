(function (root) {
    "use strict";
    root.C04GeoConfig = {
        googleMapsApiKey: "AIzaSyCn6I3BaCjIh0yD8wZ_GAx4VkDW0uDyI7o",
        googleMapId: "4e6ccbfcdcfa97ebec8daf1e",
        supabaseUrl: "https://jygbzzowrenfenzhcwcd.supabase.co",
        supabaseAnonKey: "sb_publishable_zKdOe1cili0cZR2DjUGvmg_kUd_C2FJ",
        defaultMonths: 4,
        overlapDays: 7,
        logRetentionMonths: 12,
        batchSize: 150,
        franchiseAverageTicket: 200,
        weights: { recurrence: 60, ticket: 40 },
        recurrenceLimits: { excellent: 7, good: 14, low: 21, bad: 28 },
        layers: { pins: true, visits: true, spend: true, score: true },
        heatmaps: { opacity: 0.6, radius: 30, intensity: 1.5 },
        colors: {
            clientPin: "#343434", storePin: "#f97316", cluster: "#3f3f46",
            scoreLow: "#dc2626",
            scoreMedium: "#fb923c",
            scoreGood: "#4ade80",
            scoreHigh: "#16a34a",
            heatVisitsLow: "#ffedd5",
            heatVisitsMedium: "#fed7aa",
            heatVisitsGood: "#f97316",
            heatVisitsHigh: "#ea580c",
            heatSpendLow: "#e0f2fe",
            heatSpendMedium: "#7dd3fc",
            heatSpendGood: "#3b82f6",
            heatSpendHigh: "#1e3a8a",
            heatScoreLow: "#dc2626",
            heatScoreMedium: "#fb923c",
            heatScoreGood: "#4ade80",
            heatScoreHigh: "#16a34a",
            heatDensityLow: "#f3e8ff",
            heatDensityMedium: "#c084fc",
            heatDensityGood: "#a855f7",
            heatDensityHigh: "#7e22ce"
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
