"use client";

import { useEffect, useRef, useCallback } from "react";
import { SignalStormEngine, type GamePalette, type GameCallbacks } from "./signal-storm-engine";

function readPalette(el: HTMLElement): GamePalette {
  const style = getComputedStyle(el);
  const get = (prop: string) => style.getPropertyValue(prop).trim();
  return {
    player: get("--success"),
    beam: get("--success"),
    enemy: get("--destructive"),
    jammer: get("--warning"),
    powerUp: get("--primary"),
    shield: get("--info"),
    spread: get("--chart-6"),
    text: get("--foreground"),
    textMuted: get("--muted-foreground"),
    background: get("--card"),
  };
}

export default function SignalStormGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SignalStormEngine | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = readPalette(wrapper);
    const callbacks: GameCallbacks = { onExit };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        if (engineRef.current) {
          engineRef.current.resize(width, height);
        } else {
          engineRef.current = new SignalStormEngine(ctx, width, height, palette, callbacks);
        }
      }
    });

    observer.observe(wrapper);

    const loop = (timestamp: number) => {
      engineRef.current?.tick(timestamp);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    wrapperRef.current?.focus();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, [onExit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    engineRef.current?.handleKeyDown(e.key);
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    engineRef.current?.handleKeyUp(e.key);
  }, []);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className="max-h-[60vh] min-h-48 outline-none focus:outline-none"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
