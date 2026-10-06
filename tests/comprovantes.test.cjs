const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function carregar(resposta = { anexo: "/arquivos/movimentacoes/movimentacao_9.pdf" }, token = "token") {
    const chamadas = [];
    const contexto = vm.createContext({
        File: class { constructor(uri) { this.uri = uri; } async bytes() { return new TextEncoder().encode(this.uri); } },
        fetchExpo: async () => {},
        API_URL: "http://localhost:5000", getToken: async () => token,
        FormData: class { constructor() { this.campos = []; } append(...campo) { this.campos.push(campo); } },
        requisicaoApi: async (...args) => { chamadas.push(args); return resposta; },
    });
    for (const nome of ["anexos", "uploadAnexo", "comprovantes"]) {
        const codigo = fs.readFileSync(path.join(__dirname, `../src/services/${nome}.js`), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
        vm.runInContext(codigo, contexto);
    }
    return { servico: contexto, chamadas };
}
const arquivo = { uri: "file:///cache/nota.pdf", name: "nota.pdf", mimeType: "application/pdf" };

test("status depende do anexo, não do pagamento", () => {
    const { servico } = carregar();
    assert.equal(servico.temComprovante({ status: 1, anexo: " " }), false);
    assert.equal(servico.temComprovante({ status: 0, anexo: arquivo.uri }), true);
    assert.equal(servico.temComprovante({}), false);
});
test("envia anexo ao lançamento existente com token e multipart", async () => {
    const { servico, chamadas } = carregar();
    assert.equal(await servico.enviarComprovante(9, arquivo), "/arquivos/movimentacoes/movimentacao_9.pdf");
    const [rota, opcoes, config] = chamadas[0];
    assert.equal(rota, "/livro-caixa/9/anexo");
    assert.equal(opcoes.method, "POST");
    assert.equal(opcoes.headers.Authorization, "Bearer token");
    assert.equal(opcoes.headers["Content-Type"], undefined);
    assert.equal(opcoes.body.campos.length, 1);
    assert.equal(new TextDecoder().decode(await opcoes.body.campos[0][1].bytes()), arquivo.uri);
    assert.equal(config.enviar, servico.fetchExpo);
    assert.equal(config.tempoLimite, 60000);
});
test("recusa sessão, ID, formato e URI inválidos antes de enviar", async () => {
    const { servico, chamadas } = carregar();
    await assert.rejects(servico.enviarComprovante(0, arquivo), /inválido/);
    await assert.rejects(servico.enviarComprovante(9, { name: "nota.exe" }), /PDF/);
    await assert.rejects(servico.enviarComprovante(9, { ...arquivo, uri: "https://outro/nota.pdf" }), /novamente/);
    await assert.rejects(carregar({}, null).servico.enviarComprovante(9, arquivo), /Entre novamente/);
    assert.equal(chamadas.length, 0);
});
test("não confirma upload sem anexo retornado", async () => {
    await assert.rejects(carregar({ sucesso: true }).servico.enviarComprovante(9, arquivo), /não confirmou/);
});
test("abre apenas arquivos de movimentações no servidor configurado", () => {
    const { servico } = carregar();
    assert.equal(servico.urlComprovante("/arquivos/movimentacoes/movimentacao_9.pdf"), "http://localhost:5000/arquivos/movimentacoes/movimentacao_9.pdf");
    for (const valor of ["https://outro/nota.pdf", "javascript:alert(1)", "/arquivos/movimentacoes/../nota.pdf", null]) assert.throws(() => servico.urlComprovante(valor));
});

test("troca comprovante por foto usando PUT e multipart", async () => {
    const { servico, chamadas } = carregar({ anexo: "/arquivos/movimentacoes/movimentacao_9.jpg" });
    await servico.enviarComprovante(9, { uri: "file:///cache/foto.jpg", name: "foto.jpg", mimeType: "image/jpeg" }, true);
    assert.equal(chamadas[0][1].method, "PUT");
    assert.equal(chamadas[0][1].body.campos[0][1].type, "image/jpeg");
});
