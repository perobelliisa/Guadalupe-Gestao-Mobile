const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function carregar(dados = { valor: "150.00", dia: "2026-10-06", descricao: "Mercado", fornecedor: "Loja", forma_pagamento: 0 }, token = "token") {
    const chamadas = [];
    const contexto = vm.createContext({
        fetchExpo: async () => {}, getToken: async () => token,
        File: class { async bytes() { return Uint8Array.from([1,2,3]); } },
        FormData: class { constructor() { this.campos=[]; } append(...args) { this.campos.push(args); } },
        requisicaoApi: async (...args) => { chamadas.push(args); return { dados }; },
    });
    for (const nome of ["anexos", "uploadAnexo", "lerComprovante"]) vm.runInContext(fs.readFileSync(path.join(__dirname, `../src/services/${nome}.js`), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    return { contexto, chamadas };
}
const foto = { uri: "file:///foto.jpg", name: "foto.jpg", mimeType: "image/jpeg" };
test("le foto com token e bytes sem cadastrar despesa", async () => {
    const { contexto, chamadas } = carregar();
    const dados=await contexto.lerComprovante(foto);
    assert.equal(chamadas.length,1);
    assert.equal(chamadas[0][0],"/comprovantes/ler");
    assert.equal(chamadas[0][1].headers.Authorization,"Bearer token");
    assert.equal(chamadas[0][1].headers["Content-Type"],undefined);
    assert.equal(typeof chamadas[0][1].body.campos[0][1].bytes,"function");
    assert.equal(chamadas[0][2].enviar,contexto.fetchExpo);
    assert.equal(dados.valor,"150,00");
    assert.equal(dados.data,"06/10/2026");
    assert.equal(dados.formaPagamento,0);
    assert.equal(dados.categoria,undefined);
    assert.equal(dados.status,undefined);
});
test("campos ausentes ficam vazios para revisao", () => {
    const { contexto }=carregar();
    const rascunho=contexto.montarRascunhoComprovante({});
    assert.equal(rascunho.valor,""); assert.equal(rascunho.data,""); assert.equal(rascunho.formaPagamento,null);
    assert.throws(()=>contexto.montarRascunhoComprovante(null));
});
test("PDF, foto sem URI e sessao ausente nao enviam", async () => {
    const { contexto,chamadas }=carregar();
    await assert.rejects(contexto.lerComprovante({uri:"file:///nota.pdf",name:"nota.pdf",mimeType:"application/pdf"}),/JPG/);
    await assert.rejects(contexto.lerComprovante({...foto,uri:"https://outro/foto.jpg"}),/novamente/);
    await assert.rejects(carregar({},null).contexto.lerComprovante(foto),/Entre novamente/);
    assert.equal(chamadas.length,0);
});
test("nao preenche valores invalidos e descarta campos que criariam pagamento", () => {
    const { contexto }=carregar();
    const dados=contexto.montarRascunhoComprovante({valor:"-100.00",dia:"texto",forma_pagamento:98,status:1,recorrencia:3});
    assert.equal(dados.valor,""); assert.equal(dados.data,""); assert.equal(dados.formaPagamento,null);
    assert.equal(dados.status,undefined); assert.equal(dados.recorrencia,undefined);
});
