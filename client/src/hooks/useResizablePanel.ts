import { useState, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";

interface UseResizablePanelOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

interface UseResizablePanelResult {
  containerRef: React.RefObject<HTMLDivElement>;
  leftPanelWidth: number;
  isResizing: boolean;
  handleMouseDown: (e: ReactMouseEvent) => void;
}

export function useResizablePanel({
  initialWidth = 60,
  minWidth = 30,
  maxWidth = 70,
}: UseResizablePanelOptions = {}): UseResizablePanelResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return {
    containerRef,
    leftPanelWidth,
    isResizing,
    handleMouseDown,
  };
}
