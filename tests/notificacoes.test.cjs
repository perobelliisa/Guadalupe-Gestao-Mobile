const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function carregar(pendencias = [], token = "token") {
    const chamadas = [];
    const contexto = vm.createContext({
        getToken: async () => token,
        requisicaoApi: async (rota, opcoes) => {
            chamadas.push({ rota, opcoes });
            return { pendencias };
        },
    });
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/notificacoes.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return { contexto, chamadas };
}

function despesa(dias, tipo = "despesa") {
    return { tipo, dias, chave: tipo + ":" + dias, descricao: "Aluguel", vencimento: "2026-10-08" };
}

test("mostra vencidas e proximas ate 13 dias, ignora emprestimos e dias invalidos", () => {
    const { contexto } = carregar();
    const entrada = [despesa(14), despesa(13), despesa(-2), despesa(0, "emprestimo"), despesa(null), despesa("2")];
    const avisos = contexto.montarNotificacoes(entrada);
    assert.equal(avisos.length, 2);
    assert.equal(avisos[0].titulo, "Despesa vencida");
    assert.equal(avisos[0].vencida, true);
    assert.equal(avisos[1].titulo, "Vence em 13 dias");
    assert.equal(entrada[0].dias, 14);
});

test("diferencia hoje, amanha e proximos dias e mostra descricao e data", () => {
    const { contexto } = carregar();
    const avisos = contexto.montarNotificacoes([despesa(2), despesa(1), despesa(0)]);
    assert.equal(avisos[0].titulo, "Vence hoje");
    assert.equal(avisos[1].titulo, "Vence amanh\u00e3");
    assert.equal(avisos[2].titulo, "Vence em 2 dias");
    assert.match(avisos[0].mensagem, /Aluguel.*08\/10\/2026/);
});

test("consulta pendencias com token e atualiza lista quando a API remove pagamentos", async () => {
    const registros = [despesa(0)];
    const { contexto, chamadas } = carregar(registros);
    assert.equal((await contexto.listarNotificacoes()).length, 1);
    assert.equal(chamadas[0].rota, "/pendencias");
    assert.equal(chamadas[0].opcoes.headers.Authorization, "Bearer token");
    registros.length = 0;
    assert.equal((await contexto.listarNotificacoes()).length, 0);
});

test("recusa falta de sessao e resposta invalida sem inventar uma lista vazia", async () => {
    const semSessao = carregar([], null);
    await assert.rejects(semSessao.contexto.listarNotificacoes(), /Entre novamente/);
    assert.equal(semSessao.chamadas.length, 0);
    const invalido = carregar(null);
    await assert.rejects(invalido.contexto.listarNotificacoes(), /consultar/);
});
