const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const conta = { id_usuario: 7, nome: "Ana", email: "ana@example.com", tipo: 0, status: 0 };
function carregar(resposta = { usuario: conta }, token = "token", falhar = false) {
    const chamadas = [], salvos = [];
    const contexto = vm.createContext({
        getToken: async () => token,
        requisicaoApi: async (...args) => { chamadas.push(args); return resposta; },
        salvarUsuario: async (...args) => { if (falhar) throw Error("storage"); salvos.push(args); },
        FormData: class { constructor() { this.campos = {}; } append(k, v) { this.campos[k] = v; } },
    });
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/conta.js"), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return { servico: contexto, chamadas, salvos };
}
test("consulta conta autenticada e normaliza os códigos", async () => {
    const { servico, chamadas } = carregar({ usuario: { ...conta, tipo: "0", status: "0" } });
    const dados = await servico.carregarConta();
    assert.equal(dados.tipo, 0);
    assert.equal(dados.status, 0);
    assert.equal(chamadas[0][0], "/minha-conta");
    assert.equal(chamadas[0][1].headers.Authorization, "Bearer token");
});
test("salva os quatro campos em formulário e sincroniza o usuário local", async () => {
    const { servico, chamadas, salvos } = carregar({ sucesso: true });
    const resultado = await servico.salvarConta({ ...conta, nome: " Ana Maria ", email: " ANA@example.com " });
    assert.equal(chamadas[0][1].method, "PUT");
    assert.equal(chamadas[0][1].body.campos.tipo, "0");
    assert.equal(chamadas[0][1].body.campos.status, "0");
    assert.equal(chamadas[0][1].headers["Content-Type"], undefined);
    assert.deepEqual(salvos[0], [7, "Ana Maria", "ana@example.com"]);
    assert.equal(resultado.conta.nome, "Ana Maria");
});
test("recusa campos inválidos sem enviar", async () => {
    const { servico, chamadas } = carregar();
    for (const alteracao of [{ nome: " " }, { email: "abc" }, { tipo: 3 }, { status: 2 }]) await assert.rejects(servico.salvarConta({ ...conta, ...alteracao }));
    assert.equal(chamadas.length, 0);
});
test("recusa conta incompleta e sessão ausente", async () => {
    await assert.rejects(carregar({}).servico.carregarConta(), /dados completos/);
    const { servico, chamadas } = carregar({}, null);
    await assert.rejects(servico.carregarConta(), /Entre novamente/);
    await assert.rejects(servico.salvarConta(conta), /Entre novamente/);
    assert.equal(chamadas.length, 0);
});
test("informa salvamento remoto quando armazenamento local falha", async () => {
    const resultado = await carregar({ sucesso: true }, "token", true).servico.salvarConta(conta);
    assert.match(resultado.aviso, /Conta salva na API/);
});
