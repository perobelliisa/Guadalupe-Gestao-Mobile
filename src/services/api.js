// IP do computador que está executando a API. Celular e computador devem usar a mesma rede.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://10.92.11.14:5000").trim().replace(/\/+$/, "");

export async function requisicaoApi(caminho, opcoes = {}, configuracao = {}) {
    const controle = new AbortController();
    const tempoLimite = setTimeout(() => controle.abort(), configuracao.tempoLimite || 15000);
    const enviar = configuracao.enviar || fetch;

    try {
        let resposta;
        try {
            resposta = await enviar(API_URL + caminho, {
                ...opcoes,
                credentials: "omit",
                signal: controle.signal,
            });
        } catch (erro) {
            if (erro.name === "AbortError") throw erro;
            if (configuracao.anexo) {
                throw new Error("Não foi possível enviar o comprovante à API. Selecione o arquivo novamente e confira a conexão. Antes de repetir o cadastro, verifique se a despesa já apareceu em Movimentos.");
            }
            throw new Error(`Não foi possível conectar à API em ${API_URL}. Confira o IP do computador da API, se o servidor está ligado e se o celular tem acesso à mesma rede.`);
        }

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
        throw erro;
    } finally {
        clearTimeout(tempoLimite);
    }
}
