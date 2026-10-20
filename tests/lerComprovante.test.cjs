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
    assert.equal(dados.categoria,"");
    assert.equal(dados.status,null);
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
test("nao preenche valores invalidos nem agenda recorrencia pela leitura", () => {
    const { contexto }=carregar();
    const dados=contexto.montarRascunhoComprovante({valor:"-100.00",dia:"texto",forma_pagamento:98,status:1,recorrencia:3});
    assert.equal(dados.valor,""); assert.equal(dados.data,""); assert.equal(dados.formaPagamento,null);
    assert.equal(dados.status,1); assert.equal(dados.recorrencia,undefined);
});

test("preserva status confirmado e rejeita status fora do contrato", () => {
    const { contexto } = carregar();
    for (const status of [0, 1]) assert.equal(contexto.montarRascunhoComprovante({ status }).status, status);
    for (const status of [true, "1", 2, undefined]) assert.equal(contexto.montarRascunhoComprovante({ status }).status, null);
});

test("identifica backend antigo e aceita campos nulos de backend atualizado", async () => {
    assert.equal((await carregar().contexto.lerComprovante(foto)).leituraDesatualizada, true);
    const { contexto } = carregar({ categoria: null, origem: null, status: null });
    assert.equal((await contexto.lerComprovante(foto)).leituraDesatualizada, false);
});

test("debito aprovado preenche os campos usados no cadastro", async () => {
    const { contexto } = carregar({ descricao: "Compra de alimentos", categoria: "Alimentação", origem: "Banco Local", forma_pagamento: 2, status: 1 });
    const dados = await contexto.lerComprovante(foto);
    const campos = contexto.selecionarOpcoesComprovante(dados, [{ tipo: 1, id_categoria: 8, nome: "Alimentação" }], ["Banco Local"]);
    assert.equal(campos.categoria, 8);
    assert.equal(campos.origem, "Banco Local");
    assert.equal(dados.status, 1);
    assert.equal(dados.formaPagamento, 2);
    assert.equal(dados.leituraDesatualizada, false);
});

test("seleciona categoria de despesa e origem existentes ignorando acentos e caixa", () => {
    const { contexto } = carregar();
    const campos = contexto.selecionarOpcoesComprovante({ categoria: " alimentacao ", origem: " BANCO  LOCAL " }, [
        { id_categoria: 2, tipo: 0, nome: "Alimentação" },
        { id_categoria: 7, tipo: 1, nome: "Alimentação" },
    ], ["Banco Local"]);
    assert.equal(campos.categoria, 7);
    assert.equal(campos.origem, "Banco Local");
    assert.equal(campos.novaCategoria, "");
    assert.equal(campos.novaOrigem, "");
});

test("prepara novas opcoes para salvar e nao presume origem ausente", () => {
    const { contexto } = carregar();
    const dados = contexto.montarRascunhoComprovante({ categoria: "Transporte", origem: "Caixa" });
    const campos = contexto.selecionarOpcoesComprovante(dados, [{ id_categoria: 2, tipo: 0, nome: "Transporte" }], []);
    assert.equal(campos.categoria, "__nova__");
    assert.equal(campos.novaCategoria, "Transporte");
    assert.equal(campos.origem, "__nova__");
    assert.equal(campos.novaOrigem, "Caixa");
    assert.equal(contexto.selecionarOpcoesComprovante(contexto.montarRascunhoComprovante({}), [], []).origem, undefined);
});

test("envia somente categorias de despesa como referencia da leitura", async () => {
    const { contexto, chamadas } = carregar();
    await contexto.lerComprovante(foto, [{ tipo: 0, nome: "Doação" }, { tipo: 1, nome: "Alimentação" }], ["Caixa"]);
    const opcoes = JSON.parse(chamadas[0][1].body.campos.find(item => item[0] === "opcoes")[1]);
    assert.deepEqual(opcoes, { categorias: ["Alimentação"], origens: ["Caixa"] });
});
