async function scanAndSave() {
  try {
    setLoading(true);
    setError("");
    setLastSaved(null);

    if (!GEMINI_API_KEY) {
      throw new Error("AIzaSyALI8d0sywOovwQ7uLMettYQ_JNtTIdA5E");
    }

    const image = capturePhotoBase64();

    if (!image) {
      throw new Error("Não foi possível capturar a foto.");
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: "application/json",
          },
          contents: [
            {
              parts: [
                {
                  text: `
Leia esta imagem de etiqueta/endereço e devolva APENAS um JSON válido com estes campos:
recipient, street, number, complement, neighborhood, city, state, zipCode, rawText

Regras:
- Responda somente JSON puro
- Se não encontrar um campo, use ""
- state deve vir como sigla, por exemplo SP
- rawText deve conter o texto principal lido da imagem
- Não invente informações
                  `.trim(),
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: image.base64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      throw new Error(data?.error?.message || "Erro ao chamar Gemini.");
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.error(data);
      throw new Error("Gemini não retornou conteúdo.");
    }

    let parsed: ParsedAddress;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("Resposta recebida:", text);
      throw new Error("A resposta do Gemini não veio em JSON válido.");
    }

    const address: ParsedAddress = {
      recipient: parsed.recipient || "",
      street: parsed.street || "",
      number: parsed.number || "",
      complement: parsed.complement || "",
      neighborhood: parsed.neighborhood || "",
      city: parsed.city || "",
      state: parsed.state || "",
      zipCode: parsed.zipCode || "",
      rawText: parsed.rawText || "",
    };

    const hasMinimumAddress =
      address.street.trim() &&
      address.city.trim() &&
      address.state.trim();

    if (!hasMinimumAddress) {
      throw new Error("A IA não identificou um endereço suficiente para salvar.");
    }

    const { error: saveError } = await supabase.from("deliveries").insert({
      recipient: address.recipient,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zip_code: address.zipCode,
      raw_text: address.rawText,
      source: "camera_ai",
    });

    if (saveError) {
      throw new Error(saveError.message);
    }

    setLastSaved(address);
    closeCamera();
  } catch (err: any) {
    console.error(err);
    setError(err.message || "Erro ao ler e salvar imagem.");
  } finally {
    setLoading(false);
  }
}
