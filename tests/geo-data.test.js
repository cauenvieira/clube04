"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../c04-geo-core.js");

function dataApi() {
    const context = { window: { C04GeoCore: core }, console, setTimeout, clearTimeout, setInterval, clearInterval, URL };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "c04-geo-data.js"), "utf8"), context);
    return context.window.C04GeoData;
}

function fakeCell(text, childNodes, onclick) {
    return {
        textContent: text, childNodes: childNodes || [{ nodeType: 3, textContent: text }],
        getAttribute: name => name === "onclick" ? onclick || null : null,
        querySelector: () => null
    };
}

test("extracts only tutor from relcliente and ignores report pets", () => {
    const data = dataApi(), headers = ["Cliente", "Contato", "Opcoes"].map(text => fakeCell(text));
    const customer = fakeCell("Amanda Fernandes do Espirto Santomaju/Itachi", [
        { nodeType: 3, textContent: "Amanda Fernandes do Espirto Santo" },
        { nodeType: 1, tagName: "BR", textContent: "" },
        { nodeType: 1, tagName: "B", textContent: "maju/Itachi" }
    ]);
    const cells = [customer, fakeCell(" - (11)97560-5073"), fakeCell("", null, "detalhesProdutoCliente('19312')")];
    const table = {
        id: "idTabelaVenda",
        querySelectorAll: selector => selector === "thead th" ? headers : selector === "tbody tr" ?
            [{ querySelectorAll: inner => inner === "td" ? cells : [] }] : []
    };
    const rows = data.tableRecords(table);
    assert.equal(rows[0].Cliente, "Amanda Fernandes do Espirto Santo");
    assert.equal(rows[0].Cliente.includes("maju"), false);
    assert.equal(rows[0].idPessoa, "19312");
});

test("uses relcliente ids to filter and enrich only pertinent CSV rows", () => {
    const data = dataApi(), sales = [{ idPessoa: "10", Cliente: "Ana", Contato: "11999990000",
        "Num. Compras": "2", "Freq. Compras": "15 dias" }];
    const csv = [
        { idpessoa: "10", cliente: "Ana", documento: "11122233344", contato: "11999990000", pet: "Lua",
            rua: "Rua A", numero: "10", cidade: "Mogi das Cruzes", uf: "SP", status: "Ativa", unidade: "Mogi das Cruzes" },
        { idpessoa: "11", cliente: "Bia", contato: "11888880000", pet: "Sol", status: "Ativa", unidade: "Mogi das Cruzes" }
    ];
    const details = new Map([["10", [{ Produto: "Banho", Valor: "R$ 300,00" }, { Produto: "Pacote 12 Banhos", Valor: "R$ 900,00" }]]]);
    const result = data.buildRelevantCustomers(sales, details, csv);
    assert.equal(result.persistentCustomers.length, 1);
    assert.equal(result.persistentCustomers[0].key, "id:10");
    assert.equal(result.periodCustomers[0].spend, 300);
    assert.equal(result.periodCustomers[0].ticket, 150);
    assert.equal(result.periodCustomers[0].intervalDays, 15);
    assert.equal(result.pets.length, 1);
});

test("excludes package products using a normalized whole word", () => {
    const data = dataApi();
    assert.equal(data.isPackageProduct("Pacote 12 Banhos"), true);
    assert.equal(data.isPackageProduct("PACOTE promocional"), true);
    assert.equal(data.isPackageProduct("Empacotepremium"), false);
});

test("does not place customers without visits or liquid spend in period data", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana", Contato: "11999990000", "Num. Compras": "0" };
    const csv = [{ idpessoa: "10", cliente: "Ana", contato: "11999990000", status: "Ativa", unidade: "Mogi das Cruzes" }];
    const result = data.buildRelevantCustomers([sale], new Map([["10", [{ Produto: "Pacote", Valor: "R$ 500,00" }]]]), csv);
    assert.equal(result.persistentCustomers.length, 1);
    assert.equal(result.periodCustomers.length, 0);
});

test("accepts pertinent customers without creating unit pending", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana", Contato: "11999990000", "Num. Compras": "1" };
    const csv = [{ cliente: "Ana", contato: "11999990000", status: "Ativa", unidade: "Outra unidade" }];
    const result = data.buildRelevantCustomers([sale], new Map([["10", [{ Produto: "Banho", Valor: "R$ 100,00" }]]]), csv);
    assert.equal(result.persistentCustomers.length, 1);
    assert.equal(result.counts.accepted, 1);
    assert.equal("unitWarnings" in result.counts, false);
    assert.equal(result.pending.length, 1);
    assert.equal(result.pending[0].reason, "endereco_ausente");
});

test("creates a minimal persistent customer when CSV does not match", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana", Contato: "11999990000", "Num. Compras": "1" };
    const result = data.buildRelevantCustomers([sale], new Map([["10", [{ Produto: "Banho", Valor: "R$ 100,00" }]]]), []);
    assert.equal(result.persistentCustomers[0].idPessoa, "10");
    assert.equal(result.persistentCustomers[0].name, "Ana");
    assert.equal(result.counts.minimal, 1);
    assert.equal(result.counts.accepted + result.counts.rejected, result.counts.pertinent);
});

test("rejects only explicitly inactive customers", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana", Contato: "11999990000", "Num. Compras": "1" };
    const result = data.buildRelevantCustomers([sale], new Map(), [{ cliente: "Ana", contato: "11999990000", status: "Inativa" }]);
    assert.equal(result.persistentCustomers.length, 0);
    assert.equal(result.counts.rejected, 1);
    assert.equal(result.pending[0].reason, "cliente_inativo");
});

test("crosses CSV only with exact normalized name and phone", () => {
    const data = dataApi(), indexes = data.indexCsv([
        { cliente: "Ana Silva", contato: "Celular - (11) 99999-0000" },
        { cliente: "Ana Silva", contato: "Contato APP - (11) 98888-0000" }
    ]);
    assert.equal(data.csvRowsForSale({ Cliente: "Ana Silva", Contato: "Pessoal - 11999990000" }, indexes).length, 1);
    assert.equal(data.csvRowsForSale({ Cliente: "Ana Silva", Contato: "" }, indexes).length, 0);
    assert.equal(data.csvRowsForSale({ Cliente: "Ana", Contato: "11999990000" }, indexes).length, 0);
});

test("crosses empty phones only for one consistent tutor registration", () => {
    const data = dataApi(), indexes = data.indexCsv([
        { nome: "Ana Silva", telefones: "", animal: "Lua", cpf: "111", rua: "Rua A", numero: "1" },
        { nome: "Ana Silva", telefones: "", animal: "Sol", cpf: "111", rua: "Rua A", numero: "1" },
        { nome: "Bia Souza", telefones: "", cpf: "222", rua: "Rua B", numero: "2" },
        { nome: "Bia Souza", telefones: "", cpf: "333", rua: "Rua C", numero: "3" }
    ]);
    assert.equal(data.csvRowsForSale({ Cliente: "Ana Silva", Contato: "" }, indexes).length, 2);
    assert.equal(data.matchCsvSale({ Cliente: "Bia Souza", Contato: "" }, indexes).reason, "nome_duplicado");
    assert.equal(data.csvRowsForSale({ Cliente: "Bia Souza", Contato: "" }, indexes).length, 0);
});

test("persists normalized phone and populates pets only from CSV", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana Silva", Contato: "Pessoal - (11)99999-0000",
        reportPets: "Nao usar", "Num. Compras": "1" };
    const csv = [{ nome: "Ana Silva", telefones: "Celular - (11)99999-0000", animal: "Lua", status: "Ativa" }];
    const result = data.buildRelevantCustomers([sale], new Map(), csv);
    assert.equal(result.persistentCustomers[0].phone, "11999990000");
    assert.deepEqual(JSON.parse(JSON.stringify(result.pets.map(item => item.name))), ["Lua"]);
});

test("applies audited GEO address override", () => {
    const data = dataApi(), sale = { idPessoa: "10", Cliente: "Ana", Contato: "11999990000", "Num. Compras": "1" };
    const csv = [{ cliente: "Ana", contato: "11999990000", rua: "Rua A", numero: "1", cidade: "Mogi das Cruzes" }];
    const result = data.buildRelevantCustomers([sale], new Map(), csv,
        [{ idPessoa: "10", correctedAddress: "Rua Corrigida, 20, Mogi das Cruzes", status: "active" }]);
    assert.equal(result.persistentCustomers[0].address, "Rua Corrigida, 20, Mogi das Cruzes");
});

test("contains DataTables all-records attempt and paginated fallback", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "c04-geo-data.js"), "utf8");
    assert.match(source, /page\.len\(-1\)\.draw/);
    assert.match(source, /page\.len\(100\)\.draw/);
    assert.match(source, /Coleta parcial/);
    assert.match(source, /waitForReplacement/);
});
