const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function carregar({ token = "token", resposta = { resposta: "Oi! Eu sou a Lupe." }, erro } = {}) {
    const chamadas = [];
    const contexto = vm.createContext({
        getToken: async () => token,
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
    assert.equal(configuracao.tempoLimite, 60000);
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
