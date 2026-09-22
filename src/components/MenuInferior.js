import { Alert, Pressable, Text, View } from "react-native";
import css from "../screens/Home/HomeStyle";

export default function MenuInferior({ navigation, ativo }) {
    function emBreve() {
        Alert.alert("Em breve", "Esta tela ainda está em desenvolvimento.");
    }

    return (
        <View style={css.menuInferior}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Home")} style={css.itemMenu}>
                <Text style={ativo === "Home" ? css.menuAtivo : css.menuIcone}>⌂</Text>
                <Text style={ativo === "Home" ? css.menuTextoAtivo : css.menuTexto}>Início</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Movimentacoes")} style={css.itemMenu}>
                <Text style={ativo === "Movimentacoes" ? css.menuAtivo : css.menuIcone}>▤</Text>
                <Text style={ativo === "Movimentacoes" ? css.menuTextoAtivo : css.menuTexto}>Movimentos</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar movimentação" onPress={() => navigation.navigate("NovaMovimentacao")} style={css.botaoMais}>
                <Text style={css.mais}>+</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={emBreve} style={css.itemMenu}><Text style={css.menuIcone}>▱</Text><Text style={css.menuTexto}>Comprovantes</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={emBreve} style={css.itemMenu}><Text style={css.menuIcone}>☰</Text><Text style={css.menuTexto}>Mais</Text></Pressable>
        </View>
    );
}
