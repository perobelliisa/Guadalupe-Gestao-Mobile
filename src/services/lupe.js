import { requisicaoApi } from "./api";
import { getToken } from "./usuarioStorage";

export const LIMITE_MENSAGEM_LUPE = 2000;

export async function conversarComLupe(texto, historico = []) {
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
            body: JSON.stringify({ mensagens }),
        }, { tempoLimite: 60000 });
    } catch (erro) {
        if (erro.status === 404) throw new Error("O chat da Lupe precisa ser atualizado no servidor. Reinicie o serviço e tente novamente.");
        throw erro;
    }
    if (typeof resposta.resposta !== "string" || !resposta.resposta.trim()) {
        throw new Error("A Lupe não conseguiu responder. Tente enviar a mensagem novamente.");
    }
    return resposta.resposta.trim();
}
