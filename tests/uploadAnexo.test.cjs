const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

// Usa o conversor realmente instalado no Expo para verificar o multipart.
function carregar() {
    const foto = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0xd9]);
    const contexto = vm.createContext({
        Uint8Array, TextEncoder, Blob,
        blobToArrayBufferAsync: blob => blob.arrayBuffer(),
        File: class { constructor(uri) { this.uri = uri; } async bytes() { return foto; } },
    });
    const converter = fs.readFileSync(path.join(__dirname, "../node_modules/expo/src/winter/fetch/convertFormData.ts"), "utf8");
    vm.runInContext(stripTypeScriptTypes(converter.replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "")), contexto);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/services/uploadAnexo.js"), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""), contexto);
    const formulario = { campos: [], append(...campo) { this.campos.push(campo); }, entries() { return this.campos.values(); } };
    return { contexto, formulario, foto };
}

test("reproduz falha do Expo com o formato antigo de URI", async () => {
    const { contexto, formulario } = carregar();
    formulario.append("anexo", { uri: "file:///foto.jpg", name: "foto.jpg", type: "image/jpeg" });
    await assert.rejects(contexto.convertFormDataAsync(formulario), /Unsupported FormDataPart/);
});

test("foto gera multipart com bytes reais, nome e tipo aceitos pelo Expo", async () => {
    const { contexto, formulario, foto } = carregar();
    contexto.adicionarAnexo(formulario, { uri: "file:///foto.jpg", name: "comprovante.jpg", mimeType: "image/jpeg" });
    const { body, boundary } = await contexto.convertFormDataAsync(formulario, "teste-boundary");
    const conteudo = Buffer.from(body);
    assert.equal(boundary, "teste-boundary");
    assert.ok(conteudo.includes(Buffer.from('name="anexo"; filename="comprovante.jpg"')));
    assert.ok(conteudo.includes(Buffer.from('content-type: image/jpeg')));
    assert.ok(conteudo.includes(Buffer.from(foto)));
    assert.ok(conteudo.includes(Buffer.from('--teste-boundary--')));
});

test("arquivo do navegador continua sendo enviado como Blob", async () => {
    const { contexto, formulario } = carregar();
    const arquivo = new Blob(["PDF de teste"], { type: "application/pdf" });
    contexto.adicionarAnexo(formulario, { file: arquivo, name: "nota.pdf" });
    assert.equal(formulario.campos[0][1], arquivo);
    assert.equal(formulario.campos[0][2], "nota.pdf");
});
