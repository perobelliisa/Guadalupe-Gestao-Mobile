export function normalizarAnexo(arquivo) {
    const nome = (arquivo.name || "comprovante").trim();
    const mime = (arquivo.mimeType || "").toLowerCase();
    const extensao = nome.match(/\.(pdf|jpe?g|png)$/i)?.[1].toLowerCase();
    const porMime = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
    const formato = extensao || porMime[mime];
    if (!formato) throw new Error("Envie um arquivo PDF, JPG ou PNG.");
    return {
        ...arquivo,
        name: extensao ? nome : `${nome}.${formato}`,
        mimeType: formato === "pdf" ? "application/pdf" : formato === "png" ? "image/png" : "image/jpeg",
    };
}
