"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pen,
  Type,
  Eraser,
  Check,
  Undo2,
  Download,
} from "lucide-react";

interface SignaturePadProps {
  onSignatureChange?: (signatureData: string | null) => void;
  value?: string | null;
  label?: string;
  className?: string;
  showDownload?: boolean;
}

export function SignaturePad({
  onSignatureChange,
  value,
  label = "Digital Signature",
  className,
  showDownload = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!value);
  const [typedName, setTypedName] = useState("");
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Set drawing style
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Restore existing signature if provided
    if (value && signatureMode === "draw") {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, [value, signatureMode]);

  const getCoordinates = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(true);
      const coords = getCoordinates(e);
      setLastPosition(coords);
    },
    [getCoordinates]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !lastPosition) return;
      
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      ctx.beginPath();
      ctx.moveTo(lastPosition.x, lastPosition.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      setLastPosition(coords);
    },
    [isDrawing, lastPosition, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPosition(null);
      setHasSignature(true);
      
      // Get signature data
      const canvas = canvasRef.current;
      if (canvas && onSignatureChange) {
        onSignatureChange(canvas.toDataURL("image/png"));
      }
    }
  }, [isDrawing, onSignatureChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onSignatureChange?.(null);
  }, [onSignatureChange]);

  const handleTypedSignature = useCallback(() => {
    if (typedName.trim() && onSignatureChange) {
      onSignatureChange(typedName.trim());
      setHasSignature(true);
    }
  }, [typedName, onSignatureChange]);

  const downloadSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "signature.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={signatureMode}
          onValueChange={(v) => setSignatureMode(v as "draw" | "type")}
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <Pen className="h-4 w-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Type
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3">
            <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[150px] cursor-crosshair touch-none"
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground text-sm">
                    Sign here with your mouse or finger
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearCanvas}
                className="flex items-center gap-2"
              >
                <Eraser className="h-4 w-4" />
                Clear
              </Button>
              
              {showDownload && hasSignature && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSignature}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
              
              {hasSignature && (
                <div className="ml-auto flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Signed
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="typed-signature">Type your full name</Label>
              <Input
                id="typed-signature"
                placeholder="Enter your legal name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
              />
            </div>
            
            {typedName && (
              <div className="p-4 border rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-script italic text-foreground">
                  {typedName}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={handleTypedSignature}
                disabled={!typedName.trim()}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Confirm Signature
              </Button>
              
              {hasSignature && (
                <div className="ml-auto flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Signed as: {typedName}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Preview component for displaying saved signatures
interface SignaturePreviewProps {
  signatureData: string;
  mode?: "draw" | "type";
  typedName?: string;
  className?: string;
}

export function SignaturePreview({
  signatureData,
  mode = "draw",
  typedName,
  className,
}: SignaturePreviewProps) {
  if (mode === "type") {
    return (
      <div className={`p-4 border rounded-lg bg-muted/30 text-center ${className}`}>
        <p className="text-xl font-script italic">{typedName}</p>
        <p className="text-xs text-muted-foreground mt-1">Digital Signature</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-2 bg-white ${className}`}>
      <img
        src={signatureData}
        alt="Digital Signature"
        className="max-h-[80px] w-auto mx-auto"
      />
      <p className="text-xs text-muted-foreground text-center mt-1">Digital Signature</p>
    </div>
  );
}
