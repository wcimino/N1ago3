import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, altText, onClose }: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.1 }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </motion.button>
        
        <motion.img
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25 
          }}
          src={imageUrl}
          alt={altText || "Imagem expandida"}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </motion.div>
    </AnimatePresence>
  );
}
