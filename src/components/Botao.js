import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

export default function Botao({ titulo, onPress, carregando = false, tipo = "principal" }) {
    var estiloBotao = css.botaoPrincipal;
    var estiloTexto = css.textoPrincipal;
    var corCarregando = "#ffffff";

    if (tipo === "secundario") {
        estiloBotao = css.botaoSecundario;
        estiloTexto = css.textoSecundario;
        corCarregando = "#2f6bff";
    }

    return (
        <Pressable
            style={({ pressed }) => [css.botao, estiloBotao, pressed && css.botaoPressionado, carregando && css.botaoDesabilitado]}
            onPress={onPress}
            disabled={carregando}
        >
            {carregando ? <ActivityIndicator color={corCarregando} /> : <Text style={[css.texto, estiloTexto]}>{titulo}</Text>}
        </Pressable>
    );
}

const css = StyleSheet.create({
    botao: { width: "100%", minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
    botaoPrincipal: { backgroundColor: "#2f6bff", shadowColor: "#2f6bff", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    botaoSecundario: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbe4f3" },
    botaoPressionado: { opacity: 0.8 },
    botaoDesabilitado: { opacity: 0.7 },
    texto: { fontSize: 16, fontWeight: "700" },
    textoPrincipal: { color: "#ffffff" },
    textoSecundario: { color: "#2f6bff" },
});
