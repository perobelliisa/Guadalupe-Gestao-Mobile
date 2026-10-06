import { fetch as fetchExpo } from "expo/fetch";
import { adicionarAnexo } from "./uploadAnexo";
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
        // O seletor copia o comprovante para o cache do aplicativo.
        if (!anexo.file && (typeof anexo.uri !== "string" || !/^(file|content):\/\//.test(anexo.uri))) {
            throw new Error("O comprovante selecionado não tem um endereço válido. Selecione o arquivo novamente.");
        }
        body = new FormData();
        for (const [campo, valor] of Object.entries(lancamento)) {
            if (valor !== null && valor !== undefined) body.append(campo, String(valor));
        }
        adicionarAnexo(body, anexo);
        // O fetch define o boundary do formulário com arquivo.
        delete headers["Content-Type"];
    }
    return await requisicaoApi(tipo === 0 ? "/entradas" : "/despesas", {
        method: "POST",
        headers,
        body,
    }, anexo ? { tempoLimite: 60000, anexo: true, enviar: fetchExpo } : {});
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
    // Acima deste limite o JavaScript não preserva todos os centavos.
    const [inteiro, fracao = ""] = valor.replace(/\./g, "").split(",");
    if (BigInt(inteiro + fracao.padEnd(2, "0")) > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("O valor informado é muito alto. Confira o valor e tente novamente.");
    }
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

// A edição usa a mesma rota do EditorMovimentacao do web.
export async function editarMovimentacao(id, lancamento) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error("Selecione um lançamento válido.");
    const dados = await requisicaoApi(`/livro-caixa/${id}`, {
        method: "PUT",
        headers: await cabecalho(),
        body: JSON.stringify(lancamento),
    });
    if (!dados.sucesso) throw new Error("Não foi possível confirmar a alteração. Atualize a lista.");
    return dados;
}

export async function pagarVencimento(id, vencimento) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento || "")) {
        throw new Error("Selecione uma despesa e um vencimento válidos.");
    }
    const dados = await requisicaoApi(`/pendencias/despesa/${id}/pagar`, {
        method: "POST",
        headers: await cabecalho(),
        body: JSON.stringify({ vencimento }),
    });
    if (!dados.sucesso) throw new Error("Não foi possível confirmar o pagamento. Atualize a lista.");
    return dados;
}

export async function marcarDespesaPaga(id, pagamentoEsperado = null) {
    // Reconsulta antes de pagar para usar os dados atuais do servidor.
    const movimentos = await listarMovimentacoes();
    const despesa = movimentos.find(item => Number(item.id_livro_caixa) === Number(id));
    if (!despesa || Number(despesa.tipo) !== 1) throw new Error("Selecione uma despesa válida.");
    if (Number(despesa.recorrencia)) {
        throw new Error("Selecione o vencimento da recorrência para pagar.");
    }
    if (Number(despesa.status) === 1) throw new Error("Esta despesa já foi paga. Atualize a lista.");
    if (pagamentoEsperado && (Number(despesa.valor) !== Number(pagamentoEsperado.valor)
        || despesa.descricao !== pagamentoEsperado.descricao
        || (despesa.vencimento || null) !== (pagamentoEsperado.vencimento || null))) {
        throw new Error("Esta despesa foi alterada. Atualize os dados antes de confirmar o pagamento.");
    }
    // PUT exige o registro completo; preserva os campos que não foram alterados.
    return await editarMovimentacao(id, { ...despesa, status: 1 });
}

export function camposDaMovimentacao(item) {
    const data = valor => valor ? valor.slice(0, 10).split("-").reverse().join("/") : "";
    return {
        descricao: item.descricao || "",
        valor: Number(item.valor).toFixed(2).replace(".", ","),
        data: data(item.dia || item.data),
        categoria: Number(item.id_categoria || 0),
        conta: Number(item.conta || 0),
        formaPagamento: item.forma_pagamento == null ? null : Number(item.forma_pagamento),
        fornecedor: item.fornecedor || "",
        origem: item.origem || "",
        recorrencia: Number(item.recorrencia || 0),
        inicio: data(item.dia_inicio),
        fim: data(item.dia_fim),
        status: Number(item.status || 0),
        observacao: item.observacao || "",
    };
}

export async function buscarVencimentoDespesa(id) {
    const dados = await requisicaoApi("/pendencias", { headers: await cabecalho() });
    if (!Array.isArray(dados.pendencias)) throw new Error("Não foi possível consultar os vencimentos.");
    const pendencia = dados.pendencias.find(item => item.tipo === "despesa" && Number(item.id) === Number(id));
    if (!pendencia) throw new Error("Esta despesa não tem vencimentos em aberto. Atualize a lista.");
    return pendencia;
}

// Dados salvos que serão exibidos antes da confirmação do pagamento.
export async function prepararPagamentoDespesa(id) {
    const movimentos = await listarMovimentacoes();
    const despesa = movimentos.find(item => Number(item.id_livro_caixa) === Number(id));
    if (!despesa || Number(despesa.tipo) !== 1) throw new Error("Selecione uma despesa válida.");
    if (Number(despesa.recorrencia)) {
        const pendencia = await buscarVencimentoDespesa(id);
        return { ...pendencia, recorrente: true };
    }
    if (Number(despesa.status) === 1) throw new Error("Esta despesa já foi paga. Atualize a lista.");
    return { id: despesa.id_livro_caixa, descricao: despesa.descricao, valor: despesa.valor, vencimento: despesa.vencimento, recorrente: false };
}
