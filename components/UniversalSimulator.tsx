
import React, { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from 'recharts';
import { analyzeProblemForSimulation } from '../services/geminiService';
import { SimulationSchema, DataPoint } from '../types';
import { Play, Download, Table, Code, Activity, RefreshCw, ChevronDown, ChevronUp, FileText, BarChart2, AlertCircle, Eye, EyeOff, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Apple-style color palette for multiple lines
const COLORS = [
  "#007AFF", // Blue
  "#34C759", // Green
  "#FF9500", // Orange
  "#FF3B30", // Red
  "#AF52DE", // Purple
  "#5AC8FA", // Teal
  "#FF2D55", // Pink
  "#5856D6"  // Indigo
];

const UniversalSimulator: React.FC = () => {
  // Input State
  const [problemText, setProblemText] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Simulation Model State
  const [schema, setSchema] = useState<SimulationSchema | null>(null);
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [dataCount, setDataCount] = useState<number>(50); // Number of data points to generate
  
  // Data State
  const [generatedData, setGeneratedData] = useState<DataPoint[]>([]);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // UI State
  const analysisRef = useRef<HTMLDivElement>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const handleAnalyze = async () => {
    if (!problemText.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setSchema(null);
    setGeneratedData([]);
    setHiddenLines(new Set()); // Reset visibility
    
    try {
      const result = await analyzeProblemForSimulation(problemText);
      
      if (result.title === "Error de Análisis") {
          setErrorMsg(result.description);
          setSchema(result); 
          setIsAnalyzing(false);
          return;
      }

      setSchema(result);
      
      // Initialize default independent variables
      const initialVars: Record<string, number> = {};
      if (result.independentVariables && Array.isArray(result.independentVariables)) {
        result.independentVariables.forEach(v => {
            if (v && v.symbol) {
            initialVars[v.symbol] = v.default;
            }
        });
      }
      setVariables(initialVars);
      
      // Auto generate initial data
      generateDataset(result, initialVars, dataCount);
      
      // Scroll to analysis
      setTimeout(() => {
        analysisRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch (error) {
      console.error(error);
      setErrorMsg("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDataset = (currentSchema: SimulationSchema, currentVars: Record<string, number>, count: number) => {
    if (!currentSchema || !currentSchema.independentVariables || currentSchema.independentVariables.length === 0) return;

    const data: DataPoint[] = [];
    
    // Find the "primary" independent variable to iterate over (usually time or x)
    const primaryVar = currentSchema.independentVariables[0];
    if (!primaryVar) return;

    // Safety check for min/max
    const minVal = typeof primaryVar.min === 'number' ? primaryVar.min : -10;
    const maxVal = typeof primaryVar.max === 'number' ? primaryVar.max : 10;
    const step = (maxVal - minVal) / count;

    for (let i = 0; i <= count; i++) {
      const currentX = parseFloat((minVal + (i * step)).toFixed(2));
      
      // Construct the execution context
      const contextVars = { ...currentVars, [primaryVar.symbol]: currentX };
      
      try {
        const keys = Object.keys(contextVars);
        const values = Object.values(contextVars);
        
        // Execute the JS formula. It might return a number OR an object
        // Example formula: "return { F: 4*x+3, G: 4*x-3 };"
        const func = new Function(...keys, currentSchema.jsFormula);
        const resultRaw = func(...values);

        const point: DataPoint = {
            [primaryVar.symbol]: currentX,
            ...contextVars
        };

        // Handle Single Output vs Multiple Output
        if (typeof resultRaw === 'object' && resultRaw !== null) {
            // Multiple functions mapped
            Object.keys(resultRaw).forEach(key => {
                 point[key] = parseFloat(Number(resultRaw[key]).toFixed(4));
            });
        } else if (typeof resultRaw === 'number') {
            // Single function fallback
            const symbol = currentSchema.outputs[0]?.symbol || 'y';
            point[symbol] = parseFloat(resultRaw.toFixed(4));
        }

        data.push(point);

      } catch (e) {
        console.error("Error executing formula for X=" + currentX, e);
      }
    }
    setGeneratedData(data);
  };

  const handleVariableChange = (symbol: string, value: number) => {
    const newVars = { ...variables, [symbol]: value };
    setVariables(newVars);
    if (schema) {
      generateDataset(schema, newVars, dataCount);
    }
  };

  const toggleLineVisibility = (symbol: string) => {
    const newHidden = new Set(hiddenLines);
    if (newHidden.has(symbol)) {
        newHidden.delete(symbol);
    } else {
        newHidden.add(symbol);
    }
    setHiddenLines(newHidden);
  };

  const downloadCSV = () => {
    if (generatedData.length === 0) return;
    const headers = Object.keys(generatedData[0]).join(",");
    const rows = generatedData.map(row => Object.values(row).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${schema?.title || "simulacion"}_dataset.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe access for primary variable for chart
  const primaryAxisVar = schema?.independentVariables?.[0];
  const safeIndependentVariables = schema?.independentVariables || [];
  const outputs = schema?.outputs || [];

  return (
    <div className="flex flex-col h-full space-y-6 max-w-7xl mx-auto w-full pb-20">
      
      {/* Input Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 transition-all duration-500">
        {!schema ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-200">
                <Activity size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Definir Problema</h2>
                <p className="text-gray-500">Pega tus enunciados matemáticos. El sistema detectará las funciones y las resolverá.</p>
              </div>
            </div>
            
            {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    <span className="font-medium">{errorMsg}</span>
                </div>
            )}

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-300 to-purple-300 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
              <textarea 
                className="relative w-full h-48 p-6 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-gray-700 font-medium resize-none text-base shadow-inner disabled:opacity-50"
                placeholder="Pega aquí los problemas (Ej: 'Un ciclista A viaja a 14km/h y otro B a 11km/h...')"
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                disabled={isAnalyzing}
              />
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || !problemText}
                className="absolute bottom-6 right-6 bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-full font-medium shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-80 disabled:cursor-wait flex items-center gap-2 z-10"
              >
                {isAnalyzing ? (
                    <>
                        <RefreshCw className="animate-spin" size={20}/>
                        <span>Procesando Modelos...</span>
                    </>
                ) : (
                    <>
                        <Play size={20} fill="currentColor" />
                        <span>Resolver y Graficar</span>
                    </>
                )}
              </button>
            </div>
          </div>
        ) : (
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  {schema.title}
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold tracking-wide uppercase shadow-sm border border-green-200">Simulación Activa</span>
                </h2>
                <p className="text-gray-500 mt-1 max-w-3xl text-lg line-clamp-2">{schema.description}</p>
              </div>
              <button 
                onClick={() => {setSchema(null); setGeneratedData([]); setProblemText(""); setErrorMsg(null);}}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-red-100 whitespace-nowrap"
              >
                Nuevo Problema
              </button>
           </div>
        )}
      </div>

      {schema && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow animate-fade-in-up">
          
          {/* Controls Panel */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Parameters Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                <Activity size={20} className="text-blue-600"/>
                Variables de Entrada
              </h3>
              
              <div className="space-y-8">
                {safeIndependentVariables.map((variable) => (
                  <div key={variable.symbol} className="space-y-3 group">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-gray-700">
                        {variable.name} <span className="text-gray-400 font-normal">({variable.symbol})</span>
                      </label>
                      <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 tabular-nums">
                        {variables[variable.symbol]}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                         <input
                            type="range"
                            min={variable.min}
                            max={variable.max}
                            step={variable.step}
                            value={variables[variable.symbol] || variable.default}
                            onChange={(e) => handleVariableChange(variable.symbol, parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-all"
                          />
                    </div>
                    <p className="text-xs text-gray-400">{variable.description}</p>
                  </div>
                ))}
                
                 {/* Resolution Control */}
                <div className="space-y-3 pt-6 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-gray-700">Resolución (Puntos)</label>
                      <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono text-gray-800">{dataCount}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={dataCount}
                      onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setDataCount(val);
                          generateDataset(schema, variables, val);
                      }}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                </div>
              </div>
            </div>

            {/* Visibility / Layers Control */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                 <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <Layers size={20} className="text-blue-600"/>
                    Visualización de Capas
                 </h3>
                 <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {outputs.map((out, idx) => {
                        const isHidden = hiddenLines.has(out.symbol);
                        const color = out.color || COLORS[idx % COLORS.length];
                        return (
                            <button 
                                key={out.symbol}
                                onClick={() => toggleLineVisibility(out.symbol)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${isHidden ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{backgroundColor: isHidden ? '#9CA3AF' : color}}
                                    />
                                    <span className="text-sm font-medium text-gray-700 text-left">{out.name}</span>
                                </div>
                                {isHidden ? <EyeOff size={16} className="text-gray-400"/> : <Eye size={16} className="text-blue-500"/>}
                            </button>
                        )
                    })}
                 </div>
                 <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                     <button 
                        onClick={() => setHiddenLines(new Set())} 
                        className="flex-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors"
                     >
                        Ver Todas
                     </button>
                     <button 
                         onClick={() => {
                             const all = new Set(outputs.map(o => o.symbol));
                             setHiddenLines(all);
                         }}
                         className="flex-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 py-2 rounded-lg transition-colors"
                     >
                        Ocultar Todas
                     </button>
                 </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
               <button 
                  onClick={downloadCSV}
                  className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200"
                >
                  <Download size={18} />
                  Exportar CSV
                </button>
                 <button 
                  onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
                  className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200"
                >
                   {viewMode === 'chart' ? <Table size={18} /> : <BarChart2 size={18} />}
                   {viewMode === 'chart' ? 'Ver Tabla de Datos' : 'Ver Gráfica'}
                </button>
            </div>
          </div>

          {/* Visualization Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Chart/Table Container */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-[600px] flex flex-col relative overflow-hidden">
               {viewMode === 'chart' ? (
                 <div className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generatedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey={primaryAxisVar?.symbol} 
                            label={{ value: primaryAxisVar?.name, position: 'insideBottomRight', offset: -10 }} 
                            stroke="#9CA3AF"
                            tick={{fontSize: 12}}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis 
                            stroke="#9CA3AF"
                            tick={{fontSize: 12}}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                            }}
                            itemStyle={{ color: '#374151', fontSize: '13px', fontWeight: 500 }}
                            labelStyle={{ color: '#9CA3AF', marginBottom: '8px' }}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        
                        {outputs.map((output, index) => (
                            !hiddenLines.has(output.symbol) && (
                                <Line 
                                    key={output.symbol}
                                    type="monotone" 
                                    dataKey={output.symbol} 
                                    name={output.name}
                                    stroke={output.color || COLORS[index % COLORS.length]} 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    isAnimationActive={false} // Smoother toggling
                                />
                            )
                        ))}
                        </LineChart>
                    </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="w-full h-full overflow-auto custom-scrollbar">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 rounded-tl-lg">{primaryAxisVar?.symbol}</th>
                                {outputs.map((out) => (
                                    <th key={out.symbol} className="px-6 py-3">{out.name} ({out.symbol})</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {generatedData.map((row, i) => (
                                <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {row[primaryAxisVar?.symbol as string]}
                                    </td>
                                    {outputs.map((out) => (
                                        <td key={out.symbol} className="px-6 py-4">
                                            {row[out.symbol]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
               )}
            </div>

            {/* Markdown Analysis */}
            <div ref={analysisRef} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <button 
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="w-full flex justify-between items-center text-left mb-6 focus:outline-none group"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600 group-hover:bg-purple-200 transition-colors">
                            <FileText size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                            Análisis Matemático & Big Data
                        </h3>
                    </div>
                    {showAnalysis ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                </button>
                
                {showAnalysis && (
                     <div className="prose prose-blue max-w-none">
                        <ReactMarkdown 
                            components={{
                                h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-2" {...props} />,
                                p: ({node, ...props}) => <p className="text-gray-600 leading-relaxed mb-4" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 text-gray-600 mb-4" {...props} />,
                                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                strong: ({node, ...props}) => <strong className="text-gray-900 font-semibold" {...props} />,
                                code: ({node, ...props}) => <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                            }}
                        >
                            {schema.analysisMarkdown}
                        </ReactMarkdown>
                     </div>
                )}
            </div>
            
            {/* Source Code View */}
            <div className="bg-gray-900 rounded-3xl p-6 shadow-lg text-gray-300 font-mono text-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-4 text-gray-400 border-b border-gray-700 pb-2">
                    <Code size={16} />
                    <span>Motor de Simulación (JavaScript Generado)</span>
                </div>
                <div className="overflow-x-auto">
                    <pre>
{`// Función generada por IA para este modelo
function calculate(${safeIndependentVariables.map(v => v.symbol).join(", ")}) {
  ${schema.jsFormula}
}`}
                    </pre>
                </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalSimulator;
