import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { normalizarAnexo } from "./anexos";

export async function selecionarComprovante(origem = "arquivo", apenasImagem = false) {
    if (origem === "camera") {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) throw new Error("Permita o acesso à câmera nas configurações do celular para tirar uma foto.");
        const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false });
        if (resultado.canceled) return null;
        const foto = resultado.assets[0];
        return normalizarAnexo({ ...foto, name: foto.fileName || "comprovante", mimeType: foto.mimeType || "image/jpeg" });
    }
    const resultado = await DocumentPicker.getDocumentAsync({ type: apenasImagem ? ["image/jpeg", "image/png"] : ["application/pdf", "image/jpeg", "image/png"], multiple: false, copyToCacheDirectory: true });
    return resultado.canceled ? null : normalizarAnexo(resultado.assets[0]);
}
