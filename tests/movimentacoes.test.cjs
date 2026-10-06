const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Substitui apenas API e armazenamento nativo para testar o serviço no Node.
function carregarServico(resposta = {}, token = "token-teste") {
    const chamadas = [];
    const contexto = vm.createContext({
        File: class { constructor(uri) { this.uri = uri; } async bytes() { return new TextEncoder().encode(this.uri); } },
        fetchExpo: async () => {},
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
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/services/uploadAnexo.js"), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/movimentacoes.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "")
        .replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return { servico: contexto, chamadas };
}

test("recusa valores excessivos antes de enviar e preserva valores usuais", () => {
    const { servico } = carregarServico();
    for (const valor of ["120000000000000000", "90.071.992.547.409,92"]) {
        assert.throws(() => servico.converterValor(valor), /valor informado é muito alto/);
    }
    assert.equal(servico.converterValor("1.250,50"), 1250.5);
    assert.equal(servico.converterValor("0,01"), 0.01);
});

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
    assert.equal(new TextDecoder().decode(await opcoes.body.campos.find(item => item[0] === "anexo")[1].bytes()), "file:///comprovante.pdf");
    assert.equal(chamadas[0].configuracao.enviar, servico.fetchExpo);
    assert.equal(chamadas[0].configuracao.tempoLimite, 60000);
});

test("anexo sem URI válido é identificado antes de enviar ou cadastrar", async () => {
    const { servico, chamadas } = carregarServico();
    await assert.rejects(servico.cadastrarMovimentacao(1, { valor: 10 }, { name: "foto.jpg" }), /Selecione o arquivo novamente/);
    assert.equal(chamadas.length, 0);
});

test("JPG do seletor envia bytes, nome e tipo sem depender de File.exists", async () => {
    for (const uri of ["file:///cache/DocumentPicker/foto.jpg", "content://documents/foto/123"]) {
        const { servico, chamadas } = carregarServico({ sucesso: true });
        await servico.cadastrarMovimentacao(1, { valor: 10 }, { uri, name: "foto.jpg", mimeType: "image/jpeg" });
        const arquivo = chamadas[0].opcoes.body.campos.find(item => item[0] === "anexo")[1];
        assert.equal(new TextDecoder().decode(await arquivo.bytes()), uri);
        assert.equal(arquivo.name, "foto.jpg");
        assert.equal(arquivo.type, "image/jpeg");
    }
});


test("edita na mesma rota do web com PUT, token e campos completos", async () => {
    const { servico, chamadas } = carregarServico({ sucesso: true });
    const dados = { descricao: "Conta", valor: 12.5, dia: "2026-01-02", conta: 0, forma_pagamento: 0, status: 1, recorrencia: 0 };
    await servico.editarMovimentacao(9, dados);
    assert.equal(chamadas[0].rota, "/livro-caixa/9");
    assert.equal(chamadas[0].opcoes.method, "PUT");
    assert.equal(chamadas[0].opcoes.headers.Authorization, "Bearer token-teste");
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), dados);
    await assert.rejects(servico.editarMovimentacao(0, dados), /Selecione/);
});

test("preenche editor sem perder centavos, codigos zero e datas de recorrencia", () => {
    const { servico } = carregarServico();
    const campos = servico.camposDaMovimentacao({ valor: 1250.5, dia: "2026-01-02", id_categoria: "7", conta: 0, forma_pagamento: 0, status: 1, recorrencia: 4, dia_inicio: "2026-01-02", dia_fim: "2026-02-02", origem: "Caixa" });
    assert.equal(campos.valor, "1250,50");
    assert.equal(campos.data, "02/01/2026");
    assert.equal(campos.inicio, "02/01/2026");
    assert.equal(campos.fim, "02/02/2026");
    assert.equal(campos.categoria, 7);
    assert.equal(campos.formaPagamento, 0);
    assert.equal(campos.conta, 0);
    assert.equal(campos.status, 1);
    const dados = servico.montarLancamento(1, { ...campos, descricao: "Conta", novaCategoria: "", novaOrigem: "" });
    assert.equal(dados.valor, 1250.5);
    assert.equal(dados.dia_inicio, "2026-01-02");
});

test("pagamento recorrente envia somente a data da ocorrencia escolhida", async () => {
    const { servico, chamadas } = carregarServico({ sucesso: true });
    await servico.pagarVencimento(7, "2026-10-08");
    assert.equal(chamadas[0].rota, "/pendencias/despesa/7/pagar");
    assert.equal(chamadas[0].opcoes.method, "POST");
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { vencimento: "2026-10-08" });
    await assert.rejects(servico.pagarVencimento(7, null), /vencimento/);
    await assert.rejects(servico.pagarVencimento(-1, "2026-10-08"), /vencimento/);
    assert.equal(chamadas.length, 1);
});

test("marca despesa simples como paga preservando todos os dados atuais", async () => {
    const item = { id_livro_caixa: 9, tipo: 1, descricao: "Conta", status: 0, recorrencia: 0, valor: 100, id_categoria: 4, conta: 0, forma_pagamento: 0, origem: "Caixa", dia: "2026-01-02", vencimento: "2026-01-03", anexo: "arquivo.pdf" };
    const { servico, chamadas } = carregarServico();
    servico.requisicaoApi = async (rota, opcoes) => {
        chamadas.push({ rota, opcoes });
        return rota === "/livro-caixa" ? { movimentacoes: [item] } : { sucesso: true };
    };
    await servico.marcarDespesaPaga(9);
    assert.equal(chamadas[1].rota, "/livro-caixa/9");
    assert.deepEqual(JSON.parse(chamadas[1].opcoes.body), { ...item, status: 1 });
    assert.equal(item.status, 0);
});

test("nao altera receita, despesa paga ou recorrencia pelo fluxo de pagamento simples", async () => {
    for (const item of [{ tipo: 0, status: 0 }, { tipo: 1, status: 1 }, { tipo: 1, status: 0, recorrencia: 4 }]) {
        const { servico, chamadas } = carregarServico({ movimentacoes: [{ ...item, id_livro_caixa: 7 }] });
        await assert.rejects(servico.marcarDespesaPaga(7));
        assert.equal(chamadas.length, 1);
        assert.equal(chamadas[0].opcoes.method, undefined);
    }
});

test("busca o proximo vencimento por tipo e id e rejeita resposta incompleta", async () => {
    const despesa = { tipo: "despesa", id: 7, vencimento: "2026-10-08" };
    const { servico } = carregarServico({ pendencias: [{ tipo: "emprestimo", id: 7 }, despesa] });
    assert.equal(await servico.buscarVencimentoDespesa(7), despesa);
    await assert.rejects(servico.buscarVencimentoDespesa(8), /vencimentos em aberto/);
    const invalido = carregarServico({ sucesso: true });
    await assert.rejects(invalido.servico.buscarVencimentoDespesa(7), /consultar/);
});

test("exige confirmacao de sucesso e preserva erros de conflito do servidor", async () => {
    const { servico } = carregarServico({});
    await assert.rejects(servico.editarMovimentacao(7, {}), /confirmar/);
    await assert.rejects(servico.pagarVencimento(7, "2026-10-08"), /confirmar/);
    servico.requisicaoApi = async () => { const erro = new Error("Esta ocorrencia ja foi paga"); erro.status = 409; throw erro; };
    await assert.rejects(servico.pagarVencimento(7, "2026-10-08"), erro => erro.status === 409);
});


test("confirmacao usa valor e data salvos e nao confunde o status inicial da recorrencia", async () => {
    const item = { id_livro_caixa: 7, tipo: 1, status: 0, recorrencia: 0, descricao: "Conta", valor: 150, vencimento: "2026-10-08" };
    const { servico } = carregarServico({ movimentacoes: [item] });
    const pagamento = await servico.prepararPagamentoDespesa(7);
    assert.equal(pagamento.valor, 150);
    assert.equal(pagamento.vencimento, "2026-10-08");
    assert.equal(pagamento.recorrente, false);
    item.recorrencia = 4;
    item.status = 1;
    servico.requisicaoApi = async rota => rota === "/livro-caixa"
        ? { movimentacoes: [item] }
        : { pendencias: [{ tipo: "despesa", id: 7, valor: 150, descricao: "Conta", vencimento: "2026-11-08" }] };
    const recorrente = await servico.prepararPagamentoDespesa(7);
    assert.equal(recorrente.vencimento, "2026-11-08");
    assert.equal(recorrente.recorrente, true);
});

test("nao confirma valor alterado depois de abrir a janela", async () => {
    const item = { id_livro_caixa: 7, tipo: 1, status: 0, recorrencia: 0, descricao: "Conta", valor: 200, vencimento: "2026-10-08" };
    const { servico, chamadas } = carregarServico({ movimentacoes: [item] });
    await assert.rejects(servico.marcarDespesaPaga(7, { descricao: "Conta", valor: 150, vencimento: "2026-10-08" }), /foi alterada/);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].opcoes.method, undefined);
});

test("nao abre confirmacao para receita ou despesa ja paga", async () => {
    for (const item of [{ tipo: 0, status: 0 }, { tipo: 1, status: 1, recorrencia: 0 }]) {
        const { servico } = carregarServico({ movimentacoes: [{ ...item, id_livro_caixa: 7 }] });
        await assert.rejects(servico.prepararPagamentoDespesa(7));
    }
});
