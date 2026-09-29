import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Seletor({ titulo, opcoes, valor, onChange, desabilitado = false, compacto = false }) {
    const [aberto, setAberto] = useState(false);
    const selecionado = opcoes.find(item => item.valor === valor);

    return (
        <View style={css.grupo}>
            <Text style={[css.titulo, compacto && { fontSize: 11 }]}>{titulo}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={titulo} disabled={desabilitado} onPress={() => setAberto(true)} style={[css.campo, compacto && { minHeight: 44, padding: 12 }]}>
                <Text style={[css.texto, css.rotulo, compacto && { fontSize: 13 }]}>{selecionado ? selecionado.nome : "Selecione"}</Text>
                <Text allowFontScaling={false} style={css.indicador}>⌄</Text>
            </Pressable>
            <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
                <SafeAreaView style={css.modal}>
                    <View style={css.topo}>
                        <Text style={[css.titulo, css.rotulo]}>{titulo}</Text>
                        <Pressable accessibilityRole="button" style={css.botaoFechar} onPress={() => setAberto(false)}><Text style={css.fechar}>Fechar</Text></Pressable>
                    </View>
                    <FlatList data={opcoes} extraData={valor} keyExtractor={item => String(item.valor)} renderItem={({ item }) => (
                        <Pressable accessibilityRole="button" accessibilityLabel={item.nome} accessibilityState={{ selected: item.valor === valor }} style={css.opcao} onPress={() => { onChange(item.valor); setAberto(false); }}>
                            <Text style={[css.texto, css.rotulo]}>{item.nome}</Text>
                            <View style={css.marcador}>{item.valor === valor && <Text allowFontScaling={false} style={css.selecionado}>✓</Text>}</View>
                        </Pressable>
                    )} ListEmptyComponent={<Text style={css.texto}>Nenhuma opção disponível.</Text>} />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const css = StyleSheet.create({
    grupo: { marginBottom: 16 },
    titulo: { color: "#536278", fontSize: 13, fontWeight: "600", marginBottom: 7 },
    campo: { minHeight: 52, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbe4f3", borderRadius: 12, padding: 15, flexDirection: "row", alignItems: "center", gap: 10 },
    texto: { color: "#24324a", fontSize: 15, includeFontPadding: true },
    rotulo: { flex: 1, minWidth: 0, paddingRight: 4 },
    indicador: { color: "#24324a", fontSize: 18, flexShrink: 0 },
    modal: { flex: 1, padding: 20, backgroundColor: "#ffffff" },
    topo: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 15 },
    botaoFechar: { flexShrink: 0, minHeight: 48, justifyContent: "center", padding: 10 },
    fechar: { color: "#326bff", fontWeight: "700" },
    opcao: { minHeight: 56, paddingVertical: 18, borderBottomWidth: 1, borderColor: "#e3e8f2", flexDirection: "row", gap: 10, alignItems: "center" },
    marcador: { width: 28, flexShrink: 0, alignItems: "center" },
    selecionado: { color: "#326bff", fontWeight: "700", fontSize: 20 },
});
