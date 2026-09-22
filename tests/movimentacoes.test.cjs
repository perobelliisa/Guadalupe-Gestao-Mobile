const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Substitui apenas API e armazenamento nativo para testar o serviço no Node.
function carregarServico(resposta = {}, token = "token-teste") {
    const chamadas = [];
    const contexto = vm.createContext({
        FormData: class {
            constructor() { this.campos = []; }
            append(nome, valor) { this.campos.push([nome, valor]); }
        },
        getToken: async () => token,
        requisicaoApi: async (rota, opcoes, configuracao) => {
            chamadas.push({ rota, opcoes, configuracao });
            return resposta;
        },
    });
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/movimentacoes.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "")
        .replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return { servico: contexto, chamadas };
}

test("lista os movimentos retornados pela API com autenticação", async () => {
    const registros = [{ id_livro_caixa: 9, tipo: 0, valor: 1250.50 }];
    const { servico, chamadas } = carregarServico({ movimentacoes: registros });
    assert.equal(await servico.listarMovimentacoes(), registros);
    assert.equal(chamadas[0].rota, "/livro-caixa");
    assert.equal(chamadas[0].opcoes.headers.Authorization, "Bearer token-teste");
});

test("não trata resposta incorreta da API como lista vazia", async () => {
    const { servico } = carregarServico({ sucesso: true });
    await assert.rejects(servico.listarMovimentacoes(), /lista de movimentações/);
    await assert.rejects(servico.listarCategorias(), /categorias/);
    await assert.rejects(servico.listarProjetos(), /projetos/);
});

test("envia receita e despesa nas rotas corretas preservando códigos zero", async () => {
    const { servico, chamadas } = carregarServico({ sucesso: true, id_livro_caixa: 10 });
    const dados = { descricao: "Teste", valor: 12.50, data: "2026-01-02", forma_pagamento: 0, origem: "0", conta: 0, status: 0 };
    await servico.cadastrarMovimentacao(0, dados);
    await servico.cadastrarMovimentacao(1, dados);
    assert.equal(chamadas[0].rota, "/entradas");
    assert.equal(chamadas[1].rota, "/despesas");
    assert.equal(chamadas[0].opcoes.method, "POST");
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), dados);
    await assert.rejects(servico.cadastrarMovimentacao(2, dados), /receita ou despesa/);
});

test("não envia requisição sem sessão", async () => {
    const { servico, chamadas } = carregarServico({}, null);
    await assert.rejects(servico.listarMovimentacoes(), /Entre novamente/);
    assert.equal(chamadas.length, 0);
});

test("valida valores brasileiros sem alterar centavos", () => {
    const { servico } = carregarServico();
    assert.equal(servico.converterValor("1.250,50"), 1250.5);
    assert.equal(servico.converterValor("0,01"), 0.01);
    assert.equal(servico.converterValor("1250"), 1250);
    for (const valor of ["0", "-12", "abc", "1,234", "12.50", "1.25,00", ""]) {
        assert.throws(() => servico.converterValor(valor));
    }
});

test("valida datas e permite vencimento futuro, mas não movimentação futura", () => {
    const { servico } = carregarServico();
    assert.equal(servico.converterData("29/02/2024"), "2024-02-29");
    for (const data of ["29/02/2025", "31/04/2025", "00/01/2025", "2025-01-01", "01/13/2025"]) {
        assert.throws(() => servico.converterData(data));
    }
    assert.throws(() => servico.converterData("01/01/2999"), /futura/);
    assert.equal(servico.converterData("01/01/2999", true), "2999-01-01");
});

function camposWeb() {
    return { descricao: "Compra", valor: "125,50", data: "01/01/2026", categoria: 1, novaCategoria: "", conta: 0, formaPagamento: 0, origem: "Caixa", novaOrigem: "", observacao: "Observação", fornecedor: "Mercado", status: 0, recorrencia: 0, inicio: "", fim: "" };
}

test("entrada envia os campos do web e não envia campos exclusivos de despesa", () => {
    const { servico } = carregarServico();
    const dados = servico.montarLancamento(0, camposWeb());
    assert.equal(dados.dia, "2026-01-01");
    assert.equal(dados.origem, "Caixa");
    assert.equal(dados.id_categoria, 1);
    assert.equal(dados.valor, 125.5);
    for (const campo of ["fornecedor", "status", "recorrencia", "dia_inicio", "dia_fim", "vencimento"]) assert.equal(campo in dados, false);
});

test("despesa grava origem, fornecedor, status e recorrência com datas", () => {
    const { servico } = carregarServico();
    const dados = servico.montarLancamento(1, { ...camposWeb(), recorrencia: 4, inicio: "01/01/2026", fim: "08/01/2026" });
    assert.equal(dados.origem, "Caixa");
    assert.equal(dados.fornecedor, "Mercado");
    assert.equal(dados.status, 0);
    assert.equal(dados.recorrencia, 4);
    assert.equal(dados.dia_inicio, "2026-01-01");
    assert.equal(dados.dia_fim, "2026-01-08");
});

test("exige categoria e origem e permite cadastrar novas", () => {
    const { servico } = carregarServico();
    assert.throws(() => servico.montarLancamento(0, { ...camposWeb(), categoria: 0 }), /categoria/);
    assert.throws(() => servico.montarLancamento(1, { ...camposWeb(), origem: "" }), /pagamento/);
    assert.throws(() => servico.montarLancamento(0, { ...camposWeb(), categoria: "__nova__" }), /categoria/);
    const dados = servico.montarLancamento(0, { ...camposWeb(), categoria: "__nova__", novaCategoria: " Doação ", origem: "__nova__", novaOrigem: " Empresa " });
    assert.equal(dados.categoria, "Doação");
    assert.equal(dados.origem, "Empresa");
    assert.equal("id_categoria" in dados, false);
});

test("recorrência valida todas as durações do web e exige ambas as datas", () => {
    const { servico } = carregarServico();
    for (const [recorrencia, dias] of [[1, 15], [2, 30], [3, 1], [4, 7]]) {
        assert.throws(() => servico.montarLancamento(1, { ...camposWeb(), recorrencia }), /datas/);
        const fim = String(1 + dias).padStart(2, "0") + "/01/2026";
        assert.equal(servico.montarLancamento(1, { ...camposWeb(), recorrencia, inicio: "01/01/2026", fim }).recorrencia, recorrencia);
    }
    assert.throws(() => servico.montarLancamento(1, { ...camposWeb(), recorrencia: 4, inicio: "01/01/2026", fim: "07/01/2026" }), /7 dias/);
    assert.throws(() => servico.montarLancamento(1, { ...camposWeb(), inicio: "01/01/2026" }), /duas datas/);
});

test("origens são compartilhadas e não repetem nomes com espaços ou caixa diferentes", () => {
    const { servico } = carregarServico();
    assert.equal(servico.montarOrigens([{ origem: " Caixa " }, { origem: "caixa" }, { origem: "Banco" }, { origem: "" }]).join(","), "Banco,Caixa");
});

test("anexo é enviado em multipart com autenticação sem fixar Content-Type", async () => {
    const { servico, chamadas } = carregarServico({ sucesso: true });
    await servico.cadastrarMovimentacao(1, { valor: 10, status: 0, dia_inicio: null }, { uri: "file:///comprovante.pdf", name: "comprovante.pdf", mimeType: "application/pdf" });
    const { opcoes } = chamadas[0];
    assert.equal(opcoes.headers["Content-Type"], undefined);
    assert.equal(opcoes.headers.Authorization, "Bearer token-teste");
    assert.equal(opcoes.body.campos.find(item => item[0] === "status")[1], "0");
    assert.equal(opcoes.body.campos.find(item => item[0] === "anexo")[1].uri, "file:///comprovante.pdf");
    assert.equal(chamadas[0].configuracao.enviar, undefined);
    assert.equal(chamadas[0].configuracao.tempoLimite, 60000);
});

test("anexo sem URI válido é identificado antes de enviar ou cadastrar", async () => {
    const { servico, chamadas } = carregarServico();
    await assert.rejects(servico.cadastrarMovimentacao(1, { valor: 10 }, { name: "foto.jpg" }), /Selecione o arquivo novamente/);
    assert.equal(chamadas.length, 0);
});

test("JPG do seletor mantém URI, nome e tipo sem depender de File.exists", async () => {
    for (const uri of ["file:///cache/DocumentPicker/foto.jpg", "content://documents/foto/123"]) {
        const { servico, chamadas } = carregarServico({ sucesso: true });
        await servico.cadastrarMovimentacao(1, { valor: 10 }, { uri, name: "foto.jpg", mimeType: "image/jpeg" });
        const arquivo = chamadas[0].opcoes.body.campos.find(item => item[0] === "anexo")[1];
        assert.equal(arquivo.uri, uri);
        assert.equal(arquivo.name, "foto.jpg");
        assert.equal(arquivo.type, "image/jpeg");
    }
});
