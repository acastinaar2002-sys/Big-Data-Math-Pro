import React, { useState } from 'react';
import { AppTab } from './types';
import UniversalSimulator from './components/UniversalSimulator';
import GeminiTutor from './components/GeminiTutor';
import { Activity, GraduationCap, Database } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SIMULATOR);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.SIMULATOR:
        return <UniversalSimulator />;
      case AppTab.TUTOR:
        return <GeminiTutor />;
      default:
        return <UniversalSimulator />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans selection:bg-blue-100">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col h-screen">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 text-white p-3 rounded-2xl shadow-lg shadow-gray-300/50">
                <Database size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Big Data Math Pro</h1>
              <p className="text-gray-500 mt-1 font-medium text-sm">Laboratorio de Modelado Matemático</p>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-sm border border-gray-200 inline-flex overflow-x-auto">
            <button
              onClick={() => setActiveTab(AppTab.SIMULATOR)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                activeTab === AppTab.SIMULATOR
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Activity size={18} />
              Simulador Universal
            </button>
             <button
              onClick={() => setActiveTab(AppTab.TUTOR)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                activeTab === AppTab.TUTOR
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <GraduationCap size={18} />
              Tutor IA
            </button>
          </nav>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow overflow-hidden relative">
           <div className="absolute inset-0 overflow-y-auto pb-20 px-1 custom-scrollbar">
             {renderContent()}
           </div>
        </main>

        <footer className="py-4 text-center text-xs text-gray-400 font-medium">
          Powered by Gemini 2.5 • Herramientas Educativas para Ciencia de Datos
        </footer>
      </div>
    </div>
  );
};

export default App;