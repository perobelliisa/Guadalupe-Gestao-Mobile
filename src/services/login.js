import { requisicaoApi } from "./api";
import { getBiometria } from "./biometria";
import { getBiometriaLiberada, getToken, liberarBiometria, limparDados, salvarToken, salvarUsuario } from "./usuarioStorage";

async function validarAdministrador(tipo) {
    // No backend, o tipo 0 representa o administrador.
    if (tipo !== 0 && tipo !== "0") {
        await limparDados();
        throw new Error("Você não tem autorização para acessar esse sistema");
    }
}

export async function realizarLogin(email, senha) {
    if (!email.trim() || !senha) {
        throw new Error("Preencha e-mail e senha.");
    }

    const dados = await requisicaoApi("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha: senha }),
    });

    if (!dados.sucesso || typeof dados.token !== "string" || !dados.token.trim()) {
        throw new Error("A API não retornou um token válido para entrar.");
    }

    // O contrato de login garante o token. Os dados completos do usuário vêm
    // da rota autenticada, sem depender de campos extras na resposta do login.
    const conta = await requisicaoApi("/minha-conta", {
        headers: { Authorization: "Bearer " + dados.token },
    });
    const usuario = conta.usuario || conta.conta || conta;
    const idUsuario = usuario.id_usuario ?? usuario.id ?? dados.id_usuario ?? dados.id ?? null;
    const nome = usuario.nome || dados.nome || email.trim();
    const emailUsuario = usuario.email || dados.email || email.trim();

    if (usuario.tipo !== undefined && usuario.tipo !== null) {
        await validarAdministrador(Number(usuario.tipo));
    }
    await limparDados();
    try {
        await salvarToken(dados.token);
        await salvarUsuario(idUsuario, nome, emailUsuario);
        await liberarBiometria();
    } catch {
        await limparDados();
        throw new Error("Não foi possível salvar a sessão no celular. Tente novamente.");
    }
    return true;
}

export async function realizarLoginComBiometria() {
    const biometriaLiberada = await getBiometriaLiberada();
    const token = await getToken();

    if (!biometriaLiberada || !token) {
        throw new Error("Faça o login com e-mail e senha antes de usar a biometria.");
    }

    const resultado = await getBiometria();
    if (!resultado) {
        throw new Error("Não foi possível validar a biometria.");
    }

    // A biometria desbloqueia a sessão salva; a API confirma se ela ainda é válida.
    try {
        const dados = await requisicaoApi("/minha-conta", {
            headers: { Authorization: "Bearer " + token },
        });
        const usuario = dados.usuario;
        if (!dados.sucesso || !usuario || !usuario.id_usuario || !usuario.nome || !usuario.email) {
            throw new Error("A API não retornou os dados do usuário.");
        }
        await validarAdministrador(usuario.tipo);
        await salvarUsuario(usuario.id_usuario, usuario.nome, usuario.email);
    } catch (erro) {
        if (erro.status === 401 || erro.status === 403 || erro.status === 404) {
            await limparDados();
            throw new Error("Sua sessão expirou ou não está mais disponível. Entre com e-mail e senha.");
        }
        throw erro;
    }
    return true;
}
