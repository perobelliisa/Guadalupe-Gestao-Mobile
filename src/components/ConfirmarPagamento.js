import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Usado por cima do editor e do painel do sininho, sem alerta nativo.
export default function ConfirmarPagamento({ pagamento, salvando, erro, onCancelar, onConfirmar }) {
    if (!pagamento) return null;
    const valor = Number(pagamento.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const data = pagamento.vencimento ? pagamento.vencimento.slice(0, 10).split("-").reverse().join("/") : "Sem vencimento informado";
    return (
        <View style={css.fundo} accessibilityViewIsModal>
            <View style={css.caixa}>
                <View style={css.cabecalho}><Text accessibilityRole="header" style={css.titulo}>Confirmar pagamento</Text></View>
                <ScrollView contentContainerStyle={css.conteudo}>
                    <Text style={css.texto}>{pagamento.descricao} — {valor}</Text>
                    <Text style={css.texto}>Vencimento: {data}</Text>
                    <Text style={css.texto}>Somente este vencimento será marcado como pago.</Text>
                    {erro ? <Text accessibilityRole="alert" style={css.erro}>{erro}</Text> : null}
                </ScrollView>
                <View style={css.rodape}>
                    <Pressable accessibilityRole="button" disabled={salvando} onPress={onCancelar} style={[css.botao, css.cancelar, salvando && css.desabilitado]}><Text style={css.textoCancelar}>Cancelar</Text></Pressable>
                    <Pressable accessibilityRole="button" disabled={salvando} onPress={onConfirmar} style={[css.botao, css.confirmar, salvando && css.desabilitado]}>{salvando ? <ActivityIndicator accessibilityLabel="Registrando pagamento" color="white" /> : <Text style={css.textoConfirmar}>Confirmar pagamento</Text>}</Pressable>
                </View>
            </View>
        </View>
    );
}

const css = StyleSheet.create({
    fundo: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: "rgba(21, 35, 61, 0.48)", alignItems: "center", justifyContent: "center", padding: 14 },
    caixa: { width: "100%", maxWidth: 480, maxHeight: "90%", backgroundColor: "white", borderRadius: 8, overflow: "hidden", elevation: 8 },
    cabecalho: { paddingHorizontal: 24, paddingVertical: 22, borderBottomWidth: 1, borderColor: "#e0e5ee" },
    titulo: { color: "#172747", fontSize: 20, fontWeight: "700" },
    conteudo: { padding: 24, gap: 22 },
    texto: { color: "#172747", fontSize: 17, lineHeight: 25 },
    rodape: { flexDirection: "row", gap: 10, padding: 20, borderTopWidth: 1, borderColor: "#e0e5ee" },
    botao: { flex: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 12, borderRadius: 9, justifyContent: "center", alignItems: "center" },
    cancelar: { borderWidth: 2, borderColor: "#ee9700", backgroundColor: "white" },
    confirmar: { backgroundColor: "#326bff" },
    textoCancelar: { color: "#172747", fontWeight: "700", fontSize: 12, textAlign: "center" },
    textoConfirmar: { color: "white", fontWeight: "700", fontSize: 12, textAlign: "center" },
    erro: { color: "#b53a36", fontSize: 13, lineHeight: 20 },
    desabilitado: { opacity: 0.6 },
});
