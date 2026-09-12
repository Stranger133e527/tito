'use client';

import { useEffect, useState, use, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Play, Eye, Smartphone, MousePointer, Keyboard, ArrowLeft, ChevronDown, ChevronRight as ChevronRightIcon, Monitor, Folder, FolderOpen, File } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TreeView, TreeNode } from '@/components/ui/tree-view';
import ScreenDetailsModal from '@/components/screen-details-modal';
import FlowSkeleton from '@/components/flow-skeleton';

interface Screen {
  id: string;
  order: number;
  pageUrl: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  metadata: {
    width: number;
    height: number;
  };
  pageType: string | null;
  screenId: string;
  screenUrl: string;
  hotspotType: string | null;
  hotspotWidth: number | null;
  pagePatterns: string[];
  hotspotHeight: number | null;
  screenElements: string[];
  screenPatterns: string[];
  createdAt?: string | null;
  isAppKeyScreen?: boolean;
  ocrBoundingBoxes?: Array<{ text: string }>;
  restricted?: boolean;
  animationScreenPatterns?: string[];
  animationUiElements?: string[];
  videoTimestamp: string | null;
}

interface Flow {
  id: string;
  name: string;
  appName: string;
  platform: string;
  createdAt: string | null;
  publishedAt: string | null;
  versionIndex: number;
  versionCount: number;
  actions: string[];
  order: number;
  videoUrl: string | null;
  parentAppSectionId: string | null;
  popularityMetric?: number | null;
  restricted?: boolean;
  screens: Screen[];
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// Determine platform type based on screen metadata
const getPlatformType = (metadata: { width: number; height: number }) => {
  const { width, height } = metadata;
  const aspectRatio = width / height;
  
  // Web typically has landscape orientation (aspect ratio > 1)
  if (aspectRatio > 1.2) {
    return 'web';
  }
  
  // Mobile devices typically have portrait orientation (aspect ratio < 1)
  // iOS and Android have similar aspect ratios, but we can differentiate by common resolutions
  if (width === 1080 && height === 2340) {
    return 'android'; // Common Android resolution
  } else if (width === 1170 && height === 2532) {
    return 'ios'; // iPhone 13/14 resolution
  } else if (width === 1125 && height === 2436) {
    return 'ios'; // iPhone X/XS/11 Pro resolution
  } else if (width === 1242 && height === 2688) {
    return 'ios'; // iPhone XS Max/11 Pro Max resolution
  } else if (width === 828 && height === 1792) {
    return 'ios'; // iPhone XR/11 resolution
  } else if (width === 750 && height === 1334) {
    return 'ios'; // iPhone 6/7/8 resolution
  } else if (width === 640 && height === 1136) {
    return 'ios'; // iPhone 5/SE resolution
  }
  
  // Default to mobile if we can't determine
  return 'mobile';
};

// Get grid configuration based on platform type
const getGridConfig = (platformType: string) => {
  switch (platformType) {
    case 'web':
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"; // 3 cards max for web (landscape screenshots)
    case 'ios':
    case 'android':
    case 'mobile':
      return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"; // 4 cards max for mobile (iOS/Android)
    default:
      return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"; // Default responsive
  }
};

// Get aspect ratio class based on platform type
const getAspectRatioClass = (platformType: string) => {
  switch (platformType) {
    case 'web':
      return 'aspect-[16/10]'; // Landscape for web
    case 'ios':
    case 'android':
    case 'mobile':
      return 'aspect-[9/16]'; // Portrait for mobile
    default:
      return 'aspect-[9/16]'; // Default to mobile
  }
};

// Get platform icon
const getPlatformIcon = (platformType: string) => {
  switch (platformType) {
    case 'web':
      return <Monitor className="w-5 h-5 text-muted-foreground" />;
    case 'ios':
    case 'android':
    case 'mobile':
      return <Smartphone className="w-5 h-5 text-muted-foreground" />;
    default:
      return <Smartphone className="w-5 h-5 text-muted-foreground" />;
  }
};

const formatDate = (value: string | null) => {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
};

const GridCard = ({ children, platformType }: { children: React.ReactNode; platformType: string }) => {
  return (
    <div className={cn(
      "grid content-start gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-10",
      getGridConfig(platformType)
    )}>
      {children}
    </div>
  );
};

interface FlowTreeNode {
  id: string;
  name: string;
  screens: Screen[];
  flow: Flow;
  children: FlowTreeNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
}

// Convert FlowTreeNode to TreeNode for TreeView component
const convertToTreeNode = (flowNode: FlowTreeNode): TreeNode => {
  return {
    id: flowNode.id,
    label: `${flowNode.name} (${flowNode.screens.length})`,
    icon: flowNode.children.length > 0 ? <Folder className="w-4 h-4 text-blue-500" /> : <File className="w-4 h-4 text-green-500" />,
    data: flowNode,
    children: flowNode.children.map(convertToTreeNode)
  };
};

export default function SitePage({ params }: PageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const platform = searchParams.get('platform') || 'ios';
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<FlowTreeNode | null>(null);
  const [flowTree, setFlowTree] = useState<FlowTreeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [visibleFlowIds, setVisibleFlowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('Site ID:', id);
    console.log('Params object:', params);

    const fetchFlows = async () => {
      const response = await fetch(`/api/flow`, {
        method: 'POST',
        body: JSON.stringify({
          filterAppVersionId: id,
          platform,
          filters: {}
        })
      });
      const data = await response.json();
      setFlows(data);
      
      // Build flow tree structure
      const treeData = buildFlowTree(data);
      setFlowTree(treeData);
      
      // Convert to TreeView format
      const treeViewData = treeData.map(convertToTreeNode);
      setTreeData(treeViewData);
      
      if (data.length > 0) {
        setSelectedFlow(data[0]);
        setSelectedNodeId(data[0].id);
      }
    };

    fetchFlows();
  }, [id, platform, params]);

  const buildFlowTree = (flowsData: Flow[]): FlowTreeNode[] => {
    const tree: FlowTreeNode[] = [];

    const allScreens = flowsData.find(flow => flow.id === 'all-screens');
    if (allScreens) {
      tree.push({
        id: allScreens.id,
        name: allScreens.name,
        screens: allScreens.screens,
        flow: allScreens,
        children: [],
      });
    }

    flowsData.filter(flow => flow.id !== 'all-screens').forEach(flow => {
      const path = flow.actions.length > 0 ? flow.actions : [flow.name];
      let currentLevel = tree;

      path.forEach((name, pathIndex) => {
        const isLeaf = pathIndex === path.length - 1;
        let node = currentLevel.find(item => item.name === name && item.id !== 'all-screens');

        if (!node) {
          const nodeFlow = isLeaf
            ? flow
            : { ...flow, id: `group-${path.slice(0, pathIndex + 1).join('-')}`, name, screens: [] };
          node = {
            id: nodeFlow.id,
            name,
            screens: nodeFlow.screens,
            flow: nodeFlow,
            children: [],
          };
          currentLevel.push(node);
        } else if (isLeaf) {
          node.id = flow.id;
          node.screens = flow.screens;
          node.flow = flow;
        }

        currentLevel = node.children;
      });
    });
    
    return tree;
  };

  // TreeView handles expansion internally, so we don't need this function anymore

  const selectNode = (node: FlowTreeNode) => {
    setSelectedNodeId(node.id);
    setSelectedFlow({
      ...node.flow,
      id: node.id,
      name: node.name,
      screens: node.screens
    });
    
    // Scroll to the selected flow in the right panel
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current.querySelector(`[data-flow-id="${node.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Handle TreeView node selection
  const handleTreeNodeClick = (node: TreeNode) => {
    const flowNode = node.data as FlowTreeNode;
    if (flowNode) {
      selectNode(flowNode);
    }
  };

  // Intersection Observer to track visible flows
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const newVisibleIds = new Set<string>();
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const flowId = entry.target.getAttribute('data-flow-id');
            if (flowId) {
              newVisibleIds.add(flowId);
            }
          }
        });
        setVisibleFlowIds(newVisibleIds);
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '-20% 0px -20% 0px',
        threshold: 0.1
      }
    );

    const flowElements = scrollContainerRef.current.querySelectorAll('[data-flow-id]');
    flowElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [flowTree]);

  // Update tree selection based on visible flows
  useEffect(() => {
    if (visibleFlowIds.size > 0) {
      const firstVisibleId = Array.from(visibleFlowIds)[0];
      if (firstVisibleId && firstVisibleId !== selectedNodeId) {
        setSelectedNodeId(firstVisibleId);
      }
    }
  }, [visibleFlowIds, selectedNodeId]);

  // Get expanded IDs for TreeView (only expand the path to selected node)
  const getExpandedIds = useCallback(() => {
    const expandedIds: string[] = [];
    
    const findNodePath = (nodes: FlowTreeNode[], targetId: string, path: string[] = []): string[] | null => {
      for (const node of nodes) {
        const currentPath = [...path, node.id];
        if (node.id === targetId) {
          return currentPath;
        }
        if (node.children.length > 0) {
          const result = findNodePath(node.children, targetId, currentPath);
          if (result) return result;
        }
      }
      return null;
    };

    if (selectedNodeId) {
      const path = findNodePath(flowTree, selectedNodeId);
      if (path) {
        // Only add the path to the selected node (excluding the selected node itself)
        path.slice(0, -1).forEach(id => {
          if (!expandedIds.includes(id)) {
            expandedIds.push(id);
          }
        });
      }
    }

    return expandedIds;
  }, [flowTree, selectedNodeId]);

  const getHotspotIcon = (hotspotType: string | null) => {
    switch (hotspotType) {
      case 'Tap':
        return <MousePointer className="w-4 h-4" />;
      case 'Keyboard Input':
        return <Keyboard className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getHotspotColor = (hotspotType: string | null) => {
    switch (hotspotType) {
      case 'Tap':
        return 'bg-blue-500';
      case 'Keyboard Input':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Remove the old renderTreeNode function as we're using TreeView now

  const renderScreenCard = (screen: Screen, group: FlowTreeNode) => {
    const platformType = getPlatformType(screen.metadata);
    const aspectRatioClass = getAspectRatioClass(platformType);
    const platformIcon = getPlatformIcon(platformType);

    return (
      <div
        key={screen.id}
        className="group relative flex flex-col gap-y-3 md:gap-y-4 cursor-pointer"
        onClick={() => setSelectedGroup(group)}
      >
        <div className={cn("relative rounded-[32px] overflow-hidden w-full bg-muted flex items-center justify-center", aspectRatioClass)}>
          {screen.screenUrl ? (
            <Image
              src={screen.screenUrl}
              alt={`Screen ${screen.order + 1}`}
              width={300}
              height={533}
              className="w-full h-full object-contain rounded-[32px]"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          ) : (
            <span className="text-muted-foreground">
              {platformType === 'web' ? 'Website Screen' : 'Phone Screen'} {screen.order + 1}
            </span>
          )}
          


          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium">
            Step {screen.order + 1}
          </div>

          {/* Platform indicator */}
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium">
            {platformType.toUpperCase()}
          </div>
          {screen.isAppKeyScreen && (
            <Badge className="absolute right-2 top-2 bg-blue-600 text-white">Key screen</Badge>
          )}
        </div>

        <div className="flex items-center gap-x-3 w-full">
          <div className="shrink-0 h-10 w-10 bg-[#eaeaea] rounded-xl overflow-hidden flex items-center justify-center">
            {platformIcon}
          </div>

          <div className="flex grow flex-col">
            <span className="line-clamp-1 text-body-medium-bold">
              Screen {screen.order + 1}
            </span>
            <span className="line-clamp-1 text-sm text-muted-foreground font-normal">
              {screen.screenPatterns.length > 0 
                ? screen.screenPatterns[0] 
                : screen.hotspotType || 'View screen'
              }
            </span>
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {screen.metadata.width}×{screen.metadata.height}
              {screen.ocrBoundingBoxes?.length ? ` • ${screen.ocrBoundingBoxes.length} text regions` : ''}
              {screen.videoTimestamp ? ` • ${Number(screen.videoTimestamp) / 1000}s` : ''}
            </span>
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>

        <div className="flex flex-wrap gap-1">
          {screen.screenPatterns.slice(0, 2).map((pattern, index) => (
            <Badge key={`pattern-${pattern}-${index}`} variant="secondary" className="text-xs rounded-lg">
              {pattern}
            </Badge>
          ))}
          {screen.screenElements.slice(0, 2).map((element, index) => (
            <Badge key={`element-${element}-${index}`} variant="outline" className="text-xs rounded-lg">
              {element}
            </Badge>
          ))}
          {(screen.screenPatterns.length > 2 || screen.screenElements.length > 2) && (
            <Badge key="more-badge" variant="outline" className="text-xs rounded-lg">
              +{Math.max(0, screen.screenPatterns.length - 2) + Math.max(0, screen.screenElements.length - 2)} more
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // Handle edge cases for empty data
  if (!treeData || treeData.length === 0) {
    return (
      <div className="flex h-screen">
        {/* Left Sidebar - Flow Tree */}
        <div className="w-80 border-r bg-background flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-x-2">
              <ArrowLeft className="w-4 h-4" />
              <Link href={`/browse/${platform}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Back to Browse
              </Link>
            </div>
            <h2 className="text-lg font-semibold mt-2">Screens & Flows</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          </div>
        </div>

        {/* Right Content - Skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <FlowSkeleton count={8} platformType="mobile" />
          </div>
        </div>
      </div>
    );
  }

  const selectedNode: FlowTreeNode | null = selectedFlow ? {
    id: selectedFlow.id,
    name: selectedFlow.name,
    screens: selectedFlow.screens,
    flow: selectedFlow,
    children: [],
  } : null;
  const selectedPlatformTypes = selectedFlow?.screens.map(screen => getPlatformType(screen.metadata)) || [];
  const selectedPlatformCounts = selectedPlatformTypes.reduce((counts, item) => {
    counts[item] = (counts[item] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const selectedPlatform = Object.entries(selectedPlatformCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || platform;
  const uniqueUiElements = new Set(selectedFlow?.screens.flatMap(screen => screen.screenElements) || []).size;
  const uniquePatterns = new Set(selectedFlow?.screens.flatMap(screen => screen.screenPatterns) || []).size;

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Flow Tree */}
      <div className="w-80 border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-x-2">
            <ArrowLeft className="w-4 h-4" />
            <Link href={`/browse/${platform}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to Browse
            </Link>
          </div>
          <h2 className="text-lg font-semibold mt-2">Screens & Flows</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          <TreeView
            data={treeData}
            onNodeClick={handleTreeNodeClick}
            selectedIds={selectedNodeId ? [selectedNodeId] : []}
            onSelectionChange={(ids) => {
              if (ids.length > 0) {
                setSelectedNodeId(ids[0]);
              }
            }}
            defaultExpandedIds={getExpandedIds()}
            showLines={true}
            showIcons={true}
            selectable={true}
            multiSelect={false}
            indent={16}
            animateExpand={true}
            className="border-0 bg-transparent"
          />
        </div>
      </div>

      {/* Right Content - Infinite Scroll */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {selectedFlow?.name || 'Select a flow'}
            </h1>
            {selectedFlow && (
              <Badge variant="secondary" className="uppercase">
                {selectedFlow.platform}
              </Badge>
            )}
          </div>
          {selectedFlow && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{selectedFlow.screens.length} screens</span>
              <span aria-hidden="true">•</span>
              <span>Published {formatDate(selectedFlow.publishedAt)}</span>
              <span aria-hidden="true">•</span>
              <span>Captured {formatDate(selectedFlow.createdAt)}</span>
              <span aria-hidden="true">•</span>
              <span>Version {selectedFlow.versionIndex + 1} of {selectedFlow.versionCount}</span>
              <span aria-hidden="true">•</span>
              <span>{uniqueUiElements} UI elements</span>
              <span aria-hidden="true">•</span>
              <span>{uniquePatterns} screen patterns</span>
              {selectedFlow.popularityMetric != null && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>Popularity {selectedFlow.popularityMetric}</span>
                </>
              )}
            </div>
          )}
          {selectedFlow?.actions.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Flow path: {selectedFlow.actions.join(' › ')}
            </p>
          ) : null}
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {selectedFlow && selectedNode && (
            <div data-flow-id={selectedFlow.id} className="mb-12">
              <h3 className="mb-4 text-xl font-semibold text-foreground">
                {selectedFlow.name} ({selectedFlow.screens.length} screens)
              </h3>
              <GridCard platformType={selectedPlatform}>
                {selectedFlow.screens.map(screen => renderScreenCard(screen, selectedNode))}
              </GridCard>
            </div>
          )}
        </div>
      </div>

      {/* Screen Details Modal */}
      <ScreenDetailsModal 
        group={selectedGroup} 
        onClose={() => setSelectedGroup(null)} 
      />
    </div>
  );
}
