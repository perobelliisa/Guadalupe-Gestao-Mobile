import { Pressable, Text, View } from "react-native";
import css from "../screens/Home/HomeStyle";

export default function MenuInferior({ navigation, ativo }) {
    return (
        <View style={css.menuInferior}>
            <Pressable accessibilityRole="button" accessibilityLabel="Início" accessibilityState={{ selected: ativo === "Home" }} onPress={() => navigation.navigate("Home")} style={css.itemMenu}>
                <Text allowFontScaling={false} style={ativo === "Home" ? css.menuAtivo : css.menuIcone}>⌂</Text>
                <Text style={ativo === "Home" ? css.menuTextoAtivo : css.menuTexto}>Início</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Movimentos" accessibilityState={{ selected: ativo === "Movimentacoes" }} onPress={() => navigation.navigate("Movimentacoes")} style={css.itemMenu}>
                <Text allowFontScaling={false} style={ativo === "Movimentacoes" ? css.menuAtivo : css.menuIcone}>▤</Text>
                <Text style={ativo === "Movimentacoes" ? css.menuTextoAtivo : css.menuTexto}>{"Movi\u00ADmentos"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar movimentação" onPress={() => navigation.navigate("NovaMovimentacao")} style={css.botaoMais}>
                <Text allowFontScaling={false} style={css.mais}>+</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Comprovantes" accessibilityState={{ selected: ativo === "Comprovantes" }} onPress={() => navigation.navigate("Comprovantes")} style={css.itemMenu}>
                <Text allowFontScaling={false} style={ativo === "Comprovantes" ? css.menuAtivo : css.menuIcone}>▱</Text>
                <Text style={ativo === "Comprovantes" ? css.menuTextoAtivo : css.menuTexto}>{"Compro\u00ADvantes"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mais" accessibilityState={{ selected: ativo === "Mais" }} onPress={() => navigation.navigate("Mais")} style={css.itemMenu}>
                <Text allowFontScaling={false} style={ativo === "Mais" ? css.menuAtivo : css.menuIcone}>☰</Text>
                <Text style={ativo === "Mais" ? css.menuTextoAtivo : css.menuTexto}>Mais</Text>
            </Pressable>
        </View>
    );
}
