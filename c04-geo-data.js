(function (root) {
    "use strict";
    const SALES = { url: "relcliente.php", button: "#buttonbuscarRelatorioCliente", table: "#idTabelaVenda",
        start: "#dataInicio", end: "#dataFim", products: "#idTabelaProdutis" };
    function cancelled(token) {
        if (token && token.cancelled) throw new Error("Sincronizacao cancelada.");
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
        return parts.join("").trim();
    }
    function tableRecords(table) {
        const headers = Array.from(table.querySelectorAll("thead th")).map(cell => cell.textContent.trim());
        return Array.from(table.querySelectorAll("tbody tr")).map(row => {
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
            }, 250);
        });
    }
    function waitForReplacement(frame, selector, previous, timeoutMs, token) {
        return new Promise((resolve, reject) => {
            const started = Date.now(), timer = setInterval(() => {
                try { cancelled(token); } catch (error) { clearInterval(timer); reject(error); return; }
                const found = frame.contentDocument && frame.contentDocument.querySelector(selector);
                if (found && found !== previous) { clearInterval(timer); resolve(found); }
                else if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error(`Tempo excedido ao atualizar ${selector}`)); }
            }, 250);
        });
    }
    async function waitStable(doc, table, token) {
        let previous = "", stable = 0;
        for (let attempt = 0; attempt < 50; attempt += 1) {
            cancelled(token);
            const current = `${table.querySelectorAll("tbody tr").length}|${doc.querySelector(`#${table.id}_info`)?.textContent || ""}`;
            stable = current === previous ? stable + 1 : 0;
            if (stable >= 2) return;
            previous = current; await delay(150, token);
        }
    }
    function dataTableApi(frame, table) {
        const jq = frame.contentWindow.jQuery || frame.contentWindow.$;
        if (!jq || !jq.fn || !jq.fn.dataTable) return null;
        try { return jq(table).DataTable(); } catch (_) { return null; }
    }
    async function collectAllTable(frame, table, token) {
        const doc = frame.contentDocument, expected = infoTotal(doc, table), api = dataTableApi(frame, table);
        if (!api) {
            const rows = tableRecords(table);
            if (rows.length !== expected) throw new Error(`Coleta parcial em ${table.id}: ${rows.length} de ${expected}.`);
            return { rows, expected, mode: "visible" };
        }
        try {
            api.page.len(-1).draw(); await waitStable(doc, table, token);
            const all = tableRecords(table);
            if (all.length === expected) return { rows: all, expected, mode: "all" };
        } catch (_) { /* fallback paginado */ }
        api.page.len(100).draw(); await waitStable(doc, table, token);
        const rows = [], pages = Math.max(1, Math.ceil(expected / 100));
        for (let page = 0; page < pages; page += 1) {
            cancelled(token); api.page(page).draw(false); await waitStable(doc, table, token); rows.push(...tableRecords(table));
        }
        if (rows.length !== expected) throw new Error(`Coleta parcial em ${table.id}: ${rows.length} de ${expected}.`);
        return { rows, expected, mode: "pages" };
    }
    async function openSales(period, token) {
        const frame = await iframe(SALES.url, token), doc = frame.contentDocument;
        doc.querySelector(SALES.start).value = period.start; doc.querySelector(SALES.end).value = period.end;
        doc.querySelector(SALES.button).click();
        const table = await waitFor(frame, SALES.table, 30000, token); await waitStable(doc, table, token);
        return { frame, table };
    }
    function isPackageProduct(name) {
        return /(^|\s)pacote(\s|$)/.test(root.C04GeoCore.normalize(name));
    }
    function commercialMetrics(sale, products) {
        const core = root.C04GeoCore, visits = Number.parseInt(core.field(sale, "purchases"), 10) || 0;
        const spend = products.filter(item => !isPackageProduct(core.field(item, "customer") || item.Produto || item.produto))
            .reduce((total, item) => total + core.parseMoney(core.field(item, "spend")), 0);
        return { visits, spend, ticket: visits ? spend / visits : 0, intervalDays: core.parseFrequencyDays(core.field(sale, "frequency")),
            lastPurchase: core.field(sale, "date"), reportedSpend: core.parseMoney(core.field(sale, "spend")) };
    }
    async function collectSales(period, token, progress) {
        const opened = await openSales(period, token), frame = opened.frame, doc = frame.contentDocument;
        try {
            const sales = await collectAllTable(frame, opened.table, token), active = sales.rows.filter(row => root.C04GeoCore.field(row, "id"));
            const details = new Map();
            for (let index = 0; index < active.length; index += 1) {
                cancelled(token);
                const row = active[index], idPessoa = root.C04GeoCore.field(row, "id");
                const previous = doc.querySelector(SALES.products);
                frame.contentWindow.detalhesProdutoCliente(idPessoa);
                const table = previous ? await waitForReplacement(frame, SALES.products, previous, 30000, token) :
                    await waitFor(frame, SALES.products, 30000, token);
                await waitStable(doc, table, token);
                const products = await collectAllTable(frame, table, token);
                details.set(String(idPessoa), products.rows);
                if (progress) progress(index + 1, active.length);
            }
            return { rows: active, details, expected: sales.expected, mode: sales.mode };
        } finally { frame.remove(); }
    }
    async function collectCustomersCsv(token) {
        const frame = await iframe("cliente.php", token);
        try {
            const form = Array.from(frame.contentDocument.forms).find(item => /PessoaR001/i.test(item.action));
            if (!form) throw new Error("Formulario de exportacao CSV nao encontrado.");
            const response = await frame.contentWindow.fetch(form.action, { method: form.method || "POST", credentials: "include",
                body: new frame.contentWindow.FormData(form) });
            const text = await response.text();
            if (!response.ok || /^\s*</.test(text)) throw new Error("A exportacao de clientes nao retornou CSV.");
            return text;
        } finally { frame.remove(); }
    }
    function customerSignature(row) {
        const core = root.C04GeoCore;
        return [core.field(row, "document"), core.field(row, "address"), core.field(row, "number"), core.field(row, "zip"),
            core.field(row, "complement"), core.field(row, "neighborhood"), core.field(row, "city"), core.field(row, "state")]
            .map(core.normalize).join("|");
    }
    function indexCsv(rows) {
        const core = root.C04GeoCore, result = { identity: new Map(), noPhoneByName: new Map(), ambiguousNoPhone: new Set() };
        const add = (map, key, row) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
        rows.forEach(row => {
            const name = core.normalizePersonName(core.field(row, "customer")), phone = core.normalizePhone(core.field(row, "phone"));
            if (name && phone) add(result.identity, `${name}|${phone}`, row);
            if (name && !phone) add(result.noPhoneByName, name, row);
        });
        result.noPhoneByName.forEach((matches, name) => {
            const signatures = new Set(matches.map(customerSignature));
            if (signatures.size > 1 || (matches.length > 1 && signatures.has("|||||||"))) result.ambiguousNoPhone.add(name);
        });
        return result;
    }
    function matchCsvSale(sale, indexes) {
        const core = root.C04GeoCore, name = core.normalizePersonName(core.field(sale, "customer"));
        const phone = core.normalizePhone(core.field(sale, "phone"));
        if (!name) return { rows: [], reason: "cliente_nao_encontrado", mode: "missing_name" };
        if (phone) return { rows: indexes.identity.get(`${name}|${phone}`) || [], reason: "cliente_nao_encontrado", mode: "name_phone" };
        if (indexes.ambiguousNoPhone.has(name)) return { rows: [], reason: "nome_duplicado", mode: "ambiguous_no_phone" };
        return { rows: indexes.noPhoneByName.get(name) || [], reason: "cliente_nao_encontrado", mode: "unique_no_phone" };
    }
    function csvRowsForSale(sale, indexes) {
        return matchCsvSale(sale, indexes).rows;
    }
    function pendingItem(source, reason, message, record) {
        const core = root.C04GeoCore;
        return { pendingId: core.hash(`${source}|${reason}|${core.field(record, "id")}|${message}`), source, reason, message,
            idPessoa: core.field(record, "id"), customerName: core.field(record, "customer"), status: "open" };
    }
    function persistentCustomer(idPessoa, sale, csvRows) {
        const core = root.C04GeoCore, first = csvRows[0] || {};
        const customer = { key: `id:${idPessoa}`, idPessoa: String(idPessoa), name: core.field(first, "customer") || core.field(sale, "customer"),
            document: core.field(first, "document"), phone: core.normalizePhone(core.field(first, "phone") || core.field(sale, "phone")),
            status: core.field(first, "status"), units: core.field(first, "unit"), country: core.field(first, "country") || "Brasil",
            state: core.field(first, "state"), city: core.field(first, "city"), zip: core.field(first, "zip"),
            street: core.field(first, "address"), number: core.field(first, "number"), complement: core.field(first, "complement"),
            neighborhood: core.field(first, "neighborhood") };
        customer.address = core.addressOf(first);
        customer.addressHash = core.hash(`${customer.zip}|${customer.street}|${customer.number}|${customer.complement}|${customer.city}|${customer.state}`);
        customer.hash = core.hash(JSON.stringify(customer));
        return customer;
    }
    function applyOverride(customer, overrides) {
        const override = (overrides || []).find(item => String(item.idPessoa) === String(customer.idPessoa) && item.status !== "inactive");
        if (!override) return customer;
        const updated = Object.assign({}, customer);
        if (override.correctedAddress) {
            updated.address = override.correctedAddress;
            updated.addressHash = root.C04GeoCore.hash(`${override.correctedAddress}|${updated.zip || ""}`);
        }
        updated.retryGeocode = override.retryGeocode === true || override.retryGeocode === "true";
        return updated;
    }
    function buildRelevantCustomers(sales, details, csvRows, overrides) {
        const core = root.C04GeoCore, indexes = indexCsv(csvRows), persistent = [], periodCustomers = [], pets = [], pending = [];
        const counts = { pertinent: sales.length, accepted: 0, rejected: 0, minimal: 0 };
        sales.forEach(sale => {
            const idPessoa = core.field(sale, "id"), match = matchCsvSale(sale, indexes), matches = match.rows;
            if (!idPessoa) {
                counts.rejected += 1; pending.push(pendingItem("Clientes", "identificador_invalido", "Cliente pertinente sem idPessoa.", sale)); return;
            }
            if (!matches.length) {
                pending.push(pendingItem("Clientes", match.reason, match.reason === "nome_duplicado" ?
                    "Tutor sem telefone possui cadastros divergentes no CSV; registro minimo criado." :
                    "Cadastro nao encontrado no CSV; registro minimo criado.", sale));
                counts.minimal += 1;
            }
            const customer = applyOverride(persistentCustomer(idPessoa, sale, matches), overrides);
            const metrics = commercialMetrics(sale, details.get(String(idPessoa)) || []);
            if (core.normalize(customer.status) === "inativa") {
                counts.rejected += 1; pending.push(pendingItem("Clientes", "cliente_inativo", "Cliente explicitamente inativo no CSV.", sale)); return;
            }
            counts.accepted += 1;
            persistent.push(customer);
            if (!customer.address) pending.push(pendingItem("Geocodificacao", "endereco_ausente", "Endereco ou CEP insuficiente no CSV.", sale));
            matches.forEach(row => {
                const pet = core.field(row, "pet");
                if (pet && !pets.some(item => item.idPessoa === String(idPessoa) && item.name === pet))
                    pets.push({ key: `pet:${idPessoa}:${core.hash(pet)}`, idPessoa: String(idPessoa), name: pet });
            });
            if (metrics.visits > 0 || metrics.spend > 0) periodCustomers.push(Object.assign({}, customer, metrics));
        });
        if (counts.pertinent !== counts.accepted + counts.rejected) throw new Error("Contabilizacao de clientes pertinentes inconsistente.");
        return { persistentCustomers: persistent, periodCustomers, pets, pending, counts };
    }
    function compareCustomers(customers, existing) {
        const old = new Map((existing || []).map(item => [String(item.idPessoa), item])), counters = { existing: 0, new: 0, changed: 0 };
        customers.forEach(item => {
            const previous = old.get(String(item.idPessoa));
            if (!previous) counters.new += 1; else if (previous.hash !== item.hash) counters.changed += 1; else counters.existing += 1;
        });
        return counters;
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
        const core = root.C04GeoCore, sheets = root.C04GeoSheets, snapshot = await sheets.snapshot();
        const run = await sheets.startRun({ type: force ? "full" : "sync", period, visibleUser: core.visibleUser(document) });
        const report = (stage, percent, counters) => progress(Object.assign({ stage, percent }, counters || {}));
        try {
            report("Coletando relcliente.php", 5);
            const sales = await collectSales(period, token, (done, total) => report("Coletando detalhes comerciais", 5 + Math.round(22 * done / total),
                { collected: done, sourceTotal: total }));
            cancelled(token); report("Baixando CSV de clientes", 30, { collected: sales.rows.length });
            const built = buildRelevantCustomers(sales.rows, sales.details, core.parseCsv(await collectCustomersCsv(token)), snapshot.overrides || []);
            const changes = compareCustomers(built.persistentCustomers, snapshot.customers);
            report("Validando clientes pertinentes", 38, Object.assign({ collected: built.periodCustomers.length, pending: built.pending.length }, changes));
            return { runId: run.runId, snapshot, persistentCustomers: built.persistentCustomers, periodCustomers: built.periodCustomers,
                pets: built.pets, pending: built.pending, counts: built.counts, changes,
                sourceTotals: { sales: sales.expected, pertinent: sales.rows.length, accepted: built.counts.accepted, rejected: built.counts.rejected } };
        } catch (error) {
            await sheets.finishRun({ runId: run.runId, status: token && token.cancelled ? "cancelled" : "error", error: error.message });
            throw error;
        }
    }
    root.C04GeoData = { tableRecords, collectAllTable, collectSales, collectCustomersCsv, isPackageProduct, commercialMetrics,
        indexCsv, csvRowsForSale, matchCsvSale, buildRelevantCustomers, compareCustomers, preflight, sync };
})(window);
