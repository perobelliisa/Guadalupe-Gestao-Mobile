import { requisicaoApi } from "./api";
import { getToken, getUsuario } from "./usuarioStorage";

export const LIMITE_MENSAGEM_LUPE = 2000;

export async function conversarComLupe(texto, historico = [], conversaId = null) {
    const mensagem = typeof texto === "string" ? texto.trim() : "";
    if (!mensagem) throw new Error("Escreva uma mensagem para a Lupe.");
    if (mensagem.length > LIMITE_MENSAGEM_LUPE) throw new Error("Sua mensagem deve ter até 2.000 caracteres.");
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para conversar com a Lupe.");
    const mensagens = historico.slice(-20).map(item => ({ papel: item.papel, texto: item.texto }));
    mensagens.push({ papel: "usuario", texto: mensagem });
    while (mensagens.length > 1 && mensagens.reduce((total, item) => total + item.texto.length, 0) > 40000) mensagens.splice(0, 2);
    let resposta;
    try {
        resposta = await requisicaoApi("/lupe/chat", {
            method: "POST",
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ mensagens, ...(conversaId ? { conversa_id: conversaId } : {}) }),
        }, { tempoLimite: 120000 });
    } catch (erro) {
        if (erro.status === 404) throw new Error("O chat da Lupe precisa ser atualizado no servidor. Reinicie o serviço e tente novamente.");
        throw erro;
    }
    if (typeof resposta.resposta !== "string" || !resposta.resposta.trim()) {
        throw new Error("A Lupe não conseguiu responder. Tente enviar a mensagem novamente.");
    }
    return conversaId ? { resposta: resposta.resposta.trim(), acoes: Array.isArray(resposta.acoes) ? resposta.acoes : [] } : resposta.resposta.trim();
}

async function cabecalhoAcoes(usuarioId) {
    const usuario = await getUsuario();
    const token = await getToken();
    if (!token || !usuario?.id || String(usuario.id) !== String(usuarioId)) throw new Error("Entre novamente para acessar as ações da Lupe.");
    return { Authorization: "Bearer " + token, "Content-Type": "application/json", "X-Lupe-Usuario": String(usuarioId) };
}

export async function listarAcoesLupe(conversaId, usuarioId) {
    const dados = await requisicaoApi("/lupe/acoes?conversa_id=" + encodeURIComponent(conversaId), { headers: await cabecalhoAcoes(usuarioId) });
    if (!Array.isArray(dados.acoes)) throw new Error("Não foi possível carregar as propostas da Lupe.");
    return dados.acoes;
}

export async function decidirAcaoLupe(acaoId, confirmar, usuarioId) {
    return await requisicaoApi("/lupe/acoes/" + encodeURIComponent(acaoId) + (confirmar ? "/confirmar" : "/cancelar"), {
        method: "POST", headers: await cabecalhoAcoes(usuarioId),
        body: JSON.stringify(confirmar ? { confirmar: true } : {}),
    }, { tempoLimite: 60000 });
}
