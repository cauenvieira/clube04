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
    function labelPosition(shape) {
        if (shape instanceof google.maps.Circle) {
            return google.maps.geometry.spherical.computeOffset(shape.getCenter(), shape.getRadius(), 0);
        }
        if (shape instanceof google.maps.Rectangle) {
            const bounds = shape.getBounds();
            return new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getCenter().lng());
        }
        if (shape instanceof google.maps.Polygon) {
            const bounds = new google.maps.LatLngBounds();
            shape.getPath().forEach(point => bounds.extend(point));
            return new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getCenter().lng());
        }
        return null;
    }
    function labelText(shape) {
        if (shape instanceof google.maps.Circle) {
            return `Raio: ${(shape.getRadius() / 1000).toFixed(2)} km`;
        }
        if (shape instanceof google.maps.Rectangle) {
            const bounds = shape.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const nw = new google.maps.LatLng(ne.lat(), sw.lng());
            const se = new google.maps.LatLng(sw.lat(), ne.lng());
            const w = (google.maps.geometry.spherical.computeDistanceBetween(sw, se) / 1000).toFixed(2);
            const h = (google.maps.geometry.spherical.computeDistanceBetween(sw, nw) / 1000).toFixed(2);
            return `${w} x ${h} km`;
        }
        if (shape instanceof google.maps.Polygon) {
            const area = google.maps.geometry.spherical.computeArea(shape.getPath());
            return `Área: ${(area / 1000000).toFixed(2)} km²`;
        }
        return "";
    }
    function component(result, type, shortName) {
        const found = result.address_components.find(part => part.types.includes(type));
        return found ? found[shortName ? "short_name" : "long_name"] : "";
    }
    function editDistance(s1, s2) {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) {
                costs[s2.length] = lastValue;
            }
        }
        return costs[s2.length];
    }
    function calculateSimilarity(s1, s2) {
        let longer = s1;
        let shorter = s2;
        if (s1.length < s2.length) {
            longer = s2;
            shorter = s1;
        }
        const longerLength = longer.length;
        if (longerLength === 0) return 1.0;
        return (longerLength - editDistance(longer, shorter)) / longerLength;
    }
    function validateGeocode(first, customer) {
        const location = first.geometry.location, config = root.C04GeoConfig;
        const distanceKm = google.maps.geometry.spherical.computeDistanceBetween(location, config.center) / 1000;
        
        const googleCountry = component(first, "country", true);
        const inputCountry = root.C04GeoCore.normalize(customer && customer.country);
        if (googleCountry !== "BR" || (inputCountry && inputCountry !== "brasil" && inputCountry !== "br")) {
            return { ok: false, reason: "pais_divergente", distanceKm };
        }
        
        const googleState = component(first, "administrative_area_level_1", true);
        const inputState = root.C04GeoCore.normalize(customer && customer.state);
        if (googleState !== "SP" || (inputState && inputState !== "sp" && inputState !== "sao paulo")) {
            return { ok: false, reason: "estado_divergente", distanceKm };
        }
        
        const googleCity = root.C04GeoCore.normalize(component(first, "administrative_area_level_2"));
        const inputCity = root.C04GeoCore.normalize(customer && customer.city);
        if (googleCity && inputCity && googleCity !== inputCity) {
            return { ok: false, reason: "cidade_divergente", distanceKm };
        }
        
        if (distanceKm > config.geocodeMaxDistanceKm) return { ok: false, reason: "fora_do_raio", distanceKm };
        
        const inputZip = root.C04GeoCore.digits(customer && customer.zip), resultZip = root.C04GeoCore.digits(component(first, "postal_code"));
        if (first.partial_match && (!inputZip || inputZip.slice(0, 5) !== resultZip.slice(0, 5))) return { ok: false, reason: "resultado_parcial", distanceKm };
        
        // Comparação inteligente de ruas
        const googleStreet = root.C04GeoCore.normalize(component(first, "route"));
        const inputStreet = root.C04GeoCore.normalize(customer && customer.street);
        if (googleStreet && inputStreet) {
            const cleanStreet = (s) => s.replace(/^(rua|avenida|av|r|travessa|alameda|al|rodovia|rod|praca|pc)\.?\s+/g, "").trim();
            const cleanGoogle = cleanStreet(googleStreet);
            const cleanInput = cleanStreet(inputStreet);
            if (cleanGoogle !== cleanInput) {
                const similarity = calculateSimilarity(cleanGoogle, cleanInput);
                if (similarity >= 0.7) {
                    return { ok: true, warningReason: "rua_semelhante", distanceKm, quality: first.partial_match ? "postal_code_confirmed" : "exact" };
                } else {
                    return { ok: true, warningReason: "rua_divergente", distanceKm, quality: first.partial_match ? "postal_code_confirmed" : "exact" };
                }
            }
        }
        
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
                
                if (validation.warningReason) {
                    rejected.push({ customer, reason: validation.warningReason, distanceKm: validation.distanceKm,
                        formattedAddress: first.formatted_address, isWarning: true });
                }
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
            const isApproximated = !customer.number || String(customer.number).trim() === "";
            const node = document.createElement("div");
            node.style.cssText = `width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${root.C04GeoConfig.colors.clientPin};border:4px solid ${color(customer.score)};color:#fff;display:grid;place-items:center;font:bold 9px Arial;box-shadow:0 2px 6px #0006`;
            const glyph = document.createElement("span"); glyph.textContent = String(customer.score) + (isApproximated ? "*" : ""); glyph.style.transform = "rotate(45deg)";
            node.textContent = ""; node.appendChild(glyph);
            const marker = new google.maps.marker.AdvancedMarkerElement({ position: { lat: customer.lat, lng: customer.lng }, content: node, title: customer.name + (isApproximated ? " *" : "") });
            marker.c04Score = customer.score;
            marker.c04Visits = customer.visits || 0;
            marker.c04Spend = customer.spend || 0;
            marker.addListener("click", () => {
                 const petsHtml = customer.pets ? `<br><span style="color: #4b5563 !important; font-size: 11px;">Doguinhos: <strong>${customer.pets}</strong></span>` : "";
                 
                 const cleanPhone = customer.phone ? String(customer.phone).replace(/\D/g, "") : "";
                 const phoneCopySvg = customer.phone ? `<span class="c04-copy-phone-btn" data-phone="${cleanPhone}" style="cursor: pointer; margin-left: 6px; display: inline-flex; align-items: center; color: #64748b; vertical-align: middle;" title="Copiar telefone"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>` : "";
                 const phoneHtml = customer.phone ? `<br><span style="color: #4b5563 !important; font-size: 11px; display: inline-flex; align-items: center;">Tel: <strong>${customer.phone}</strong>${phoneCopySvg}</span>` : "";
                 
                 const neighborhoodZipHtml = `${customer.neighborhood || ""}${customer.zip ? ` - CEP: ${customer.zip}` : ""}`;
                 
                 const brDate = root.C04GeoCore.formatBrazilianDate(customer.lastPurchase);
                 const lastVisitHtml = brDate ? `<br><span style="color: #0f172a !important;">Última visita: <strong>${brDate}</strong></span>` : "";
                 
                 const freqVal = Number(customer.visits) === 1 ? "N/A" : customer.frequency;
                 const freqHtml = freqVal ? `<br><span style="color: #0f172a !important;">Frequência: <strong>${freqVal}</strong></span>` : "";
                 
                 const nameLinkSvg = customer.idPessoa ? `<span style="cursor: pointer; margin-left: 6px; display: inline-flex; align-items: center; color: #3b82f6; vertical-align: middle;" title="Ver cadastro do cliente"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></span>` : "";
                 const nameHtml = customer.idPessoa ? `<b class="c04-open-person-btn" data-person="${customer.idPessoa}" style="color: #3b82f6 !important; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; cursor: pointer;" title="Ver cadastro do cliente">${customer.name}${isApproximated ? " *" : ""}${nameLinkSvg}</b>` : `<b style="color: #0f172a !important; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center;">${customer.name}${isApproximated ? " *" : ""}</b>`;
                 
                 info.setContent(`<div style="color: #0f172a !important; font-family: Outfit, Inter, Arial, sans-serif; font-size: 12px; line-height: 1.5; min-width: 180px;">
                     ${nameHtml}
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
                 
                 google.maps.event.addListenerOnce(info, "domready", () => {
                     // Bind copy phone button
                     const copyBtn = document.querySelector(".c04-copy-phone-btn");
                     if (copyBtn) {
                         copyBtn.onclick = () => {
                             navigator.clipboard.writeText(copyBtn.dataset.phone);
                             copyBtn.style.color = '#10b981';
                             setTimeout(() => { copyBtn.style.color = '#64748b'; }, 1000);
                         };
                     }
                     // Bind open person button
                     const openBtn = document.querySelector(".c04-open-person-btn");
                     if (openBtn) {
                         openBtn.onclick = () => {
                             const idPessoa = openBtn.dataset.person;
                             if (typeof root.c04OpenPersonRegistration === 'function') {
                                 root.c04OpenPersonRegistration(idPessoa);
                             } else if (typeof window.redirecionarPessoaEditar === 'function') {
                                 window.redirecionarPessoaEditar(idPessoa, '2');
                             } else {
                                 alert('Função de redirecionamento não encontrada.');
                             }
                         };
                     }
                 });
                 
                 info.open(map, marker);
            }); return marker;
        });
        createClusterer(visible, clusterEnabled);
        addReferenceObjects();
        updateEdges();
    }
    function heatLayer(metric) {
        const weight = metric === "visits" ? item => item.visits : metric === "spend" ? item => item.spend : metric === "density" ? item => 1 : item => item.score;
        const prefix = metric === "visits" ? "heatVisits" : metric === "spend" ? "heatSpend" : metric === "density" ? "heatDensity" : "heatScore";
        const rgba = hex => { const value = String(hex).replace("#", ""); return [Number.parseInt(value.slice(0, 2), 16),
            Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16), 255]; };
        return new deck.HeatmapLayer({ id: `c04-${metric}`, data: customers, getPosition: item => [item.lng, item.lat], getWeight: weight,
            colorRange: [
                rgba(root.C04GeoConfig.colors[`${prefix}Low`]),
                rgba(root.C04GeoConfig.colors[`${prefix}Medium`]),
                rgba(root.C04GeoConfig.colors[`${prefix}Good`]),
                rgba(root.C04GeoConfig.colors[`${prefix}High`])
            ],
            radiusPixels: root.C04GeoConfig.heatmaps.radius, intensity: root.C04GeoConfig.heatmaps.intensity,
            opacity: root.C04GeoConfig.heatmaps.opacity, threshold: 0.04 });
    }
    function setLayers(state) {
        lastLayerState = Object.assign({}, state);
        if (clusterer) { clusterer.clearMarkers(); clusterer.setMap(null); clusterer = null; }
        // Compatibility: clearMarkers(); clusterer.setMap(null); createClusterer(state.pins)
        markers.forEach(marker => { marker.map = null; });
        createClusterer(state.pins, state.cluster);
        ["visits", "spend", "score", "density"].forEach(metric => {
            if (overlays[metric]) overlays[metric].finalize();
            overlays[metric] = state[metric] ? new deck.GoogleMapsOverlay({ layers: [heatLayer(metric)] }) : null;
            if (overlays[metric]) overlays[metric].setMap(map);
        });
    }
    function addReferenceObjects() {
        if (storeMarker) { storeMarker.map = null; storeMarker = null; }
        const config = root.C04GeoConfig, position = config.center;
        
        // Premium custom marker element
        const content = document.createElement("div");
        content.style.cssText = "position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; background: linear-gradient(135deg, #f97316, #ea580c); border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.35), 0 0 12px rgba(249, 115, 22, 0.5); font-family: Outfit, sans-serif; pointer-events: none;";
        
        const label = document.createElement("span");
        label.style.cssText = "color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; line-height: 1;";
        label.textContent = "C04";
        content.appendChild(label);
        
        const pinArrow = document.createElement("div");
        pinArrow.style.cssText = "position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 7px solid #ffffff;";
        content.appendChild(pinArrow);
        
        storeMarker = new google.maps.marker.AdvancedMarkerElement({ map, position, content, title: "Clube04" });
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
        selections.forEach(item => {
            item.shape.setMap(map);
            item.close.map = map;
            if (item.labelMarker) item.labelMarker.map = map;
        });
        addReferenceObjects(); addFullscreenControl(); addSatelliteControl(); addRecenterControl(); renderPins(customers, lastLayerState.pins); setLayers(lastLayerState);
        Object.keys(transport).forEach(name => transport[name].setMap(transportState[name] ? map : null));
        map.addListener("idle", updateEdges);
    }
    function setMapType(type) {
        map.setMapTypeId(type === "satellite" ? "satellite" : "roadmap");
    }
    function recenter() {
        map.panTo(root.C04GeoConfig.center); map.setZoom(root.C04GeoConfig.zoom);
    }
    const SVG_RECENTER = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="3" fill="#f97316"></circle><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line></svg>`;
    const SVG_FULLSCREEN = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
    const SVG_EXIT_FULLSCREEN = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path></svg>`;

    function addRecenterControl() {
        const button = document.createElement("button");
        button.type = "button"; button.title = "Centralizar no Clube04"; button.setAttribute("aria-label", "Centralizar no Clube04");
        button.innerHTML = `
            <div id="c04-recenter-container" style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e293b, #0f172a);">
                ${SVG_RECENTER}
            </div>
        `;
        button.style.cssText = "background:none;border:0;padding:0;margin:10px;cursor:pointer;transition:transform 0.15s;";
        button.onmouseover = () => button.style.transform = "scale(1.05)";
        button.onmouseout = () => button.style.transform = "scale(1)";
        button.onclick = recenter; map.controls[google.maps.ControlPosition.RIGHT_TOP].push(button);
    }
    const SVG_MAP = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#38bdf8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>`;
    const SVG_SATELLITE = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    let satelliteMode = false;
    function addSatelliteControl() {
        const checkbox = document.getElementById("c04-satellite");
        satelliteMode = checkbox ? checkbox.checked : false;
        const button = document.createElement("button");
        button.type = "button"; button.title = satelliteMode ? "Mapa" : "Satélite"; button.setAttribute("aria-label", satelliteMode ? "Mapa" : "Satélite");
        const iconHtml = satelliteMode ? SVG_MAP : SVG_SATELLITE;
        button.innerHTML = `
            <div id="c04-satellite-container" style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e293b, #0f172a);">
                <div id="c04-satellite-icon-wrapper" style="display: flex; align-items: center; justify-content: center;">
                    ${iconHtml}
                </div>
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
            if (satelliteMode) {
                wrapper.innerHTML = SVG_MAP;
                button.title = "Mapa";
                button.setAttribute("aria-label", "Mapa");
            } else {
                wrapper.innerHTML = SVG_SATELLITE;
                button.title = "Satélite";
                button.setAttribute("aria-label", "Satélite");
            }
        };
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(button);
    }
    function addFullscreenControl() {
        const button = document.createElement("button");
        button.type = "button";
        const isFullscreen = !!document.fullscreenElement;
        button.title = isFullscreen ? "Sair" : "Tela Cheia";
        button.setAttribute("aria-label", isFullscreen ? "Sair" : "Tela Cheia");
        const iconHtml = isFullscreen ? SVG_EXIT_FULLSCREEN : SVG_FULLSCREEN;
        button.innerHTML = `
            <div id="c04-fullscreen-container" style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e293b, #0f172a);">
                <div id="c04-fullscreen-icon-wrapper" style="display: flex; align-items: center; justify-content: center;">
                    ${iconHtml}
                </div>
            </div>
        `;
        button.style.cssText = "background:none;border:0;padding:0;margin:10px;cursor:pointer;transition:transform 0.15s;";
        button.onmouseover = () => button.style.transform = "scale(1.05)";
        button.onmouseout = () => button.style.transform = "scale(1)";
        button.onclick = () => {
            const el = document.getElementById("c04-fullscreen");
            if (el) el.click();
        };
        window.addEventListener("c04_fullscreen_changed", (e) => {
            const active = e.detail.isFullscreen;
            const wrapper = button.querySelector("#c04-fullscreen-icon-wrapper");
            if (wrapper) {
                wrapper.innerHTML = active ? SVG_EXIT_FULLSCREEN : SVG_FULLSCREEN;
                button.title = active ? "Sair" : "Tela Cheia";
                button.setAttribute("aria-label", active ? "Sair" : "Tela Cheia");
            }
        });
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(button);
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
        if (item.labelMarker) item.labelMarker.map = null;
        selections.splice(index, 1); emitSelection();
    }
    function addSelection(shape, type) {
        const id = `area-${selectionCounter += 1}`, closeNode = document.createElement("button");
        closeNode.type = "button"; closeNode.textContent = "x"; closeNode.title = "Remover esta selecao";
        closeNode.style.cssText = "width:18px;height:18px;border:0;border-radius:50%;background:rgba(239,68,68,0.8);color:#fff;font:bold 11px Outfit,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:background 0.15s, transform 0.15s;";
        closeNode.onmouseover = () => { closeNode.style.background = "#ef4444"; closeNode.style.transform = "scale(1.1)"; };
        closeNode.onmouseout = () => { closeNode.style.background = "rgba(239,68,68,0.8)"; closeNode.style.transform = "scale(1)"; };
        
        const close = new google.maps.marker.AdvancedMarkerElement({ map, position: closePosition(shape), content: closeNode, title: "Remover selecao" });
        
        const labelNode = document.createElement("div");
        labelNode.style.cssText = "font-family:Outfit, sans-serif; background:rgba(15,23,42,0.85); color:#fff; padding:4px 8px; border-radius:6px; border:1.5px solid rgba(255,255,255,0.2); font-size:11px; font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap; pointer-events:none;";
        labelNode.textContent = labelText(shape);
        
        const labelMarker = new google.maps.marker.AdvancedMarkerElement({ map, position: labelPosition(shape), content: labelNode, title: "Dimensões da área" });
        
        const entry = { id, type, shape, close, labelMarker, listeners: [] }; closeNode.onclick = () => removeSelection(id);
        const changed = () => {
            close.position = closePosition(shape);
            labelMarker.position = labelPosition(shape);
            labelNode.textContent = labelText(shape);
            emitSelection();
        };
        
        ["bounds_changed", "center_changed", "radius_changed", "dragend"].forEach(event => entry.listeners.push(shape.addListener(event, changed)));
        if (shape instanceof google.maps.Polygon) {
            const path = shape.getPath();
            ["set_at", "insert_at", "remove_at"].forEach(event => entry.listeners.push(path.addListener(event, changed)));
        }
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
        addReferenceObjects(); addFullscreenControl(); addSatelliteControl(); addRecenterControl(); map.addListener("idle", updateEdges);
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
