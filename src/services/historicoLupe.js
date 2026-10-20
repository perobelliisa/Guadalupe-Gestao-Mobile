import { requisicaoApi } from "./api";
import { getToken, getUsuario } from "./usuarioStorage";
import { criarConversaLupe, listarConversasLupe as listarLocais, carregarConversaLupe as carregarLocal, excluirConversaLupe as excluirLocal } from "./historicoLupeLocal";

export { criarConversaLupe };
let fila = Promise.resolve();

function executarEmFila(acao) {
    const tarefa = fila.then(acao);
    fila = tarefa.catch(() => {});
    return tarefa;
}

async function credenciais(usuarioId) {
    const usuario = await getUsuario();
    const token = await getToken();
    if (!token || !usuario?.id || String(usuario.id) !== String(usuarioId)) throw new Error("Entre novamente para acessar o histórico da Lupe.");
    return { Authorization: "Bearer " + token, "Content-Type": "application/json", "X-Lupe-Usuario": String(usuarioId) };
}

async function solicitar(caminho, headers, opcoes = {}) {
    try {
        return await requisicaoApi("/lupe/conversas" + caminho, { ...opcoes, headers });
    } catch (erro) {
        if (erro.status === 404 && !caminho) throw new Error("O histórico compartilhado precisa ser atualizado no servidor. Reinicie o serviço e tente novamente.");
        throw erro;
    }
}

function validarLista(dados) {
    if (!Array.isArray(dados.conversas)) throw new Error("Não foi possível carregar o histórico compartilhado.");
    return dados.conversas;
}

export function listarConversasLupe(usuarioId) {
    return executarEmFila(async () => {
        const headers = await credenciais(usuarioId);
        // Só remove a cópia antiga depois de o servidor confirmar a importação.
        const locais = await listarLocais(usuarioId);
        for (const item of locais) {
            const conversa = await carregarLocal(usuarioId, item.id);
            await solicitar("/" + encodeURIComponent(item.id), headers, { method: "PUT", body: JSON.stringify({ ...conversa, revisao: 0, importacao: true }) });
            await excluirLocal(usuarioId, item.id);
        }
        return validarLista(await solicitar("", headers));
    });
}

export function carregarConversaLupe(usuarioId, id) {
    return executarEmFila(async () => {
        const dados = await solicitar("/" + encodeURIComponent(id), await credenciais(usuarioId));
        if (!dados.conversa || !Array.isArray(dados.conversa.mensagens)) throw new Error("Não foi possível abrir esta conversa.");
        return dados.conversa;
    });
}

export function salvarConversaLupe(usuarioId, conversa) {
    const corpo = JSON.stringify(conversa);
    return executarEmFila(async () => {
        const dados = await solicitar("/" + encodeURIComponent(conversa.id), await credenciais(usuarioId), { method: "PUT", body: corpo });
        if (!dados.conversa || !Array.isArray(dados.conversa.mensagens)) throw new Error("Não foi possível confirmar o salvamento da conversa.");
        return { conversas: validarLista(dados), conversa: dados.conversa };
    });
}

export function excluirConversaLupe(usuarioId, id) {
    return executarEmFila(async () => validarLista(await solicitar("/" + encodeURIComponent(id), await credenciais(usuarioId), { method: "DELETE" })));
}
