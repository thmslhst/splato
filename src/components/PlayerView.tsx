"use client";

/**
 * PlayerView - A preview card showing rail-driven camera animation.
 * Scroll within the card controls the camera position along the rail.
 * Supports expanded mode for larger preview.
 *
 * Note: PlayerView creates its own scene and splat instance to avoid
 * WebGL state conflicts when multiple renderers share the same SplatMesh.
 * It shares the camera rail with the editor for synchronized positioning.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { SplatMesh } from "@sparkjsdev/spark";
import { Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSceneSystem, type SceneSystem } from "@/systems/scene";
import {
  createPlayerViewport,
  type PlayerViewport,
} from "@/systems/player-viewport";
import type { CameraRailSystem } from "@/systems/camera-rail";

interface PlayerViewProps {
  splatUrl: string;
  rail: CameraRailSystem;
  className?: string;
}

export function PlayerView({ splatUrl, rail, className }: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneSystem | null>(null);
  const viewportRef = useRef<PlayerViewport | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Initialize scene and player viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create own scene (separate from editor to avoid WebGL conflicts)
    const sceneSystem = createSceneSystem();
    sceneRef.current = sceneSystem;

    const viewport = createPlayerViewport({
      container,
      scene: sceneSystem.scene,
      rail,
    });
    viewportRef.current = viewport;

    // Only start rendering if rail has control points
    if (rail.controlPoints.length > 0) {
      viewport.start();
    }

    return () => {
      viewport.dispose();
      sceneSystem.dispose();
      viewportRef.current = null;
      sceneRef.current = null;
    };
  }, [rail]);

  // Load splat when URL changes
  useEffect(() => {
    const sceneSystem = sceneRef.current;
    if (!sceneSystem) return;

    // Remove existing splat
    if (splatRef.current) {
      sceneSystem.remove(splatRef.current);
      splatRef.current.dispose();
      splatRef.current = null;
    }

    // Load new splat
    const splat = new SplatMesh({ url: splatUrl });
    splat.position.set(0, 0, 0);
    splat.quaternion.set(1, 0, 0, 0);
    splatRef.current = splat;
    sceneSystem.add(splat);

    return () => {
      if (splatRef.current && sceneRef.current) {
        sceneRef.current.remove(splatRef.current);
        splatRef.current.dispose();
        splatRef.current = null;
      }
    };
  }, [splatUrl]);

  // Handle scroll to update progress
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const viewport = viewportRef.current;
    if (!scrollContainer || !viewport) return;

    const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    if (scrollHeight <= 0) return;

    const t = scrollContainer.scrollTop / scrollHeight;
    viewport.setProgress(t);
    setProgress(t);
  }, []);

  // Start/stop viewport and update camera when rail changes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const hasPoints = rail.controlPoints.length > 0;
    if (hasPoints) {
      // Start viewport and update camera position
      viewport.start();
      viewport.setProgress(progress);
    } else {
      // Stop rendering when no rail points exist
      viewport.stop();
    }
  }, [rail.controlPoints.length, progress]);

  // Toggle expanded mode
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle escape key to collapse
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Resize viewport when container size changes
  useEffect(() => {
    const container = containerRef.current;
    const viewport = viewportRef.current;
    if (!container || !viewport) return;

    const resizeObserver = new ResizeObserver(() => {
      viewport.resize();
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const progressPercent = Math.round(progress * 100);
  const hasRailPoints = rail.controlPoints.length > 0;

  return (
    <Card
      className={`bg-background/90 backdrop-blur-sm py-3 gap-2 transition-all duration-200 ${
        isExpanded ? "w-[40vw]" : "w-96"
      } ${className}`}
    >
      <CardHeader className="pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Preview</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {progressPercent}%
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleExpanded}
            disabled={!hasRailPoints}
            title={isExpanded ? "Collapse preview (Esc)" : "Expand preview"}
          >
            {isExpanded ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Preview viewport */}
        <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
          <div ref={containerRef} className="absolute inset-0" />

          {/* Scroll overlay inside the card viewport */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Scrollable content */}
            <div style={{ height: "500%" }} />
          </div>

          {/* Empty state */}
          {!hasRailPoints && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              Add rail points to preview
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
