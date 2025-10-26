"use client"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-9",   // Más pequeño para botones
  md: "h-12 w-14", // Tamaño medio
  lg: "h-16 w-18"  // Más grande para pantallas completas
}

export function LoadingSpinner({ size = "md", text, className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className={cn("triangles", size)}>
        <div className="tri invert"></div>
        <div className="tri invert"></div>
        <div className="tri"></div>
        <div className="tri invert"></div>
        <div className="tri invert"></div>
        <div className="tri"></div>
        <div className="tri invert"></div>
        <div className="tri"></div>
        <div className="tri invert"></div>
      </div>
      {text && <span className="text-muted-foreground mt-4 text-center">{text}</span>}
      
      <style jsx>{`
        .triangles {
          transform: translate(-50%, -50%);
          height: 81px;
          width: 90px;
          position: absolute;
          left: 50%;
          top: 50%;
        }

        .tri {
          position: absolute;
          animation: pulse_51 750ms ease-in infinite;
          border-top: 27px solid #367DE6;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-bottom: 0px;
        }

        .tri.invert {
          border-top: 0px;
          border-bottom: 27px solid #215A6D;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
        }

        .tri:nth-child(1) {
          left: 30px;
        }

        .tri:nth-child(2) {
          left: 15px;
          top: 27px;
          animation-delay: -125ms;
        }

        .tri:nth-child(3) {
          left: 30px;
          top: 27px;
        }

        .tri:nth-child(4) {
          left: 45px;
          top: 27px;
          animation-delay: -625ms;
        }

        .tri:nth-child(5) {
          top: 54px;
          animation-delay: -250ms;
        }

        .tri:nth-child(6) {
          top: 54px;
          left: 15px;
          animation-delay: -250ms;
        }

        .tri:nth-child(7) {
          top: 54px;
          left: 30px;
          animation-delay: -375ms;
        }

        .tri:nth-child(8) {
          top: 54px;
          left: 45px;
          animation-delay: -500ms;
        }

        .tri:nth-child(9) {
          top: 54px;
          left: 60px;
          animation-delay: -500ms;
        }

        @keyframes pulse_51 {
          0% {
            opacity: 1;
          }

          16.666% {
            opacity: 1;
          }

          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
