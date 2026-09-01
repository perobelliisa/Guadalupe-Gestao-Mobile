import { StyleSheet } from "react-native";

const css = StyleSheet.create({
    pagina: { flex: 1, backgroundColor: "#ffffff" },
    conteudo: { flex: 1, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 22, justifyContent: "center" },
    marca: { flexDirection: "row", alignItems: "center", marginBottom: 70 },
    logo: { width: 42, height: 42, resizeMode: "contain", marginRight: 8 },
    nomeMarca: { color: "#2f6bff", fontWeight: "800", fontSize: 14, lineHeight: 15 },
    apresentacao: { marginBottom: 30 },
    titulo: { color: "#26364f", fontSize: 30, lineHeight: 36, fontWeight: "800", maxWidth: 320, marginBottom: 10 },
    subtitulo: { color: "#8491a5", fontSize: 14, lineHeight: 21, maxWidth: 310 },
    erro: { color: "#d64c4c", fontSize: 13, textAlign: "center", marginBottom: 2 },
    rodape: { color: "#b1bac8", textAlign: "center", fontSize: 11, marginTop: 34 },
});

export default css;
