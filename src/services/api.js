// IP do computador que está executando a API. Celular e computador devem usar a mesma rede.
export const API_URL = "http://10.92.11.65:5000";

export async function requisicaoApi(caminho, opcoes = {}) {
    const controle = new AbortController();
    const tempoLimite = setTimeout(() => controle.abort(), 15000);

    try {
        const resposta = await fetch(API_URL + caminho, {
            ...opcoes,
            credentials: "omit",
            signal: controle.signal,
        });

        let dados;
        try {
            dados = await resposta.json();
        } catch {
            const erro = new Error("A API retornou uma resposta inválida. Tente novamente.");
            erro.status = resposta.status;
            throw erro;
        }

        if (!resposta.ok || dados.sucesso === false) {
            const erro = new Error(dados.mensagem || dados.erro || "Não foi possível concluir a solicitação.");
            erro.status = resposta.status;
            throw erro;
        }

        return dados;
    } catch (erro) {
        if (erro.name === "AbortError") {
            throw new Error("A API demorou para responder. Tente novamente.");
        }
        if (erro instanceof TypeError) {
            throw new Error("Não foi possível conectar à API. Confira se ela está ligada e se o celular está na mesma rede do computador.");
        }
        throw erro;
    } finally {
        clearTimeout(tempoLimite);
    }
}
