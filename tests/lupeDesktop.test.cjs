const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function carregar() {
    const chamadas = [];
    const contexto = vm.createContext({
        API_URL: "/api", AbortController, setTimeout, clearTimeout,
        fetch: async (url, opcoes) => { chamadas.push([url, opcoes]); return { ok: true, json: async () => ({ sucesso: true, resposta: "Confira a proposta.", acoes: [{ id: "acao-1", estado: "preparada" }], acao: { id: "acao-1", estado: "concluida" } }) }; },
    });
    const arquivo = process.env.LUPE_DESKTOP_SOURCE || "../GuadalupeGestao-Front/src/services/lupe.js";
    vm.runInContext(fs.readFileSync(arquivo, "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    return { contexto, chamadas };
}

test("desktop envia contexto por cookie e nao confirma propostas automaticamente", async () => {
    const { contexto, chamadas } = carregar();
    const retorno = await contexto.conversar(7, "Altere a despesa", [], "conversa-1");
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0][0], "/api/lupe/chat");
    assert.equal(chamadas[0][1].credentials, "include");
    assert.equal(chamadas[0][1].headers["X-Lupe-Usuario"], "7");
    assert.equal(JSON.parse(chamadas[0][1].body).conversa_id, "conversa-1");
    assert.equal(retorno.acoes[0].estado, "preparada");
});

test("desktop confirma somente pela chamada de decisao explicita", async () => {
    const { contexto, chamadas } = carregar();
    await contexto.listarAcoes(7, "conversa-1");
    assert.equal(chamadas[0][1].method, undefined);
    await contexto.decidirAcao(7, "acao-1", true);
    assert.equal(chamadas[1][0], "/api/lupe/acoes/acao-1/confirmar");
    assert.deepEqual(JSON.parse(chamadas[1][1].body), { confirmar: true });
    await contexto.decidirAcao(7, "acao-1", false);
    assert.equal(chamadas[2][0], "/api/lupe/acoes/acao-1/cancelar");
});
