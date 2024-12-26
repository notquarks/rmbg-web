import { motion } from "framer-motion";

interface ImageDisplayProps {
  imageUrl: string;
  title: string;
}

export function ImageDisplay({ imageUrl, title }: ImageDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg overflow-hidden shadow-lg"
    >
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <img src={imageUrl} alt={title} className="w-full h-auto" />
    </motion.div>
  );
}
