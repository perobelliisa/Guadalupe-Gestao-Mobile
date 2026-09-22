import CampoTexto from "./CampoTexto";

export default function CampoData({ titulo, valor, onChange }) {
    function alterar(texto) {
        const digitos = texto.replace(/\D/g, "").slice(0, 8);
        let data = digitos;
        if (digitos.length > 4) data = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
        else if (digitos.length > 2) data = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
        onChange(data);
    }
    return <CampoTexto compacto titulo={titulo} placeholder="DD/MM/AAAA" keyboardType="number-pad" value={valor} onChangeText={alterar} maxLength={10} />;
}
