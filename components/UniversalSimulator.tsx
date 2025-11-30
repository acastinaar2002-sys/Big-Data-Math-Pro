import React, { useState, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot, Brush, TooltipProps } from 'recharts';
import { analyzeProblemForSimulation } from '../services/geminiService';
import { SimulationSchema, DataPoint, VariableDef, OutputVariable } from '../types';
import { Play, Download, Table, Code, Activity, RefreshCw, ChevronDown, FileText, BarChart2, AlertCircle, Eye, EyeOff, Layers, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Dynamic color generator for infinite lines
const getColor = (index: number) => {
  const hue = (index * 137.508) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 50%)`;
};

// --- SMART TOOLTIP COMPONENT ---
// Explicitly typed to satisfy Vercel build requirements
const CustomTooltip = ({ active, payload, label, primaryVarSymbol }: TooltipProps<number, string> & { primaryVarSymbol?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-gray-200 p-4 rounded-2xl shadow-xl text-xs font-sans">
        <div className="mb-2 pb-2 border-b border-gray-100">
            <span className="uppercase tracking-widest text-gray-400 font-bold text-[10px]">{primaryVarSymbol || 'X'}</span>
            <p className="text-lg font-bold text-gray-900 font-mono">{Number(label).toFixed(2)}</p>
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-medium text-gray-600">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-gray-900">{Number(entry.value).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const UniversalSimulator: React.FC = () => {
  // Input State
  const [problemText, setProblemText] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Simulation Model State
  const [schema, setSchema] = useState<SimulationSchema | null>(null);
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [dataCount, setDataCount] = useState<number>(100); 
  
  // View State
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const analysisRef = useRef<HTMLDivElement>(null);

  // --- 1. ANALYSIS ENGINE ---
  const handleAnalyze = async () => {
    if (!problemText.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setSchema(null);
    setHiddenLines(new Set());
    
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

  // --- 2. DATA GENERATION ENGINE (Memoized) ---
  const { generatedData, primaryAxisVar, outputs } = useMemo(() => {
      if (!schema || !schema.independentVariables || schema.independentVariables.length === 0) {
          return { generatedData: [], primaryAxisVar: null, outputs: [] };
      }

      const primaryVar: VariableDef = schema.independentVariables[0];
      const outs: OutputVariable[] = schema.outputs || [];
      const data: DataPoint[] = [];

      // Safety check with defaults
      const minVal = typeof primaryVar.min === 'number' ? primaryVar.min : -10;
      const maxVal = typeof primaryVar.max === 'number' ? primaryVar.max : 10;
      // Ensure dataCount is valid
      const safeDataCount = dataCount > 0 ? dataCount : 100;
      const step = (maxVal - minVal) / safeDataCount;

      for (let i = 0; i <= safeDataCount; i++) {
          const currentX = parseFloat((minVal + (i * step)).toFixed(2));
          const contextVars = { ...variables, [primaryVar.symbol]: currentX };
          
          try {
              const keys = Object.keys(contextVars);
              const values = Object.values(contextVars);
              // Function construction - eslint-disable-next-line
              const func = new Function(...keys, schema.jsFormula);
              const resultRaw = func(...values);

              const point: DataPoint = {
                  [primaryVar.symbol]: currentX,
                  ...contextVars
              };

              if (typeof resultRaw === 'object' && resultRaw !== null) {
                  Object.keys(resultRaw).forEach(key => {
                      point[key] = parseFloat(Number(resultRaw[key]).toFixed(4));
                  });
              } else if (typeof resultRaw === 'number') {
                  const symbol = outs[0]?.symbol || 'y';
                  point[symbol] = parseFloat(resultRaw.toFixed(4));
              }
              data.push(point);
          } catch (e) {
              console.warn("Math error at", currentX, e);
          }
      }

      return { generatedData: data, primaryAxisVar: primaryVar, outputs: outs };

  }, [schema, variables, dataCount]);

  // --- 3. INTERSECTION DETECTION ENGINE ---
  const intersections = useMemo(() => {
      if (!generatedData.length || outputs.length < 2 || !primaryAxisVar) return [];
      const points: {x: number, y: number, label: string, color: string}[] = [];
      const activeOutputs = outputs.filter(o => !hiddenLines.has(o.symbol));

      for (let i = 0; i < activeOutputs.length; i++) {
          for (let j = i + 1; j < activeOutputs.length; j++) {
              const lineA = activeOutputs[i];
              const lineB = activeOutputs[j];

              for (let k = 0; k < generatedData.length - 1; k++) {
                  const p1 = generatedData[k];
                  const p2 = generatedData[k+1];
                  
                  const x1 = Number(p1[primaryAxisVar.symbol]);
                  const x2 = Number(p2[primaryAxisVar.symbol]);
                  
                  // Safe access to y values
                  const yA1 = Number(p1[lineA.symbol]);
                  const yB1 = Number(p1[lineB.symbol]);
                  const yA2 = Number(p2[lineA.symbol]);
                  const yB2 = Number(p2[lineB.symbol]);

                  if (isNaN(yA1) || isNaN(yB1) || isNaN(yA2) || isNaN(yB2)) continue;

                  const diff1 = yA1 - yB1;
                  const diff2 = yA2 - yB2;

                  // Sign change indicates intersection
                  if (Math.sign(diff1) !== Math.sign(diff2) && Math.abs(diff1) < 1000) {
                      // Linear interpolation for precise X
                      const fraction = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
                      const intersectX = x1 + fraction * (x2 - x1);
                      const intersectY = yA1 + fraction * (yA2 - yA1);

                      points.push({
                          x: parseFloat(intersectX.toFixed(2)),
                          y: parseFloat(intersectY.toFixed(2)),
                          label: "Cruce",
                          color: "#EF4444"
                      });
                  }
              }
          }
      }
      return points;
  }, [generatedData, outputs, hiddenLines, primaryAxisVar]);


  // --- HANDLERS ---
  const handleVariableChange = (symbol: string, value: number) => {
    setVariables(prev => ({ ...prev, [symbol]: value }));
  };

  const toggleLineVisibility = (symbol: string) => {
    const newHidden = new Set(hiddenLines);
    if (newHidden.has(symbol)) newHidden.delete(symbol);
    else newHidden.add(symbol);
    setHiddenLines(newHidden);
  };

  const downloadCSV = () => {
    if (generatedData.length === 0) return;
    const headers = Object.keys(generatedData[0]).join(",");
    const rows = generatedData.map(row => Object.values(row).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${schema?.title || "simulacion"}_dataset.csv`;
    link.click();
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1600px] mx-auto w-full pb-20">
      
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
                <p className="text-gray-500">Pega enunciados de funciones, geometría o big data. El sistema los modela automáticamente.</p>
              </div>
            </div>
            
            {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-pulse">
                    <AlertCircle size={20} />
                    <span className="font-medium">{errorMsg}</span>
                </div>
            )}

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-300 to-purple-300 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
              <textarea 
                className="relative w-full h-48 p-6 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-gray-700 font-medium resize-none text-base shadow-inner disabled:opacity-50"
                placeholder="Ejemplo: Un ciclista A viaja a 14km/h desde Panamá. Otro B sale de Colón a 11km/h. La distancia es 75km. ¿Cuándo se encuentran?"
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
                        <span>Analizando...</span>
                    </>
                ) : (
                    <>
                        <Play size={20} fill="currentColor" />
                        <span>Simular</span>
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
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold tracking-wide uppercase shadow-sm border border-green-200 flex items-center gap-1">
                    <Activity size={12}/> Activo
                  </span>
                </h2>
                <p className="text-gray-500 mt-1 max-w-3xl text-lg line-clamp-1">{schema.description}</p>
              </div>
              <button 
                onClick={() => {setSchema(null); setProblemText(""); setErrorMsg(null);}}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-red-100 whitespace-nowrap"
              >
                Nuevo Problema
              </button>
           </div>
        )}
      </div>

      {schema && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow animate-fade-in-up">
          
          {/* LEFT PANEL: Controls */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Parameters */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Activity size={16} className="text-blue-600"/> Parámetros
              </h3>
              
              <div className="space-y-6">
                {schema.independentVariables.map((variable) => (
                  <div key={variable.symbol} className="space-y-2 group">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-500 uppercase">
                        {variable.name} <span className="text-gray-400">({variable.symbol})</span>
                      </label>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono font-bold">
                        {variables[variable.symbol]}
                      </span>
                    </div>
                    <input
                        type="range"
                        min={variable.min}
                        max={variable.max}
                        step={variable.step}
                        value={variables[variable.symbol] || variable.default}
                        onChange={(e) => handleVariableChange(variable.symbol, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                    />
                  </div>
                ))}
                
                {/* Resolution */}
                <div className="pt-4 border-t border-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Resolución</label>
                      <span className="text-xs font-medium text-gray-400">{dataCount} pts</span>
                    </div>
                    <input
                      type="range" min="20" max="500" step="20"
                      value={dataCount}
                      onChange={(e) => setDataCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                </div>
              </div>
            </div>

            {/* Layers */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                 <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                    <Layers size={16} className="text-blue-600"/> Capas
                 </h3>
                 <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {outputs.map((out, idx) => {
                        const isHidden = hiddenLines.has(out.symbol);
                        const color = out.color || getColor(idx);
                        return (
                            <button 
                                key={out.symbol}
                                onClick={() => toggleLineVisibility(out.symbol)}
                                className={`w-full flex items-center justify-between p-2 rounded-lg transition-all border ${isHidden ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: isHidden ? '#9CA3AF' : color}} />
                                    <span className="text-xs font-semibold text-gray-700 truncate max-w-[120px]" title={out.name}>{out.name}</span>
                                </div>
                                {isHidden ? <EyeOff size={14} className="text-gray-400"/> : <Eye size={14} className="text-blue-500"/>}
                            </button>
                        )
                    })}
                 </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 grid grid-cols-2 gap-3">
               <button onClick={downloadCSV} className="col-span-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-colors border border-gray-200">
                  <Download size={16} /> CSV
                </button>
                 <button onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')} className="col-span-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-colors border border-gray-200">
                   {viewMode === 'chart' ? <Table size={16} /> : <BarChart2 size={16} />}
                   {viewMode === 'chart' ? 'Tabla' : 'Gráfica'}
                </button>
            </div>
          </div>

          {/* MAIN PANEL: Visualization & Analysis */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            
            {/* 1. CHART AREA */}
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 h-[600px] flex flex-col relative overflow-hidden group">
               
               {/* Toolbar overlay */}
               <div className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur border border-gray-200 rounded-lg p-1 flex gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <div className="px-2 py-1 text-xs font-medium text-gray-500">Zoom activo con Slider</div>
                   <Search size={14} className="text-gray-400"/>
               </div>

               {viewMode === 'chart' ? (
                 <div className="w-full h-full p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generatedData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                            dataKey={primaryAxisVar?.symbol} 
                            stroke="#9CA3AF"
                            tick={{fontSize: 11, fill: '#6B7280'}}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis 
                            stroke="#9CA3AF"
                            tick={{fontSize: 11, fill: '#6B7280'}}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip 
                            content={<CustomTooltip primaryVarSymbol={primaryAxisVar?.symbol} />}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} iconType="circle"/>
                        
                        {/* Render Intersections */}
                        {intersections.map((point, i) => (
                             <ReferenceDot 
                                key={`intersect-${i}`} 
                                x={point.x} 
                                y={point.y} 
                                r={6} 
                                fill="#EF4444" 
                                stroke="#fff" 
                                strokeWidth={3}
                                isFront={true}
                                label={{ value: point.label, position: 'top', fill: '#EF4444', fontSize: 10, fontWeight: 700 }}
                             />
                        ))}

                        {outputs.map((output, index) => (
                            !hiddenLines.has(output.symbol) && (
                                <Line 
                                    key={output.symbol}
                                    type="monotone" 
                                    dataKey={output.symbol} 
                                    name={output.name}
                                    stroke={output.color || getColor(index)} 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6, strokeWidth: 0, fill: output.color || getColor(index) }}
                                    isAnimationActive={false} 
                                />
                            )
                        ))}
                        
                        {/* Zoom Brush */}
                        <Brush 
                            dataKey={primaryAxisVar?.symbol} 
                            height={30} 
                            stroke="#E5E7EB"
                            fill="#F9FAFB"
                            tickFormatter={() => ""} 
                        />
                        </LineChart>
                    </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="w-full h-full overflow-auto custom-scrollbar p-4">
                    <table className="w-full text-sm text-left text-gray-500 border-separate border-spacing-0">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200 font-bold bg-gray-50">{primaryAxisVar?.name}</th>
                                {outputs.map((out) => (
                                    <th key={out.symbol} className="px-6 py-3 border-b border-gray-200 font-bold bg-gray-50">{out.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {generatedData.map((row, i) => (
                                <tr key={i} className="bg-white hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900 border-b border-gray-100 font-mono">
                                        {row[primaryAxisVar?.symbol as string]}
                                    </td>
                                    {outputs.map((out) => (
                                        <td key={out.symbol} className="px-6 py-3 border-b border-gray-100 font-mono text-gray-600">
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

            {/* 2. ANALYSIS CARD */}
            <div ref={analysisRef} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>

                <button 
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="w-full flex justify-between items-center text-left mb-6 focus:outline-none group relative z-10"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                Informe Matemático
                            </h3>
                            <p className="text-sm text-gray-400 font-medium">Generado por IA • {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-full bg-gray-100 text-gray-500 transition-transform duration-300 ${showAnalysis ? 'rotate-180' : ''}`}>
                         <ChevronDown size={20} />
                    </div>
                </button>
                
                {showAnalysis && (
                     <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-gray-600 prose-a:text-blue-600 prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown>
                            {schema.analysisMarkdown}
                        </ReactMarkdown>
                     </div>
                )}
            </div>
            
            {/* 3. CODE CARD */}
            <div className="bg-[#1E1E1E] rounded-3xl p-6 shadow-xl text-gray-300 font-mono text-sm overflow-hidden border border-gray-800">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Code size={16} />
                        <span className="font-bold text-xs uppercase tracking-widest">Motor JS</span>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <pre className="text-blue-300">
{`function simulate(${primaryAxisVar?.symbol || 'x'}) {
  ${schema.jsFormula.split('\n').join('\n  ')}
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