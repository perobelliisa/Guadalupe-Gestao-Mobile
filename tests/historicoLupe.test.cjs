const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function carregar(armazenamento = new Map()) {
    let falharProximaGravacao = false;
    const contexto = vm.createContext({
        AsyncStorage: {
            getItem: async chave => armazenamento.get(chave) ?? null,
            setItem: async (chave, valor) => {
                if (falharProximaGravacao) { falharProximaGravacao = false; throw new Error("Sem espaço"); }
                armazenamento.set(chave, valor);
            },
            removeItem: async chave => armazenamento.delete(chave),
        },
    });
    vm.runInContext(fs.readFileSync("src/services/historicoLupeLocal.js", "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    return { contexto, armazenamento, falhar: () => { falharProximaGravacao = true; } };
}

function conversa(contexto, pergunta = "Como cadastrar despesa?", data = "2026-10-20T13:00:00.000Z") {
    return { ...contexto.criarConversaLupe(), atualizadaEm: data, mensagens: [{ papel: "usuario", texto: pergunta }, { papel: "lupe", texto: "Toque em **Despesa**." }] };
}

test("salva conversa completa e recupera apos reiniciar o aplicativo", async () => {
    const { contexto, armazenamento } = carregar();
    const original = conversa(contexto);
    await contexto.salvarConversaLupe(7, original);
    const reiniciado = carregar(armazenamento).contexto;
    const lista = await reiniciado.listarConversasLupe(7);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].titulo, original.mensagens[0].texto);
    assert.equal(lista[0].resumo, "Toque em Despesa.");
    const salva = await reiniciado.carregarConversaLupe(7, original.id);
    assert.deepEqual(JSON.parse(JSON.stringify(salva)), JSON.parse(JSON.stringify(original)));
});

test("separa historico por usuario inclusive no mesmo celular", async () => {
    const { contexto } = carregar();
    const original = conversa(contexto);
    await contexto.salvarConversaLupe(7, original);
    assert.equal((await contexto.listarConversasLupe(8)).length, 0);
    await assert.rejects(contexto.carregarConversaLupe(8, original.id), /não está mais disponível/);
    await contexto.excluirConversaLupe(8, original.id);
    assert.equal((await contexto.listarConversasLupe(7)).length, 1);
    await assert.rejects(contexto.listarConversasLupe(null), /Entre novamente/);
});

test("continuar conversa atualiza mensagens sem duplicar o registro", async () => {
    const { contexto } = carregar();
    const original = conversa(contexto);
    await contexto.salvarConversaLupe(7, original);
    const retomada = await contexto.carregarConversaLupe(7, original.id);
    retomada.mensagens.push({ papel: "usuario", texto: "E o comprovante?" }, { papel: "lupe", texto: "Tire uma foto." });
    await contexto.salvarConversaLupe(7, retomada);
    const lista = await contexto.listarConversasLupe(7);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].quantidadeMensagens, 4);
    assert.equal(lista[0].titulo, original.mensagens[0].texto);
    assert.equal((await contexto.carregarConversaLupe(7, original.id)).mensagens.length, 4);
});

test("salvamentos concorrentes preservam todas as conversas e ordem por atualizacao", async () => {
    const { contexto } = carregar();
    const antiga = conversa(contexto, "Antiga", "2026-10-19T13:00:00.000Z");
    const recente = conversa(contexto, "Recente");
    await Promise.all([contexto.salvarConversaLupe(7, recente), contexto.salvarConversaLupe(7, antiga)]);
    const lista = await contexto.listarConversasLupe(7);
    assert.equal(lista.length, 2);
    assert.equal(lista[0].id, recente.id);
    assert.equal(lista[1].id, antiga.id);
});

test("nova conversa nao apaga anterior e exclusao remove apenas a selecionada", async () => {
    const { contexto, armazenamento } = carregar();
    const primeira = conversa(contexto);
    const segunda = conversa(contexto, "Outra conversa");
    await contexto.salvarConversaLupe(7, primeira);
    await contexto.salvarConversaLupe(7, segunda);
    const nova = contexto.criarConversaLupe();
    assert.equal(nova.mensagens.length, 0);
    assert.equal((await contexto.listarConversasLupe(7)).length, 2);
    await contexto.excluirConversaLupe(7, primeira.id);
    assert.equal((await contexto.listarConversasLupe(7))[0].id, segunda.id);
    assert.equal(armazenamento.has(`lupe:v1:7:conversa:${primeira.id}`), false);
    await assert.rejects(contexto.carregarConversaLupe(7, primeira.id), /não está mais disponível/);
});

test("falha ao salvar nao altera conversa existente e permite tentar novamente", async () => {
    const { contexto, falhar } = carregar();
    const original = conversa(contexto);
    await contexto.salvarConversaLupe(7, original);
    const outra = conversa(contexto, "Nova");
    falhar();
    await assert.rejects(contexto.salvarConversaLupe(7, outra), /Sem espaço/);
    assert.equal((await contexto.listarConversasLupe(7)).length, 1);
    await contexto.salvarConversaLupe(7, outra);
    assert.equal((await contexto.listarConversasLupe(7)).length, 2);
});

test("indice corrompido nao e sobrescrito e mensagens incompletas nao sao salvas", async () => {
    const { contexto, armazenamento } = carregar();
    armazenamento.set("lupe:v1:7:indice", "corrompido");
    await assert.rejects(contexto.salvarConversaLupe(7, conversa(contexto)));
    assert.equal(armazenamento.get("lupe:v1:7:indice"), "corrompido");
    await assert.rejects(contexto.salvarConversaLupe(8, { ...conversa(contexto), mensagens: [{ papel: "usuario", texto: "Ainda sem resposta" }] }));
    assert.equal((await contexto.listarConversasLupe(8)).length, 0);
});
