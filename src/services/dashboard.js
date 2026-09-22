import { listarMovimentacoes, listarProjetos } from "./movimentacoes";

export function montarDashboard(movimentacoes, projetos) {
    let receitas = 0;
    let despesas = 0;

    // Mesma regra do relatório: todas as entradas e saídas do livro-caixa.
    // Soma em centavos para evitar diferenças de arredondamento.
    for (const item of movimentacoes) {
        const valor = Number(item.valor);
        if (item.valor === null || item.valor === "" || !Number.isFinite(valor)) {
            throw new Error("A API retornou um lançamento com valor inválido.");
        }
        if (Number(item.tipo) === 0) receitas += Math.round(valor * 100);
        if (Number(item.tipo) === 1) despesas += Math.round(valor * 100);
    }

    const ultimos = movimentacoes.filter(item => Number(item.tipo) === 0 || Number(item.tipo) === 1)
        .sort((a, b) => String(b.data || b.dia || "").localeCompare(String(a.data || a.dia || "")) || Number(b.id_livro_caixa) - Number(a.id_livro_caixa))
        .slice(0, 3)
        .map(item => {
            const projeto = projetos.find(projeto => Number(projeto.id_projeto) === Number(item.conta));
            return { ...item, projeto: !Number(item.conta) ? "Missão Guadalupe" : projeto?.nome || "Projeto " + item.conta };
        });

    return { receitas: receitas / 100, despesas: despesas / 100, saldo: (receitas - despesas) / 100, lancamentos: ultimos };
}

export async function carregarDashboard() {
    const [movimentacoes, projetos] = await Promise.all([listarMovimentacoes(), listarProjetos()]);
    return montarDashboard(movimentacoes, projetos);
}
