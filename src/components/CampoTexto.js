import { StyleSheet, Text, TextInput, View } from "react-native";

export default function CampoTexto({ titulo, placeholder, value, onChangeText, secureTextEntry = false, keyboardType = "default", maxLength, compacto = false, multiline = false }) {
    return (
        <View style={css.grupo}>
            <Text style={[css.titulo, compacto && { fontSize: 11 }]}>{titulo}</Text>
            <TextInput accessibilityLabel={titulo} style={[css.input, compacto && { height: 44, fontSize: 13, paddingHorizontal: 12 }, multiline && { height: 100, textAlignVertical: "top", paddingTop: 12 }]} placeholder={placeholder} placeholderTextColor="#9aa8bd" value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" maxLength={maxLength} multiline={multiline} />
        </View>
    );
}

const css = StyleSheet.create({
    grupo: { width: "100%", marginBottom: 16 },
    titulo: { color: "#536278", fontSize: 13, fontWeight: "600", marginBottom: 7 },
    input: { width: "100%", height: 52, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbe4f3", borderRadius: 12, paddingHorizontal: 15, color: "#24324a", fontSize: 15 },
});
