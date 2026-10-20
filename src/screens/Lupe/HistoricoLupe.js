import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AvisoErro from "../../components/AvisoErro";
import css from "./LupeStyle";

export default function HistoricoLupe({ aberto, conversas, atual, ocupado, erro, onFechar, onAbrir, onExcluir }) {
    return <Modal visible={aberto} animationType="slide" onRequestClose={onFechar}>
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}><View style={css.identidade}><Text style={css.titulo}>Histórico da Lupe</Text><Text style={css.subtitulo}>Suas conversas no celular e no desktop</Text></View><Pressable accessibilityRole="button" onPress={onFechar} style={css.novaConversa}><Text style={css.link}>Fechar</Text></Pressable></View>
            {!!erro && <View style={css.erroHistorico}><AvisoErro erro={erro} /></View>}
            {ocupado && <ActivityIndicator accessibilityLabel="Carregando conversa" color="#326bff" style={{ marginTop: 15 }} />}
            <FlatList data={conversas} keyExtractor={item => item.id} contentContainerStyle={css.listaHistorico} renderItem={({ item }) => <View style={[css.itemHistorico, item.id === atual && css.itemHistoricoAtivo]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Abrir conversa: ${item.titulo}`} accessibilityState={{ selected: item.id === atual }} disabled={ocupado} onPress={() => onAbrir(item.id)} style={css.abrirHistorico}>
                    <Text style={css.tituloHistorico} numberOfLines={2}>{item.titulo}</Text>
                    <Text style={css.resumoHistorico} numberOfLines={2}>{item.resumo}</Text>
                    <Text style={css.dataHistorico}>{new Date(item.atualizadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {item.quantidadeMensagens} mensagens</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Excluir conversa: ${item.titulo}`} disabled={ocupado} onPress={() => onExcluir(item)} style={css.excluirHistorico}><Text style={css.textoExcluir}>Excluir</Text></Pressable>
            </View>} ListEmptyComponent={<View style={css.historicoVazio}><Text style={css.tituloHistorico}>Nenhuma conversa salva</Text><Text style={css.resumoHistorico}>Converse com a Lupe para começar seu histórico.</Text></View>} />
        </SafeAreaView>
    </Modal>;
}
