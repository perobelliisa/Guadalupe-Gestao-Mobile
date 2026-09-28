import { Pressable, Text, View } from "react-native";
import css from "../screens/Home/HomeStyle";

export default function MenuInferior({ navigation, ativo }) {
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
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Comprovantes")} style={css.itemMenu}><Text style={ativo === "Comprovantes" ? css.menuAtivo : css.menuIcone}>▱</Text><Text style={ativo === "Comprovantes" ? css.menuTextoAtivo : css.menuTexto}>Comprovantes</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Mais")} style={css.itemMenu}><Text style={ativo === "Mais" ? css.menuAtivo : css.menuIcone}>☰</Text><Text style={ativo === "Mais" ? css.menuTextoAtivo : css.menuTexto}>Mais</Text></Pressable>
        </View>
    );
}
