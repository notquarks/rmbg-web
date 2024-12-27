import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingIndicatorProps {
  isLoading: boolean;
}

export function ProcessingIndicator({ isLoading }: ProcessingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: isLoading ? 1 : 0, y: isLoading ? 0 : -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center mt-4"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="h-8 w-8 text-primary" />
      </motion.div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-2 text-sm text-muted-foreground"
      >
        Processing image...
      </motion.span>
    </motion.div>
  );
}
