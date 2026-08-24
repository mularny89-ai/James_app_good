"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Draw-to-sign pad. Publishes the signature to (input id="sign-pad-input") so
 * the enclosing form's server action receives base64 PNG in `signature`.
 */
export default function SignPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    if (value) {
      const c = canvasRef.current;
      const img = new Image();
      img.onload = () => {
        if (c) {
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        }
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    c.setPointerCapture(e.pointerId);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setEmpty(false);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    const p = pos(e);
    canvasRef.current!.getContext("2d")!.lineTo(p.x, p.y);
    canvasRef.current!.getContext("2d")!.stroke();
  };
  const end = () => {
    const c = canvasRef.current;
    if (!c) return;
    onChange(c.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange("");
    setEmpty(true);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        className="input w-full touch-none bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
      />
      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={clear} className="btn px-3 py-1 text-xs">
          Clear
        </button>
        {empty && !value && <span className="text-xs text-ink-muted">Sign above with mouse or touch</span>}
        {value && <span className="text-xs text-green-700">Signature captured</span>}
      </div>
    </div>
  );
}
