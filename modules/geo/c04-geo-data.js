(function (root) {
    "use strict";
    const SALES = { url: "relcliente.php", button: "#buttonbuscarRelatorioCliente", table: "#idTabelaVenda",
        start: "#dataInicio", end: "#dataFim", products: "#idTabelaProdutis" };
    function cancelled(token) {
        if (token && token.cancelled) throw new Error("Sincronizacao cancelada.");
    }
    function getAjaxDetails(func) {
        const src = String(func || "");
        const urlMatch = src.match(/['"]([^'"]+\.php)(?:\?[^'"]*)?['"]/);
        if (!urlMatch) return null;
        const url = urlMatch[1];
        
        const isPost = src.toLowerCase().includes("post") || src.toLowerCase().includes('type: "post"') || src.toLowerCase().includes("type:'post'");
        
        const funcArgsMatch = src.match(/function\s+\w+\s*\(\s*([^)]*)\)/) || src.match(/\(([^)]*)\)\s*=>/);
        const argName = funcArgsMatch ? funcArgsMatch[1].split(",")[0].trim() : "idPessoa";
        
        let paramName = "idPessoa";
        const keyMatch = src.match(new RegExp(`(\\w+)\\s*:\\s*${argName}\\b`));
        if (keyMatch) {
            paramName = keyMatch[1];
        } else {
            const paramMatch = src.match(/\{\s*(\w+)\s*:/);
            if (paramMatch) {
                paramName = paramMatch[1];
            } else {
                const queryMatch = src.match(/\+\s*['"]\&?(\w+)\=/);
                if (queryMatch) {
                    paramName = queryMatch[1];
                }
            }
        }
        
        const hasDateParams = src.includes("dataInicio") && src.includes("dataFim");
        return { url, isPost, paramName, hasDateParams };
    }
    async function fetchProductDetails(idPessoa, ajaxDetails, frameWindow) {
        const url = ajaxDetails.url;
        const isPost = ajaxDetails.isPost;
        const paramName = ajaxDetails.paramName;
        
        const payload = { [paramName]: idPessoa };
        if (ajaxDetails.hasDateParams && frameWindow) {
            const doc = frameWindow.document;
            const dataInicio = doc.querySelector("#dataInicio")?.value || "";
            const dataFim = doc.querySelector("#dataFim")?.value || "";
            if (dataInicio) payload.dataInicio = dataInicio;
            if (dataFim) payload.dataFim = dataFim;
        }
        
        let responseText;
        if (frameWindow && frameWindow.$ && typeof frameWindow.$.ajax === "function") {
            try {
                responseText = await new Promise((resolve, reject) => {
                    frameWindow.$.ajax({
                        url: url,
                        type: isPost ? "POST" : "GET",
                        data: payload,
                        dataType: "text"
                    }).done(resolve).fail((xhr, status, err) => reject(new Error(status || err)));
                });
            } catch (e) {
                console.warn(`jQuery $.ajax falhou para o cliente ${idPessoa}, tentando fetch nativo:`, e);
            }
        }
        
        if (responseText === undefined) {
            if (isPost) {
                const formData = new URLSearchParams();
                for (const [k, v] of Object.entries(payload)) {
                    formData.append(k, v);
                }
                const res = await frameWindow.fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "text/html, */*"
                    },
                    body: formData.toString(),
                    credentials: "include"
                });
                responseText = await res.text();
            } else {
                const separator = url.includes("?") ? "&" : "?";
                const queryStr = new URLSearchParams(payload).toString();
                const fetchUrl = `${url}${separator}${queryStr}`;
                const res = await frameWindow.fetch(fetchUrl, {
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "text/html, */*"
                    },
                    credentials: "include"
                });
                responseText = await res.text();
            }
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, "text/html");
        const table = doc.querySelector(SALES.products) || doc.querySelector("#idTabelaProdutos") || doc.querySelector("table");
        if (!table) return [];
        return tableRecords(table);
    }
    async function limitConcurrency(tasks, limit) {
        const results = [];
        const executing = new Set();
        for (const task of tasks) {
            const p = Promise.resolve().then(() => task());
            results.push(p);
            executing.add(p);
            const clean = () => executing.delete(p);
            p.then(clean, clean);
            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }
    function getDatesInRange(startStr, endStr) {
        const dates = [];
        const current = new Date(startStr + 'T00:00:00Z');
        const end = new Date(endStr + 'T00:00:00Z');
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return dates;
    }
    function delay(ms, token) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            if (token) token.onCancel = () => { clearTimeout(timer); reject(new Error("Sincronizacao cancelada.")); };
        });
    }
    function iframe(url, token) {
        return new Promise((resolve, reject) => {
            cancelled(token);
            const frame = document.createElement("iframe");
            frame.style.cssText = "position:fixed;left:-2000px;top:-2000px;width:1200px;height:800px;opacity:0;pointer-events:none";
            frame.src = new URL(url, location.href).href;
            frame.onload = () => resolve(frame);
            frame.onerror = () => reject(new Error(`Falha ao abrir ${url}`));
            document.body.appendChild(frame);
        });
    }
    function tutorCellValue(cell) {
        const parts = [];
        for (const node of Array.from(cell.childNodes)) {
            if (node.nodeType === 1 && node.tagName === "BR") break;
            if (node.nodeType === 1 && node.tagName === "B") break;
            parts.push(node.textContent || "");
        }
        return parts.join("").trim().replace(/^\*+\s*/, "");
    }
    function tableRecords(table) {
        let headers = Array.from(table.querySelectorAll("thead th")).map(cell => cell.textContent.trim());
        let rows = Array.from(table.querySelectorAll("tbody tr"));
        
        if (headers.length === 0) {
            const ths = Array.from(table.querySelectorAll("tr th"));
            if (ths.length > 0) {
                headers = ths.map(cell => cell.textContent.trim());
                rows = rows.filter(row => !row.querySelector("th"));
            } else {
                const firstRow = table.querySelector("tr");
                if (firstRow) {
                    headers = Array.from(firstRow.querySelectorAll("td")).map(cell => cell.textContent.trim());
                    rows = rows.filter(row => row !== firstRow);
                }
            }
        }
        
        return rows.map(row => {
            const cells = Array.from(row.querySelectorAll("td"));
            const record = Object.fromEntries(headers.map((header, index) => {
                const cell = cells[index], isCustomer = table.id === SALES.table.slice(1) &&
                    root.C04GeoCore.field({ [header]: "value" }, "customer") === "value";
                return [header, cell ? (isCustomer ? tutorCellValue(cell) : cell.textContent.trim()) : ""];
            }));
            const handlers = cells.flatMap(cell => [cell.getAttribute("onclick"), cell.querySelector("[onclick]")?.getAttribute("onclick")]).filter(Boolean);
            const idPessoa = handlers.map(root.C04GeoCore.extractPessoaId).find(Boolean);
            if (idPessoa) record.idPessoa = idPessoa;
            return record;
        }).filter(record => Object.values(record).some(Boolean));
    }
    function infoTotal(doc, table) {
        const info = doc.querySelector(`#${table.id}_info`);
        const numbers = String(info ? info.textContent : "").match(/\d[\d.]*/g) || [];
        return numbers.length ? Number(numbers[numbers.length - 1].replace(/\./g, "")) : tableRecords(table).length;
    }
    function waitFor(frame, selector, timeoutMs, token) {
        return new Promise((resolve, reject) => {
            const started = Date.now(), timer = setInterval(() => {
                try { cancelled(token); } catch (error) { clearInterval(timer); reject(error); return; }
                const found = frame.contentDocument && frame.contentDocument.querySelector(selector);
                if (found) { clearInterval(timer); resolve(found); }
                else if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error(`Tempo excedido: ${selector}`)); }
            }, 100);
        });
    }
    function waitForReplacement(frame, selector, previous, timeoutMs, token) {
        return new Promise((resolve, reject) => {
            const started = Date.now(), timer = setInterval(() => {
                try { cancelled(token); } catch (error) { clearInterval(timer); reject(error); return; }
                const found = frame.contentDocument && frame.contentDocument.querySelector(selector);
                if (found && found !== previous) { clearInterval(timer); resolve(found); }
                else if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error(`Tempo excedido ao atualizar ${selector}`)); }
            }, 100);
        });
    }
    async function waitStable(doc, table, token) {
        let previous = "", stable = 0;
        for (let attempt = 0; attempt < 50; attempt += 1) {
            cancelled(token);
            const current = `${table.querySelectorAll("tbody tr").length}|${doc.querySelector(`#${table.id}_info`)?.textContent || ""}`;
            stable = current === previous ? stable + 1 : 0;
            if (stable >= 2) return;
            previous = current; await delay(50, token);
        }
    }
    function dataTableApi(frame, table) {
        const jq = frame.contentWindow.jQuery || frame.contentWindow.$;
        if (!jq || !jq.fn || !jq.fn.dataTable) return null;
        try { return jq(table).DataTable(); } catch (_) { return null; }
    }
    async function collectAllTable(frame, table, token) {
        const doc = frame.contentDocument, expected = infoTotal(doc, table), api = dataTableApi(frame, table);
        const initialRows = tableRecords(table);
        if (initialRows.length === expected) {
            return { rows: initialRows, expected, mode: "visible" };
        }
        if (!api) {
            if (initialRows.length !== expected) throw new Error(`Coleta parcial em ${table.id}: ${initialRows.length} de ${expected}.`);
            return { rows: initialRows, expected, mode: "visible" };
        }
        try {
            api.page.len(-1).draw(); await waitStable(doc, table, token);
            const all = tableRecords(table);
            if (all.length === expected) return { rows: all, expected, mode: "all" };
        } catch (_) { }
        try {
            api.page.len(9999).draw(); await waitStable(doc, table, token);
            const all = tableRecords(table);
            if (all.length === expected) return { rows: all, expected, mode: "large_limit" };
        } catch (_) { }
        
        const finalRows = tableRecords(table);
        if (finalRows.length !== expected) throw new Error(`Falha ao carregar todos os registros em uma unica pagina em ${table.id}: ${finalRows.length} de ${expected}.`);
        return { rows: finalRows, expected, mode: "all_single" };
    }
    async function openSales(period, token) {
        const frame = await iframe(SALES.url, token), doc = frame.contentDocument;
        doc.querySelector(SALES.start).value = period.start; doc.querySelector(SALES.end).value = period.end;
        doc.querySelector(SALES.button).click();
        const table = await waitFor(frame, SALES.table, 30000, token); await waitStable(doc, table, token);
        return { frame, table };
    }
    function isPackageProduct(name) {
        return /(^|\s)pacotes?(\s|$)/.test(root.C04GeoCore.normalize(name));
    }
    function commercialMetrics(sale, products) {
        const core = root.C04GeoCore, visits = Number.parseInt(core.field(sale, "purchases"), 10) || 0;
        const spend = (products || []).filter(item => !isPackageProduct(core.field(item, "product") || core.field(item, "customer") || item.Produto || item.produto))
            .reduce((total, item) => total + core.parseMoney(core.field(item, "spend")), 0);
        return { visits, spend, ticket: visits ? spend / visits : 0, intervalDays: core.parseFrequencyDays(core.field(sale, "frequency")),
            frequency: core.field(sale, "frequency"), lastPurchase: core.field(sale, "date"), reportedSpend: core.parseMoney(core.field(sale, "spend")) };
    }
    async function collectSales(period, token, progress) {
        const startSalesFetch = Date.now();
        const opened = await openSales(period, token), frame = opened.frame, doc = frame.contentDocument;
        const salesFetchMs = Date.now() - startSalesFetch;
        
        const startDetailsFetch = Date.now();
        try {
            const sales = await collectAllTable(frame, opened.table, token), active = sales.rows.filter(row => root.C04GeoCore.field(row, "id"));
            const details = new Map();
            
            // Try to extract ajax details for fetching products
            let ajaxDetails = null;
            if (frame.contentWindow && typeof frame.contentWindow.detalhesProdutoCliente === "function") {
                try {
                    ajaxDetails = getAjaxDetails(frame.contentWindow.detalhesProdutoCliente);
                } catch (e) {
                    console.warn("Falha ao extrair detalhes AJAX, usando fallback sequencial", e);
                }
            }
            
            if (ajaxDetails) {
                // We have AJAX details, run parallel fetches (max 4 concurrency)
                const clientsToFetch = [];
                for (let index = 0; index < active.length; index += 1) {
                    const row = active[index], idPessoa = root.C04GeoCore.field(row, "id");
                    const visitsVal = root.C04GeoCore.field(row, "purchases");
                    const visits = Number.parseInt(visitsVal, 10) || 0;
                    if (visits === 0) {
                        details.set(String(idPessoa), []);
                    } else {
                        clientsToFetch.push({ index, idPessoa });
                    }
                }
                
                let completed = 0;
                const tasks = clientsToFetch.map(({ index, idPessoa }) => async () => {
                    cancelled(token);
                    try {
                        const products = await fetchProductDetails(idPessoa, ajaxDetails, frame.contentWindow);
                        details.set(String(idPessoa), products);
                    } catch (err) {
                        console.error(`Erro ao buscar produtos para o cliente ${idPessoa}:`, err);
                        details.set(String(idPessoa), []);
                    }
                    completed += 1;
                    if (progress) progress(completed + (active.length - clientsToFetch.length), active.length);
                });
                
                await limitConcurrency(tasks, 4);
                if (progress) progress(active.length, active.length);
            } else {
                // Fallback to original sequential iframe loading
                for (let index = 0; index < active.length; index += 1) {
                    cancelled(token);
                    const row = active[index], idPessoa = root.C04GeoCore.field(row, "id");
                    const visitsVal = root.C04GeoCore.field(row, "purchases");
                    const visits = Number.parseInt(visitsVal, 10) || 0;
                    if (visits === 0) {
                        details.set(String(idPessoa), []);
                        if (progress) progress(index + 1, active.length);
                        continue;
                    }
                    const previous = doc.querySelector(SALES.products);
                    frame.contentWindow.detalhesProdutoCliente(idPessoa);
                    const table = previous ? await waitForReplacement(frame, SALES.products, previous, 30000, token) :
                        await waitFor(frame, SALES.products, 30000, token);
                    await waitStable(doc, table, token);
                    const products = await collectAllTable(frame, table, token);
                    details.set(String(idPessoa), products.rows);
                    if (progress) progress(index + 1, active.length);
                }
            }
            const productDetailsFetchMs = Date.now() - startDetailsFetch;
            return { rows: active, details, expected: sales.expected, mode: sales.mode, salesFetchMs, productDetailsFetchMs };
        } finally { frame.remove(); }
    }
    async function collectCustomersCsv(token) {
        if (root.C04GeoData && root.C04GeoData._csvCache) {
            console.log("⚡ [GEO] Reusando CSV de clientes em cache de sessão.");
            return root.C04GeoData._csvCache;
        }
        if (root.C04GeoData && root.C04GeoData._csvCachePromise) {
            console.log("⚡ [GEO] Reusando promessa de carregamento de CSV em andamento.");
            return root.C04GeoData._csvCachePromise;
        }
        const promise = (async () => {
            const frame = await iframe("cliente.php", token);
            try {
                const form = Array.from(frame.contentDocument.forms).find(item => /PessoaR001/i.test(item.action));
                if (!form) throw new Error("Formulario de exportacao CSV nao encontrado.");
                const response = await frame.contentWindow.fetch(form.action, { method: form.method || "POST", credentials: "include",
                    body: new frame.contentWindow.FormData(form) });
                const text = await response.text();
                if (!response.ok || /^\s*</.test(text)) throw new Error("A exportacao de clientes nao retornou CSV.");
                if (root.C04GeoData) {
                    root.C04GeoData._csvCache = text;
                }
                return text;
            } finally { frame.remove(); }
        })();
        if (root.C04GeoData) {
            root.C04GeoData._csvCachePromise = promise;
        }
        try {
            return await promise;
        } catch (err) {
            if (root.C04GeoData) {
                root.C04GeoData._csvCachePromise = null;
            }
            throw err;
        }
    }
    function customerSignature(row) {
        const core = root.C04GeoCore;
        return [core.field(row, "document"), core.field(row, "address"), core.field(row, "number"), core.field(row, "zip"),
            core.field(row, "complement"), core.field(row, "neighborhood"), core.field(row, "city"), core.field(row, "state")]
            .map(core.normalize).join("|");
    }
    function indexCsv(rows) {
        const core = root.C04GeoCore, result = { identity: new Map(), noPhoneByName: new Map(), ambiguousNoPhone: new Set(), byName: new Map(), ambiguousByName: new Set() };
        const add = (map, key, row) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
        rows.forEach(row => {
            const name = core.normalizePersonName(core.field(row, "customer")), phone = core.normalizePhone(core.field(row, "phone"));
            if (name && phone) add(result.identity, `${name}|${phone}`, row);
            if (name && !phone) add(result.noPhoneByName, name, row);
            if (name) add(result.byName, name, row);
        });
        result.noPhoneByName.forEach((matches, name) => {
            const signatures = new Set(matches.map(customerSignature));
            if (signatures.size > 1 || (matches.length > 1 && signatures.has("|||||||"))) result.ambiguousNoPhone.add(name);
        });
        result.byName.forEach((matches, name) => {
            const signatures = new Set(matches.map(customerSignature));
            if (signatures.size > 1 || (matches.length > 1 && signatures.has("|||||||"))) result.ambiguousByName.add(name);
        });
        return result;
    }
    function matchCsvSale(sale, indexes) {
        const core = root.C04GeoCore, name = core.normalizePersonName(core.field(sale, "customer"));
        const phone = core.normalizePhone(core.field(sale, "phone"));
        if (!name) return { rows: [], reason: "cliente_nao_encontrado", mode: "missing_name" };
        
        // 1. Try exact Name + Phone match
        if (phone) {
            const matches = indexes.identity.get(`${name}|${phone}`);
            if (matches && matches.length > 0) {
                return { rows: matches, reason: "sucesso", mode: "name_phone" };
            }
        }
        
        // 2. Fallback to Name-only match if name is not ambiguous in the CSV
        if (indexes.ambiguousByName && indexes.ambiguousByName.has(name)) {
            return { rows: [], reason: "nome_duplicado", mode: "ambiguous_name" };
        }
        if (indexes.byName) {
            const nameMatches = indexes.byName.get(name);
            if (nameMatches && nameMatches.length > 0) {
                return { rows: nameMatches, reason: "sucesso", mode: "unique_name" };
            }
        }
        
        // 3. Fallback to original logic just in case
        if (phone) return { rows: [], reason: "cliente_nao_encontrado", mode: "name_phone" };
        if (indexes.ambiguousNoPhone && indexes.ambiguousNoPhone.has(name)) {
            return { rows: [], reason: "nome_duplicado", mode: "ambiguous_no_phone" };
        }
        return { rows: (indexes.noPhoneByName && indexes.noPhoneByName.get(name)) || [], reason: "cliente_nao_encontrado", mode: "unique_no_phone" };
    }
    function csvRowsForSale(sale, indexes) {
        return matchCsvSale(sale, indexes).rows;
    }
    function pendingItem(source, reason, message, record) {
        const core = root.C04GeoCore;
        const id = core.field(record, "id") || core.field(record, "customer") || "unknown";
        let customerName = core.field(record, "customer");
        if (customerName && typeof customerName === "object") {
            customerName = customerName.name || customerName.customerName || customerName.Cliente || "";
        }
        return { pendingId: core.hash(`Pendencia|${id}`), source, reason, message,
            idPessoa: core.field(record, "id"), customerName, status: "open",
            record: record,
            createdAt: new Date().toISOString() };
    }
    async function geocodeAddress(zip, street, number, neighborhood, city, state, customer) {
        if (typeof google === "undefined" || !google.maps || !google.maps.Geocoder) {
            return { ok: false, error: "API do Google Maps não carregada." };
        }
        const geocoder = new google.maps.Geocoder();
        const address = [street, number, neighborhood, city, state, zip, "Brasil"]
            .map(item => String(item || "").trim()).filter(Boolean).join(", ");
        
        try {
            const response = await new Promise((resolve, reject) => {
                geocoder.geocode({ address, region: "BR", componentRestrictions: { country: "BR" } }, (results, status) => {
                    if (status === "OK" && results) {
                        resolve(results);
                    } else {
                        reject(new Error(status || "Zero results"));
                    }
                });
            });
            const first = response[0];
            if (!first) throw new Error("Endereço não localizado pelo Google.");
            
            if (root.C04GeoMap && typeof root.C04GeoMap.validateGeocode === "function") {
                const validation = root.C04GeoMap.validateGeocode(first, customer);
                if (!validation.ok) {
                    return { ok: false, error: `Endereço inválido: ${validation.reason}`, reason: validation.reason, distanceKm: validation.distanceKm, formattedAddress: first.formatted_address };
                }
            }
            
            const location = first.geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            
            const getComponent = (type, short = false) => {
                const comp = first.address_components.find(c => c.types.includes(type));
                return comp ? (short ? comp.short_name : comp.long_name) : "";
            };
            
            const streetName = getComponent("route") || street || "";
            const neighborhoodName = getComponent("sublocality_level_1") || getComponent("neighborhood") || neighborhood || "";
            const cityName = getComponent("administrative_area_level_2") || city || "";
            const stateName = getComponent("administrative_area_level_1", true) || state || "";
            const countryName = getComponent("country") || "Brasil";
            const zipCode = getComponent("postal_code") || zip || "";
            
            return {
                ok: true,
                lat,
                lng,
                street: streetName,
                neighborhood: neighborhoodName,
                city: cityName,
                state: stateName,
                country: countryName,
                zip: zipCode,
                formattedAddress: first.formatted_address
            };
        } catch (error) {
            return { ok: false, error: error.message || "Erro desconhecido na API do Google" };
        }
    }
    function buildRelevantCustomers(sales, details, csv, overrides) {
        const core = root.C04GeoCore;
        const indexes = indexCsv(csv);
        const persistent = [];
        const periodCustomers = [];
        const pets = [];
        const pending = [];
        const counts = { pertinent: sales.length, accepted: 0, rejected: 0, minimal: 0 };
        
        const applyOverride = (customer, list) => {
            const match = (list || []).find(item => String(item.idPessoa) === String(customer.idPessoa));
            if (match && match.correctedAddress) customer.address = match.correctedAddress;
            return customer;
        };
        
        sales.forEach(sale => {
            const idPessoa = core.field(sale, "id") || sale.idPessoa;
            if (!idPessoa) return;
            
            const matches = csvRowsForSale(sale, indexes);
            if (matches.length > 0) {
                const customerStatus = core.field(matches[0], "status") || "active";
                if (core.normalize(customerStatus) === "inativa") {
                    counts.rejected += 1;
                    pending.push(pendingItem("Clientes", "cliente_inativo", "Cliente explicitamente inativo no CSV.", Object.assign({}, sale, { csvMatches: matches })));
                    return;
                }
            }
            let hasPending = false;
            
            if (matches.length === 0) {
                counts.accepted += 1;
                counts.minimal += 1;
                pending.push(pendingItem("Erro: Cadastro divergente", "cliente_nao_encontrado", "Cadastro nao encontrado no CSV; registro minimo criado.", Object.assign({}, sale, { csvMatches: [] })));
                const minCust = {
                    idPessoa: String(idPessoa),
                    name: core.field(sale, "customer") || "Cliente " + idPessoa,
                    phone: core.normalizePhone(core.field(sale, "phone")),
                    document: null,
                    status: "active",
                    doguinhos: null,
                    idLocalizacao: null
                };
                minCust.key = `id:${idPessoa}`;
                persistent.push(minCust);
                const metrics = commercialMetrics(sale, details ? details.get(String(idPessoa)) : []);
                if (metrics.visits > 0 || metrics.spend > 0) {
                    periodCustomers.push(Object.assign({}, minCust, metrics));
                }
                return;
            }
            
            const cleanCPF = (r) => core.digits(core.field(r, "document"));
            const cleanCEP = (r) => core.digits(core.field(r, "zip"));
            const cleanNum = (r) => core.normalize(core.field(r, "number"));

            const firstCPF = cleanCPF(matches[0]);
            const firstCEP = cleanCEP(matches[0]);
            const firstNum = cleanNum(matches[0]);

            let allCPFSame = true;
            let allCEPSame = true;
            let allNumSame = true;

            for (let idx = 1; idx < matches.length; idx++) {
                if (cleanCPF(matches[idx]) !== firstCPF) allCPFSame = false;
                if (cleanCEP(matches[idx]) !== firstCEP) allCEPSame = false;
                if (cleanNum(matches[idx]) !== firstNum) allNumSame = false;
            }

            const isConsistent = allCPFSame && allCEPSame && allNumSame;
            if (!isConsistent) {
                hasPending = true;
                const msg = `Dados cadastrais divergentes no CSV para o tutor ${core.field(sale, "customer")}.` +
                            (!allCPFSame ? " CPFs distintos encontrados." : "") +
                            (!allCEPSame ? " CEPs distintos encontrados." : "") +
                            (!allNumSame ? " Números distintos encontrados." : "");
                pending.push(pendingItem("Erro: Cadastro divergente", "cadastro_divergente", msg, Object.assign({}, sale, { csvMatches: matches })));
            }

            let missingCEP = !firstCEP;
            let missingNum = !firstNum;

            if (missingCEP) {
                hasPending = true;
                pending.push(pendingItem("Erro: Cadastro divergente", "endereco_ausente", "CEP ausente no CSV; pin não gerado.", Object.assign({}, sale, { csvMatches: matches })));
            } else if (missingNum) {
                hasPending = true;
                pending.push(pendingItem("Erro: Cadastro divergente", "resultado_parcial", "Número do imóvel ausente no CSV.", Object.assign({}, sale, { csvMatches: matches })));
            }

            // Concat alive pets
            const alivePets = [];
            matches.forEach(r => {
                const isAlive = core.normalize(r.Vivo || r.vivo) === "sim";
                const petName = core.field(r, "pet");
                if (isAlive && petName && !alivePets.includes(petName)) {
                    alivePets.push(petName);
                }
            });
            const doguinhos = alivePets.join(", ") || null;
            
            // Populate pets array for backwards compatibility with tests
            matches.forEach(r => {
                const pet = core.field(r, "pet");
                if (pet && !pets.some(item => item.idPessoa === String(idPessoa) && item.name === pet)) {
                    pets.push({ key: `pet:${idPessoa}:${core.hash(pet)}`, idPessoa: String(idPessoa), name: pet });
                }
            });

            const customerStatus = core.field(matches[0], "status") || "active";
            counts.accepted += 1;
            
            const customer = {
                idPessoa: String(idPessoa),
                name: core.field(sale, "customer") || core.field(matches[0], "customer") || ("Cliente " + idPessoa),
                phone: core.normalizePhone(core.field(sale, "phone")) || core.normalizePhone(core.field(matches[0], "phone")),
                document: core.field(matches[0], "document") || null,
                status: customerStatus,
                doguinhos: doguinhos,
                idLocalizacao: null
            };
            
            customer.key = `id:${idPessoa}`;
            customer.address = matches[0].rua || matches[0].address || "";
            customer.zip = firstCEP;
            customer.number = firstNum;
            
            applyOverride(customer, overrides);
            
            persistent.push(customer);
            
            const metrics = commercialMetrics(sale, details ? details.get(String(idPessoa)) : []);
            if (metrics.visits > 0 || metrics.spend > 0) {
                periodCustomers.push(Object.assign({}, customer, metrics));
            }
        });
        
        return { persistentCustomers: persistent, periodCustomers, pets, pending, counts };
    }
    async function preflight(period, progress, token) {
        const report = (stage, percent, counters) => progress(Object.assign({ stage, percent }, counters || {}));
        report("Pre-validacao: relcliente.php", 5);
        const sales = await collectSales(period, token, (done, total) => report("Pre-validacao: detalhes comerciais", 5 + Math.round(45 * done / total),
            { collected: done, sourceTotal: total }));
        report("Pre-validacao: CSV", 55, { collected: sales.rows.length });
        const csvRows = root.C04GeoCore.parseCsv(await collectCustomersCsv(token)), indexes = indexCsv(csvRows);
        const salesWithIdentity = sales.rows.filter(item => root.C04GeoCore.normalizePersonName(root.C04GeoCore.field(item, "customer")) &&
            root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone"))).length;
        const csvWithIdentity = csvRows.filter(item => root.C04GeoCore.normalizePersonName(root.C04GeoCore.field(item, "customer")) &&
            root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone"))).length;
        const exactMatches = sales.rows.filter(item => csvRowsForSale(item, indexes).length).length;
        const csvNames = new Set(csvRows.map(item => root.C04GeoCore.normalizePersonName(root.C04GeoCore.field(item, "customer"))).filter(Boolean));
        const csvPhones = new Set(csvRows.map(item => root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone"))).filter(Boolean));
        const exactNameMatches = sales.rows.filter(item => csvNames.has(root.C04GeoCore.normalizePersonName(root.C04GeoCore.field(item, "customer")))).length;
        const exactPhoneMatches = sales.rows.filter(item => csvPhones.has(root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone")))).length;
        const uniqueNoPhoneMatches = sales.rows.filter(item => matchCsvSale(item, indexes).mode === "unique_no_phone" && csvRowsForSale(item, indexes).length).length;
        const ambiguousNoPhone = sales.rows.filter(item => matchCsvSale(item, indexes).mode === "ambiguous_no_phone").length;
        const built = buildRelevantCustomers(sales.rows, sales.details, csvRows, []);
        const pendingReasons = built.pending.reduce((result, item) => {
            result[item.reason] = (result[item.reason] || 0) + 1; return result;
        }, {});
        report("Pre-validacao concluida", 100, { collected: built.periodCustomers.length, pending: built.pending.length });
        const complete = sales.rows.length === built.counts.accepted + built.counts.rejected;
        const warning = built.counts.minimal || built.pending.length || !built.persistentCustomers.some(item => item.address) ?
            `${built.counts.minimal} cadastros minimos, ${built.pending.length} pendencias e ${built.persistentCustomers.filter(item => item.address).length} enderecos validos.` : "";
        return { ok: complete, warning, sales: sales.expected, pertinent: sales.rows.length, accepted: built.counts.accepted, rejected: built.counts.rejected,
            minimal: built.counts.minimal, active: built.periodCustomers.length,
            persistent: built.persistentCustomers.length, validAddresses: built.persistentCustomers.filter(item => item.address).length,
            pending: built.pending.length, mode: sales.mode, csvRows: csvRows.length, salesWithIdentity, csvWithIdentity, exactMatches,
            exactNameMatches, exactPhoneMatches, uniqueNoPhoneMatches, ambiguousNoPhone,
            tutorsExtracted: sales.rows.filter(item => root.C04GeoCore.normalizePersonName(root.C04GeoCore.field(item, "customer"))).length,
            normalizedSalesPhones: sales.rows.filter(item => root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone"))).length,
            normalizedCsvPhones: csvRows.filter(item => root.C04GeoCore.normalizePhone(root.C04GeoCore.field(item, "phone"))).length,
            pendingReasons, salesHeaders: Object.keys(sales.rows[0] || {}), csvHeaders: Object.keys(csvRows[0] || {}) };
    }
    async function sync(period, force, progress, token) {
        const core = root.C04GeoCore, sheets = root.C04GeoSheets;
        const report = (stage, percent, counters) => progress(Object.assign({ stage, percent }, counters || {}));
        
        const startSyncTime = Date.now();
        const telemetry = {
            sheetsSnapshotMs: 0,
            salesFetchMs: 0,
            productDetailsFetchMs: 0,
            csvFetchMs: 0,
            processingMs: 0,
            geocodingMs: 0,
            sheetsPublishMs: 0
        };

        // 1. Fetch snapshot from Supabase
        report("Carregando snapshot do banco", 2);
        const snapshot = await sheets.snapshot();
        telemetry.sheetsSnapshotMs = Date.now() - startSyncTime;

        const run = await sheets.startRun({ type: force ? "full" : "sync", period, visibleUser: core.visibleUser(document) });
        
        const newCustomers = [];
        const newPendings = [];
        const allCreatedPendings = [];
        
        try {
            const today = new Date();
            const getLocalDateStr = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dayStr = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dayStr}`;
            };
            const todayStr = getLocalDateStr(today);
            
            let syncEnd = period.end;
            if (syncEnd > todayStr) syncEnd = todayStr;
            let syncStart = period.start;
            if (syncStart > syncEnd) syncStart = syncEnd;

            // 3. Check which days are already synced
            report("Verificando cache de sincronização", 3);
            const syncedDays = force ? [] : await sheets.getSyncedDays(syncStart, syncEnd);
            
            const allDates = getDatesInRange(syncStart, syncEnd);
            const missingDates = allDates.filter(d => !syncedDays.includes(d));
            
            console.log(`[GEO] Período: ${syncStart} ate ${syncEnd}. Dias já sincronizados: ${syncedDays.length}/${allDates.length}. Faltam: ${missingDates.length}`);

            // 4. Download/Load customers CSV
            const csvStart = Date.now();
            report("Baixando CSV de clientes", 5);
            const csvText = await collectCustomersCsv(token);
            const csvRows = core.parseCsv(csvText);
            const csvIndexes = indexCsv(csvRows);
            telemetry.csvFetchMs = Date.now() - csvStart;

            let totalExpected = 0;
            let salesMode = "visible";
            const todaySalesRows = [];

            // 5. Fetch missing days day-by-day from CRM
            if (missingDates.length > 0) {
                for (let i = 0; i < missingDates.length; i++) {
                    const d = missingDates[i];
                    cancelled(token);
                    
                    const pct = 5 + Math.round(25 * (i / missingDates.length));
                    report(`Sincronizando dia ${d} (${i+1}/${missingDates.length})`, pct);
                    
                    const dayPeriod = { start: d, end: d };
                    
                    const daySales = await collectSales(dayPeriod, token, (done, total) => {
                        report(`Buscando produtos do dia ${d} (${done}/${total})`, pct);
                    });
                    
                    telemetry.salesFetchMs += daySales.salesFetchMs || 0;
                    telemetry.productDetailsFetchMs += daySales.productDetailsFetchMs || 0;
                    
                    totalExpected += daySales.expected;
                    salesMode = daySales.mode;
                    
                    const salesRowsToSave = [];
                    for (const sale of daySales.rows) {
                        const idPessoa = core.field(sale, "id");
                        if (!idPessoa) continue;
                        const products = daySales.details.get(String(idPessoa)) || [];
                        const metrics = commercialMetrics(sale, products);
                        
                        const row = {
                            idPessoa: String(idPessoa),
                            customerName: core.field(sale, "customer"),
                            phone: core.field(sale, "phone"),
                            saleDate: d,
                            spend: metrics.spend
                        };

                        if (d === todayStr) {
                            todaySalesRows.push(row);
                        } else {
                            salesRowsToSave.push(row);
                        }

                        // Check if customer already exists in snapshot
                        let customerObj = snapshot.customers.find(c => String(c.idPessoa) === String(idPessoa));
                        if (!customerObj) {
                            // Match against CSV
                            const csvMatches = csvRowsForSale(sale, csvIndexes);
                            if (csvMatches.length === 0) {
                                // cliente_nao_encontrado
                                const pending = pendingItem("Erro: Cadastro divergente", "cliente_nao_encontrado", "Cadastro nao encontrado no CSV; registro minimo criado.", Object.assign({}, sale, { saleDate: d, csvMatches: [] }));
                                newPendings.push(pending);
                                
                                const minCust = {
                                    idPessoa: String(idPessoa),
                                    name: core.field(sale, "customer") || "Cliente " + idPessoa,
                                    phone: core.normalizePhone(core.field(sale, "phone")),
                                    document: null,
                                    status: "active",
                                    doguinhos: null,
                                    idLocalizacao: null
                                };
                                newCustomers.push(minCust);
                                snapshot.customers.push(minCust);
                            } else {
                                // Match found! Perform consistency validations
                                const cleanCPF = (r) => core.digits(core.field(r, "document"));
                                const cleanCEP = (r) => core.digits(core.field(r, "zip"));
                                const cleanNum = (r) => core.normalize(core.field(r, "number"));

                                const firstCPF = cleanCPF(csvMatches[0]);
                                const firstCEP = cleanCEP(csvMatches[0]);
                                const firstNum = cleanNum(csvMatches[0]);

                                let allCPFSame = true;
                                let allCEPSame = true;
                                let allNumSame = true;

                                for (let idx = 1; idx < csvMatches.length; idx++) {
                                    if (cleanCPF(csvMatches[idx]) !== firstCPF) allCPFSame = false;
                                    if (cleanCEP(csvMatches[idx]) !== firstCEP) allCEPSame = false;
                                    if (cleanNum(csvMatches[idx]) !== firstNum) allNumSame = false;
                                }

                                const isConsistent = allCPFSame && allCEPSame && allNumSame;
                                if (!isConsistent) {
                                    const msg = `Dados cadastrais divergentes no CSV para o tutor ${core.field(sale, "customer")}.` +
                                                (!allCPFSame ? " CPFs distintos encontrados." : "") +
                                                (!allCEPSame ? " CEPs distintos encontrados." : "") +
                                                (!allNumSame ? " Números distintos encontrados." : "");
                                    newPendings.push(pendingItem("Erro: Cadastro divergente", "cadastro_divergente", msg, Object.assign({}, sale, { saleDate: d, csvMatches: csvMatches })));
                                }

                                let missingCEP = !firstCEP;
                                let missingNum = !firstNum;

                                if (missingCEP) {
                                    newPendings.push(pendingItem("Erro: Cadastro divergente", "endereco_ausente", "CEP ausente no CSV; pin não gerado.", Object.assign({}, sale, { saleDate: d, csvMatches: csvMatches })));
                                } else if (missingNum) {
                                    newPendings.push(pendingItem("Erro: Cadastro divergente", "resultado_parcial", "Número do imóvel ausente no CSV.", Object.assign({}, sale, { saleDate: d, csvMatches: csvMatches })));
                                }

                                // Concat alive pets
                                const alivePets = [];
                                csvMatches.forEach(r => {
                                    const isAlive = core.normalize(r.Vivo || r.vivo) === "sim";
                                    const petName = core.field(r, "pet");
                                    if (isAlive && petName && !alivePets.includes(petName)) {
                                        alivePets.push(petName);
                                    }
                                });
                                const doguinhos = alivePets.join(", ") || null;

                                let idLocalizacao = null;
                                if (firstCEP && isConsistent) {
                                    // Check if combination already exists in c04_geocodes cache
                                    let existingGeo = snapshot.geocodes.find(g => core.digits(g.zip) === firstCEP && core.normalize(g.number) === firstNum);
                                    if (!existingGeo && !firstNum) {
                                        // If number is missing, check if we have any cached coordinate for this CEP to reuse
                                        existingGeo = snapshot.geocodes.find(g => core.digits(g.zip) === firstCEP);
                                    }
                                    if (existingGeo) {
                                        idLocalizacao = existingGeo.idLocalizacao;
                                    } else {
                                        // Geocode
                                        const geoStart = Date.now();
                                        const mockCustomer = {
                                            idPessoa: String(idPessoa),
                                            name: core.field(sale, "customer") || core.field(csvMatches[0], "customer"),
                                            phone: core.normalizePhone(core.field(sale, "phone")),
                                            document: core.field(csvMatches[0], "document") || null,
                                            status: core.field(csvMatches[0], "status") || "active",
                                            zip: firstCEP,
                                            number: firstNum,
                                            street: core.field(csvMatches[0], "address") || core.field(csvMatches[0], "rua") || "",
                                            neighborhood: core.field(csvMatches[0], "neighborhood") || "",
                                            city: core.field(csvMatches[0], "city") || core.field(csvMatches[0], "cidade") || "",
                                            state: core.field(csvMatches[0], "state") || core.field(csvMatches[0], "uf") || "",
                                            country: "Brasil"
                                        };
                                        const geoResult = await geocodeAddress(
                                            firstCEP,
                                            mockCustomer.street,
                                            firstNum,
                                            mockCustomer.neighborhood,
                                            mockCustomer.city,
                                            mockCustomer.state,
                                            mockCustomer
                                        );
                                        telemetry.geocodingMs += Date.now() - geoStart;

                                        if (geoResult.ok) {
                                            const savedGeo = await sheets.saveGeocode({
                                                zip: firstCEP,
                                                number: firstNum,
                                                lng: geoResult.lng,
                                                lat: geoResult.lat,
                                                street: geoResult.street,
                                                neighborhood: geoResult.neighborhood,
                                                city: geoResult.city,
                                                state: geoResult.state,
                                                country: geoResult.country
                                            });
                                            if (savedGeo) {
                                                idLocalizacao = savedGeo.idLocalizacao;
                                                snapshot.geocodes.push(savedGeo); // cache it
                                            }
                                        } else {
                                            const reason = geoResult.reason || "geocodificacao_falhou";
                                            let msg = geoResult.error || "Erro desconhecido na API do Google";
                                            if (reason === "fora_do_raio") {
                                                msg = `Endereço muito distante (${geoResult.distanceKm ? geoResult.distanceKm.toFixed(1) : 0} km).`;
                                            } else if (reason === "resultado_parcial") {
                                                msg = `Aproximação apenas (número não exato ou CEP divergente).`;
                                            } else if (reason === "estado_divergente") {
                                                msg = `Endereço fora do estado de São Paulo (SP).`;
                                            } else if (reason === "pais_divergente") {
                                                msg = `Endereço fora do Brasil.`;
                                            }
                                            const pendingRecord = Object.assign({}, sale, {
                                                saleDate: d,
                                                customer: Object.assign({}, mockCustomer, { pets: doguinhos }),
                                                formattedAddress: geoResult.formattedAddress || "não encontrado",
                                                distanceKm: geoResult.distanceKm
                                            });
                                            newPendings.push(pendingItem("Geocodificacao", reason, msg, pendingRecord));
                                        }
                                        // Throttle maps queries to respect API limits
                                        await new Promise(resolve => setTimeout(resolve, 80));
                                    }
                                }

                                const newCust = {
                                    idPessoa: String(idPessoa),
                                    name: core.field(sale, "customer") || core.field(csvMatches[0], "customer"),
                                    phone: core.normalizePhone(core.field(sale, "phone")),
                                    document: core.field(csvMatches[0], "document") || null,
                                    status: core.field(csvMatches[0], "status") || "active",
                                    doguinhos: doguinhos,
                                    idLocalizacao: idLocalizacao
                                };
                                newCustomers.push(newCust);
                                snapshot.customers.push(newCust);
                            }
                        }
                    }

                    // Save new customers and pendings for this day first to satisfy FK constraints
                    if (newCustomers.length > 0) {
                        await sheets.upsert({ customers: newCustomers });
                        newCustomers.length = 0;
                    }
                    if (newPendings.length > 0) {
                        allCreatedPendings.push(...newPendings);
                        await sheets.savePendings(newPendings);
                        newPendings.length = 0;
                    }

                    if (d !== todayStr) {
                        await sheets.saveDailySales(salesRowsToSave, [d]);
                    }
                }
            }

            const processingStart = Date.now();
            report("Consolidando dados do período", 32);

            // Save new customers and pendings
            if (newCustomers.length > 0) {
                await sheets.upsert({ customers: newCustomers });
            }
            if (newPendings.length > 0) {
                allCreatedPendings.push(...newPendings);
                await sheets.savePendings(newPendings);
            }

            // 6. Load all daily sales for the period from database cache
            const allDailySales = await sheets.getDailySales(syncStart, syncEnd);
            const combinedDailySales = allDailySales.concat(todaySalesRows);
            
            // Fetch fresh open pendings to exclude
            const allDbPendings = await sheets.pendings();
            const openPendingIds = new Set(allDbPendings.filter(p => p.status === "open").map(p => String(p.idPessoa)));

            // Group sales by idPessoa
            const clientSalesGroups = new Map();
            for (const sale of combinedDailySales) {
                const id = String(sale.idPessoa);
                if (!clientSalesGroups.has(id)) {
                    clientSalesGroups.set(id, []);
                }
                clientSalesGroups.get(id).push(sale);
            }

            // Compile periodCustomers (the search results!)
            const periodCustomers = [];
            let acceptedCount = 0;
            let rejectedCount = 0;

            for (const [idPessoa, sales] of clientSalesGroups.entries()) {
                // Check if this tutor has an open pending. If so, completely exclude from search results!
                if (openPendingIds.has(String(idPessoa))) {
                    rejectedCount++;
                    continue;
                }

                const customer = snapshot.customers.find(c => String(c.idPessoa) === String(idPessoa));
                if (!customer) {
                    rejectedCount++;
                    continue; // Should not happen but safety first
                }

                const geocode = customer.idLocalizacao ? snapshot.geocodes.find(g => Number(g.idLocalizacao) === Number(customer.idLocalizacao)) : null;

                const visits = sales.length; // PK is (id_cliente, data), so 1 row = 1 visit day
                const spend = sales.reduce((sum, r) => sum + (r.spend || 0), 0);
                const visitDates = sales.map(r => r.saleDate).filter(Boolean);
                const lastPurchase = sales.reduce((max, r) => !max || r.saleDate > max ? r.saleDate : max, "");

                if (visits === 0 && spend === 0) continue;

                acceptedCount++;
                periodCustomers.push({
                    idPessoa: customer.idPessoa,
                    name: customer.name,
                    phone: customer.phone,
                    document: customer.document,
                    status: customer.status,
                    doguinhos: customer.doguinhos,
                    zip: geocode ? geocode.zip : "",
                    number: geocode ? geocode.number : "",
                    street: geocode ? geocode.street : "",
                    neighborhood: geocode ? geocode.neighborhood : "",
                    city: geocode ? geocode.city : "",
                    state: geocode ? geocode.state : "",
                    country: geocode ? geocode.country : "",
                    lat: geocode ? Number(geocode.lat) : null,
                    lng: geocode ? Number(geocode.lng) : null,
                    visits: visits,
                    spend: spend,
                    ticket: visits ? spend / visits : 0.0,
                    lastPurchase: lastPurchase ? core.formatBrazilianDate(lastPurchase) : "",
                    visitDates: visitDates,
                    address: geocode ? `${geocode.street || ""}, ${geocode.number || ""}, ${geocode.neighborhood || ""}, ${geocode.city || ""} - ${geocode.zip || ""}` : ""
                });
            }

            telemetry.processingMs = Date.now() - processingStart;

            report("Sincronização concluída", 100);

            return {
                runId: run.runId,
                snapshot,
                persistentCustomers: snapshot.customers,
                periodCustomers: periodCustomers,
                pets: [], // Doguinhos are already inside periodCustomers
                pending: allCreatedPendings,
                counts: { pertinent: clientSalesGroups.size, accepted: acceptedCount, rejected: rejectedCount, minimal: allCreatedPendings.filter(p => p.reason === "cliente_nao_encontrado").length },
                changes: { existing: snapshot.customers.length - newCustomers.length, new: newCustomers.length, changed: 0 },
                sourceTotals: {
                    sales: totalExpected || clientSalesGroups.size,
                    pertinent: clientSalesGroups.size,
                    accepted: acceptedCount,
                    rejected: rejectedCount
                },
                telemetry: telemetry
            };
        } catch (error) {
            await sheets.finishRun({ runId: run.runId, status: token && token.cancelled ? "cancelled" : "error", error: error.message });
            throw error;
        }
    }
    root.C04GeoData = { tableRecords, collectAllTable, collectSales, collectCustomersCsv, isPackageProduct, commercialMetrics,
        indexCsv, csvRowsForSale, matchCsvSale, buildRelevantCustomers, preflight, sync, getAjaxDetails, fetchProductDetails };
})(window);