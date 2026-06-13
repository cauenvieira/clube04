"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../modules/geo/c04-geo-core.js");
test("parse CSV with quoted delimiters and normalized headers", () => {
    const rows = core.parseCsv('Cliente;Endereco;Valor Gasto\n"Ana";"Rua A, 10";"R$ 240,00"\n');
    assert.equal(rows.length, 1);
    assert.equal(core.field(rows[0], "customer"), "Ana");
    assert.equal(core.parseMoney(core.field(rows[0], "spend")), 240);
});

test("uses exact aliases and never confuses city or pet fields", () => {
    const row = { cidade: "Mogi das Cruzes", animal: "Luke", nascimento: "2020", rua: "Rua A", numero: "12" };
    assert.equal(core.field(row, "id"), "");
    assert.equal(core.field(row, "number"), "12");
    assert.equal(core.field(row, "address"), "Rua A");
});

test("recognizes the plural phone header used by cliente CSV", () => {
    assert.equal(core.field({ telefones: "(11) 99999-9999" }, "phone"), "(11) 99999-9999");
});

test("normalizes the phone portion after the description separator", () => {
    assert.equal(core.normalizePhone("Celular Pessoal - (11)97108-6597"), "11971086597");
    assert.equal(core.normalizePhone("- (11)99537-4934"), "11995374934");
    assert.equal(core.normalizePhone("Contato APP - 11916228220"), "11916228220");
    assert.equal(core.normalizePhone("11998244942"), "11998244942");
    assert.equal(core.normalizePhone("sem contato"), "");
});

test("filters active customers linked to Mogi", () => {
    assert.equal(core.isActiveMogi({ Status: "Ativa", Unidade: "Ribeirao Preto | Mogi das Cruzes" }), true);
    assert.equal(core.isActiveMogi({ Status: "Inativa", Unidade: "Mogi das Cruzes" }), false);
    assert.equal(core.isActiveMogi({ Status: "Ativa", Unidade: "Sao Paulo" }), false);
});

test("prefixes hashes so Sheets keeps identifiers as text", () => {
    assert.match(core.hash("123"), /^h:[0-9a-f]+$/);
});

test("classifies recurrence limits", () => {
    assert.equal(core.recurrence(7).label, "Excelente");
    assert.equal(core.recurrence(8).label, "Bom");
    assert.equal(core.recurrence(14).label, "Bom");
    assert.equal(core.recurrence(15).label, "Baixo");
    assert.equal(core.recurrence(21).label, "Baixo");
    assert.equal(core.recurrence(22).label, "Ruim");
    assert.equal(core.recurrence(null).label, "Dados insuficientes");
});

test("computes interval and weighted score using ticket reference", () => {
    const customers = core.scoreCustomers([
        { visitDates: ["01/01/2026", "08/01/2026"], visits: 2, ticket: 240, spend: 100 },
        { visitDates: ["01/01/2026"], visits: 1, ticket: 120, spend: 200 }
    ], { recurrence: 60, ticket: 40 }, 240);
    assert.equal(customers[0].intervalDays, 7);
    assert.equal(customers[0].components.ticket, 100);
    assert.equal(customers[1].components.recurrence, 0);
    assert.equal(customers[1].score, 50);
    assert.equal(customers[1].recurrence.label, "Única visita no período");
    assert.equal(customers[1].scoreConfidence, "low");
});

test("default period starts four months before today", () => {
    assert.deepEqual(core.defaultPeriod(new Date("2026-06-11T12:00:00"), 4), { start: "2026-02-11", end: "2026-06-11" });
});

test("supports configurable recurrence limits", () => {
    assert.equal(core.recurrence(10, { excellent: 10, good: 20, low: 40, bad: 60 }).label, "Excelente");
    assert.equal(core.recurrence(35, { excellent: 10, good: 20, low: 40, bad: 60 }).label, "Baixo");
});

test("parses recurrence frequency supplied by relcliente", () => {
    assert.equal(core.parseFrequencyDays("18 dias"), 18);
    assert.equal(core.parseFrequencyDays("7,5 dias"), 7.5);
    assert.equal(core.parseFrequencyDays(""), null);
});

test("scores using the period frequency when visit dates are not persisted", () => {
    const rows = core.scoreCustomers([{ intervalDays: 7, visits: 2, ticket: 240, spend: 100 }],
        { recurrence: 60, ticket: 40 }, 240);
    assert.equal(rows[0].components.recurrence, 85);
});

test("uses a continuous recurrence curve", () => {
    assert.ok(core.recurrence(4).score > core.recurrence(7).score);
    assert.ok(core.recurrence(7).score > core.recurrence(15).score);
    assert.equal(core.recurrence(60).score, 0);
});

test("filters customers by frequency ticket score and first visit", () => {
    const rows = [{ idPessoa: "1", visits: 1, intervalDays: 8, ticket: 200, score: 70 },
        { idPessoa: "2", visits: 3, intervalDays: 16, ticket: 300, score: 80 }];
    assert.deepEqual(core.filterCustomers(rows, { frequency: { max: 15 }, ticket: {}, score: {} }).map(item => item.idPessoa), ["1"]);
    assert.deepEqual(core.filterCustomers(rows, { frequency: {}, ticket: { min: 250 }, score: {}, excludeSingleVisit: true })
        .map(item => item.idPessoa), ["2"]);
    assert.deepEqual(core.filterCustomers([{ idPessoa: "3", intervalDays: null, ticket: 300, score: 80 }],
        { frequency: { min: 0, max: 15 }, ticket: {}, score: {} }), []);
});

test("summarizes and exports a regional selection", () => {
    const rows = [{ name: "Ana", phone: "1", address: "Rua A", neighborhood: "Centro", visits: 3, spend: 500, ticket: 250,
        score: 80, recurrence: { label: "Excelente" } }];
    assert.deepEqual(core.selectionSummary(rows), { count: 1, visits: 3, spend: 500, averageTicket: 500 / 3, averageScore: 80,
        frequencyAverage: 0, frequencyMedian: 0,
        recurrenceCounts: { Excelente: 1 } });
    assert.match(core.toCsv(rows), /"Ana";"1";"Rua A"/);
});

test("summarizes regional selection excluding single-visit customers from frequency statistics", () => {
    const rows = [
        { name: "Ana", visits: 3, intervalDays: 10, spend: 500, ticket: 250, score: 80, recurrence: { label: "Excelente" } },
        { name: "Beto", visits: 1, intervalDays: 30, spend: 100, ticket: 100, score: 40, recurrence: { label: "Única visita no período" } }
    ];
    const summary = core.selectionSummary(rows);
    assert.equal(summary.count, 2);
    // Beto should be excluded from frequencies because visits < 2
    assert.equal(summary.frequencyAverage, 10);
    assert.equal(summary.frequencyMedian, 10);
});

test("formats date strings into Brazilian format properly", () => {
    assert.equal(core.formatBrazilianDate("2026-06-13 16:40:06"), "13/06/2026 16:40:06");
    assert.equal(core.formatBrazilianDate("2026-06-13"), "13/06/2026");
    assert.equal(core.formatBrazilianDate("13/06/2026 16:40:06"), "13/06/2026 16:40:06");
    assert.equal(core.formatBrazilianDate("2026-06-03 18:42:0103/06/202618:42:01"), "03/06/2026 18:42:01");
    assert.equal(core.formatBrazilianDate(""), "");
    assert.equal(core.formatBrazilianDate(null), "");
});

test("summarizes regional selection including single-visit customer if interval to end date is >= 45 days", () => {
    const rows = [
        { name: "Ana", visits: 3, intervalDays: 10, spend: 500, ticket: 250, score: 80, recurrence: { label: "Excelente" } },
        { name: "Beto", visits: 1, lastPurchase: "2026-04-01", spend: 100, ticket: 100, score: 40, recurrence: { label: "Única visita no período" } }, // 50 days to 2026-05-21
        { name: "Carlos", visits: 1, lastPurchase: "2026-05-10", spend: 100, ticket: 100, score: 40, recurrence: { label: "Única visita no período" } } // 11 days to 2026-05-21
    ];
    const summary = core.selectionSummary(rows, "2026-05-21");
    // Ana has 10 days frequency
    // Beto has 50 days frequency (>= 45 days, so included)
    // Carlos has 11 days frequency (< 45 days, so excluded)
    // Included frequencies: [10, 50]
    // Average: 30, Median: 30
    assert.equal(summary.count, 3);
    assert.equal(summary.frequencyAverage, 30);
    assert.equal(summary.frequencyMedian, 30);
});

test("extracts idPessoa and requires it as the customer key", () => {
    assert.equal(core.extractPessoaId("redirecionarPessoaEditar('26888', '2')"), "26888");
    assert.equal(core.customerKey({ idPessoa: "26888", Nome: "Yago" }), "id:26888");
    assert.equal(core.customerKey({ Nome: "Yago", Telefone: "11999999999" }), "");
});

test("protects full scan using the normalized visible user name", () => {
    assert.equal(core.canRunFullScan("Cau\u00ea"), true);
    assert.equal(core.canRunFullScan(" caue "), true);
    assert.equal(core.canRunFullScan("Outro usuario"), false);
    assert.equal(core.canRunFullScan(""), false);
});

test("normalizes CEPs to xxxxx-xxx and pads 7-digit ones with 0", () => {
    assert.equal(core.formatZip("8700000"), "08700-000");
    assert.equal(core.formatZip("08700000"), "08700-000");
    assert.equal(core.formatZip("08700-000"), "08700-000");
    assert.equal(core.formatZip("abc"), "abc");
    assert.equal(core.formatZip(""), "");
});
