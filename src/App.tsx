import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageUpload } from "./components/ImageUpload";
import { ImageComparison } from "./components/ImageComparison";
import { ProcessingIndicator } from "./components/ProcessingIndicator";
import { DarkModeToggle } from "./components/DarkModeToggle";
import { useToast } from "./hooks/use-toast";
import { ThemeProvider } from "./components/theme-provider";
import { Download, Undo2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function App() {
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null
  );
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState("inspyrenet");
  const [isTransparent, setIsTransparent] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const { toast } = useToast();

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      console.log("Creating worker...");
      const workerUrl = new URL("./worker.js", import.meta.url);
      workerRef.current = new Worker(workerUrl, { type: "module" });

      workerRef.current.addEventListener("message", (e) => {
        const { type, data } = e.data;
        if (type === "ready") {
          setIsLoading(false);
        } else if (type === "reset_algorithm") {
          setAlgorithm("inspyrenet");
        } else if (type === "decode_result") {
          setProcessedImageUrl(data.mask);
          setIsLoading(false);
        } else if (type === "segment_result") {
          if (data === "start") {
            toast({
              title: "Processing",
              description: "Removing background...",
            });
          } else if (data === "done") {
            toast({
              title: "Success",
              description: "Background removed successfully!",
            });
          }
        } else if (type === "error") {
          setIsLoading(false);
          toast({
            title: "Error",
            description: data,
            variant: "destructive",
          });
        }
      });

      workerRef.current.addEventListener("error", (error) => {
        console.error("Worker error:", error);
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Failed to initialize the worker. Please try again.",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error("Error creating worker:", error);
      toast({
        title: "Error",
        description:
          "Failed to start the application. Please refresh the page.",
        variant: "destructive",
      });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [toast]);

  const handleImageUpload = useCallback(
    async (image: File) => {
      setIsLoading(true);
      setProcessedImageUrl(null);

      if (!image.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Please upload a valid image file.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      try {
        const imageUrl = URL.createObjectURL(image);
        setOriginalImageUrl(imageUrl);

        if (workerRef.current) {
          workerRef.current.postMessage({ type: "segment", data: imageUrl });
        }
      } catch (error) {
        console.error("Error processing image:", error);
        toast({
          title: "Error",
          description: `Failed to process the image: ${
            (error as Error).message
          }`,
          variant: "destructive",
        });
        setIsLoading(false);
      }
    },
    [toast]
  );

  const handleReset = useCallback(() => {
    setProcessedImageUrl(null);
    setOriginalImageUrl(null);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "reset" });
    }
  }, []);

  const handleProcess = useCallback(() => {
    if (workerRef.current && originalImageUrl) {
      setIsLoading(true);
      workerRef.current.postMessage({
        type: "segment",
        data: {
          imageUrl: originalImageUrl,
          algorithm,
          isTransparent,
          backgroundColor: isTransparent ? null : backgroundColor,
        },
      });
    }
  }, [originalImageUrl, algorithm, isTransparent, backgroundColor]);

  const handleDownload = useCallback(() => {
    if (processedImageUrl && originalImageUrl) {
      const originalName =
        originalImageUrl.split("/").pop()?.split(".")[0] || "image";
      const extension = isTransparent ? "png" : "jpg";
      const suffix = isTransparent ? "-transparent" : "-bg";
      const filename = `${originalName}${suffix}.${extension}`;

      const link = document.createElement("a");
      link.href = processedImageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [processedImageUrl, originalImageUrl, isTransparent]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen w-screen bg-background text-foreground flex flex-col"
      >
        <div className="container mx-auto p-4 flex-1 flex flex-col items-center">
          <div className="flex w-full justify-between items-center mb-8">
            <motion.h1
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-3xl font-bold"
            >
              Background Removal
            </motion.h1>
            <DarkModeToggle />
          </div>
          <div className="flex-1 flex w-full items-center justify-center">
            <div className="w-full max-w-5xl place-items-center">
              <div className="w-full">
                <AnimatePresence mode="wait">
                  {!originalImageUrl && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <ImageUpload onImageUpload={handleImageUpload} />
                    </motion.div>
                  )}
                  {originalImageUrl && (
                    <motion.div
                      key="original"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="relative flex items-center justify-center">
                        <ImageComparison
                          originalImageUrl={originalImageUrl}
                          processedImageUrl={processedImageUrl}
                        />
                        {isLoading && (
                          <div className="absolute w-full h-full flex items-center justify-center backdrop-blur-lg backdrop-brightness-50 backdrop-opacity-85">
                            <ProcessingIndicator isLoading={isLoading} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col mt-4 space-y-4 justify-center items-center">
                        <div className="flex items-center space-x-4">
                          <Select
                            value={algorithm}
                            onValueChange={setAlgorithm}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select algorithm" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inspyrenet">
                                InSPyReNet (Default)
                              </SelectItem>
                              <SelectItem value="carvekit-tracer">
                                Tracer B7
                              </SelectItem>
                              <SelectItem value="carvekit-u2net">
                                U2NET
                              </SelectItem>
                              <SelectItem value="carvekit-basnet">
                                BASNET
                              </SelectItem>
                              <SelectItem value="carvekit-deeplab">
                                DeepLabV3
                              </SelectItem>
                              <SelectItem value="bria">BRIA</SelectItem>
                              <SelectItem value="rembg-u2net">
                                Rembg U2NET
                              </SelectItem>
                              <SelectItem value="rembg-u2net-human">
                                Rembg U2NET Human
                              </SelectItem>
                              <SelectItem value="rembg-isnet">
                                Rembg ISNET
                              </SelectItem>
                              <SelectItem value="rembg-isnet-anime">
                                Rembg ISNET Anime
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="transparent-mode"
                              checked={isTransparent}
                              onCheckedChange={setIsTransparent}
                            />
                            <Label htmlFor="transparent-mode">
                              Transparent
                            </Label>
                          </div>
                          {!isTransparent && (
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="background-color">
                                Background Color:
                              </Label>
                              <Input
                                id="background-color"
                                type="color"
                                value={backgroundColor}
                                onChange={(e) =>
                                  setBackgroundColor(e.target.value)
                                }
                                className="w-12 h-8 p-0 border-none"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-4">
                          <Button
                            onClick={handleProcess}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded"
                            disabled={isLoading}
                          >
                            Process Image
                          </Button>
                          <Button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded"
                          >
                            <Undo2 className="w-4 h-4" /> Reset
                          </Button>
                          {processedImageUrl && (
                            <Button
                              onClick={handleDownload}
                              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded"
                            >
                              <Download className="w-4 h-4" /> Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </ThemeProvider>
  );
}

export default App;
