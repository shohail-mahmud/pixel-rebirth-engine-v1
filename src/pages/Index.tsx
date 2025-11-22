import { useState, useRef, useEffect } from "react";
import { Upload, RotateCcw, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Configuration - Optimized for Vercel
const CONFIG = {
  particleSize: 4,
  scanSpeed: 8,
  settleSpeed: 0.15,
  driftAmount: 3,
  // Optimized image URL with aggressive compression for Vercel bandwidth limits
  targetImage: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=60&w=800&auto=format&fit=crop&fm=webp',
};

type Particle = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  r: number;
  g: number;
  b: number;
  diag: number;
  dx: number;
  dy: number;
};

type StatusType = 'loading' | 'processing' | 'animating' | 'done';

const Index = () => {
  const [stage, setStage] = useState<'upload' | 'engine'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; text: string }>({
    type: 'loading',
    text: 'Initializing...',
  });
  const [showAbout, setShowAbout] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const stateRef = useRef<{
    particles: Particle[];
    width: number;
    height: number;
    scanProgress: number;
    maxScan: number;
    isAnimating: boolean;
  }>({
    particles: [],
    width: 896,
    height: 504,
    scanProgress: 0,
    maxScan: 0,
    isAnimating: false,
  });

  // Initialize Web Worker
  useEffect(() => {
    const workerScript = `
      self.onmessage = function(e) {
        const { type, sourceImageData, targetImageData, width, height, particleSize } = e.data;
        
        if (type === 'PROCESS_IMAGE') {
          const sourceParticles = [];
          const targetParticles = [];
          
          const cols = Math.ceil(width / particleSize);
          const rows = Math.ceil(height / particleSize);
          
          const getLum = (r, g, b) => 0.299*r + 0.587*g + 0.114*b;

          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const px = x * particleSize;
              const py = y * particleSize;
              const i = (py * width + px) * 4;
              
              if (sourceImageData.data[i+3] < 10) continue;

              const sr = sourceImageData.data[i];
              const sg = sourceImageData.data[i+1];
              const sb = sourceImageData.data[i+2];
              sourceParticles.push({
                x: px, y: py,
                r: sr, g: sg, b: sb,
                lum: getLum(sr, sg, sb)
              });

              const tr = targetImageData.data[i];
              const tg = targetImageData.data[i+1];
              const tb = targetImageData.data[i+2];
              targetParticles.push({
                x: px, y: py,
                r: tr, g: tg, b: tb,
                lum: getLum(tr, tg, tb)
              });
            }
          }

          sourceParticles.sort((a, b) => a.lum - b.lum);
          targetParticles.sort((a, b) => a.lum - b.lum);

          const finalParticles = [];
          const limit = Math.min(sourceParticles.length, targetParticles.length);

          for(let i = 0; i < limit; i++) {
            const s = sourceParticles[i];
            const t = targetParticles[i];

            finalParticles.push({
              sx: s.x, sy: s.y,
              tx: t.x, ty: t.y,
              r: s.r, g: s.g, b: s.b,
              diag: t.x + t.y,
              dx: (Math.random() - 0.5) * 15, 
              dy: (Math.random() - 0.5) * 15
            });
          }
          
          finalParticles.sort((a, b) => a.diag - b.diag);
          self.postMessage({ type: 'COMPLETE', particles: finalParticles });
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      if (e.data.type === 'COMPLETE') {
        stateRef.current.particles = e.data.particles;
        startAnimation();
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file');
      return;
    }

    setStage('engine');
    setStatus({ type: 'loading', text: 'Deconstructing input...' });

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setupEngine(img);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const setupEngine = (sourceImg: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false // Performance optimization for Vercel
    });
    if (!ctx) return;

    const state = stateRef.current;
    canvas.width = state.width;
    canvas.height = state.height;

    // Draw source image (contained)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, state.width, state.height);

    const sRatio = sourceImg.width / sourceImg.height;
    const cRatio = state.width / state.height;
    let dw, dh, dx, dy;

    if (sRatio > cRatio) {
      dw = state.width;
      dh = state.width / sRatio;
      dx = 0;
      dy = (state.height - dh) / 2;
    } else {
      dh = state.height;
      dw = state.height * sRatio;
      dy = 0;
      dx = (state.width - dw) / 2;
    }

    ctx.drawImage(sourceImg, dx, dy, dw, dh);
    const sourceData = ctx.getImageData(0, 0, state.width, state.height);

    setStatus({ type: 'processing', text: 'Reassembling pixels...' });

    // Load and process target image
    const targetImg = new Image();
    targetImg.crossOrigin = 'anonymous';
    targetImg.onload = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, state.width, state.height);

      const tRatio = targetImg.width / targetImg.height;
      if (tRatio > cRatio) {
        dw = state.width;
        dh = state.width / tRatio;
        dx = 0;
        dy = (state.height - dh) / 2;
      } else {
        dh = state.height;
        dw = state.height * tRatio;
        dy = 0;
        dx = (state.width - dw) / 2;
      }

      ctx.drawImage(targetImg, dx, dy, dw, dh);
      const targetData = ctx.getImageData(0, 0, state.width, state.height);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, state.width, state.height);

      state.maxScan = state.width + state.height;

      workerRef.current?.postMessage({
        type: 'PROCESS_IMAGE',
        sourceImageData: sourceData,
        targetImageData: targetData,
        width: state.width,
        height: state.height,
        particleSize: CONFIG.particleSize,
      });
    };
    targetImg.src = CONFIG.targetImage;
  };

  const startAnimation = () => {
    const state = stateRef.current;
    state.isAnimating = true;
    state.scanProgress = 0;
    setStatus({ type: 'animating', text: 'Rebirth Sequence Active' });
    loop();
  };

  const loop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const state = stateRef.current;
    if (!state.isAnimating) return;

    // Clear with better performance
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, state.width, state.height);

    state.scanProgress += CONFIG.scanSpeed * 1.5;
    const scanPos = state.scanProgress;

    const size = CONFIG.particleSize;

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const dist = scanPos - p.diag;

      if (dist < 0) {
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fillRect(p.sx, p.sy, size, size);
      } else if (dist >= 0 && dist < 300) {
        let progress = dist / 200;
        if (progress > 1) progress = 1;

        const ease = 1 - Math.pow(1 - progress, 3);
        const currX = p.sx + (p.tx - p.sx) * ease;
        const currY = p.sy + (p.ty - p.sy) * ease;

        const chaos = Math.sin(progress * Math.PI) * 20;
        const dx = p.dx * (1 - ease);
        const dy = p.dy * (1 - ease);

        const drawX = currX + dx + (Math.random() - 0.5) * chaos * 0.2;
        const drawY = currY + dy + (Math.random() - 0.5) * chaos * 0.2;

        if (dist < 30) {
          ctx.fillStyle = `rgba(255,255,255,0.8)`;
          ctx.fillRect(drawX, drawY, size + 2, size + 2);
        }

        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fillRect(drawX, drawY, size, size);
      } else {
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fillRect(p.tx, p.ty, size, size);
      }
    }

    if (state.scanProgress > state.maxScan + 400) {
      finishAnimation();
    } else {
      animationIdRef.current = requestAnimationFrame(loop);
    }
  };

  const finishAnimation = () => {
    stateRef.current.isAnimating = false;
    setStatus({ type: 'done', text: 'Rebirth Complete' });
    setShowControls(true);
    toast.success('Transformation complete!');
  };

  const handleReplay = () => {
    setShowControls(false);
    stateRef.current.scanProgress = 0;
    setTimeout(() => startAnimation(), 100);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = 'pixel-rebirth-cat.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Image downloaded!');
    } catch (e) {
      toast.error('Unable to download: Canvas has been tainted by cross-origin data');
      console.error(e);
    }
  };

  const handleReset = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    stateRef.current.isAnimating = false;
    stateRef.current.particles = [];
    setStage('upload');
    setShowControls(false);
  };

  const getStatusColor = () => {
    switch (status.type) {
      case 'loading':
        return 'hsl(217 91% 60%)';
      case 'processing':
        return 'hsl(271 76% 53%)';
      case 'animating':
        return 'hsl(142 76% 36%)';
      case 'done':
        return 'hsl(0 0% 100%)';
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-grid pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-10 w-full px-4 py-3 md:px-6 md:py-4 flex justify-between items-center opacity-0 animate-fade-in flex-none" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-white rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 md:w-4 md:h-4 bg-black rounded-sm" />
          </div>
          <h1 className="text-sm md:text-xl font-bold tracking-tight text-white/75">
            PIXEL REBIRTH <span className="text-white/75 font-normal">ENGINE</span>
          </h1>
        </div>
        <div className="text-[8px] md:text-xs font-mono text-white/75 uppercase tracking-wider md:tracking-widest">
          v 2.0.0.9
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 w-full max-w-7xl mx-auto overflow-hidden">
        {/* Upload Section */}
        {stage === 'upload' && (
          <div className="w-full max-w-xl opacity-0 animate-fade-in relative z-30" style={{ animationDelay: '0.2s' }}>
            <div className="text-center mb-4 md:mb-6">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-3 tracking-tight">
                Deconstruct Reality
              </h2>
              <p className="text-white/75 text-sm md:text-base px-4">
                Upload any image to initialize the rebirth sequence.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files.length) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`glass glass-hover transition-all duration-300 rounded-xl p-6 md:p-10 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden ${
                isDragging ? 'drag-active' : 'border-muted'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div className="w-10 h-10 md:w-14 md:h-14 mb-3 md:mb-4 rounded-full bg-card flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-border">
                <Upload className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
              </div>

              <p className="text-sm md:text-base font-medium mb-1.5 group-hover:text-white transition-colors text-white/75">
                Click or drag image here
              </p>
              <p className="text-xs text-white/75 font-mono">
                JPG, PNG, WEBP supported
              </p>
            </div>
          </div>
        )}

        {/* Engine Section */}
        {stage === 'engine' && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 md:gap-4">
            {/* Status Pill */}
            <div className="flex-none flex justify-center relative z-20">
              <div className="glass px-3 md:px-4 py-1.5 rounded-full flex items-center gap-2 md:gap-3 opacity-0 animate-fade-in border border-white/10">
                <div
                  className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getStatusColor(),
                    animation: status.type !== 'done' ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider whitespace-nowrap text-white/75">
                  {status.text}
                </span>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-initial relative canvas-glow rounded-lg overflow-hidden group border border-white/10 bg-card/50 z-10 max-h-[calc(100vh-220px)]">
              <canvas
                ref={canvasRef}
                className="block rounded-lg max-h-[calc(100vh-220px)] max-w-[90vw] w-auto h-auto object-contain"
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
                  Canvas Render // 60FPS
                </span>
              </div>
            </div>

            {/* Controls */}
            <div
              className={`flex-none flex flex-col sm:flex-row flex-wrap justify-center gap-2 transition-all duration-500 z-20 px-4 w-full max-w-md sm:max-w-none ${
                showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <Button
                onClick={handleReplay}
                className="glass glass-hover w-full sm:w-auto px-3 py-2 md:px-5 md:py-2.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-wide md:tracking-widest flex items-center justify-center gap-2 bg-transparent hover:bg-white/10 border border-white/15 text-white/75 hover:text-white shadow-none"
              >
                <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Replay</span>
              </Button>
              <Button
                onClick={handleDownload}
                className="glass glass-hover w-full sm:w-auto px-3 py-2 md:px-5 md:py-2.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-wide md:tracking-widest flex items-center justify-center gap-2 bg-transparent hover:bg-white/10 border border-white/15 text-white/75 hover:text-white shadow-none"
              >
                <Download className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Download</span>
              </Button>
              <Button
                onClick={handleReset}
                className="glass glass-hover w-full sm:w-auto px-3 py-2 md:px-5 md:py-2.5 rounded-lg text-[10px] md:text-xs font-mono uppercase tracking-wide md:tracking-widest flex items-center justify-center bg-transparent hover:bg-white/10 border border-white/15 text-white/75 hover:text-white shadow-none"
              >
                <span>Try Again</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-40 w-full flex justify-center pointer-events-none opacity-0 animate-fade-in px-2 py-2 flex-none" style={{ animationDelay: '0.5s' }}>
        <div className="glass px-3 py-1 rounded-full flex items-center gap-2 md:gap-3 pointer-events-auto transition-all duration-300 hover:bg-white/10 backdrop-blur-md text-[9px] md:text-[10px] border border-white/10">
          <button
            onClick={() => setShowAbout(true)}
            className="font-mono uppercase tracking-wider md:tracking-widest hover:text-white text-white/75 transition-colors cursor-pointer"
          >
            About
          </button>
          <div className="w-[1px] h-2 md:h-3 bg-white/20" />
          <a
            href="https://instagram.com/shohailmahmud09"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono uppercase tracking-wider md:tracking-widest hover:text-white text-white/75 transition-colors flex items-center gap-1 md:gap-2 whitespace-nowrap"
          >
            <span>@shohailmahmud09</span>
          </a>
        </div>
      </footer>

      {/* About Modal */}
      {showAbout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-card border border-border p-8 rounded-2xl max-w-md w-full mx-4 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-4">Pixel Rebirth Engine</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed font-mono text-sm text-white/75">
              This engine deconstructs your uploaded image pixel-by-pixel and mathematically
              rearranges it into a target form.
              <br />
              <br />
              <span className="text-yellow-400/90">
                NOTE: This web is currently in development.
              </span>
              <br />
              <br />
              It runs purely in your browser using Web Workers for performance, ensuring your
              data never leaves your device. A study in chaos and order.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowAbout(false)}
                className="px-6 py-2 bg-white text-black rounded-lg font-mono text-sm font-bold hover:bg-neutral-200 shadow-none"
              >
                CLOSE
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
