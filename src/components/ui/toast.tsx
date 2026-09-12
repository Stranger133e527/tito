"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={4000}
      style={{
        zIndex: 9999,
      }}
      {...props}
    />
  )
}

export { Toaster } 