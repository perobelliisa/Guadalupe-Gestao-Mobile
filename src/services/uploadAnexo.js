import { File } from "expo-file-system";

export function adicionarAnexo(formulario, anexo) {
    if (anexo.file) {
        formulario.append("anexo", anexo.file, anexo.name);
        return;
    }
    const arquivo = new File(anexo.uri);
    // O fetch do Expo precisa dos bytes; apenas o URI não envia o arquivo.
    formulario.append("anexo", {
        name: anexo.name,
        type: anexo.mimeType,
        bytes: () => arquivo.bytes(),
    });
}
