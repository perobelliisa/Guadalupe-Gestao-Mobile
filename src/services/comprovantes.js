import { API_URL, requisicaoApi } from "./api";
import { getToken } from "./usuarioStorage";
import { normalizarAnexo } from "./anexos";

export function temComprovante(item) {
    return typeof item.anexo === "string" && item.anexo.trim().length > 0;
}

export function urlComprovante(caminho) {
    if (typeof caminho !== "string" || !/^\/arquivos\/movimentacoes\/[^/\\]+\.(pdf|jpe?g|png)$/i.test(caminho)) {
        throw new Error("O endereço do comprovante é inválido.");
    }
    return API_URL + caminho;
}

export async function enviarComprovante(id, arquivo) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error("Lançamento inválido.");
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para enviar comprovantes.");
    const anexo = normalizarAnexo(arquivo);
    if (!anexo.file && (typeof anexo.uri !== "string" || !/^(file|content):\/\//.test(anexo.uri))) {
        throw new Error("Selecione o arquivo novamente.");
    }
    const body = new FormData();
    if (anexo.file) body.append("anexo", anexo.file, anexo.name);
    else body.append("anexo", { uri: anexo.uri, name: anexo.name, type: anexo.mimeType });
    const dados = await requisicaoApi(`/livro-caixa/${Number(id)}/anexo`, {
        method: "POST", headers: { Authorization: "Bearer " + token }, body,
    }, { tempoLimite: 60000 });
    if (!temComprovante(dados)) throw new Error("A API não confirmou o comprovante. Atualize a lista antes de tentar novamente.");
    return dados.anexo;
}
