import { useCallback } from "react";
import { DropzoneRootProps, useDropzone } from "react-dropzone";
import { motion, HTMLMotionProps } from "framer-motion";
import { Upload } from "lucide-react";

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
}

export function ImageUpload({ onImageUpload }: ImageUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onImageUpload(acceptedFiles[0]);
      }
    },
    [onImageUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  return (
    <motion.div
      {...(getRootProps() as DropzoneRootProps & HTMLMotionProps<"div">)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="border-2 border-dashed border-primary rounded-lg p-8 text-center cursor-pointer"
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
      {isDragActive ? (
        <p className="mt-4 text-lg">Drop the image here...</p>
      ) : (
        <p className="mt-4 text-lg">
          Drag & drop an image here, or click to select one
        </p>
      )}
    </motion.div>
  );
}
