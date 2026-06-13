"use strict";
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

test("Apps Script backend has valid JavaScript syntax", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
    assert.doesNotThrow(() => new vm.Script(source));
});

test("Apps Script publishes persistent upserts and protects database reset", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
    assert.match(source, /function stageBatch_/);
    assert.match(source, /function publishRun_/);
    assert.match(source, /function discardRun_/);
    assert.match(source, /activeVersion/);
    assert.match(source, /appendVersion_\("Clientes"/);
    assert.match(source, /validateSnapshot_/);
    assert.match(source, /pruneVersions_/);
    assert.match(source, /Overrides:/);
    assert.match(source, /testStaging_/);
    assert.match(source, /function consistency_/);
    assert.match(source, /orphanPets/);
    assert.match(source, /duplicateCustomerIds/);
    assert.doesNotMatch(source, /activeRows_/);
    assert.match(source, /versionRows_\("Clientes"/);
    assert.match(source, /consumeRetries_/);
    assert.match(source, /LIMPAR BANCO GEO/);
    assert.match(source, /empty_period/);
    assert.match(source, /success_with_pendings/);
    assert.match(source, /JSON\.stringify\(current\) === JSON\.stringify\(expected\)/);
    assert.doesNotMatch(source, /nenhum cliente pertinente valido/);
    assert.doesNotMatch(source, /Visitas:/);
});
