import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { limparDados } from "../../services/usuarioStorage";
import css from "./HomeStyle";

export default function Home({ navigation }) {
    // Estes dados serão preenchidos pela API futuramente.
    const dadosFinanceiros = {
        saldo: "",
        receitas: "",
        despesas: "",
    };
    const lancamentos = [];

    function mostrarValor(valor) {
        if (!valor) {
            return "R$ --";
        }
        return valor;
    }

    async function sair() {
        await limparDados();
        navigation.replace("Login");
    }

    return (
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}>
                <View style={css.usuario}>
                    <View style={css.avatar}><Text style={css.avatarTexto}>G</Text></View>
                    <View><Text style={css.saudacao}>Boas-vindas</Text><Text style={css.nomeUsuario}>Olá!</Text></View>
                </View>
                <Pressable onPress={sair} style={css.botaoSair}><Text style={css.textoSair}>Sair</Text></Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={css.resumoAzul}>
                    <Text style={css.rotuloSaldo}>Saldo geral disponível</Text>
                    <Text style={css.saldo}>{mostrarValor(dadosFinanceiros.saldo)}</Text>
                    <View style={css.cartaoResumo}>
                        <View style={css.resumoItem}><View style={[css.iconeCirculo, css.fundoVerde]}><Text style={css.verde}>↙</Text></View><View><Text style={css.rotuloResumo}>Receitas</Text><Text style={css.valorResumo}>{mostrarValor(dadosFinanceiros.receitas)}</Text></View></View>
                        <View style={css.divisor} />
                        <View style={css.resumoItem}><View style={[css.iconeCirculo, css.fundoVermelho]}><Text style={css.vermelho}>↗</Text></View><View><Text style={css.rotuloResumo}>Despesas</Text><Text style={css.valorResumo}>{mostrarValor(dadosFinanceiros.despesas)}</Text></View></View>
                    </View>
                </View>

                <View style={css.conteudo}>
                    <View style={css.linhaTitulo}><Text style={css.tituloSecao}>Acesso rápido</Text><Text style={css.periodo}>Período não informado</Text></View>
                    <View style={css.acessos}>
                        <View style={css.acesso}><View style={[css.iconeAcesso, css.fundoVerde]}><Text style={css.verde}>↙</Text></View><Text style={css.textoAcesso}>Receita</Text></View>
                        <View style={css.acesso}><View style={[css.iconeAcesso, css.fundoVermelho]}><Text style={css.vermelho}>↗</Text></View><Text style={css.textoAcesso}>Despesa</Text></View>
                        <View style={css.acesso}><View style={[css.iconeAcesso, css.fundoCinza]}><Text style={css.cinza}>▤</Text></View><Text style={css.textoAcesso}>Movimentos</Text></View>
                    </View>
                    <Text style={css.tituloLancamentos}>Últimos lançamentos</Text>
                    {lancamentos.length === 0 && (
                        <View style={css.semLancamentos}><Text style={css.semLancamentosTitulo}>Nenhum lançamento disponível</Text><Text style={css.semLancamentosTexto}>Os lançamentos serão exibidos quando forem retornados pela API.</Text></View>
                    )}
                </View>
            </ScrollView>

            <View style={css.menuInferior}>
                <View style={css.itemMenu}><Text style={css.menuAtivo}>⌂</Text><Text style={css.menuTextoAtivo}>Início</Text></View>
                <View style={css.itemMenu}><Text style={css.menuIcone}>⇄</Text><Text style={css.menuTexto}>Movimentos</Text></View>
                <View style={css.botaoMais}><Text style={css.mais}>+</Text></View>
                <View style={css.itemMenu}><Text style={css.menuIcone}>░</Text><Text style={css.menuTexto}>Comprovantes</Text></View>
                <View style={css.itemMenu}><Text style={css.menuIcone}>☰</Text><Text style={css.menuTexto}>Mais</Text></View>
            </View>
        </SafeAreaView>
    );
}
