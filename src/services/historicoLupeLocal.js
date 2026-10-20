import AsyncStorage from "@react-native-async-storage/async-storage";

let fila = Promise.resolve();

function executarEmFila(acao) {
    const tarefa = fila.then(acao);
    fila = tarefa.catch(() => {});
    return tarefa;
}

function prefixoUsuario(usuarioId) {
    if ((typeof usuarioId !== "number" && typeof usuarioId !== "string") || !String(usuarioId).trim()) {
        throw new Error("Entre novamente para acessar o histórico da Lupe.");
    }
    return `lupe:v1:${encodeURIComponent(String(usuarioId))}:`;
}

function chaveConversa(prefixo, id) {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) throw new Error("A conversa selecionada é inválida.");
    return prefixo + "conversa:" + id;
}

async function lerIndice(prefixo) {
    const salvo = await AsyncStorage.getItem(prefixo + "indice");
    if (salvo === null) return [];
    const indice = JSON.parse(salvo);
    if (!Array.isArray(indice) || indice.some(item => !item || typeof item.id !== "string" || typeof item.titulo !== "string" || typeof item.resumo !== "string" || !Number.isFinite(Date.parse(item.atualizadaEm)))) {
        throw new Error("O histórico salvo não pôde ser lido. Tente novamente.");
    }
    return indice.sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

function validarConversa(conversa) {
    if (!conversa || !Number.isFinite(Date.parse(conversa.criadaEm)) || !Number.isFinite(Date.parse(conversa.atualizadaEm)) || !Array.isArray(conversa.mensagens) || !conversa.mensagens.length || conversa.mensagens.length % 2 !== 0) {
        throw new Error("A conversa salva não pôde ser lida.");
    }
    for (const [indice, mensagem] of conversa.mensagens.entries()) {
        if (!mensagem || mensagem.papel !== (indice % 2 ? "lupe" : "usuario") || typeof mensagem.texto !== "string" || !mensagem.texto.trim()) {
            throw new Error("A conversa salva não pôde ser lida.");
        }
    }
}

export function criarConversaLupe() {
    const agora = new Date().toISOString();
    return { id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2), criadaEm: agora, atualizadaEm: agora, mensagens: [] };
}

export function listarConversasLupe(usuarioId) {
    return executarEmFila(() => lerIndice(prefixoUsuario(usuarioId)));
}

export function carregarConversaLupe(usuarioId, id) {
    return executarEmFila(async () => {
        const salvo = await AsyncStorage.getItem(chaveConversa(prefixoUsuario(usuarioId), id));
        if (salvo === null) throw new Error("Esta conversa não está mais disponível.");
        const conversa = JSON.parse(salvo);
        validarConversa(conversa);
        if (conversa.id !== id) throw new Error("A conversa selecionada é inválida.");
        return conversa;
    });
}

export function salvarConversaLupe(usuarioId, conversa) {
    // Captura a conversa antes de entrar na fila para preservar cada atualização.
    const copia = JSON.parse(JSON.stringify(conversa));
    return executarEmFila(async () => {
        const prefixo = prefixoUsuario(usuarioId);
        validarConversa(copia);
        const chave = chaveConversa(prefixo, copia.id);
        const indice = await lerIndice(prefixo);
        const resumo = {
            id: copia.id,
            titulo: copia.mensagens[0].texto.replace(/\s+/g, " ").trim().slice(0, 80),
            resumo: copia.mensagens.at(-1).texto.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 140),
            atualizadaEm: copia.atualizadaEm,
            quantidadeMensagens: copia.mensagens.length,
        };
        const atualizado = [resumo, ...indice.filter(item => item.id !== copia.id)].sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
        await AsyncStorage.setItem(chave, JSON.stringify(copia));
        await AsyncStorage.setItem(prefixo + "indice", JSON.stringify(atualizado));
        return atualizado;
    });
}

export function excluirConversaLupe(usuarioId, id) {
    return executarEmFila(async () => {
        const prefixo = prefixoUsuario(usuarioId);
        const chave = chaveConversa(prefixo, id);
        const indice = await lerIndice(prefixo);
        const atualizado = indice.filter(item => item.id !== id);
        // Retira da lista antes de apagar o conteúdo para não deixar links inválidos.
        await AsyncStorage.setItem(prefixo + "indice", JSON.stringify(atualizado));
        await AsyncStorage.removeItem(chave);
        return atualizado;
    });
}
