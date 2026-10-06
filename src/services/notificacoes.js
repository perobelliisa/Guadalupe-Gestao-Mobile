import { requisicaoApi } from "./api";
import { getToken } from "./usuarioStorage";

// A API calcula os dias restantes e remove os vencimentos já pagos.
export function montarNotificacoes(pendencias) {
    return pendencias
        .filter(item => item.tipo === "despesa" && Number.isInteger(item.dias) && item.dias < 14)
        .sort((a, b) => a.dias - b.dias)
        .map(item => {
            let titulo;
            if (item.dias < 0) titulo = "Despesa vencida";
            else if (item.dias === 0) titulo = "Vence hoje";
            else if (item.dias === 1) titulo = "Vence amanhã";
            else titulo = `Vence em ${item.dias} dias`;

            const data = item.vencimento.split("-").reverse().join("/");
            return {
                chave: item.chave,
                id: item.id,
                descricao: item.descricao || "Despesa",
                valor: item.valor,
                vencimento: item.vencimento,
                titulo,
                mensagem: `${item.descricao || "Despesa"} — vencimento em ${data}.`,
                vencida: item.dias < 0,
            };
        });
}

export async function listarNotificacoes() {
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para consultar as notificações.");
    const dados = await requisicaoApi("/pendencias", {
        headers: { Authorization: "Bearer " + token },
    });
    if (!Array.isArray(dados.pendencias)) {
        throw new Error("Não foi possível consultar as notificações.");
    }
    return montarNotificacoes(dados.pendencias);
}
