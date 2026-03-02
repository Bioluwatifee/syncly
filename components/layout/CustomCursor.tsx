"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + "px";
        cursorRef.current.style.top = e.clientY + "px";
      }
    };

    const animate = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + "px";
        ringRef.current.style.top = ring.current.y + "px";
      }
      requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMove);
    animate();

    // Hover effect on interactive elements
    const interactives = document.querySelectorAll("button, a, .platform-pill, .step-card");
    const onEnter = () => {
      if (!cursorRef.current || !ringRef.current) return;
      cursorRef.current.style.transform = "translate(-50%, -50%) scale(2.5)";
      cursorRef.current.style.background = "transparent";
      cursorRef.current.style.border = "1.5px solid var(--accent)";
      ringRef.current.style.width = "20px";
      ringRef.current.style.height = "20px";
    };
    const onLeave = () => {
      if (!cursorRef.current || !ringRef.current) return;
      cursorRef.current.style.transform = "translate(-50%, -50%) scale(1)";
      cursorRef.current.style.background = "var(--accent)";
      cursorRef.current.style.border = "none";
      ringRef.current.style.width = "36px";
      ringRef.current.style.height = "36px";
    };

    interactives.forEach(el => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });

    return () => {
      document.removeEventListener("mousemove", onMove);
      interactives.forEach(el => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="cursor" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
