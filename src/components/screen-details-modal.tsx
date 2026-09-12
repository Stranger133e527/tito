"use client"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Monitor, Smartphone, X, Maximize2, Info, Copy } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Screen {
  id: string
  order: number
  pageUrl: string | null
  hotspotX: number | null
  hotspotY: number | null
  metadata: {
    width: number
    height: number
  }
  pageType: string | null
  screenId: string
  screenUrl: string
  hotspotType: string | null
  hotspotWidth: number | null
  pagePatterns: string[]
  hotspotHeight: number | null
  screenElements: string[]
  screenPatterns: string[]
  videoTimestamp: string | null
}

interface FlowTreeNode {
  id: string
  name: string
  screens: Screen[]
  children: FlowTreeNode[]
  isExpanded?: boolean
  isSelected?: boolean
}

interface ScreenDetailsModalProps {
  group: FlowTreeNode | null
  onClose: () => void
}

// Determine platform type based on screen metadata
const getPlatformType = (metadata: { width: number; height: number }) => {
  const { width, height } = metadata
  const aspectRatio = width / height

  // Web typically has landscape orientation (aspect ratio > 1)
  if (aspectRatio > 1.2) {
    return "web"
  }

  // Mobile devices typically have portrait orientation (aspect ratio < 1)
  // iOS and Android have similar aspect ratios, but we can differentiate by common resolutions
  if (width === 1080 && height === 2340) {
    return "android" // Common Android resolution
  } else if (width === 1170 && height === 2532) {
    return "ios" // iPhone 13/14 resolution
  } else if (width === 1125 && height === 2436) {
    return "ios" // iPhone X/XS/11 Pro resolution
  } else if (width === 1242 && height === 2688) {
    return "ios" // iPhone XS Max/11 Pro Max resolution
  } else if (width === 828 && height === 1792) {
    return "ios" // iPhone XR/11 resolution
  } else if (width === 750 && height === 1334) {
    return "ios" // iPhone 6/7/8 resolution
  } else if (width === 640 && height === 1136) {
    return "ios" // iPhone 5/SE resolution
  }

  // Default to mobile if we can't determine
  return "mobile"
}

// Get platform icon
const getPlatformIcon = (platformType: string) => {
  switch (platformType) {
    case "web":
      return <Monitor className="w-4 h-4" />
    case "ios":
    case "android":
    case "mobile":
      return <Smartphone className="w-4 h-4" />
    default:
      return <Smartphone className="w-4 h-4" />
  }
}

export default function ScreenDetailsModal({ group, onClose }: ScreenDetailsModalProps) {
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)
  const [isCopying, setIsCopying] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  if (!group || group.screens.length === 0) return null

  const currentScreen = group.screens[currentScreenIndex]
  const platformType = getPlatformType(currentScreen.metadata)
  const platformIcon = getPlatformIcon(platformType)

  const nextScreen = () => {
    setCurrentScreenIndex((prev: number) => (prev + 1) % group.screens.length)
    setImageLoading(true) // Reset loading state when changing screens
  }

  const prevScreen = () => {
    setCurrentScreenIndex((prev: number) => (prev - 1 + group.screens.length) % group.screens.length)
    setImageLoading(true) // Reset loading state when changing screens
  }

  const handleImageLoad = () => {
    setImageLoading(false)
  }

  const handleImageError = () => {
    setImageLoading(false)
  }

  const copyImage = async () => {
    setIsCopying(true)
    try {
      // Check if we have a valid image URL
      if (!currentScreen.screenUrl) {
        toast.error("No image URL available")
        return
      }

      // Strategy 1: Direct fetch and clipboard write (most reliable)
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const response = await fetch(currentScreen.screenUrl, {
            mode: 'cors',
            credentials: 'omit'
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`)
          }

          const blob = await response.blob()
          
          // Create clipboard item
          const clipboardItem = new ClipboardItem({
            [blob.type]: blob
          })
          
          await navigator.clipboard.write([clipboardItem])
          toast.success("Image copied to clipboard!")
          return
        }
      } catch (directError) {
        console.log("Direct copy failed, trying fallback:", directError)
      }

      // Strategy 2: Canvas-based approach (handles CORS better in some cases)
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = currentScreen.screenUrl
        })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          throw new Error("Canvas context not available")
        }
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Failed to create blob"))
          }, 'image/png')
        })
        
        const clipboardItem = new ClipboardItem({
          [blob.type]: blob
        })
        
        await navigator.clipboard.write([clipboardItem])
        toast.success("Image copied to clipboard!")
        return
        
      } catch (canvasError) {
        console.log("Canvas copy failed, trying URL fallback:", canvasError)
      }

      // Strategy 3: Copy image URL as text (fallback)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(currentScreen.screenUrl)
          toast.success("Image URL copied to clipboard instead")
          return
        }
      } catch (urlError) {
        console.log("URL copy failed:", urlError)
      }

      // Strategy 4: Legacy execCommand fallback (for older browsers)
      try {
        const textArea = document.createElement('textarea')
        textArea.value = currentScreen.screenUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        toast.success("Image URL copied to clipboard instead")
        return
      } catch (legacyError) {
        console.log("Legacy copy failed:", legacyError)
      }

      // If all strategies fail
      toast.error("Could not copy image. Please try right-clicking and copying manually.")
      
    } catch (error) {
      console.error("All copy strategies failed:", error)
      toast.error("Failed to copy image. Please try again.")
    } finally {
      setIsCopying(false)
    }
  }

  const downloadImage = async () => {
    try {
      if (!currentScreen.screenUrl) {
        toast.error("No image URL available")
        return
      }

      const response = await fetch(currentScreen.screenUrl, {
        mode: 'cors',
        credentials: 'omit'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `screen-${currentScreen.order + 1}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success("Image downloaded successfully!")
    } catch (error) {
      console.error("Failed to download image:", error)
      toast.error("Failed to download image. Please try again.")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in-0 duration-300">
      <Card className="w-full max-w-7xl max-h-[95vh] bg-black border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-300">
        <CardHeader className="border-b border-zinc-800 bg-zinc-950/50">
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-zinc-400" />
                <span className="text-lg font-semibold">{group.name}</span>
              </div>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border-zinc-700">
                {group.screens.length} screens
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>

        <div className="flex h-[calc(95vh-80px)]">
          {/* Left side - Large image with navigation */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-zinc-950 relative">
            {/* Copy button above image */}
            <div className="mb-4 flex justify-end w-full max-w-full gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadImage}
                className="bg-black/80 hover:bg-black text-white border border-zinc-600 rounded-lg px-4 py-2 backdrop-blur-sm transition-all hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium">Download</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyImage}
                className="bg-black/80 hover:bg-black text-white border border-zinc-600 rounded-lg px-4 py-2 backdrop-blur-sm transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                disabled={isCopying}
              >
                {isCopying ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm font-medium">Copy Image</span>
                  </>
                )}
              </Button>
            </div>
            
            <div className="relative max-w-full max-h-full">
              <div className="relative">
                {imageLoading && (
                  <div className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
                    <Skeleton className="w-full h-[70vh] bg-zinc-800" />
                  </div>
                )}
                <img
                  src={currentScreen.screenUrl || "/placeholder.svg"}
                  alt={`Screen ${currentScreen.order + 1}`}
                  className={cn(
                    "max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-zinc-800 transition-opacity duration-300",
                    imageLoading ? "opacity-0 absolute inset-0" : "opacity-100"
                  )}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />

                {/* Hotspot overlay */}
                {currentScreen.hotspotType && currentScreen.hotspotX && currentScreen.hotspotY && !imageLoading && (
                  <div
                    className="absolute border-2 border-red-500 bg-red-500/20 rounded-lg animate-pulse"
                    style={{
                      left: `${currentScreen.hotspotX * 100}%`,
                      top: `${currentScreen.hotspotY * 100}%`,
                      width: `${(currentScreen.hotspotWidth || 0) * 100}%`,
                      height: `${(currentScreen.hotspotHeight || 0) * 100}%`,
                    }}
                  >
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                  </div>
                )}
              </div>
            </div>

            {/* Navigation buttons */}
            {group.screens.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevScreen}
                  className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white border border-zinc-700 rounded-full w-12 h-12 p-0 backdrop-blur-sm transition-all hover:scale-105"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nextScreen}
                  className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white border border-zinc-700 rounded-full w-12 h-12 p-0 backdrop-blur-sm transition-all hover:scale-105"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Screen counter */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium border border-zinc-700">
              {currentScreenIndex + 1} of {group.screens.length}
            </div>
          </div>

          {/* Right side - Details and thumbnail navigation */}
          <div className="w-96 border-l border-zinc-800 bg-zinc-950">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Current screen info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-white text-lg">Screen {currentScreen.order + 1}</h3>
                  <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                    <div className="p-2 bg-zinc-800 rounded-md">{platformIcon}</div>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{platformType}</p>
                      <p className="text-xs text-zinc-400">Platform</p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Screen details */}
                <div className="space-y-4">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" />
                    Details
                  </h4>

                  <div className="grid gap-3">
                    <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">Dimensions</span>
                      <p className="text-sm text-white font-mono mt-1">
                        {currentScreen.metadata.width} × {currentScreen.metadata.height}
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">Hotspot Type</span>
                      <p className="text-sm text-white mt-1">{currentScreen.hotspotType || "None"}</p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Screen patterns */}
                {currentScreen.screenPatterns.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-white">Screen Patterns</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentScreen.screenPatterns.map((pattern) => (
                        <Badge
                          key={pattern}
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                        >
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screen elements */}
                {currentScreen.screenElements.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-white">Screen Elements</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentScreen.screenElements.map((element) => (
                        <Badge
                          key={element}
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          {element}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-zinc-800" />

                {/* Thumbnail navigation */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white">All Screens</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {group.screens.map((screen, index) => (
                      <div
                        key={screen.id}
                        className={cn(
                          "relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                          index === currentScreenIndex
                            ? "border-blue-500 ring-2 ring-blue-500/20"
                            : "border-zinc-700 hover:border-zinc-600",
                        )}
                        onClick={() => setCurrentScreenIndex(index)}
                      >
                        <img
                          src={screen.screenUrl || "/placeholder.svg"}
                          alt={`Screen ${screen.order + 1}`}
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-1 left-1 bg-black/80 text-white px-2 py-1 rounded text-xs font-medium">
                          {screen.order + 1}
                        </div>
                        {index === currentScreenIndex && (
                          <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  )
}
