#!/bin/bash

# List of all available shadcn/ui components
components=(
    "accordion"
    "alert"
    "alert-dialog"
    "avatar"
    "badge"
    "button"
    "calendar"
    "card"
    "carousel"
    "checkbox"
    "collapsible"
    "command"
    "context-menu"
    "dialog"
    "dropdown-menu"
    "form"
    "hover-card"
    "input"
    "label"
    "menubar"
    "navigation-menu"
    "popover"
    "progress"
    "radio-group"
    "scroll-area"
    "select"
    "separator"
    "sheet"
    "skeleton"
    "slider"
    "switch"
    "table"
    "tabs"
    "textarea"
    "toast"
    "toggle"
    "toggle-group"
    "tooltip"
    "tree-view"
)

echo "Adding all shadcn/ui components..."
echo "=================================="

for component in "${components[@]}"; do
    echo "Adding $component..."
    pnpm dlx shadcn@latest add "$component" --yes
    
    # Check if the command was successful
    if [ $? -eq 0 ]; then
        echo "✅ Successfully added $component"
    else
        echo "❌ Failed to add $component"
    fi
    
    # Small delay to avoid overwhelming the registry
    sleep 1
done

echo "=================================="
echo "Component installation complete!" 