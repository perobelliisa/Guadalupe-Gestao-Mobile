const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function carregar({ token = "token", resposta = { resposta: "Oi! Eu sou a Lupe." }, erro, usuario = { id: 7 } } = {}) {
    const chamadas = [];
    const contexto = vm.createContext({
        getToken: async () => token,
        getUsuario: async () => usuario,
        requisicaoApi: async (...args) => { chamadas.push(args); if (erro) throw erro; return resposta; },
    });
    vm.runInContext(fs.readFileSync("src/services/lupe.js", "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    return { contexto, chamadas };
}

test("envia conversa autenticada e retorna resposta da Lupe", async () => {
    const { contexto, chamadas } = carregar();
    assert.equal(await contexto.conversarComLupe("  Oi!  "), "Oi! Eu sou a Lupe.");
    const [rota, opcoes, configuracao] = chamadas[0];
    assert.equal(rota, "/lupe/chat");
    assert.equal(opcoes.headers.Authorization, "Bearer token");
    assert.equal(configuracao.tempoLimite, 120000);
    assert.deepEqual(JSON.parse(opcoes.body), { mensagens: [{ papel: "usuario", texto: "Oi!" }] });
});

test("nao envia mensagem vazia, longa ou sem sessao", async () => {
    const { contexto, chamadas } = carregar();
    await assert.rejects(contexto.conversarComLupe(" "), /Escreva/);
    await assert.rejects(contexto.conversarComLupe("a".repeat(2001)), /2.000/);
    await assert.rejects(carregar({ token: null }).contexto.conversarComLupe("Oi"), /Entre novamente/);
    assert.equal(chamadas.length, 0);
});

test("mantem as ultimas dez trocas sem alterar o historico exibido", async () => {
    const { contexto, chamadas } = carregar();
    const historico = Array.from({ length: 30 }, (_, i) => ({ papel: i % 2 ? "lupe" : "usuario", texto: String(i), metadado: "nao enviar" }));
    await contexto.conversarComLupe("Nova pergunta", historico);
    const mensagens = JSON.parse(chamadas[0][1].body).mensagens;
    assert.equal(mensagens.length, 21);
    assert.equal(mensagens[0].texto, "10");
    assert.equal(mensagens[0].papel, "usuario");
    assert.equal(mensagens[0].metadado, undefined);
    assert.equal(historico.length, 30);
});

test("limita contexto por tamanho sem separar pares da conversa", async () => {
    const { contexto, chamadas } = carregar();
    const historico = Array.from({ length: 20 }, (_, i) => ({ papel: i % 2 ? "lupe" : "usuario", texto: "x".repeat(i % 2 ? 8000 : 2000) }));
    await contexto.conversarComLupe("Pergunta", historico);
    const mensagens = JSON.parse(chamadas[0][1].body).mensagens;
    assert.ok(mensagens.reduce((total, item) => total + item.texto.length, 0) <= 40000);
    assert.equal(mensagens[0].papel, "usuario");
    assert.equal(mensagens.at(-1).texto, "Pergunta");
});

test("nao aceita resposta vazia e explica servidor sem chat", async () => {
    await assert.rejects(carregar({ resposta: { resposta: " " } }).contexto.conversarComLupe("Oi"), /não conseguiu responder/);
    await assert.rejects(carregar({ erro: { status: 404 } }).contexto.conversarComLupe("Oi"), /Reinicie/);
    const erro = new Error("Sem conexão");
    await assert.rejects(carregar({ erro }).contexto.conversarComLupe("Oi"), falha => falha === erro);
});

test("chat com comandos envia conversa e retorna proposta sem confirmar", async () => {
    const proposta = { id: "acao-1", estado: "preparada" };
    const { contexto, chamadas } = carregar({ resposta: { resposta: "Confira a proposta.", acoes: [proposta] } });
    const resultado = await contexto.conversarComLupe("Cadastre uma despesa", [], "conversa-1");
    assert.equal(JSON.parse(chamadas[0][1].body).conversa_id, "conversa-1");
    assert.equal(resultado.acoes[0].id, "acao-1");
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0][0], "/lupe/chat");
});

test("confirmacao e cancelamento usam endpoint proprio e conta autenticada", async () => {
    const { contexto, chamadas } = carregar({ resposta: { sucesso: true, acao: { id: "acao-1", estado: "concluida" } } });
    await contexto.decidirAcaoLupe("acao-1", true, 7);
    assert.equal(chamadas[0][0], "/lupe/acoes/acao-1/confirmar");
    assert.deepEqual(JSON.parse(chamadas[0][1].body), { confirmar: true });
    assert.equal(chamadas[0][1].headers["X-Lupe-Usuario"], "7");
    await contexto.decidirAcaoLupe("acao-1", false, 7);
    assert.equal(chamadas[1][0], "/lupe/acoes/acao-1/cancelar");
    assert.deepEqual(JSON.parse(chamadas[1][1].body), {});
    await assert.rejects(contexto.decidirAcaoLupe("acao-1", true, 8), /Entre novamente/);
    assert.equal(chamadas.length, 2);
});

test("acoes pendentes sao consultadas por conversa sem realizar alteracoes", async () => {
    const { contexto, chamadas } = carregar({ resposta: { acoes: [{ id: "acao-1" }] } });
    assert.equal((await contexto.listarAcoesLupe("conversa-1", 7)).length, 1);
    assert.equal(chamadas[0][0], "/lupe/acoes?conversa_id=conversa-1");
    assert.equal(chamadas[0][1].method, undefined);
});
