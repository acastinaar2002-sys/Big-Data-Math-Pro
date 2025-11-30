import { GoogleGenAI, Type } from "@google/genai";
import { SimulationSchema } from "../types";

const modelId = 'gemini-2.5-flash';

// Helper to safely access environment variables without crashing in browser
const getApiKey = (): string => {
    try {
        // Check if process is defined (Node/Build env)
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
        // Check window (Browser injection)
        if (typeof window !== 'undefined' && (window as any).API_KEY) {
            return (window as any).API_KEY;
        }
    } catch (e) {
        // Ignore errors accessing process/window
    }
    return '';
};

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Falta la API KEY. Por favor configura la variable de entorno API_KEY en Vercel.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to clean JSON string from Markdown code blocks
const cleanJsonText = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
};

export const analyzeProblemForSimulation = async (problemText: string): Promise<SimulationSchema> => {
  try {
    const ai = getAiClient();

    const prompt = `
      Actúa como un profesor senior de matemáticas y científico de datos.
      Analiza el texto proporcionado (que puede contener uno o varios problemas) y genera un modelo de simulación completo.

      Enunciado: "${problemText}"

      ESTRATEGIA DE SIMULACIÓN:
      1. Si el texto contiene MÚLTIPLES problemas distintos (ej: Salarios, Ciclistas, Pesas), ELIGE EL SISTEMA DE ECUACIONES MÁS COMPLEJO O INTERESANTE (generalmente el de movimiento o intersección) para graficar, pero explica TODOS en el markdown.
      2. Si el problema pide "F(x), G(x)...", grafica TODAS las funciones simultáneamente.
      3. Extrae todas las variables clave.

      REGLAS MATEMÁTICAS:
      - Corrige errores de OCR (ej: "0.95t" -> "0.95^t" si es decaimiento).
      - Para funciones lineales: y = mx + b.
      - Para exponencial: y = a * (1+r)^t.
      - JS: Usa 'Math.pow(base, exponente)'. Return debe ser un OBJETO si hay >1 función.

      ESTRUCTURA DEL REPORTE MARKDOWN (IMPORTANTE - LUJO DE DETALLES):
      Debes incluir estas secciones obligatorias usando Markdown bonito:
      📌 1. Interpretación del Problema: Explicación verbal de qué se pide.
      📌 2. Identificación de Funciones: Qué tipo son (Lineal, Afín, Exponencial) y por qué.
      📌 3. Modelo Matemático (Fórmulas): Escribe las ecuaciones formales.
      📌 4. DESARROLLO PASO A PASO (Crucial):
         - Muestra CÓMO llegaste a la fórmula.
         - Si hay intersecciones (ej: ciclistas), resuelve la ecuación igualando f(t)=g(t) paso a paso.
         - Sustituye los valores numéricos.
      📌 5. Conclusiones y Insights: ¿Qué significa la intersección? ¿Qué tendencia muestra?
      📌 6. Problemas Adicionales: Sugiere 3 variantes más difíciles.

      Responde ÚNICAMENTE con el JSON.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            independentVariables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  symbol: { type: Type.STRING },
                  min: { type: Type.NUMBER },
                  max: { type: Type.NUMBER },
                  default: { type: Type.NUMBER },
                  step: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["name", "symbol", "min", "max", "default"]
              }
            },
            outputs: {
              type: Type.ARRAY,
              description: "Lista de funciones a graficar (Eje Y). Si hay ciclistas A y B, crea dos outputs.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nombre legible, ej: Ciclista A" },
                  symbol: { type: Type.STRING, description: "Clave exacta usada en el return del JS. Ej: 'Ca'" },
                  unit: { type: Type.STRING },
                  color: { type: Type.STRING, description: "Color hex sugerido (opcional)" }
                },
                required: ["name", "symbol"]
              }
            },
            jsFormula: { type: Type.STRING, description: "Cuerpo de función JS. DEBE incluir 'return'. Ej: 'return { y1: 2*x, y2: x+5 };'" },
            pythonFormula: { type: Type.STRING },
            analysisMarkdown: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
        const cleaned = cleanJsonText(response.text);
        const parsed = JSON.parse(cleaned) as SimulationSchema;
        
        // --- Validation & Defaults ---
        if (!parsed.independentVariables || !Array.isArray(parsed.independentVariables)) {
            parsed.independentVariables = [{
                name: "Tiempo", symbol: "t", min: 0, max: 20, default: 0, step: 1, description: "Variable independiente"
            }];
        }
        parsed.independentVariables = parsed.independentVariables.map(v => ({
            name: v.name || "Variable",
            symbol: v.symbol || "x",
            min: typeof v.min === 'number' ? v.min : -10,
            max: typeof v.max === 'number' ? v.max : 10,
            default: typeof v.default === 'number' ? v.default : 0,
            step: typeof v.step === 'number' ? v.step : 1,
            description: v.description || ""
        }));

        const legacyDep = (parsed as any).dependentVariable;
        if (!parsed.outputs && legacyDep) {
             parsed.outputs = [{
                 name: legacyDep.name || "Resultado",
                 symbol: legacyDep.symbol || "y",
                 unit: legacyDep.unit || ""
             }];
        } else if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
            parsed.outputs = [{ name: "f(x)", symbol: "y", unit: "" }];
        }

        if (!parsed.jsFormula) parsed.jsFormula = "return 0;";
        if (!parsed.jsFormula.includes("return")) parsed.jsFormula = "return " + parsed.jsFormula;

        return parsed;
    }
    throw new Error("La IA no devolvió texto válido.");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
        title: "Error de Análisis",
        description: (error as Error).message || "No se pudo interpretar el problema.",
        independentVariables: [{ name: "x", symbol: "x", min: -10, max: 10, default: 0, step: 1, description: "" }],
        outputs: [{ name: "Error", symbol: "y" }],
        jsFormula: "return 0;",
        pythonFormula: "0",
        analysisMarkdown: `### Error\n\n${(error as Error).message}. Asegúrate de haber configurado la API KEY en Vercel.`
    };
  }
};

export const explainMathConcept = async (context: string, question: string): Promise<string> => {
  try {
    const ai = getAiClient(); // Initialize client HERE too
    const prompt = `
      Eres un profesor de matemáticas y ciencia de datos.
      Contexto: ${context}
      Pregunta: ${question}
      Responde en Markdown detallado.
    `;
    const response = await ai.models.generateContent({ model: modelId, contents: prompt });
    return response.text || "No se pudo generar explicación.";
  } catch (error) {
    return "Error al conectar con tutor. Verifica tu API Key.";
  }
};