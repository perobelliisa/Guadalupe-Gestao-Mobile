const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function carregar({ granted = true, canceled = false, asset = { uri: "file:///cache/foto.jpg", mimeType: "image/jpeg" } } = {}) {
    const chamadas = [];
    const contexto = vm.createContext({
        ImagePicker: {
            requestCameraPermissionsAsync: async () => { chamadas.push("permissao"); return { granted }; },
            launchCameraAsync: async opcoes => { chamadas.push(opcoes); return { canceled, assets: [asset] }; },
        },
        DocumentPicker: { getDocumentAsync: async () => { chamadas.push("arquivo"); return { canceled, assets: [{ uri: "file:///nota.pdf", name: "nota.pdf" }] }; } },
    });
    for (const nome of ["anexos", "selecionarComprovante"]) {
        const codigo = fs.readFileSync(path.join(__dirname, `../src/services/${nome}.js`), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
        vm.runInContext(codigo, contexto);
    }
    return { selecionar: contexto.selecionarComprovante, chamadas };
}
test("camera solicita permissao e retorna foto para multipart", async () => {
    const { selecionar, chamadas } = carregar();
    const foto = await selecionar("camera");
    assert.equal(chamadas[0], "permissao");
    assert.equal(chamadas[1].mediaTypes[0], "images");
    assert.equal(chamadas[1].allowsEditing, false);
    assert.equal(foto.name, "comprovante.jpg");
    assert.equal(foto.uri, "file:///cache/foto.jpg");
});
test("permissao negada impede abrir camera", async () => {
    const { selecionar, chamadas } = carregar({ granted: false });
    await assert.rejects(selecionar("camera"), /configura/);
    assert.equal(chamadas.length, 1);
});
test("cancelamento da foto ou arquivo retorna null", async () => {
    const { selecionar } = carregar({ canceled: true });
    assert.equal(await selecionar("camera"), null);
    assert.equal(await selecionar("arquivo"), null);
});
test("escolher PDF nao solicita camera", async () => {
    const { selecionar, chamadas } = carregar();
    assert.equal((await selecionar()).name, "nota.pdf");
    assert.deepEqual(chamadas, ["arquivo"]);
});
test("foto PNG sem nome preserva formato", async () => {
    const { selecionar } = carregar({ asset: { uri: "file:///foto.png", mimeType: "image/png" } });
    assert.equal((await selecionar("camera")).name, "comprovante.png");
});
