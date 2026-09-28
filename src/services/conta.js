import { requisicaoApi } from "./api";
import { getToken, salvarUsuario } from "./usuarioStorage";

export const PERFIS = [{ valor: 0, nome: "Administrador geral" }, { valor: 1, nome: "Financeiro" }, { valor: 2, nome: "Voluntário" }];
export const STATUS = [{ valor: 0, nome: "Ativo" }, { valor: 1, nome: "Inativo" }];

async function cabecalho() {
    const token = await getToken();
    if (!token) throw new Error("Entre novamente para acessar sua conta.");
    return { Authorization: "Bearer " + token };
}

export async function carregarConta() {
    const dados = await requisicaoApi("/minha-conta", { headers: await cabecalho() });
    const usuario = dados.usuario;
    if (!usuario?.id_usuario || typeof usuario.nome !== "string" || typeof usuario.email !== "string" || !PERFIS.some(item => String(item.valor) === String(usuario.tipo)) || !STATUS.some(item => String(item.valor) === String(usuario.status))) {
        throw new Error("A API não retornou os dados completos da conta.");
    }
    return { ...usuario, tipo: Number(usuario.tipo), status: Number(usuario.status) };
}

export async function salvarConta(conta) {
    const nome = conta.nome.trim();
    const email = conta.email.trim().toLowerCase();
    if (!nome) throw new Error("Preencha o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if (!PERFIS.some(item => item.valor === conta.tipo) || !STATUS.some(item => item.valor === conta.status)) throw new Error("Selecione um perfil e um status válidos.");
    const body = new FormData();
    for (const [campo, valor] of Object.entries({ nome, email, tipo: conta.tipo, status: conta.status })) body.append(campo, String(valor));
    await requisicaoApi("/minha-conta", { method: "PUT", headers: await cabecalho(), body });
    const atualizada = { ...conta, nome, email };
    try {
        await salvarUsuario(conta.id_usuario, nome, email);
    } catch {
        return { conta: atualizada, aviso: "Conta salva na API. Não foi possível atualizar os dados neste celular; entre novamente." };
    }
    return { conta: atualizada, aviso: "" };
}
