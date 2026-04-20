import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  Play, 
  Square, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  BarChart3, 
  PieChart, 
  Radius, 
  CircleDot, 
  Cloud,
  LayoutGrid,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
} from 'chart.js';
import { Bar, Pie, Radar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as d3 from 'd3';
import { MASTER_DATA } from './constants';
import { PollResult, VisualType } from './types';
import { cn } from './lib/utils';

// Register ChartJS plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ChartDataLabels
);

// Bubble Cloud Component
const BubbleCloud = ({ data }: { data: Record<string, number> }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDataRef = useRef("");

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const dataString = JSON.stringify(data);
    if (dataString === prevDataRef.current) return;
    prevDataRef.current = dataString;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    
    // Ensure group exists
    let g = svg.select<SVGGElement>("g.main-group");
    if (g.empty()) {
      g = svg.append("g").attr("class", "main-group").attr("transform", "translate(20, 20)");
    }

    const formattedData = {
      children: Object.entries(data).map(([name, value]) => ({
        name,
        value: Math.max(value, 0.1),
      })),
    };

    const root = d3.hierarchy(formattedData).sum((d: any) => d.value);
    d3.pack().size([width - 40, height - 40]).padding(10)(root);
    const nodes = (root as d3.HierarchyCircularNode<any>).leaves();

    const nodeJoin = g.selectAll<SVGGElement, d3.HierarchyCircularNode<any>>(".bubble-node")
      .data(nodes, (d: any) => d.data.name);

    // EXIT
    nodeJoin.exit()
      .transition().duration(500)
      .attr("opacity", 0)
      .attr("transform", (d: any) => `translate(${d.x}, ${d.y}) scale(0)`)
      .remove();

    // ENTER
    const nodeEnter = nodeJoin.enter()
      .append("g")
      .attr("class", "bubble-node")
      .attr("opacity", 0)
      .attr("transform", d => `translate(${d.x}, ${d.y}) scale(0)`);

    nodeEnter.append("circle")
      .attr("fill", "#004c9b")
      .attr("stroke", "#ffdc00")
      .attr("stroke-width", 4);

    nodeEnter.append("text").attr("class", "label-text")
      .attr("y", -4)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-weight", "800");

    nodeEnter.append("text").attr("class", "value-text")
      .attr("text-anchor", "middle")
      .attr("fill", "#ffdc00")
      .attr("font-weight", "900");

    // UPDATE + ENTER
    const nodeUpdate = nodeEnter.merge(nodeJoin as any);

    nodeUpdate.transition().duration(800)
      .attr("opacity", 1)
      .attr("transform", (d: any) => `translate(${d.x}, ${d.y}) scale(1)`);

    nodeUpdate.select("circle")
      .transition().duration(800)
      .attr("r", (d: any) => d.r);

    nodeUpdate.select(".label-text")
      .attr("font-size", (d: any) => Math.max(8, d.r / 4))
      .text((d: any) => d.data.name.toUpperCase());

    nodeUpdate.select(".value-text")
      .attr("y", (d: any) => d.r / 3)
      .attr("font-size", (d: any) => Math.max(12, d.r / 2.2))
      .text((d: any) => Math.floor(d.data.value));

  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};

// Word Cloud Component (Simplified D3 placement)
const WordCloud = ({ data }: { data: Record<string, number> }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDataRef = useRef("");

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const dataString = JSON.stringify(data);
    if (dataString === prevDataRef.current) return;
    prevDataRef.current = dataString;

    const width = 800; // Use fixed viewBox width for placement simulation
    const height = 500; // Use fixed viewBox height for placement simulation
    const svg = d3.select(svgRef.current);
    
    let g = svg.select<SVGGElement>("g.word-group");
    if (g.empty()) {
      g = svg.append("g").attr("class", "word-group");
    }

    const items = Object.entries(data)
      .map(([label, val]) => ({ label, val }))
      .sort((a, b) => b.val - a.val);

    const maxVal = Math.max(...Object.values(data), 1);
    const count = items.length;
    
    // Dynamically adjust font scale based on population density
    // For many words, we shrink the overall range to ensure fitness
    const scaleFactor = Math.max(0.3, Math.min(1, 20 / Math.sqrt(count || 1)));
    const minFontSize = 14 * scaleFactor + 10;
    const maxFontSize = 70 * scaleFactor + 40;

    const fontSizeScale = d3.scalePow().exponent(0.5).domain([0, maxVal]).range([minFontSize, maxFontSize]);

    const centerX = width / 2;
    const centerY = height / 2;
    const placedRects: any[] = [];
    const padding = 6;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const finalData = items.map(item => {
      let fontSize = fontSizeScale(item.val);
      let textWidth = 0;
      let textHeight = 0;
      
      let angle = 0, radius = 0, found = false, tx = 0, ty = 0;

      // Inner function to try placement at a specific font size
      const tryPlace = (size: number) => {
        ctx.font = `900 ${size}px "Plus Jakarta Sans"`;
        textWidth = ctx.measureText(item.label.toUpperCase()).width;
        textHeight = size * 0.9;
        
        angle = 0;
        radius = 0;
        
        while (radius < 500) {
          tx = centerX + radius * Math.cos(angle) - textWidth / 2;
          ty = centerY + radius * Math.sin(angle) - textHeight / 2;
          
          const rect = { x1: tx, y1: ty, x2: tx + textWidth, y2: ty + textHeight };
          
          const withinBounds = rect.x1 > padding && rect.x2 < width - padding && 
                              rect.y1 > padding && rect.y2 < height - padding;

          if (withinBounds) {
            let overlap = placedRects.some(r => !(rect.x2 + padding < r.x1 || rect.x1 - padding > r.x2 || rect.y2 + padding < r.y1 || rect.y1 - padding > r.y2));
            if (!overlap) return true;
          }
          
          angle += 0.2;
          radius += 0.4;
        }
        return false;
      };

      found = tryPlace(fontSize);
      
      // Fallback: If it doesn't fit, try shrinking it up to 3 times
      if (!found) {
        for (let attempt = 0; attempt < 3; attempt++) {
          fontSize *= 0.75;
          if (fontSize < 10) break;
          if (tryPlace(fontSize)) {
            found = true;
            break;
          }
        }
      }

      // Final fallback: If still not found, force it near the edge or center with minimum size
      if (!found) {
        fontSize = 10;
        tx = Math.random() * (width - 100) + 50;
        ty = Math.random() * (height - 60) + 30;
        found = true; 
      }

      placedRects.push({ x1: tx, y1: ty, x2: tx + textWidth, y2: ty + textHeight });
      return { ...item, tx: tx + textWidth / 2, ty: ty + textHeight / 2, fontSize, found };
    });

    const wordJoin = g.selectAll<SVGElement, any>(".word-node")
      .data(finalData, d => d.label);

    wordJoin.exit()
      .transition().duration(500)
      .attr("opacity", 0)
      .remove();

    const wordEnter = wordJoin.enter()
      .append("g")
      .attr("class", "word-node")
      .attr("opacity", 0)
      .attr("transform", d => `translate(${d.tx}, ${d.ty}) scale(0)`);

    wordEnter.append("text")
      .attr("text-anchor", "middle")
      .attr("font-weight", "900");

    const wordUpdate = wordEnter.merge(wordJoin as any);

    wordUpdate.transition().duration(800)
      .attr("opacity", 1)
      .attr("transform", (d: any) => `translate(${d.tx}, ${d.ty}) scale(1)`);

    wordUpdate.select("text")
      .attr("font-size", (d: any) => d.fontSize)
      .attr("fill", (_, i) => ['#004c9b', '#002d5c', '#64748b'][i % 3])
      .text((d: any) => d.label.toUpperCase());

  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};

// Response Grid Component
const ResponseGrid = ({ responses }: { responses: string[] }) => {
  return (
    <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
        <AnimatePresence mode="popLayout">
          {responses.map((text, i) => (
            <motion.div
              key={`${text}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group h-fit"
            >
              <p className="text-slate-700 font-medium leading-relaxed italic break-words whitespace-pre-wrap">
                "{text}"
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Verified Response</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#004c9b] opacity-20 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeStates, setActiveStates] = useState<Record<number, boolean>>(
    MASTER_DATA.reduce((acc, q) => ({ ...acc, [q.id]: true }), {})
  );
  const [visualTypes, setVisualTypes] = useState<Record<number, VisualType>>(
    MASTER_DATA.reduce((acc, q) => ({ ...acc, [q.id]: 'bar' }), {})
  );
  const [pollData, setPollData] = useState<PollResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'live' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [showResponses, setShowResponses] = useState(true);

  // Filter MASTER_DATA based on activeStates
  const activeQuestions = useMemo(() => 
    MASTER_DATA.filter(q => activeStates[q.id]), 
  [activeStates]);

  const currentQuestion = useMemo(() => 
    activeQuestions[currentIdx] || null,
  [activeQuestions, currentIdx]);

  const fetchData = async () => {
    if (!currentQuestion) return;
    try {
      setLoading(true);
      const res = await fetch(currentQuestion.script);
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      setPollData(result);
      setStatus('live');
    } catch (error) {
      console.error('Fetch error:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault(); // Prevent page scroll
        setShowResponses(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestions.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % activeQuestions.length);
  };

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev - 1 + activeQuestions.length) % activeQuestions.length);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: {
        display: visualTypes[currentQuestion?.id || 0] === 'pie' || visualTypes[currentQuestion?.id || 0] === 'radar',
        position: 'bottom' as const,
      },
      datalabels: {
        color: visualTypes[currentQuestion?.id || 0] === 'pie' ? '#fff' : '#004c9b',
        anchor: (visualTypes[currentQuestion?.id || 0] === 'pie' ? 'center' : 'end') as any,
        align: (visualTypes[currentQuestion?.id || 0] === 'pie' ? 'center' : 'top') as any,
        formatter: (v: number) => (v > 0 ? v : ''),
        font: { weight: 'bold' as const, size: 14 }
      }
    },
    scales: visualTypes[currentQuestion?.id || 0] === 'bar' ? {
      y: { beginAtZero: true }
    } : {}
  };

  const tallyMap = useMemo(() => {
    if (!pollData || !pollData.results) return {};
    const results = pollData.results;
    
    if (Array.isArray(results)) {
      return results.reduce((acc: Record<string, number>, val) => {
        const s = String(val);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
    }
    
    return Object.entries(results).reduce((acc: Record<string, number>, [text, count]) => {
      acc[text] = Number(count) || 0;
      return acc;
    }, {});
  }, [pollData]);

  const flatResponses = useMemo(() => {
    return Object.entries(tallyMap).flatMap(([text, count]) => 
      Array(count).fill(text)
    );
  }, [tallyMap]);

  const totalResponses = useMemo(() => {
    return Object.values(tallyMap).reduce((a: number, b: number) => a + b, 0);
  }, [tallyMap]);

  const chartData = useMemo(() => {
    const labels = Object.keys(tallyMap);
    const values = Object.values(tallyMap);
    const type = visualTypes[currentQuestion?.id || 0];

    const displayLabels = type === 'pie' ? labels.map((l, i) => `${l} (${values[i]})`) : labels;

    return {
      labels: displayLabels,
      datasets: [{
        label: 'Responses',
        data: values,
        backgroundColor: (type === 'pie' || type === 'radar')
          ? ['rgba(0, 76, 155, 0.7)', 'rgba(255, 220, 0, 0.7)', 'rgba(0, 45, 92, 0.7)', 'rgba(100, 116, 139, 0.7)', 'rgba(100, 100, 100, 0.7)']
          : '#004c9b',
        borderColor: (type === 'radar') ? '#004c9b' : '#ffffff',
        borderRadius: type === 'bar' ? 12 : 0,
        borderWidth: type === 'bar' ? 0 : 2,
        fill: type === 'radar'
      }]
    };
  }, [tallyMap, visualTypes, currentQuestion]);

  return (
    <div className={cn("h-screen flex flex-col font-sans bg-slate-50 text-slate-900 transition-colors duration-500", 
      isFullscreen && "bg-white")}>
      
      {/* Top Navbar */}
      <AnimatePresence>
        {!isFullscreen && (
          <motion.nav 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="h-16 bg-[#004c9b] text-white px-6 shadow-2xl flex items-center justify-between z-50 shrink-0"
          >
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="font-extrabold text-xl tracking-tight">PollParty <span className="text-[#ffdc00]">Pro</span></h1>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-full border border-white/10">
                <div className={cn("h-2.5 w-2.5 rounded-full transition-colors duration-500", 
                  status === 'live' ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : 
                  status === 'error' ? "bg-red-400" : "bg-slate-400")} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                  {status}
                </span>
              </div>
              <button 
                onClick={() => setIsFullscreen(true)}
                className="bg-white text-[#004c9b] hover:bg-[#ffdc00] px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 group"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Presentation
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && !isFullscreen && (
            <motion.aside 
              initial={{ x: -350 }}
              animate={{ x: 0 }}
              exit={{ x: -350 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[340px] bg-white border-r border-slate-200 flex flex-col shadow-xl z-40 overflow-hidden"
            >
              <div className="p-8 overflow-y-auto flex-1">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-8">Poll Configuration</h2>
                
                <div className="space-y-6">
                  {MASTER_DATA.map((q) => {
                    const isActive = activeStates[q.id];
                    const questionIndex = activeQuestions.findIndex(aq => aq.id === q.id);
                    const isSelected = currentIdx === questionIndex;

                    return (
                      <div 
                        key={q.id}
                        onClick={() => {
                          if (isActive && questionIndex !== -1) {
                            setCurrentIdx(questionIndex);
                          }
                        }}
                        className={cn("p-5 rounded-[2rem] border transition-all duration-300 relative group cursor-pointer overflow-hidden", 
                          isActive ? (isSelected ? "bg-white border-[#004c9b] shadow-lg ring-2 ring-[#004c9b]/20" : "bg-slate-50 border-slate-200 hover:border-[#004c9b]/50") : "bg-white border-slate-100 opacity-50 cursor-not-allowed")}
                      >
                        {isSelected && isActive && (
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004c9b]" />
                        )}
                        <div className="flex justify-between items-center mb-5">
                          <div className="flex items-center gap-4">
                            <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={isActive}
                                onChange={() => setActiveStates(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#004c9b]"></div>
                            </label>
                            <p className="font-extrabold text-sm text-slate-800 tracking-tight">Question {q.id}</p>
                          </div>
                          <a 
                            href={q.edit} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2.5 bg-white border border-slate-200 hover:bg-[#004c9b] hover:text-white rounded-xl transition text-slate-400 shadow-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <select 
                            value={visualTypes[q.id]}
                            onChange={(e) => setVisualTypes(prev => ({ ...prev, [q.id]: e.target.value as VisualType }))}
                            className="w-full text-[11px] font-black uppercase tracking-widest pl-12 pr-10 py-4 rounded-2xl border border-slate-200 bg-white hover:border-[#004c9b] focus:ring-4 focus:ring-[#004c9b]/10 outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="bar">Bar Chart</option>
                            <option value="pie">Pie Chart</option>
                            <option value="radar">Radar Chart</option>
                            <option value="bubble">Bubble Cloud</option>
                            <option value="word">Word Cloud</option>
                            <option value="grid">Response Grid</option>
                          </select>
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#004c9b] pointer-events-none">
                            {visualTypes[q.id] === 'bar' && <BarChart3 className="w-4 h-4" />}
                            {visualTypes[q.id] === 'pie' && <PieChart className="w-4 h-4" />}
                            {visualTypes[q.id] === 'radar' && <Radius className="w-4 h-4" />}
                            {visualTypes[q.id] === 'bubble' && <CircleDot className="w-4 h-4" />}
                            {visualTypes[q.id] === 'word' && <Cloud className="w-4 h-4" />}
                            {visualTypes[q.id] === 'grid' && <LayoutGrid className="w-4 h-4" />}
                          </div>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none transition-transform group-hover:translate-y-[-2px]">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 lg:p-6 min-w-0 transition-all duration-700 overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
            
            {/* Chart Section */}
            <div className="flex-[3] bg-white p-6 lg:p-10 rounded-[3rem] shadow-2xl border border-slate-200/50 flex flex-col min-h-0 relative group">
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div className="space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.h2 
                      key={currentQuestion?.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-2xl lg:text-4xl font-black text-slate-800 tracking-tighter line-clamp-2"
                    >
                      {currentQuestion ? (pollData?.title || "Loading Poll...") : "Welcome to PollParty"}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">Slide {currentIdx + 1}/{activeQuestions.length}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="text-[#004c9b] flex items-center gap-1 group-hover:bg-[#004c9b]/5 px-2 py-0.5 rounded-lg transition-colors whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#004c9b] animate-pulse" />
                      {totalResponses} Live
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-3xl shadow-inner shrink-0">
                  <button 
                    onClick={handlePrev}
                    className="p-3 bg-white hover:bg-[#004c9b] hover:text-white rounded-xl shadow-sm transition-all active:scale-95 text-slate-400"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowResponses(!showResponses)}
                    title={showResponses ? "Hide Responses" : "Show Responses"}
                    className={cn("p-3 rounded-xl shadow-sm transition-all active:scale-95 border", 
                      showResponses ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-100" : "bg-[#004c9b] text-white border-[#004c9b] hover:bg-[#003d7c]")}
                  >
                    {showResponses ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={handleNext}
                    className="px-6 py-3 bg-[#004c9b] hover:bg-[#003d7c] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2 group"
                  >
                    Next Question
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative min-h-0 bg-slate-50/30 rounded-3xl overflow-hidden">
                <AnimatePresence mode="wait">
                  {!pollData || totalResponses === 0 ? (
                    <motion.div 
                      key="no-data"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-md z-20 rounded-[2rem]"
                    >
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                          <BarChart3 className="w-10 h-10 text-slate-300" />
                          <div className="absolute inset-0 border-4 border-slate-100 border-t-[#004c9b] rounded-full animate-spin" />
                        </div>
                        <p className="font-black text-slate-400 uppercase text-xs tracking-[0.3em]">Awaiting First Participant</p>
                      </div>
                    </motion.div>
                  ) : !showResponses ? (
                    <motion.div 
                      key="responses-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white z-20 rounded-[2rem] overflow-hidden"
                    >
                      <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#004c9b] to-[#ffdc00]/20" />
                      </div>
                      <div className="text-center space-y-6 relative z-10 px-8">
                        <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-8 ring-1 ring-white/20">
                          <EyeOff className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-3xl font-black tracking-tight">Responses are hidden</h3>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Click revealed to show results</p>
                        <button 
                          onClick={() => setShowResponses(true)}
                          className="px-8 py-4 bg-[#ffdc00] text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:bg-white"
                        >
                          Reveal Responses
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key={`${currentQuestion?.id}-${visualTypes[currentQuestion?.id || 0]}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      transition={{ duration: 0.5 }}
                      className="w-full h-full p-6"
                    >
                      {visualTypes[currentQuestion?.id || 0] === 'bar' && (
                        <Bar options={chartOptions} data={chartData} />
                      )}
                      {visualTypes[currentQuestion?.id || 0] === 'pie' && (
                        <Pie options={chartOptions} data={chartData} />
                      )}
                      {visualTypes[currentQuestion?.id || 0] === 'radar' && (
                        <Radar options={chartOptions} data={chartData} />
                      )}
                      {visualTypes[currentQuestion?.id || 0] === 'bubble' && (
                        <BubbleCloud data={tallyMap} />
                      )}
                      {visualTypes[currentQuestion?.id || 0] === 'word' && (
                        <WordCloud data={tallyMap} />
                      )}
                      {visualTypes[currentQuestion?.id || 0] === 'grid' && (
                        <ResponseGrid responses={flatResponses} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex-1 bg-white p-6 lg:p-8 rounded-[3rem] border border-slate-200/50 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden group shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#ffdc00]" />
              
              <div className="mb-6 relative w-full flex justify-center">
                <div className="absolute -inset-6 bg-[#ffdc00]/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-[2s]" />
                <div className="relative p-4 bg-white border-[4px] border-[#ffdc00] rounded-[2.5rem] shadow-[0_15px_40px_rgba(255,220,0,0.2)] transition-transform duration-500 group-hover:rotate-1 max-w-[85%]">
                  {currentQuestion && (
                    <QRCodeSVG 
                      value={currentQuestion.form} 
                      size={180}
                      className="p-1 w-full h-auto max-h-[180px] max-w-[180px]"
                      fgColor="#004c9b"
                      level="H"
                      includeMargin
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Scan to Participate</h3>
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={currentQuestion?.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight"
                  >
                    Question {currentQuestion?.id}
                  </motion.p>
                </AnimatePresence>
                <div className="flex items-center gap-1.5 justify-center py-1.5 px-3 bg-slate-50 rounded-xl border border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Verified</span>
                </div>
              </div>

              {isFullscreen && (
                <div className="mt-8 flex flex-col items-center gap-6">
                  <button 
                    onClick={() => setShowResponses(!showResponses)}
                    className={cn("px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3", 
                      showResponses ? "bg-slate-900 text-white hover:bg-black" : "bg-[#ffdc00] text-black hover:bg-white")}
                  >
                    {showResponses ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showResponses ? "Hide Responses" : "Show Responses"}
                  </button>
                  
                  <button 
                    onClick={() => setIsFullscreen(false)}
                    className="group flex items-center gap-3 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <div className="p-3 bg-slate-50 group-hover:bg-red-50 rounded-full transition-colors">
                      <Square className="w-4 h-4 fill-current" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Stop Presentation</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
