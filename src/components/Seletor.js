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
                <Text numberOfLines={1} style={[css.texto, compacto && { fontSize: 13 }]}>{selecionado ? selecionado.nome : "Selecione"}</Text><Text style={css.texto}>⌄</Text>
            </Pressable>
            <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
                <SafeAreaView style={css.modal}>
                    <View style={css.topo}><Text style={css.titulo}>{titulo}</Text><Pressable onPress={() => setAberto(false)}><Text style={css.fechar}>Fechar</Text></Pressable></View>
                    <FlatList data={opcoes} keyExtractor={item => String(item.valor)} renderItem={({ item }) => (
                        <Pressable accessibilityRole="button" accessibilityState={{ selected: item.valor === valor }} style={css.opcao} onPress={() => { onChange(item.valor); setAberto(false); }}>
                            <Text style={css.texto}>{item.nome}</Text>{item.valor === valor && <Text style={css.fechar}>✓</Text>}
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
    campo: { minHeight: 52, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbe4f3", borderRadius: 12, padding: 15, flexDirection: "row", justifyContent: "space-between", gap: 10 },
    texto: { color: "#24324a", fontSize: 15, flexShrink: 1 },
    modal: { flex: 1, padding: 20, backgroundColor: "#ffffff" },
    topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
    fechar: { color: "#326bff", fontWeight: "700", padding: 10 },
    opcao: { paddingVertical: 18, borderBottomWidth: 1, borderColor: "#e3e8f2", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
