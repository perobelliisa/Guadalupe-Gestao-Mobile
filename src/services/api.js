// IP do computador que está executando a API. Celular e computador devem usar a mesma rede.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || " http://10.92.11.38:5000").trim().replace(/\/+$/, "");

function extrairMensagem(valor, profundidade = 0) {
    if (typeof valor === "string") {
        const texto = valor.trim();
        return texto.includes("[object Object]") ? "" : texto;
    }
    if (!valor || typeof valor !== "object" || profundidade > 5) return "";
    if (Array.isArray(valor)) {
        return valor.map(item => extrairMensagem(item, profundidade + 1)).filter(Boolean).join("\n");
    }
    for (const campo of ["mensagem", "message", "erro", "error", "detail", "msg"]) {
        const mensagem = extrairMensagem(valor[campo], profundidade + 1);
        if (mensagem) return mensagem;
    }
    return "";
}

export function mensagemErro(erro, padrao = "Não foi possível concluir a solicitação. Tente novamente.") {
    if (typeof erro?.mensagemUsuario === "string") return mensagemErro(erro.mensagemUsuario, padrao);
    const texto = extrairMensagem(erro);
    if (/numeric overflow|SQL_INT64|out of range/i.test(texto)) return "O valor informado é muito alto. Confira o valor e tente novamente.";
    if (/string.*truncation|value too long/i.test(texto)) return "Um dos campos tem texto demais. Reduza o conteúdo e tente novamente.";
    if (/foreign key|integrity constraint/i.test(texto)) return "Um dos dados selecionados não está mais disponível. Atualize a tela e selecione novamente.";
    if (/network request failed|failed to fetch|NetworkError/i.test(texto)) return "Não foi possível conectar. Confira sua conexão e tente novamente.";
    if (erro?.status === 413) return "O arquivo é muito grande. Escolha um arquivo menor e tente novamente.";
    if (erro?.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.";
    if (erro?.status >= 500) return "O serviço está indisponível no momento. Tente novamente mais tarde.";
    // Detalhes de implementação não devem aparecer nas telas, mesmo em erros locais.
    if (/\bAPI\b|\bSQL\w*\b|traceback|exception|typeerror|referenceerror|syntaxerror|\bat \w+.*\(|https?:\/\/|\bselect\b.+\bfrom\b|\binsert into\b|\bupdate\b.+\bset\b|\b(stack|errno|firebird|database|constraint)\b|[{}]|\\n/i.test(texto) || texto.length > 260) return padrao;
    if (!texto || !/^(Não |Confira |Informe |Preencha |Selecione |Escolha |Envie |Entre |Faça |Sua |Seu |Você |O |A |Os |As |Um |Uma |Este |Esta |Esse |Essa |E-mail |Email |Senha |Sessão |Serviço |Acesso |Nenhum |Valor |Data |Recorrência |Nome |Perfil |Status |Projeto |Lançamento )/i.test(texto)) return padrao;
    return texto;
}

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
            if (erro?.name === "AbortError") throw erro;
            if (configuracao.anexo) {
                throw new Error("Não foi possível confirmar o envio. Confira em Movimentos se o lançamento foi salvo antes de tentar novamente.");
            }
            throw new Error("Não foi possível conectar. Confira sua conexão e tente novamente.");
        }

        let dados;
        try {
            dados = await resposta.json();
        } catch {
            const erro = new Error("Não foi possível carregar os dados. Tente novamente em instantes.");
            erro.status = resposta.status;
            throw erro;
        }

        if (!resposta.ok || dados?.sucesso === false) {
            const padrao = caminho === "/login" && resposta.status === 401
                ? "E-mail ou senha incorretos. Confira os dados e tente novamente."
                : "Não foi possível concluir a solicitação.";
            const erro = new Error(mensagemErro({ mensagem: dados, status: resposta.status }, padrao));
            erro.mensagemUsuario = erro.message;
            erro.status = resposta.status;
            throw erro;
        }

        if (!dados || typeof dados !== "object") {
            const erro = new Error("Não foi possível carregar os dados. Tente novamente em instantes.");
            erro.status = resposta.status;
            throw erro;
        }

        return dados;
    } catch (erro) {
        if (erro?.name === "AbortError") {
            const gravando = opcoes.method && opcoes.method !== "GET";
            throw new Error(gravando
                ? "Não foi possível confirmar a operação. Confira se a alteração foi salva antes de tentar novamente."
                : "A conexão demorou mais que o esperado. Tente novamente.");
        }
        throw erro;
    } finally {
        clearTimeout(tempoLimite);
    }
}
