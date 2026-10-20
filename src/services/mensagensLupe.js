// Avisos do servidor entram na conversa sem criar mensagens falsas do usuário.
export function montarMensagensLupe(conversa) {
    const mensagens = conversa.mensagens || [];
    return [
        ...mensagens.map((mensagem, indice) => ({ ...mensagem, chave: 'mensagem-' + indice, ordem: indice })),
        ...(conversa.avisos || []).map(aviso => ({ papel: 'lupe', texto: aviso.texto, chave: 'aviso-' + aviso.id, ordem: Math.max(0, Math.min(aviso.aposMensagem, mensagens.length)) - 0.5 })),
    ].sort((a, b) => a.ordem - b.ordem);
}
