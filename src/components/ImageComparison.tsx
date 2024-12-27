import React, { useState, useRef, useEffect } from "react";

interface ImageComparisonProps {
  originalImageUrl: string;
  processedImageUrl: string | null;
}

export function ImageComparison({
  originalImageUrl,
  processedImageUrl,
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calculatedMaxWidth, setCalculatedMaxWidth] = useState<string>("75%");

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(event.target.value));
  };

  useEffect(() => {
    const loadImageAspectRatio = () => {
      const img = new Image();
      img.src = originalImageUrl;
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspectRatio(img.naturalWidth / img.naturalHeight);
        }
        setIsLoading(false);
      };
    };

    loadImageAspectRatio();
  }, [originalImageUrl]);

  useEffect(() => {
    if (aspectRatio !== null) {
      if (aspectRatio > 1) {
        setCalculatedMaxWidth("75%");
      } else {
        setCalculatedMaxWidth("30%");
      }
    }
  }, [aspectRatio]);

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: aspectRatio ? aspectRatio : undefined,
        maxWidth: calculatedMaxWidth,
        minHeight: isLoading ? "100px" : undefined,
      }}
      ref={containerRef}
    >
      <div
        className="absolute top-0 left-0 w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #808080 25%, transparent 25%),
            linear-gradient(-45deg, #808080 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #808080 75%),
            linear-gradient(-45deg, transparent 75%, #808080 75%)
          `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          backgroundColor: "#fff",
        }}
      />

      <img
        src={originalImageUrl}
        alt="Original"
        className="absolute top-0 left-0 w-full h-full object-contain"
        style={{ aspectRatio: "auto" }}
      />

      {processedImageUrl && (
        <div
          className="absolute top-0 left-0 w-full h-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #808080 25%, transparent 25%),
                linear-gradient(-45deg, #808080 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #808080 75%),
                linear-gradient(-45deg, transparent 75%, #808080 75%)
              `,
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              backgroundColor: "#fff",
            }}
          />
          <img
            src={processedImageUrl}
            alt="Processed"
            className="absolute top-0 left-0 w-full h-full object-contain"
            style={{ aspectRatio: "auto" }}
          />
        </div>
      )}

      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={handleSliderChange}
        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-col-resize"
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}
