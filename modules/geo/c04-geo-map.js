(function (root) {
    "use strict";
    let map, mapContainer, clusterer, markers = [], selections = [], selectionCounter = 0, selectionCallback, customers = [], clusterInfo;
    let storeMarker, edgeBox;
    const overlays = {};
    const transport = {}, transportState = {};
    let lastLayerState = { pins: true, visits: true, spend: true, score: true };
    function waitUntil(ready, src, attempts) {
        return new Promise((resolve, reject) => {
            function check(remaining) {
                if (ready()) return resolve();
                if (!remaining) return reject(new Error(`Dependencia indisponivel apos carregar ${src}`));
                setTimeout(() => check(remaining - 1), 100);
            }
            check(attempts || 100);
        });
    }
    function script(src, ready) {
        return new Promise((resolve, reject) => {
            if (ready()) return resolve();
            const element = document.createElement("script"); element.src = src; element.async = true;
            element.onload = () => waitUntil(ready, src).then(resolve, reject);
            element.onerror = () => reject(new Error(`Falha ao carregar ${src}`)); document.head.appendChild(element);
        });
    }
    async function load() {
        const config = root.C04GeoConfig;
        await script(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&v=quarterly&libraries=marker,geometry&loading=async`,
            () => root.google && root.google.maps && typeof root.google.maps.Map === "function" &&
                root.google.maps.geometry && root.google.maps.marker);
        await Promise.all([script("https://unpkg.com/@googlemaps/markerclusterer@2.6.2/dist/index.min.js", () => root.markerClusterer),
            script("https://unpkg.com/deck.gl@9.1.14/dist.min.js", () => root.deck)]);
    }
    function geocodeKey(item) { return `geo:${item.idPessoa}`; }
    function component(result, type, shortName) {
        const found = result.address_components.find(part => part.types.includes(type));
        return found ? found[shortName ? "short_name" : "long_name"] : "";
    }
    function validateGeocode(first, customer) {
        const location = first.geometry.location, config = root.C04GeoConfig;
        const distanceKm = google.maps.geometry.spherical.computeDistanceBetween(location, config.center) / 1000;
        if (component(first, "country", true) !== "BR") return { ok: false, reason: "pais_invalido", distanceKm };
        if (component(first, "administrative_area_level_1", true) !== "SP") return { ok: false, reason: "estado_invalido", distanceKm };
        if (distanceKm > config.geocodeMaxDistanceKm) return { ok: false, reason: "fora_do_raio", distanceKm };
        const inputZip = root.C04GeoCore.digits(customer && customer.zip), resultZip = root.C04GeoCore.digits(component(first, "postal_code"));
        if (first.partial_match && (!inputZip || inputZip !== resultZip)) return { ok: false, reason: "resultado_parcial", distanceKm };
        return { ok: true, distanceKm, quality: first.partial_match ? "postal_code_confirmed" : "exact" };
    }
    function failureRow(customer, reason, detail) {
        return { key: geocodeKey(customer), idPessoa: customer.idPessoa, addressHash: customer.addressHash, inputCountry: customer.country,
            inputState: customer.state, inputCity: customer.city, inputZip: customer.zip, inputStreet: customer.street,
            inputNumber: customer.number, inputComplement: customer.complement, inputNeighborhood: customer.neighborhood,
            formattedAddress: detail && detail.formattedAddress || "", status: "failed", quality: reason, failureReason: reason,
            validationVersion: root.C04GeoConfig.geocodeValidationVersion, geocodedAt: new Date().toISOString(),
            distanceKm: detail && detail.distanceKm };
    }
    async function geocode(items, cachedRows, progress, token, options) {
        options = options || {};
        const geocoder = new google.maps.Geocoder(), cached = new Map((cachedRows || []).map(item => [String(item.idPessoa), item])), result = [], rows = [];
        const rejected = [], counts = { reused: 0, found: 0, failed: 0 };
        for (let i = 0; i < items.length; i += 1) {
            if (token && token.cancelled) throw new Error("Sincronizacao cancelada.");
            const customer = items[i], key = geocodeKey(customer), previous = cached.get(String(customer.idPessoa));
            if (!customer.address) {
                counts.failed += 1; rows.push(failureRow(customer, "endereco_ausente")); continue;
            }
            if (previous && previous.addressHash === customer.addressHash && previous.status === "valid" &&
                Number(previous.validationVersion) === root.C04GeoConfig.geocodeValidationVersion) {
                counts.reused += 1; result.push(Object.assign({}, customer, { placeId: previous.placeId, lat: Number(previous.lat),
                    lng: Number(previous.lng), neighborhood: previous.neighborhood || customer.neighborhood }));
                progress(i + 1, items.length, counts, result); continue;
            }
            if (previous && previous.addressHash === customer.addressHash && previous.status === "failed" &&
                !options.forceFailed && !customer.retryGeocode) {
                counts.reused += 1; rows.push(previous); progress(i + 1, items.length, counts, result); continue;
            }
            try {
                const response = await geocoder.geocode({ address: customer.address, region: "BR", componentRestrictions: { country: "BR" } });
                const first = response.results[0];
                if (!first) throw new Error("sem_resultado");
                const validation = validateGeocode(first, customer);
                if (!validation.ok) {
                    counts.failed += 1; rejected.push({ customer, reason: validation.reason, distanceKm: validation.distanceKm,
                        formattedAddress: first.formatted_address });
                    rows.push(failureRow(customer, validation.reason, { distanceKm: validation.distanceKm,
                        formattedAddress: first.formatted_address })); progress(i + 1, items.length, counts, result); continue;
                }
                const location = first.geometry.location, neighborhood = first.address_components.find(part =>
                    part.types.includes("sublocality_level_1") || part.types.includes("neighborhood"));
                const row = { key, idPessoa: customer.idPessoa, addressHash: customer.addressHash, inputCountry: customer.country,
                    inputState: customer.state, inputCity: customer.city, inputZip: customer.zip, inputStreet: customer.street,
                    inputNumber: customer.number, inputComplement: customer.complement, inputNeighborhood: customer.neighborhood,
                    formattedAddress: first.formatted_address, country: component(first, "country"), state: component(first, "administrative_area_level_1", true),
                    city: component(first, "administrative_area_level_2"), zip: component(first, "postal_code"), street: component(first, "route"),
                    number: component(first, "street_number"), complement: "", neighborhood: neighborhood ? neighborhood.long_name : customer.neighborhood,
                    placeId: first.place_id, lat: location.lat(), lng: location.lng(), quality: validation.quality, status: "valid",
                    geocodedAt: new Date().toISOString(), validationVersion: root.C04GeoConfig.geocodeValidationVersion, distanceKm: validation.distanceKm };
                rows.push(row); result.push(Object.assign({}, customer, { placeId: row.placeId, lat: row.lat, lng: row.lng, neighborhood: row.neighborhood }));
                counts.found += 1;
                await new Promise(resolve => setTimeout(resolve, 80));
            } catch (error) {
                counts.failed += 1; rows.push(failureRow(customer, error.message || "erro_geocodificacao"));
                rejected.push({ customer, reason: error.message || "erro_geocodificacao", distanceKm: 0, formattedAddress: "" });
            }
            progress(i + 1, items.length, counts, result);
        }
        return { customers: result, rows, counts, rejected };
    }
    function color(score) {
        const colors = root.C04GeoConfig.colors;
        return score >= 75 ? colors.scoreHigh : score >= 50 ? colors.scoreGood : score >= 25 ? colors.scoreMedium : colors.scoreLow;
    }
    function createClusterer(visible, clusterEnabled) {
        if (!visible) return;
        if (clusterEnabled !== false) {
            if (!clusterInfo && typeof google !== "undefined" && google.maps) {
                clusterInfo = new google.maps.InfoWindow({ disableAutoPan: true });
            }
            clusterer = new markerClusterer.MarkerClusterer({ map: map, markers,
                algorithmOptions: { maxZoom: 18, radius: root.C04GeoConfig.clusterRadius },
                renderer: { render: ({ count, position, markers: group }) => {
                    const average = group.reduce((sum, item) => sum + (item.c04Score || 0), 0) / group.length, node = document.createElement("div");
                    node.textContent = count; node.style.cssText = `background:${root.C04GeoConfig.colors.cluster};color:#fff;border:4px solid ${color(average)};border-radius:50%;width:44px;height:44px;display:grid;place-items:center;font:bold 13px Arial;box-shadow:0 2px 8px #0008;cursor:pointer;`;
                    
                    const totalVisits = group.reduce((sum, item) => sum + (item.c04Visits || 0), 0);
                    const totalSpend = group.reduce((sum, item) => sum + (item.c04Spend || 0), 0);
                    
                    const marker = new google.maps.marker.AdvancedMarkerElement({ position, content: node, zIndex: 1000 + count });
                    
                    node.onmouseenter = () => {
                        if (clusterInfo) {
                            clusterInfo.setContent(`<div style="color: #0f172a !important; font-family: Outfit, Inter, Arial, sans-serif; font-size: 11px; line-height: 1.4; min-width: 140px;">
                                <b style="color: #0f172a !important; font-size: 12px; font-weight: 700;">Grupo de ${count} clientes</b><br>
                                <span style="color: #0f172a !important;">Score médio: <strong>${average.toFixed(0)}</strong></span><br>
                                <span style="color: #0f172a !important;">Visitas totais: <strong>${totalVisits}</strong></span><br>
                                <span style="color: #0f172a !important;">Receita total: <strong>R$ ${totalSpend.toFixed(0)}</strong></span>
                            </div>`);
                            clusterInfo.open(map, marker);
                        }
                    };
                    node.onmouseleave = () => {
                        if (clusterInfo) clusterInfo.close();
                    };
                    
                    return marker;
                } } });
        } else {
            markers.forEach(marker => { marker.map = map; });
        }
    }
    function renderPins(items, visible, clusterEnabled) {
        const seen = {};
        const jitteredItems = items.map(customer => {
            if (!Number.isFinite(customer.lat) || !Number.isFinite(customer.lng)) return customer;
            const key = `${customer.lat.toFixed(6)},${customer.lng.toFixed(6)}`;
            if (seen[key] == null) {
                seen[key] = 0;
            } else {
                seen[key]++;
            }
            const count = seen[key];
            if (count > 0) {
                const angle = (count * 0.1) * 2 * Math.PI;
                const radius = 0.00003 * Math.sqrt(count);
                const lat = customer.lat + radius * Math.sin(angle);
                const lng = customer.lng + (radius * Math.cos(angle)) / Math.cos(lat * Math.PI / 180);
                return Object.assign({}, customer, { lat, lng });
            }
            return customer;
        });

        customers = jitteredItems;
        if (clusterer) { clusterer.clearMarkers(); clusterer.setMap(null); clusterer = null; }
        markers.forEach(item => { item.map = null; }); markers = [];
        const info = new google.maps.InfoWindow();
        markers = jitteredItems.map(customer => {
            const node = document.createElement("div");
            node.style.cssText = `width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${root.C04GeoConfig.colors.clientPin};border:4px solid ${color(customer.score)};color:#fff;display:grid;place-items:center;font:bold 9px Arial;box-shadow:0 2px 6px #0006`;
            const glyph = document.createElement("span"); glyph.textContent = String(customer.score); glyph.style.transform = "rotate(45deg)";
            node.textContent = ""; node.appendChild(glyph);
            const marker = new google.maps.marker.AdvancedMarkerElement({ position: { lat: customer.lat, lng: customer.lng }, content: node, title: customer.name });
            marker.c04Score = customer.score;
            marker.c04Visits = customer.visits || 0;
            marker.c04Spend = customer.spend || 0;
            marker.addListener("click", () => {
                 const petsHtml = customer.pets ? `<br><span style="color: #4b5563 !important; font-size: 11px;">Doguinhos: <strong>${customer.pets}</strong></span>` : "";
                 const phoneHtml = customer.phone ? `<br><span style="color: #4b5563 !important; font-size: 11px;">Tel: <strong>${customer.phone}</strong></span>` : "";
                 const neighborhoodZipHtml = `${customer.neighborhood || ""}${customer.zip ? ` - CEP: ${customer.zip}` : ""}`;
                 const lastVisitHtml = customer.lastPurchase ? `<br><span style="color: #0f172a !important;">Última visita: <strong>${customer.lastPurchase}</strong></span>` : "";
                 const freqHtml = customer.frequency ? `<br><span style="color: #0f172a !important;">Frequência: <strong>${customer.frequency}</strong></span>` : "";
                 
                 info.setContent(`<div style="color: #0f172a !important; font-family: Outfit, Inter, Arial, sans-serif; font-size: 12px; line-height: 1.5; min-width: 180px;">
                     <b style="color: #0f172a !important; font-size: 13px; font-weight: 700;">${customer.name}</b>
                     ${petsHtml}
                     ${phoneHtml}
                     <br><span style="color: #4b5563 !important; font-size: 11px;">${neighborhoodZipHtml}</span>
                     <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 8px 0;">
                     <span style="color: #0f172a !important;">Score: <strong>${customer.score}</strong>${customer.scoreConfidence === "low" ? " (baixa confiança)" : ""}</span><br>
                     <span style="color: #0f172a !important;">Visitas: <strong>${customer.visits}</strong></span>
                     ${lastVisitHtml}
                     ${freqHtml}<br>
                     <span style="color: #0f172a !important;">Ticket de consumo: <strong>R$ ${customer.ticket.toFixed(2)}</strong></span><br>
                     <span style="color: #0f172a !important;">Receita consumida: <strong>R$ ${customer.spend.toFixed(2)}</strong></span>
                 </div>`);
                info.open(map, marker);
            }); return marker;
        });
        createClusterer(visible, clusterEnabled);
        addReferenceObjects();
        updateEdges();
    }
    function heatLayer(metric) {
        const weight = metric === "visits" ? item => item.visits : metric === "spend" ? item => item.spend : item => item.score;
        const prefix = metric === "visits" ? "heatVisits" : metric === "spend" ? "heatSpend" : "heatScore";
        const rgba = hex => { const value = String(hex).replace("#", ""); return [Number.parseInt(value.slice(0, 2), 16),
            Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16), 255]; };
        return new deck.HeatmapLayer({ id: `c04-${metric}`, data: customers, getPosition: item => [item.lng, item.lat], getWeight: weight,
            colorRange: [rgba(root.C04GeoConfig.colors[`${prefix}Low`]), rgba(root.C04GeoConfig.colors[`${prefix}High`])],
            radiusPixels: root.C04GeoConfig.heatmaps.radius, intensity: root.C04GeoConfig.heatmaps.intensity,
            opacity: root.C04GeoConfig.heatmaps.opacity, threshold: 0.04 });
    }
    function setLayers(state) {
        lastLayerState = Object.assign({}, state);
        if (clusterer) { clusterer.clearMarkers(); clusterer.setMap(null); clusterer = null; }
        // Compatibility: clearMarkers(); clusterer.setMap(null); createClusterer(state.pins)
        markers.forEach(marker => { marker.map = null; });
        createClusterer(state.pins, state.cluster);
        ["visits", "spend", "score"].forEach(metric => {
            if (overlays[metric]) overlays[metric].finalize();
            overlays[metric] = state[metric] ? new deck.GoogleMapsOverlay({ layers: [heatLayer(metric)] }) : null;
            if (overlays[metric]) overlays[metric].setMap(map);
        });
    }
    function addReferenceObjects() {
        if (storeMarker) { storeMarker.map = null; storeMarker = null; }
        const config = root.C04GeoConfig, position = config.center;
        const pin = new google.maps.marker.PinElement({ background: root.C04GeoConfig.colors.storePin, borderColor: "#fff", glyphColor: "#fff", glyphText: "C04", scale: 1.4 });
        pin.style.fontSize = "8px";
        storeMarker = new google.maps.marker.AdvancedMarkerElement({ map, position, content: pin, title: "Clube04" });
    }
    function updateEdges() {
        if (!map || !map.getBounds() || !edgeBox) return;
        const bounds = map.getBounds(), center = map.getCenter(), groups = { N: [], S: [], E: [], W: [] };
        customers.filter(item => !bounds.contains({ lat: item.lat, lng: item.lng })).forEach(item => {
            const dy = item.lat - center.lat(), dx = item.lng - center.lng();
            groups[Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "N" : "S")].push(item);
        });
        edgeBox.innerHTML = Object.entries(groups).filter(([, items]) => items.length).map(([direction, items]) =>
            `<button data-edge="${direction}" title="Clientes fora da area visivel">${direction} ${items.length}</button>`).join("");
        edgeBox.querySelectorAll("button").forEach(button => {
            button.onclick = () => {
                const target = groups[button.dataset.edge][0];
                map.panTo({ lat: target.lat, lng: target.lng });
            };
        });
    }
    function setTransport(name, enabled) {
        const constructors = { traffic: "TrafficLayer", transit: "TransitLayer", bicycling: "BicyclingLayer" };
        if (!transport[name]) transport[name] = new google.maps[constructors[name]]();
        transportState[name] = enabled; transport[name].setMap(enabled ? map : null);
    }
    function mapOptions() {
        const id = root.C04GeoConfig.googleMapId;
        return { center: root.C04GeoConfig.center, zoom: root.C04GeoConfig.zoom, scaleControl: true,
            mapId: id || "DEMO_MAP_ID", mapTypeControl: false, fullscreenControl: false };
    }
    function rebuildMap(options) {
        const center = map.getCenter(), zoom = map.getZoom();
        map = new google.maps.Map(mapContainer, Object.assign(options, { center, zoom }));
        selections.forEach(item => { item.shape.setMap(map); item.close.map = map; });
        addReferenceObjects(); addRecenterControl(); addSatelliteControl(); renderPins(customers, lastLayerState.pins); setLayers(lastLayerState);
        Object.keys(transport).forEach(name => transport[name].setMap(transportState[name] ? map : null));
        map.addListener("idle", updateEdges);
    }
    function setMapType(type) {
        map.setMapTypeId(type === "satellite" ? "satellite" : "roadmap");
    }
    function recenter() {
        map.panTo(root.C04GeoConfig.center); map.setZoom(root.C04GeoConfig.zoom);
    }
    function addRecenterControl() {
        const button = document.createElement("button");
        button.type = "button"; button.title = "Centralizar no Clube04"; button.setAttribute("aria-label", "Centralizar no Clube04");
        button.textContent = ""; button.style.cssText = "background:radial-gradient(circle,#f97316 0 3px,#fff 4px 8px,#292524 9px 11px,#fff 12px);border:0;border-radius:2px;margin:10px;width:40px;height:40px;box-shadow:0 1px 4px #0006;cursor:pointer";
        button.onclick = recenter; map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(button);
    }
    const SVG_MAP = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#38bdf8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>`;
    const SVG_SATELLITE = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    let satelliteMode = false;
    function addSatelliteControl() {
        const checkbox = document.getElementById("c04-satellite");
        satelliteMode = checkbox ? checkbox.checked : false;
        const button = document.createElement("button");
        button.type = "button"; button.title = "Alternar Satélite"; button.setAttribute("aria-label", "Alternar Satélite");
        const iconHtml = satelliteMode ? SVG_MAP : SVG_SATELLITE;
        const labelText = satelliteMode ? "Mapa" : "Satélite";
        button.innerHTML = `
            <div id="c04-satellite-container" style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; position: relative; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e293b, #0f172a); padding-bottom: 8px;">
                <div id="c04-satellite-icon-wrapper" style="flex: 1; display: flex; align-items: center; justify-content: center; margin-top: 4px;">
                    ${iconHtml}
                </div>
                <div id="c04-satellite-label" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15,23,42,0.9); color: #fff; font-size: 8px; font-weight: 600; text-align: center; padding: 2px 0; font-family: Outfit, sans-serif; text-transform: uppercase;">${labelText}</div>
            </div>
        `;
        button.style.cssText = "background:none;border:0;padding:0;margin:10px;cursor:pointer;transition:transform 0.15s;";
        button.onmouseover = () => button.style.transform = "scale(1.05)";
        button.onmouseout = () => button.style.transform = "scale(1)";
        button.onclick = () => {
            satelliteMode = !satelliteMode;
            setMapType(satelliteMode ? "satellite" : "roadmap");
            if (checkbox) {
                checkbox.checked = satelliteMode;
                checkbox.dispatchEvent(new Event("change"));
            }
            const wrapper = button.querySelector("#c04-satellite-icon-wrapper");
            const label = button.querySelector("#c04-satellite-label");
            if (satelliteMode) {
                wrapper.innerHTML = SVG_MAP;
                label.textContent = "Mapa";
            } else {
                wrapper.innerHTML = SVG_SATELLITE;
                label.textContent = "Satélite";
            }
        };
        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(button);
    }
    function resize() { if (map) google.maps.event.trigger(map, "resize"); }
    function diagnostics() {
        const capabilities = map && map.getMapCapabilities ? map.getMapCapabilities() : {};
        return { loaded: Boolean(map), advancedMarkersAvailable: capabilities.isAdvancedMarkersAvailable !== false,
            mapIdConfigured: Boolean(root.C04GeoConfig.googleMapId), apiKeyConfigured: Boolean(root.C04GeoConfig.googleMapsApiKey),
            ok: Boolean(map) && capabilities.isAdvancedMarkersAvailable !== false && Boolean(root.C04GeoConfig.googleMapId) };
    }
    async function diagnosticGeocode() {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: root.C04GeoConfig.center });
        const first = response.results && response.results[0];
        return { ok: Boolean(first), placeId: first ? first.place_id : "", resultCount: response.results ? response.results.length : 0 };
    }
    function selectionInfo() {
        return { count: selections.length, radiiKm: selections.filter(item => item.shape instanceof google.maps.Circle)
            .map(item => item.shape.getRadius() / 1000), selections: selections.map(item => ({ id: item.id, type: item.type })) };
    }
    function insideShape(item, shape) {
        const point = new google.maps.LatLng(item.lat, item.lng);
        if (shape instanceof google.maps.Circle) return google.maps.geometry.spherical.computeDistanceBetween(point, shape.getCenter()) <= shape.getRadius();
        if (shape instanceof google.maps.Rectangle) return shape.getBounds().contains(point);
        return shape instanceof google.maps.Polygon && google.maps.geometry.poly.containsLocation(point, shape);
    }
    function emitSelection() {
        if (!selectionCallback) return;
        const unique = new Map(customers.filter(item => selections.some(entry => insideShape(item, entry.shape)))
            .map(item => [String(item.idPessoa), item]));
        selectionCallback(Array.from(unique.values()), selectionInfo());
    }
    function closePosition(shape) {
        if (shape instanceof google.maps.Circle) return google.maps.geometry.spherical.computeOffset(shape.getCenter(), shape.getRadius(), 45);
        if (shape instanceof google.maps.Rectangle) return shape.getBounds().getNorthEast();
        const bounds = new google.maps.LatLngBounds(); shape.getPath().forEach(point => bounds.extend(point)); return bounds.getNorthEast();
    }
    function removeSelection(id) {
        const index = selections.findIndex(item => item.id === id); if (index < 0) return;
        const item = selections[index]; item.listeners.forEach(listener => listener.remove()); item.shape.setMap(null); item.close.map = null;
        selections.splice(index, 1); emitSelection();
    }
    function addSelection(shape, type) {
        const id = `area-${selectionCounter += 1}`, closeNode = document.createElement("button");
        closeNode.type = "button"; closeNode.textContent = "x"; closeNode.title = "Remover esta selecao";
        closeNode.style.cssText = "width:24px;height:24px;border:0;border-radius:50%;background:#ea580c;color:#fff;font:bold 14px Arial;cursor:pointer";
        const close = new google.maps.marker.AdvancedMarkerElement({ map, position: closePosition(shape), content: closeNode, title: "Remover selecao" });
        const entry = { id, type, shape, close, listeners: [] }; closeNode.onclick = () => removeSelection(id);
        const changed = () => { close.position = closePosition(shape); emitSelection(); };
        ["bounds_changed", "center_changed", "radius_changed", "dragend"].forEach(event => entry.listeners.push(shape.addListener(event, changed)));
        selections.push(entry); emitSelection(); return entry;
    }
    function clearSelection() {
        selections.slice().forEach(item => removeSelection(item.id)); selections = []; emitSelection();
    }
    function select(mode, callback) {
        selectionCallback = callback; const center = map.getCenter();
        let shape;
        if (mode === "circle") shape = new google.maps.Circle({ map, center, radius: 1500, editable: true, draggable: true, fillOpacity: 0.08 });
        if (mode === "rectangle") {
            const north = google.maps.geometry.spherical.computeOffset(center, 1500, 0);
            const south = google.maps.geometry.spherical.computeOffset(center, 1500, 180);
            const east = google.maps.geometry.spherical.computeOffset(center, 1500, 90);
            const west = google.maps.geometry.spherical.computeOffset(center, 1500, 270);
            shape = new google.maps.Rectangle({ map, bounds: { north: north.lat(), south: south.lat(), east: east.lng(), west: west.lng() },
                editable: true, draggable: true, fillOpacity: 0.08 });
        }
        if (mode === "polygon") {
            const distance = 1200, path = [0, 120, 240].map(heading => google.maps.geometry.spherical.computeOffset(center, distance, heading));
            shape = new google.maps.Polygon({ map, paths: path, editable: true, draggable: true, fillOpacity: 0.08 });
        }
        return addSelection(shape, mode === "rectangle" ? "square" : mode);
    }
    async function init(container) {
        await load(); const config = root.C04GeoConfig; mapContainer = container;
        map = new google.maps.Map(container, mapOptions());
        edgeBox = document.createElement("div"); edgeBox.className = "c04-map-edges"; container.parentElement.appendChild(edgeBox);
        addReferenceObjects(); addRecenterControl(); addSatelliteControl(); map.addListener("idle", updateEdges);
    }
    function destroy() {
        selectionCallback = null; clearSelection(); if (clusterer) clusterer.clearMarkers(); Object.values(overlays).forEach(item => item && item.finalize());
        if (storeMarker) storeMarker.map = null;
        if (clusterInfo) { clusterInfo.close(); clusterInfo = null; }
        if (edgeBox) edgeBox.remove(); clusterer = null; markers = []; customers = []; map = null; mapContainer = null;
    }
    root.C04GeoMap = { init, geocode, validateGeocode, diagnosticGeocode, renderPins, setLayers, setTransport, setMapType, recenter, resize, diagnostics,
        select, clearSelection, removeSelection, selectionInfo, destroy };
})(window);
