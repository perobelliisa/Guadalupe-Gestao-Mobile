const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function carregar({ locais = [], falhar = false, id = 7 } = {}) {
    const chamadas = [], excluidas = [];
    const conversa = { id: "conversa-1", revisao: 3, mensagens: [{ papel: "usuario", texto: "Oi" }, { papel: "lupe", texto: "Olá" }] };
    const contexto = vm.createContext({
        criarConversaLupe: () => ({}), getToken: async () => "token", getUsuario: async () => ({ id }),
        listarLocais: async () => locais, carregarLocal: async () => conversa, excluirLocal: async (...args) => excluidas.push(args),
        requisicaoApi: async (...args) => {
            chamadas.push(args);
            if (falhar) throw Object.assign(new Error("Sem conexão"), { status: 503 });
            return { conversas: [{ id: conversa.id, revisao: 3 }], conversa };
        },
    });
    vm.runInContext(fs.readFileSync("src/services/historicoLupe.js", "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export \{.*\};\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    return { contexto, chamadas, excluidas, conversa };
}

test("consulta historico no servidor com token e conta esperada", async () => {
    const { contexto, chamadas } = carregar();
    await contexto.listarConversasLupe(7);
    assert.equal(chamadas[0][0], "/lupe/conversas");
    assert.equal(chamadas[0][1].headers.Authorization, "Bearer token");
    assert.equal(chamadas[0][1].headers["X-Lupe-Usuario"], "7");
});

test("importa historico local uma vez e apaga copia somente depois de confirmar", async () => {
    const { contexto, chamadas, excluidas } = carregar({ locais: [{ id: "conversa-1" }] });
    await contexto.listarConversasLupe(7);
    assert.equal(chamadas[0][1].method, "PUT");
    assert.equal(JSON.parse(chamadas[0][1].body).importacao, true);
    assert.deepEqual(excluidas, [[7, "conversa-1"]]);
    const falha = carregar({ locais: [{ id: "conversa-1" }], falhar: true });
    await assert.rejects(falha.contexto.listarConversasLupe(7), /Sem conexão/);
    assert.equal(falha.excluidas.length, 0);
});

test("salva revisao da conversa e recupera revisao confirmada", async () => {
    const { contexto, conversa, chamadas } = carregar();
    const resultado = await contexto.salvarConversaLupe(7, conversa);
    assert.equal(JSON.parse(chamadas[0][1].body).revisao, 3);
    assert.equal(resultado.conversa.revisao, 3);
    assert.equal(resultado.conversas.length, 1);
    assert.equal((await contexto.carregarConversaLupe(7, conversa.id)).id, conversa.id);
    await contexto.excluirConversaLupe(7, conversa.id);
    assert.equal(chamadas.at(-1)[1].method, "DELETE");
});

test("nao importa historico de outra conta depois de trocar sessao", async () => {
    const { contexto, chamadas } = carregar({ id: 8 });
    await assert.rejects(contexto.listarConversasLupe(7), /Entre novamente/);
    assert.equal(chamadas.length, 0);
});
