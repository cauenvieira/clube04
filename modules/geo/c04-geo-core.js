(function (root, factory) {
    "use strict";
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.C04GeoCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    const ALIASES = {
        id: ["idpessoa", "id pessoa", "id", "codigo", "cod"], customer: ["cliente", "nome cliente", "nome do cliente", "tutor", "nome", "pessoa"],
        pet: ["pet", "pets", "nome pet", "nome do pet", "doguinho", "animal", "animais"], document: ["documento", "cpf", "cpf cnpj"],
        status: ["status", "situacao"], unit: ["unidade", "unidades"],
        address: ["endereco", "logradouro", "rua"], number: ["numero", "numero endereco"], complement: ["complemento"],
        neighborhood: ["bairro"], city: ["cidade", "municipio"], state: ["uf", "estado"], zip: ["cep"],
        phone: ["telefone", "telefones", "celular", "contato", "contatos"], date: ["data", "ultima visita", "ultima compra"],
        spend: ["valor gasto", "valor", "total"], purchases: ["num compras", "numero compras", "compras"],
        ticket: ["ticket medio", "ticket"], frequency: ["freq compras", "frequencia", "frequencia compras"],
        totalVisits: ["total de visitas", "visitas"], country: ["pais"]
    };
    function normalize(value) {
        return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ").trim().toLowerCase();
    }
    function normalizeHeader(value) {
        return normalize(value).replace(/[.:#_*()-]/g, " ").replace(/\s+/g, " ").trim();
    }
    function parseMoney(value) {
        const clean = String(value == null ? "" : value).replace(/[^\d,.-]/g, "");
        if (!clean) return 0;
        const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
        return Number.parseFloat(normalized) || 0;
    }
    function parseDate(value) {
        const text = String(value == null ? "" : value).trim();
        let match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
        match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
        return null;
    }
    function csvRows(text, delimiter) {
        const rows = []; let row = [], cell = "", quoted = false;
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            if (ch === '"') {
                if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
            } else if (ch === delimiter && !quoted) { row.push(cell); cell = ""; }
            else if ((ch === "\n" || ch === "\r") && !quoted) {
                if (ch === "\r" && text[i + 1] === "\n") i += 1;
                row.push(cell); cell = ""; if (row.some((item) => item.trim())) rows.push(row); row = [];
            } else cell += ch;
        }
        row.push(cell); if (row.some((item) => item.trim())) rows.push(row); return rows;
    }
    function parseCsv(text) {
        const source = String(text || "").replace(/^\uFEFF/, "");
        const first = source.split(/\r?\n/, 1)[0] || "";
        const delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
        const rows = csvRows(source, delimiter); if (rows.length < 2) return [];
        const headers = rows[0].map(normalizeHeader);
        return rows.slice(1).map((values) => Object.fromEntries(headers.map((key, i) => [key, (values[i] || "").trim()])));
    }
    function formatZip(value) {
        if (!value) return "";
        const raw = String(value).replace(/\D/g, "");
        let padded = raw;
        if (padded.length === 7) padded = "0" + padded;
        if (padded.length === 8) {
            return padded.slice(0, 5) + "-" + padded.slice(5);
        }
        return value;
    }
    function field(record, aliasKey) {
        const keys = Object.keys(record || {}), aliases = ALIASES[aliasKey] || [aliasKey];
        for (const alias of aliases) {
            const wanted = normalizeHeader(alias);
            const key = keys.find((item) => normalizeHeader(item) === wanted);
            if (key && String(record[key] || "").trim()) {
                const val = record[key];
                if (aliasKey === "zip") return formatZip(val);
                return val;
            }
        }
        return "";
    }
    function customerKey(record) {
        const id = field(record, "id");
        if (id) return `id:${normalize(id)}`;
        return "";
    }
    function digits(value) { return String(value || "").replace(/\D/g, ""); }
    function normalizePhone(value) {
        const text = String(value || ""), separator = text.lastIndexOf("- ");
        return digits(separator >= 0 ? text.slice(separator + 2) : text);
    }
    function normalizePersonName(value) { return normalize(value).replace(/^[^a-z0-9]+/, "").trim(); }
    function isActiveMogi(record) {
        return normalize(field(record, "status")) === "ativa" && normalize(field(record, "unit")).includes("mogi das cruzes");
    }
    function hasMinimumAddress(record) {
        return Boolean(field(record, "address") && (field(record, "number") || field(record, "zip")) && field(record, "city"));
    }
    function extractPessoaId(value) {
        const match = String(value || "").match(/(?:redirecionarPessoaEditar|detalhesProdutoCliente|detalhesCategoriaCliente)\s*\(\s*['"](\d+)['"]/i);
        return match ? match[1] : "";
    }
    function visibleUser(documentRef) {
        const node = documentRef && documentRef.querySelector(".user-info h6");
        return node ? String(node.textContent || "").trim() : "";
    }
    function canRunFullScan(name) {
        return normalize(name) === "caue";
    }
    function addressOf(record) {
        return [field(record, "address"), field(record, "number"), field(record, "complement"),
            field(record, "neighborhood"), field(record, "city"), field(record, "state"), field(record, "zip")]
            .map((item) => String(item || "").trim()).filter(Boolean).join(", ");
    }
    function parseFrequencyDays(value) {
        const match = String(value == null ? "" : value).match(/(\d+(?:[.,]\d+)?)/);
        return match ? Number(match[1].replace(",", ".")) : null;
    }
    function averageIntervalDays(dates) {
        const sorted = dates.map(parseDate).filter(Boolean).sort((a, b) => a - b);
        if (sorted.length < 2) return null;
        let total = 0;
        for (let i = 1; i < sorted.length; i += 1) total += (sorted[i] - sorted[i - 1]) / 86400000;
        return total / (sorted.length - 1);
    }
    function recurrence(interval, limits) {
        limits = limits || { excellent: 7, good: 15, improve: 30 };
        if (interval == null) return { label: "Dados insuficientes", score: 0 };
        const anchors = [[0, 100], [limits.excellent, 85], [limits.good, 60], [limits.improve, 25], [Math.max(60, limits.improve * 2), 0]];
        let score = 0;
        for (let i = 1; i < anchors.length; i += 1) {
            if (interval <= anchors[i][0]) {
                const previous = anchors[i - 1], current = anchors[i], ratio = (interval - previous[0]) / (current[0] - previous[0]);
                score = Math.round(previous[1] + ratio * (current[1] - previous[1])); break;
            }
        }
        const label = interval <= limits.excellent ? "Excelente" : interval <= limits.good ? "Bom" :
            interval <= limits.improve ? "Precisa melhorar" : "Ruim";
        return { label, score: Math.max(0, Math.min(100, score)) };
    }
    function percentileRanks(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        return values.map((value) => sorted.length <= 1 ? 100 : Math.round(100 * sorted.lastIndexOf(value) / (sorted.length - 1)));
    }
    function scoreCustomers(customers, weights, ticketReference, limits) {
        const totalWeight = weights.recurrence + weights.ticket || 100;
        return customers.map((item) => {
            const interval = Number.isFinite(item.intervalDays) ? item.intervalDays : averageIntervalDays(item.visitDates || []);
            const singleVisit = Number(item.visits) === 1;
            const recurrenceInfo = singleVisit ? { label: "Primeira visita", score: 0 } : recurrence(interval, limits);
            const ticketScore = Math.min(100, Math.round(100 * (item.ticket || 0) / ticketReference));
            const components = { recurrence: recurrenceInfo.score, ticket: ticketScore };
            const denominator = singleVisit ? weights.ticket || 1 : totalWeight;
            const score = Math.round((components.recurrence * (singleVisit ? 0 : weights.recurrence) +
                components.ticket * weights.ticket) / denominator);
            return Object.assign({}, item, { intervalDays: interval, recurrence: recurrenceInfo, components, score,
                scoreConfidence: singleVisit ? "low" : "normal" });
        });
    }
    function inRange(value, range) {
        if (value == null || value === "") return range && range.includeMissing === true;
        const number = Number(value);
        if (!Number.isFinite(number)) return range && range.includeMissing === true;
        return (!Number.isFinite(range && range.min) || number >= range.min) &&
            (!Number.isFinite(range && range.max) || number <= range.max);
    }
    function filterCustomers(customers, filters) {
        filters = filters || {};
        return customers.filter(item => (!filters.excludeSingleVisit || Number(item.visits) !== 1) &&
            inRange(item.intervalDays, Object.assign({}, filters.frequency || {}, {
                includeMissing: !Number.isFinite(filters.frequency && filters.frequency.min) &&
                    !Number.isFinite(filters.frequency && filters.frequency.max)
            })) && inRange(item.ticket, filters.ticket || {}) &&
            inRange(item.score, filters.score || {}));
    }
    function hash(value) {
        let result = 2166136261, text = String(value || "");
        for (let i = 0; i < text.length; i += 1) result = Math.imul(result ^ text.charCodeAt(i), 16777619);
        return `h:${(result >>> 0).toString(16)}`;
    }
    function defaultPeriod(today, months) {
        const end = new Date(today); end.setHours(12, 0, 0, 0);
        const start = new Date(end); start.setMonth(start.getMonth() - months);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }
    function selectionSummary(customers) {
        const count = customers.length;
        const sum = (key) => customers.reduce((total, item) => total + (Number(item[key]) || 0), 0);
        const frequencies = customers.map(item => Number(item.intervalDays)).filter(Number.isFinite).sort((a, b) => a - b);
        const frequencyAverage = frequencies.length ? frequencies.reduce((total, value) => total + value, 0) / frequencies.length : 0;
        const middle = Math.floor(frequencies.length / 2);
        const frequencyMedian = frequencies.length ? (frequencies.length % 2 ? frequencies[middle] :
            (frequencies[middle - 1] + frequencies[middle]) / 2) : 0;
        const visits = sum("visits"), spend = sum("spend");
        const recurrenceCounts = customers.reduce((result, item) => {
            const label = item.recurrence ? item.recurrence.label : "Dados insuficientes";
            result[label] = (result[label] || 0) + 1; return result;
        }, {});
        return { count, visits, spend, averageTicket: visits ? spend / visits : 0,
            averageScore: count ? sum("score") / count : 0, frequencyAverage, frequencyMedian, recurrenceCounts };
    }
    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, character =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    }
    function toCsv(customers) {
        const headers = ["Cliente", "Telefone", "Endereco", "Bairro", "Visitas", "Gasto", "Ticket Medio", "Score", "Recorrencia"];
        const quote = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
        return [headers.map(quote).join(";")].concat(customers.map((item) => [
            item.name, item.phone, item.address, item.neighborhood, item.visits, item.spend, item.ticket, item.score,
            item.recurrence ? item.recurrence.label : ""
        ].map(quote).join(";"))).join("\r\n");
    }
    return { normalize, normalizeHeader, parseMoney, parseDate, parseCsv, field, customerKey, extractPessoaId,
        visibleUser, canRunFullScan, addressOf, parseFrequencyDays, digits, normalizePhone, normalizePersonName, isActiveMogi, hasMinimumAddress,
        averageIntervalDays, recurrence, percentileRanks, scoreCustomers, filterCustomers, hash, defaultPeriod, selectionSummary, escapeHtml, toCsv, formatZip };
});
