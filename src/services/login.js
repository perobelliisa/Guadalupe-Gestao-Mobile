import { requisicaoApi } from "./api";
import { getBiometria } from "./biometria";
import { getBiometriaLiberada, getToken, liberarBiometria, limparDados, salvarToken, salvarUsuario } from "./usuarioStorage";

export async function realizarLogin(email, senha) {
    if (!email.trim() || !senha) {
        throw new Error("Preencha e-mail e senha.");
    }

    const dados = await requisicaoApi("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha: senha }),
    });

    if (!dados.sucesso || !dados.token || !dados.id_usuario || !dados.nome) {
        throw new Error("A API não retornou os dados necessários para entrar.");
    }

    await limparDados();
    try {
        await salvarToken(dados.token);
        await salvarUsuario(dados.id_usuario, dados.nome, email.trim());
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
