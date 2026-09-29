import { StyleSheet, Text, View } from "react-native";
import { mensagemErro } from "../services/api";

export default function AvisoErro({ erro }) {
    if (!erro) return null;
    return (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={css.aviso}>
            <View style={css.icone}><Text allowFontScaling={false} style={css.simbolo}>!</Text></View>
            <View style={css.conteudo}>
                <Text style={css.titulo}>Não foi possível concluir</Text>
                <Text style={css.mensagem}>{mensagemErro(erro)}</Text>
            </View>
        </View>
    );
}

const css = StyleSheet.create({
    aviso: { alignSelf: "stretch", flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, marginVertical: 10, backgroundColor: "#fff5f3", borderWidth: 1, borderColor: "#f1d6d0", borderRadius: 12 },
    icone: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f9e0da", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    simbolo: { fontSize: 16, fontWeight: "700", color: "#923e30" },
    conteudo: { flex: 1, minWidth: 0 },
    titulo: { fontSize: 14, fontWeight: "600", color: "#84392e", marginBottom: 4 },
    mensagem: { fontSize: 14, color: "#704e47" },
});
