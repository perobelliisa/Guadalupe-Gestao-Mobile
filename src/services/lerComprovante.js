import { fetch as fetchExpo } from "expo/fetch";
import { requisicaoApi } from "./api";
import { getToken } from "./usuarioStorage";
import { normalizarAnexo } from "./anexos";
import { adicionarAnexo } from "./uploadAnexo";

export function montarRascunhoComprovante(dados) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error("Não foi possível ler os dados do comprovante.");
    const valor = typeof dados.valor === "string" && /^\d+\.\d{2}$/.test(dados.valor) && Number(dados.valor) > 0 ? dados.valor.replace(".", ",") : "";
    const dia = typeof dados.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dados.dia) ? dados.dia.split("-").reverse().join("/") : "";
    return {
        descricao: typeof dados.descricao === "string" ? dados.descricao.slice(0, 200) : "",
        fornecedor: typeof dados.fornecedor === "string" ? dados.fornecedor.slice(0, 100) : "",
        categoria: typeof dados.categoria === "string" ? dados.categoria.trim().slice(0, 100) : "",
        origem: typeof dados.origem === "string" ? dados.origem.trim().slice(0, 150) : "",
        status: dados.status === 0 || dados.status === 1 ? dados.status : null,
        valor, data: dia,
        formaPagamento: [0, 1, 2, 3, 4, 5].includes(dados.forma_pagamento) ? dados.forma_pagamento : null,
    };
}

function normalizarNome(nome) {
    return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function selecionarOpcoesComprovante(dados, categorias, origens) {
    const campos = {};
    if (dados.categoria) {
        const existente = categorias.find(item => Number(item.tipo) === 1 && normalizarNome(item.nome) === normalizarNome(dados.categoria));
        campos.categoria = existente ? Number(existente.id_categoria) : "__nova__";
        campos.novaCategoria = existente ? "" : dados.categoria;
    }
    if (dados.origem) {
        const existente = origens.find(nome => normalizarNome(nome) === normalizarNome(dados.origem));
        campos.origem = existente || "__nova__";
        campos.novaOrigem = existente ? "" : dados.origem;
    }
    return campos;
}

export async function lerComprovante(arquivo, categorias = [], origens = []) {
    const anexo = normalizarAnexo(arquivo);
    if (!["image/jpeg", "image/png"].includes(anexo.mimeType)) throw new Error("Escolha uma foto JPG ou PNG para ler o comprovante.");
    if (!anexo.file && (typeof anexo.uri !== "string" || !/^(file|content):\/\//.test(anexo.uri))) throw new Error("Selecione a foto novamente.");
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para ler o comprovante.");
    const body = new FormData();
    adicionarAnexo(body, anexo);
    body.append("opcoes", JSON.stringify({ categorias: categorias.filter(item => Number(item.tipo) === 1).map(item => item.nome).slice(0, 200), origens: origens.slice(0, 200) }));
    const resposta = await requisicaoApi("/comprovantes/ler", { method: "POST", headers: { Authorization: "Bearer " + token }, body }, { enviar: fetchExpo, tempoLimite: 60000 });
    const rascunho = montarRascunhoComprovante(resposta.dados);
    rascunho.leituraDesatualizada = !["categoria", "origem", "status"].every(campo => Object.prototype.hasOwnProperty.call(resposta.dados, campo));
    return rascunho;
}
