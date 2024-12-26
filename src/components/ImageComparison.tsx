import { useState, useEffect, useRef } from "react";

interface ImageComparisonProps {
  originalImageUrl: string;
  processedImageUrl: string | null;
  maxWidth?: string; // Optional prop to control the maximum width
}

export function ImageComparison({
  originalImageUrl,
  processedImageUrl,
  maxWidth = "30%", // Default max width to 100% of its parent
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  useEffect(() => {
    const loadImageAspectRatio = async () => {
      setIsLoading(true);
      const img = new Image();
      img.src = originalImageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
      setIsLoading(false);
    };

    loadImageAspectRatio();
  }, [originalImageUrl]);

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: aspectRatio ? aspectRatio : undefined,
        maxWidth: maxWidth, // Apply the max width
        // Optionally add a minimum height while loading to prevent collapse
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
