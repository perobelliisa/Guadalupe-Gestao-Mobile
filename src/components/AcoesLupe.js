import { Pressable, StyleSheet, Text, View } from "react-native";

export default function AcoesLupe({ acoes, ocupado, onDecidir }) {
    return acoes.filter(acao => ['preparada', 'executando'].includes(acao.estado)).slice(-1).map(acao => <View key={acao.id} style={[css.proposta, acao.destrutiva && css.exclusao]}>
        <Text style={css.titulo}>{acao.titulo}</Text>
        {acao.estado === "preparada" ? <>
            {!!acao.descricao && <Text style={css.descricao}>{acao.descricao}</Text>}
            {acao.campos.map((campo, indice) => <View key={indice} style={css.campo}><Text style={css.rotulo}>{campo.campo}</Text><Text style={css.valor}>{campo.antes ? campo.antes + " → " : ""}{campo.depois}</Text></View>)}
            <View style={css.botoes}>
                <Pressable accessibilityRole="button" accessibilityLabel={"Cancelar: " + acao.titulo} disabled={ocupado} onPress={() => onDecidir(acao, false)} style={[css.cancelar, ocupado && css.desabilitado]}><Text style={css.textoCancelar}>Cancelar</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={"Confirmar: " + acao.titulo} disabled={ocupado} onPress={() => onDecidir(acao, true)} style={[css.confirmar, acao.destrutiva && css.confirmarExclusao, ocupado && css.desabilitado]}><Text style={css.textoConfirmar}>{acao.destrutiva ? "Confirmar exclusão" : "Confirmar"}</Text></Pressable>
            </View>
        </> : <Text style={css.estado}>Estou concluindo essa ação…</Text>}
    </View>);
}

const css = StyleSheet.create({
    proposta: { borderWidth: 1, borderColor: "#d4e2ff", backgroundColor: "#f6f9ff", borderRadius: 15, padding: 16, gap: 12 },
    exclusao: { borderColor: "#f0c5c0" }, titulo: { fontSize: 16, color: "#142849", fontWeight: "700" },
    descricao: { color: "#536278", fontSize: 14, lineHeight: 21 },
    campo: { gap: 4 }, rotulo: { color: "#536278", fontSize: 13 }, valor: { color: "#142849", fontSize: 14, lineHeight: 20 },
    botoes: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
    cancelar: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10, backgroundColor: "#e9eef5" },
    confirmar: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10, backgroundColor: "#326bff" },
    confirmarExclusao: { backgroundColor: "#b53a36" }, textoCancelar: { color: "#24324a", fontWeight: "600" }, textoConfirmar: { color: "#fff", fontWeight: "700" },
    estado: { color: "#536278", fontSize: 14, fontWeight: "600" }, desabilitado: { opacity: 0.5 },
});
