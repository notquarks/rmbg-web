import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingIndicatorProps {
  isLoading: boolean;
}

export function ProcessingIndicator({ isLoading }: ProcessingIndicatorProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center mt-4"
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      <span>Processing image...</span>
    </motion.div>
  );
}
