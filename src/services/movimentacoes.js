import { requisicaoApi } from "./api";
import { getToken } from "./usuarioStorage";

async function cabecalho() {
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para acessar as movimentações.");
    return { Authorization: "Bearer " + token, "Content-Type": "application/json" };
}

export async function listarMovimentacoes() {
    const dados = await requisicaoApi("/livro-caixa", { headers: await cabecalho() });
    if (!Array.isArray(dados.movimentacoes)) throw new Error("A API não retornou a lista de movimentações.");
    return dados.movimentacoes;
}

export async function listarCategorias() {
    const dados = await requisicaoApi("/categorias", { headers: await cabecalho() });
    if (!Array.isArray(dados.categorias)) throw new Error("A API não retornou as categorias.");
    return dados.categorias;
}

export async function listarProjetos() {
    const dados = await requisicaoApi("/projetos", { headers: await cabecalho() });
    if (!Array.isArray(dados.projetos)) throw new Error("A API não retornou os projetos.");
    return dados.projetos;
}

export async function cadastrarMovimentacao(tipo, lancamento, anexo = null) {
    if (tipo !== 0 && tipo !== 1) throw new Error("Selecione receita ou despesa.");
    const headers = await cabecalho();
    let body = JSON.stringify(lancamento);
    if (anexo) {
        // O DocumentPicker já copia o documento para o cache do aplicativo.
        // O fetch nativo do React Native aceita esse URI no multipart.
        if (!anexo.file && (typeof anexo.uri !== "string" || !/^(file|content):\/\//.test(anexo.uri))) {
            throw new Error("O comprovante selecionado não tem um endereço válido. Selecione o arquivo novamente.");
        }
        body = new FormData();
        for (const [campo, valor] of Object.entries(lancamento)) {
            if (valor !== null && valor !== undefined) body.append(campo, String(valor));
        }
        if (anexo.file) body.append("anexo", anexo.file, anexo.name);
        else body.append("anexo", { uri: anexo.uri, name: anexo.name, type: anexo.mimeType });
        // O fetch define o boundary do formulário com arquivo.
        delete headers["Content-Type"];
    }
    return await requisicaoApi(tipo === 0 ? "/entradas" : "/despesas", {
        method: "POST",
        headers,
        body,
    }, anexo ? { tempoLimite: 60000, anexo: true } : {});
}

export const RECORRENCIAS = [
    { valor: 0, nome: "Não recorrente", dias: 0 },
    { valor: 1, nome: "A cada 15 dias", dias: 15 },
    { valor: 2, nome: "A cada 30 dias", dias: 30 },
    { valor: 3, nome: "Todo dia", dias: 1 },
    { valor: 4, nome: "Semanal", dias: 7 },
];

export function montarOrigens(movimentos) {
    const origens = [];
    for (const item of movimentos) {
        const origem = String(item.origem || "").trim();
        if (origem && !origens.some(valor => valor.toLocaleLowerCase("pt-BR") === origem.toLocaleLowerCase("pt-BR"))) origens.push(origem);
    }
    return origens.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function montarLancamento(tipo, campos) {
    if (tipo !== 0 && tipo !== 1) throw new Error("Selecione receita ou despesa.");
    if (!campos.descricao.trim()) throw new Error("Preencha a descrição.");
    if (!campos.categoria) throw new Error("Selecione uma categoria.");
    if (campos.categoria === "__nova__" && !campos.novaCategoria.trim()) throw new Error("Informe o nome da nova categoria.");
    const origem = campos.origem === "__nova__" ? campos.novaOrigem.trim() : campos.origem.trim();
    if (!origem) throw new Error(tipo === 0 ? "Informe a fonte do recurso." : "Informe de onde veio o pagamento.");
    if (campos.formaPagamento === null) throw new Error("Selecione a forma de pagamento.");
    const dados = {
        descricao: campos.descricao.trim(),
        valor: converterValor(campos.valor),
        dia: converterData(campos.data.trim()),
        conta: campos.conta,
        forma_pagamento: campos.formaPagamento,
        origem,
        observacao: campos.observacao.trim(),
    };
    if (campos.categoria === "__nova__") dados.categoria = campos.novaCategoria.trim();
    else dados.id_categoria = campos.categoria;
    if (tipo === 1) {
        dados.fornecedor = campos.fornecedor.trim();
        dados.status = campos.status;
        dados.recorrencia = campos.recorrencia;
        dados.dia_inicio = campos.inicio.trim() ? converterData(campos.inicio.trim(), true) : null;
        dados.dia_fim = campos.fim.trim() ? converterData(campos.fim.trim(), true) : null;
        const opcao = RECORRENCIAS.find(item => item.valor === campos.recorrencia);
        if (!opcao) throw new Error("Recorrência inválida.");
        if (campos.recorrencia !== 0 && (!dados.dia_inicio || !dados.dia_fim)) throw new Error("Informe as datas de início e fim para essa recorrência.");
        if (Boolean(dados.dia_inicio) !== Boolean(dados.dia_fim)) throw new Error("Informe as duas datas da recorrência.");
        if (dados.dia_inicio && dados.dia_fim) {
            const dias = (Date.parse(dados.dia_fim) - Date.parse(dados.dia_inicio)) / 86400000;
            if (dias <= 0) throw new Error("A data de fim deve ser posterior à data de início.");
            if (dias < opcao.dias) throw new Error(`A data de fim deve respeitar pelo menos ${opcao.dias} dias de recorrência.`);
        }
    }
    return dados;
}

export function converterValor(texto) {
    const valor = texto.trim();
    // Aceita 1250,50 ou 1.250,50, sem aceitar letras ou valores negativos.
    if (!/^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(valor)) {
        throw new Error("Informe um valor válido, por exemplo: 1.250,50.");
    }
    const numero = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) throw new Error("O valor deve ser maior que zero.");
    return numero;
}

export function converterData(texto, permitirFutura = false) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) throw new Error("Informe a data no formato DD/MM/AAAA.");
    const [dia, mes, ano] = texto.split("/").map(Number);
    const data = new Date(ano, mes - 1, dia);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
        throw new Error("Informe uma data válida.");
    }
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (!permitirFutura && data > hoje) throw new Error("A data da movimentação não pode ser futura.");
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
