const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function servico(movimentos = [], projetos = []) {
    const contexto = vm.createContext({
        listarMovimentacoes: async () => movimentos,
        listarProjetos: async () => projetos,
    });
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/dashboard.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return contexto;
}

test("soma entradas e despesas de todos os períodos, incluindo pendentes como no relatório", async () => {
    const dashboard = await servico([
        { tipo: 0, valor: 6930, status: 1, data: "2026-08-01" },
        { tipo: 1, valor: 2000, status: 1, data: "2026-07-01" },
        { tipo: 1, valor: "120", status: 0, data: "2026-08-02" },
    ]).carregarDashboard();
    assert.equal(dashboard.receitas, 6930);
    assert.equal(dashboard.despesas, 2120);
    assert.equal(dashboard.saldo, 4810);
});

test("trata lista vazia e saldo negativo sem esconder zero", () => {
    const { montarDashboard } = servico();
    const vazio = montarDashboard([], []);
    assert.equal(vazio.saldo, 0);
    assert.equal(vazio.receitas, 0);
    assert.equal(vazio.despesas, 0);
    assert.equal(vazio.lancamentos.length, 0);
    assert.equal(montarDashboard([{ tipo: 1, valor: 50 }], []).saldo, -50);
});

test("mantém centavos exatos e desconsidera tipos fora de entrada e saída", () => {
    const resultado = servico().montarDashboard([
        { tipo: "0", valor: "0.10" }, { tipo: 0, valor: 0.20 },
        { tipo: "1", valor: 0.30 }, { tipo: 2, valor: 900 },
    ], []);
    assert.equal(resultado.receitas, 0.30);
    assert.equal(resultado.saldo, 0);
    assert.equal(resultado.lancamentos.length, 3);
});

test("seleciona os três mais recentes por data e ID, com projeto, sem alterar a lista original", () => {
    const lista = [
        { id_livro_caixa: 1, tipo: 0, valor: 1, data: "2026-08-01", conta: 0 },
        { id_livro_caixa: 2, tipo: 0, valor: 1, data: "2026-08-03", conta: 7 },
        { id_livro_caixa: 3, tipo: 1, valor: 1, data: "2026-08-03", conta: "0" },
        { id_livro_caixa: 4, tipo: 1, valor: 1, dia: "2026-08-02", conta: 8 },
    ];
    const resultado = servico().montarDashboard(lista, [{ id_projeto: 7, nome: "Casa da Missão" }]);
    assert.equal(resultado.lancamentos.map(item => item.id_livro_caixa).join(","), "3,2,4");
    assert.equal(resultado.lancamentos[0].projeto, "Missão Guadalupe");
    assert.equal(resultado.lancamentos[1].projeto, "Casa da Missão");
    assert.equal(resultado.lancamentos[2].projeto, "Projeto 8");
    assert.equal(lista[0].id_livro_caixa, 1);
    assert.equal(lista[0].projeto, undefined);
});

test("não exibe totais inventados quando há valor inválido ou falha da API", async () => {
    for (const valor of [null, "", "invalido", undefined]) {
        assert.throws(() => servico().montarDashboard([{ tipo: 0, valor }], []), /valor inválido/);
    }
    const api = servico();
    api.listarMovimentacoes = async () => { throw new Error("API indisponível"); };
    await assert.rejects(api.carregarDashboard(), /API indisponível/);
});
