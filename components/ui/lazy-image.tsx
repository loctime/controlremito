'use client'
import { useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Skeleton } from './skeleton'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  fallback?: string
  placeholder?: React.ReactNode
}

export function LazyImage({ 
  src, 
  alt, 
  fallback, 
  placeholder,
  className,
  ...props 
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '50px',
  })
  
  const defaultPlaceholder = (
    <Skeleton className={`w-full h-full ${className}`} />
  )
  
  return (
    <div ref={ref} className={`relative ${className}`}>
      {!isLoaded && (placeholder || defaultPlaceholder)}
      {inView && (
        <img
          src={error && fallback ? fallback : src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  )
}
