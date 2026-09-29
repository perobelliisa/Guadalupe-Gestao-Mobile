const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contexto = vm.createContext({ process, AbortController, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/services/api.js"), "utf8")
    .replace(/^export /gm, ""), contexto);

function requisitar(dados, status = 401) {
    return contexto.requisicaoApi("/login", {}, {
        enviar: async () => ({ ok: status < 400, status, json: async () => dados }),
    });
}

test("exibe mensagem de login em texto e em objetos aninhados, preservando status", async () => {
    for (const dados of [
        { mensagem: "Senha incorreta" },
        { mensagem: { mensagem: "Senha incorreta" } },
        { erro: { message: "Senha incorreta" } },
        { mensagem: {}, erro: "Senha incorreta" },
        { detail: [{ msg: "Senha incorreta" }] },
    ]) {
        await assert.rejects(requisitar(dados), { message: "Senha incorreta", status: 401 });
    }
});

test("erro sem mensagem legível usa texto padrão, nunca object Object", async () => {
    for (const dados of [null, { mensagem: {} }, { erro: { codigo: 123 } }]) {
        await assert.rejects(requisitar(dados), {
            message: "E-mail ou senha incorretos. Confira os dados e tente novamente.", status: 401,
        });
    }
});

test("sucesso false com HTTP 200 também extrai o texto", async () => {
    await assert.rejects(requisitar({ sucesso: false, mensagem: { message: "Acesso negado" } }, 200),
        { message: "Acesso negado", status: 200 });
});

test("login bem-sucedido preserva os dados da sessão", async () => {
    const dados = { sucesso: true, token: "teste", id_usuario: 1, nome: "Teste", tipo: 0 };
    assert.equal(await requisitar(dados, 200), dados);
});

test("resposta nula de sucesso recebe mensagem de resposta inválida", async () => {
    await assert.rejects(requisitar(null, 200), /Não foi possível carregar os dados/);
});

test("erros internos são convertidos em orientação sem detalhes técnicos", async () => {
    try {
        await requisitar({ erro: "numeric overflow SQL_INT64" }, 500);
        assert.fail("Deve recusar o valor");
    } catch (erro) {
        assert.equal(contexto.mensagemErro(erro), "O valor informado é muito alto. Confira o valor e tente novamente.");
    }
    await assert.rejects(requisitar({ erro: "Erro ao cadastrar entrada: numeric overflow: SQL_INT64 (-802)" }, 500),
        { message: "O valor informado é muito alto. Confira o valor e tente novamente.", status: 500 });
    await assert.rejects(requisitar({ erro: "Falha interna desconhecida com dados privados" }, 500),
        { message: "O serviço está indisponível no momento. Tente novamente mais tarde.", status: 500 });
    for (const erro of ["TypeError: cannot read properties", "SELECT senha FROM usuario", "http://10.0.0.1:5000", { message: "Exception: private details" }]) {
        assert.equal(contexto.mensagemErro(erro), "Não foi possível concluir a solicitação. Tente novamente.");
    }
    assert.equal(contexto.mensagemErro(new Error("Preencha a descrição.")), "Preencha a descrição.");
    await assert.rejects(requisitar({}, 413), /arquivo é muito grande/);
    await assert.rejects(requisitar({}, 429), /Aguarde um momento/);
});

test("descarta object Object já convertido em string pela API", async () => {
    for (const mensagem of ["[object Object]", "Erro: [object Object]"]) {
        await assert.rejects(requisitar({ mensagem }), {
            message: "E-mail ou senha incorretos. Confira os dados e tente novamente.", status: 401,
        });
        await assert.rejects(requisitar({ mensagem, erro: "Email não cadastrado" }, 400),
            { message: "Email não cadastrado", status: 400 });
    }
});

test("tela de login trata rejeições de senha e biometria antes de exibir", async () => {
    const codigoTela = fs.readFileSync(path.join(__dirname, "../src/screens/Login/Login.js"), "utf8")
        .replace(/^import .*;\r?\n/gm, "")
        .replace("export default function Login", "function Login")
        .split("    return (\n")[0].split("    return (\r\n")[0]
        + "return { entrar, entrarComBiometria }; }";
    for (const falha of [null, undefined, {}, "[object Object]", new Error("[object Object]"),
        { message: { mensagem: "Sessão indisponível" } }, "Serviço indisponível"]) {
        let exibido;
        let carregando;
        let indice = 0;
        const tela = vm.createContext({
            mensagemErro: contexto.mensagemErro,
            realizarLogin: async () => { throw falha; },
            realizarLoginComBiometria: async () => { throw falha; },
            useState: () => ["teste", [() => {}, () => {}, valor => { exibido = valor; },
                valor => { carregando = valor; }][indice++]],
        });
        vm.runInContext(codigoTela, tela);
        const handlers = tela.Login({ navigation: { replace: () => assert.fail("Não deve navegar em erro") } });
        for (const handler of [handlers.entrar, handlers.entrarComBiometria]) {
            await handler();
            assert.equal(typeof exibido, "string");
            assert.ok(exibido.length > 0);
            assert.ok(!exibido.includes("[object Object]"));
            if (falha?.message?.mensagem) assert.equal(exibido, "Sessão indisponível");
            if (falha === "Serviço indisponível") assert.equal(exibido, falha);
            assert.equal(carregando, false);
        }
    }
});
