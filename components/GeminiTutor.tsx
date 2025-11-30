import React, { useState } from 'react';
import { explainMathConcept } from '../services/geminiService';
import { Send, Sparkles } from 'lucide-react';

const GeminiTutor: React.FC = () => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const context = `
      Contexto General de Matemáticas para Big Data:
      1. Tipos de Funciones: Tablas, Gráficos, Expresiones algebraicas.
      2. Funciones Lineales: f(x) = mx + b. Pendiente (m), Intersección (b). Regresión lineal simple.
      3. Funciones Exponenciales: Crecimiento y decaimiento.
      4. Interpolación y Extrapolación de datos.
      5. Análisis de variables y correlaciones.
    `;
    
    const result = await explainMathConcept(context, query);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
       <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/50 flex-grow flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tutor IA de Big Data</h2>
              <p className="text-gray-500">Pregunta sobre funciones, regresiones o análisis matemático.</p>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto mb-6 pr-2 space-y-4 custom-scrollbar">
            {response ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-purple-50">
                 <div className="prose prose-purple max-w-none">
                    <div className="whitespace-pre-wrap font-sans text-gray-700 text-base leading-relaxed">
                        {response}
                    </div>
                 </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6">
                <Sparkles size={64} className="opacity-10 text-purple-500" />
                <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-gray-500">¿En qué puedo ayudarte hoy?</p>
                    <p className="text-sm">Intenta preguntar:</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {["¿Cómo interpreto la pendiente?", "¿Qué es una función exponencial?", "Diferencia entre interpolación y extrapolación"].map((q, i) => (
                        <button key={i} onClick={() => setQuery(q)} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors">
                            {q}
                        </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Haz una pregunta matemática compleja..."
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-2xl pl-6 pr-14 py-4 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none shadow-inner"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-3 top-3 p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={20} />}
            </button>
          </form>
       </div>
    </div>
  );
};

export default GeminiTutor;