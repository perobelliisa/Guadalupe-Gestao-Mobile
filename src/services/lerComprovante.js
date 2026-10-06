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
        valor, data: dia,
        formaPagamento: [0, 1, 2, 3, 4, 5].includes(dados.forma_pagamento) ? dados.forma_pagamento : null,
    };
}

export async function lerComprovante(arquivo) {
    const anexo = normalizarAnexo(arquivo);
    if (!["image/jpeg", "image/png"].includes(anexo.mimeType)) throw new Error("Escolha uma foto JPG ou PNG para ler o comprovante.");
    if (!anexo.file && (typeof anexo.uri !== "string" || !/^(file|content):\/\//.test(anexo.uri))) throw new Error("Selecione a foto novamente.");
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para ler o comprovante.");
    const body = new FormData();
    adicionarAnexo(body, anexo);
    const resposta = await requisicaoApi("/comprovantes/ler", { method: "POST", headers: { Authorization: "Bearer " + token }, body }, { enviar: fetchExpo, tempoLimite: 60000 });
    return montarRascunhoComprovante(resposta.dados);
}
