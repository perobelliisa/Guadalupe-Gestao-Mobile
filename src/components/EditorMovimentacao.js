import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NovaMovimentacao from "../screens/Movimentacoes/NovaMovimentacao";

export default function EditorMovimentacao({ item, onFechar, onSalvar }) {
    const [ocupado, setOcupado] = useState(false);
    return (
        <Modal transparent animationType="fade" onRequestClose={() => { if (!ocupado) onFechar(); }}>
            <SafeAreaView style={css.fundo}>
                <View style={css.painel} accessibilityViewIsModal>
                    <NovaMovimentacao route={{ params: { id: item.id_livro_caixa, tipo: Number(item.tipo) } }} onFechar={onFechar} onSalvar={onSalvar} onOcupado={setOcupado} />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const css = StyleSheet.create({
    fundo: { flex: 1, backgroundColor: "rgba(21, 35, 61, 0.48)", alignItems: "center", justifyContent: "center", padding: 12 },
    painel: { width: "100%", maxWidth: 600, height: "90%", borderRadius: 12, overflow: "hidden", backgroundColor: "white", elevation: 8 },
});
