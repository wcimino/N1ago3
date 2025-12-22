import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, altText, onClose }: ImageLightboxProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (imageUrl) {
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, [imageUrl]);

  if (!imageUrl) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <button
        className={`absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        onClick={handleClose}
      >
        <X className="w-6 h-6" />
      </button>
      
      <img
        src={imageUrl}
        alt={altText || "Imagem expandida"}
        className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl transition-all duration-200 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
