const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function carregar(tipo) {
    const eventos = [];
    const usuario = { id_usuario: 1, nome: "Teste", email: "teste@exemplo.com", tipo };
    const contexto = vm.createContext({
        requisicaoApi: async () => ({ sucesso: true, token: "token", ...usuario, usuario }),
        getBiometria: async () => true,
        getBiometriaLiberada: async () => true,
        getToken: async () => "token",
        limparDados: async () => eventos.push("limpar"),
        salvarToken: async () => eventos.push("token"),
        salvarUsuario: async () => eventos.push("usuario"),
        liberarBiometria: async () => eventos.push("biometria"),
    });
    const codigo = fs.readFileSync(path.join(__dirname, "../src/services/login.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
    vm.runInContext(codigo, contexto);
    return { contexto, eventos };
}

test("administrador pode entrar com senha e biometria", async () => {
    for (const tipo of [0, "0"]) {
        const { contexto, eventos } = carregar(tipo);
        assert.equal(await contexto.realizarLogin("teste@exemplo.com", "senha"), true);
        assert.ok(eventos.includes("token"));
        assert.equal(await contexto.realizarLoginComBiometria(), true);
    }
});

test("outros perfis ou perfil ausente não salvam sessão e recebem a mensagem solicitada", async () => {
    for (const tipo of [1, 2, "1", null, undefined, "", false]) {
        const { contexto, eventos } = carregar(tipo);
        await assert.rejects(contexto.realizarLogin("teste@exemplo.com", "senha"), { message: "Você não tem autorização para acessar esse sistema" });
        assert.deepEqual(eventos, ["limpar"]);
    }
});

test("biometria bloqueia usuário que deixou de ser administrador e apaga sessão", async () => {
    const { contexto, eventos } = carregar(1);
    await assert.rejects(contexto.realizarLoginComBiometria(), { message: "Você não tem autorização para acessar esse sistema" });
    assert.deepEqual(eventos, ["limpar"]);
});
