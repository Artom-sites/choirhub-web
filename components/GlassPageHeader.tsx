import { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { 
  ArrowLeft, Pencil, Trash2, Download, Plus, MoreVertical, 
  Music, Users, Settings, SlidersHorizontal, Search, X, UserX,
  Share, Eye, EyeOff, Sun, Moon, Monitor
} from "lucide-react";

function renderWebIcon(iconName: string | any) {
  if (typeof iconName !== "string") return iconName;
  switch (iconName.toLowerCase()) {
    case 'pencil':
    case 'pencil.circle.fill': return <Pencil className="w-5 h-5" />;
    case 'trash': return <Trash2 className="w-5 h-5" />;
    case 'arrow.down.circle': return <Download className="w-5 h-5" />;
    case 'plus': return <Plus className="w-5 h-5" />;
    case 'ellipsis': return <MoreVertical className="w-5 h-5" />;
    case 'music.note': return <Music className="w-5 h-5" />;
    case 'person.2': return <Users className="w-5 h-5" />;
    case 'person.fill.xmark': return <UserX className="w-5 h-5" />;
    case 'gearshape': return <Settings className="w-5 h-5" />;
    case 'slider.horizontal.3': return <SlidersHorizontal className="w-5 h-5" />;
    case 'magnifyingglass': return <Search className="w-5 h-5" />;
    case 'xmark': return <X className="w-5 h-5" />;
    case 'square.and.arrow.up': return <Share className="w-5 h-5" />;
    case 'eye': return <Eye className="w-5 h-5" />;
    case 'eye.slash': return <EyeOff className="w-5 h-5" />;
    case 'sun.max': return <Sun className="w-5 h-5" />;
    case 'moon': return <Moon className="w-5 h-5" />;
    case 'desktopcomputer': return <Monitor className="w-5 h-5" />;
    default: return null;
  }
}

interface GlassAction {
  id: string;
  icon: string;
  color?: "default" | "danger";
  onClick: () => void;
}

// Hierarchical filter menu item (children → UIMenu submenu in Swift)
export interface FilterMenuItem {
  id: string;
  label: string;
  isActive: boolean;
  children?: FilterMenuItem[];
}

export interface FilterMenuGroup {
  items: FilterMenuItem[];
}

interface GlassPageHeaderProps {
  title?: string;
  subtitle?: string;
  tabs?: string[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  rightActions?: GlassAction[];
  rightSegmented?: {
    items: string[];
    active: number;
    onChange: (index: number) => void;
  };
  searchInput?: {
    placeholder?: string;
    value: string;
    autoFocus?: boolean;
    onChange: (val: string) => void;
  };
  filterMenu?: FilterMenuGroup[];
  onFilterMenuSelect?: (itemId: string) => void;
  children?: ReactNode;
  onBack?: () => void;
  isActive?: boolean;
}

// Global registry to maintain header stack
interface MountedHeader {
  id: number;
  payload: any;
  callbacks: {
    back: () => void;
    action: (id: string) => void;
    tabClick: (index: number) => void;
    rightSegmentClick: (index: number) => void;
    searchChange: (val: string) => void;
    filterMenuSelect: (itemId: string) => void;
  };
}
let nextHeaderId = 0;
const mountedHeaders: MountedHeader[] = [];

function syncTopHeader() {
  if (mountedHeaders.length === 0) {
    (window as any).__nativeInnerHeaderBackClick = undefined;
    (window as any).__nativeInnerHeaderAction = undefined;
    (window as any).__nativeInnerHeaderTabClick = undefined;
    (window as any).__nativeInnerHeaderRightSegmentClick = undefined;
    (window as any).__nativeInnerHeaderSearchChange = undefined;
    (window as any).__nativeInnerHeaderFilterMenuSelect = undefined;
    return;
  }
  const top = mountedHeaders[mountedHeaders.length - 1];
  
  (window as any).__nativeInnerHeaderBackClick = top.callbacks.back;
  (window as any).__nativeInnerHeaderAction = top.callbacks.action;
  (window as any).__nativeInnerHeaderTabClick = top.callbacks.tabClick;
  (window as any).__nativeInnerHeaderRightSegmentClick = top.callbacks.rightSegmentClick;
  (window as any).__nativeInnerHeaderSearchChange = top.callbacks.searchChange;
  (window as any).__nativeInnerHeaderFilterMenuSelect = top.callbacks.filterMenuSelect;
  
  if (
    Capacitor.isNativePlatform() &&
    (window as any).webkit?.messageHandlers?.innerHeaderSync
  ) {
    try {
      (window as any).webkit.messageHandlers.innerHeaderSync.postMessage(top.payload);
    } catch (e) {
      console.error("Failed to sync inner header:", e);
    }
  }
}

export default function GlassPageHeader({
  title,
  subtitle,
  tabs = [],
  activeTab = 0,
  onTabChange,
  rightActions = [],
  rightSegmented,
  searchInput,
  filterMenu,
  onFilterMenuSelect,
  children,
  onBack,
  isActive = true,
}: GlassPageHeaderProps) {
  const router = useRouter();

  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
      idRef.current = nextHeaderId++;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const myId = idRef.current;
    
    if (!isActive) {
      const removeIdx = mountedHeaders.findIndex(h => h.id === myId);
      if (removeIdx >= 0) {
        mountedHeaders.splice(removeIdx, 1);
        syncTopHeader();
      }
      return;
    }

    const payload = {
      title: title || "",
      subtitle: subtitle || "",
      tabs: tabs,
      activeTab: activeTab,
      rightActions: rightActions.map(a => ({
        id: a.id,
        icon: a.icon,
        color: a.color || "default"
      })),
      rightSegmented: rightSegmented ? {
        items: rightSegmented.items,
        active: rightSegmented.active
      } : undefined,
      searchInput: searchInput ? {
        placeholder: searchInput.placeholder,
        value: searchInput.value,
        autoFocus: searchInput.autoFocus
      } : undefined,
      // Serialize filterMenu groups → [[[id, label, isActive, children?]]]
      filterMenu: filterMenu
        ? filterMenu.map(group => group.items.map(item => ({
            id: item.id,
            label: item.label,
            isActive: item.isActive,
            children: item.children?.map(c => ({ id: c.id, label: c.label, isActive: c.isActive }))
          })))
        : undefined
    };

    const callbacks = {
      back: () => {
        if (onBack) {
          onBack();
        } else {
          router.back();
        }
      },
      action: (actionId: string) => {
        const action = rightActions.find((a) => a.id === actionId);
        if (action) action.onClick();
      },
      tabClick: (index: number) => {
        if (onTabChange) onTabChange(index);
      },
      rightSegmentClick: (index: number) => {
        if (rightSegmented?.onChange) rightSegmented.onChange(index);
      },
      searchChange: (val: string) => {
        if (searchInput?.onChange) searchInput.onChange(val);
      },
      filterMenuSelect: (itemId: string) => {
        if (onFilterMenuSelect) onFilterMenuSelect(itemId);
      }
    };

    const headerData: MountedHeader = { id: myId as number, payload, callbacks };
    const idx = mountedHeaders.findIndex(h => h.id === myId);
    
    if (idx >= 0) {
      mountedHeaders[idx] = headerData;
    } else {
      mountedHeaders.push(headerData);
    }

    syncTopHeader();

    return () => {
      const removeIdx = mountedHeaders.findIndex(h => h.id === myId);
      if (removeIdx >= 0) {
        mountedHeaders.splice(removeIdx, 1);
        syncTopHeader();
      }
    };
  }, [title, subtitle, tabs, activeTab, rightActions, rightSegmented?.items, rightSegmented?.active, onTabChange, rightSegmented?.onChange, searchInput?.value, searchInput?.placeholder, searchInput?.autoFocus, searchInput?.onChange, filterMenu, onFilterMenuSelect, isActive]);

  return (
    <div className="w-full relative z-30">
      {/* Spacer to push content below the native iOS hover header OR web fixed header */}
      {Capacitor.isNativePlatform() && (
        <div className="h-[calc(56px+env(safe-area-inset-top))] w-full pointer-events-none" />
      )}
      
      {/* ── Web Header Fallback ── */}
      {!Capacitor.isNativePlatform() && (
        <div className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-md border-b border-border flex flex-col pt-[env(safe-area-inset-top)]">
          <div className="h-14 flex items-center px-4 justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {onBack && (
                <button onClick={onBack} className="p-2 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-highlight transition-colors shrink-0">
                  <ArrowLeft className="w-5 h-5"/>
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-text-primary truncate leading-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {rightActions?.map((action) => (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  className={`p-2 rounded-xl transition-colors ${
                    action.color === 'danger' 
                      ? 'text-red-500 hover:bg-red-500/10' 
                      : 'text-primary hover:bg-primary/10'
                  }`}
                >
                  {renderWebIcon(action.icon)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Web optional search input */}
          {searchInput && (
            <div className="px-4 pt-1 pb-3">
              <div className="relative">
                <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={searchInput.placeholder || "Пошук"}
                  value={searchInput.value}
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  autoFocus={searchInput.autoFocus}
                  className="w-full bg-surface-highlight text-text-primary text-sm rounded-xl pl-9 pr-9 py-2 border border-border focus:border-primary/50 focus:outline-none placeholder:text-text-secondary/50"
                />
                {searchInput.value.length > 0 && (
                  <button
                    onClick={() => searchInput.onChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Web optional segmented control */}
          {rightSegmented && rightSegmented.items && (
            <div className="px-4 pb-2">
              <div className="flex bg-surface-highlight/50 p-1 rounded-xl w-full max-w-sm mx-auto">
                {rightSegmented.items.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => rightSegmented.onChange(idx)}
                    className={`flex-1 flex justify-center items-center py-1.5 text-sm font-semibold rounded-lg transition-all ${
                      rightSegmented.active === idx 
                        ? "bg-background text-text-primary shadow-sm" 
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {renderWebIcon(item) || item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Web optional filter menus */}
          {filterMenu && filterMenu.length > 0 && (
            <div className="px-4 pb-3 flex flex-col gap-3 max-h-[150px] overflow-y-auto w-full scrollbar-hide">
              {filterMenu.map((group, gIdx) => {
                const activeItemWithChildren = group.items.find((i) => i.isActive && i.children && i.children.length > 0);
                
                return (
                  <div key={gIdx} className="flex flex-col gap-2 w-full">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x pb-1 w-full">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onFilterMenuSelect?.(item.id)}
                          className={`snap-start px-4 py-1.5 rounded-full whitespace-nowrap text-[13px] font-medium transition-colors flex-shrink-0 border ${
                            item.isActive 
                              ? "bg-text-primary text-background border-transparent shadow-sm" 
                              : "bg-surface text-text-secondary border-border hover:border-accent/40 hover:text-text-primary"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Render active item's children immediately below its row */}
                    {activeItemWithChildren && (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x pl-4 border-l-2 border-primary/20 w-full pb-1">
                        {activeItemWithChildren.children!.map((child) => (
                           <button
                             key={child.id}
                             onClick={() => onFilterMenuSelect?.(child.id)}
                             className={`snap-start px-3 py-1 rounded-full whitespace-nowrap text-xs font-semibold transition-colors flex-shrink-0 ${
                               child.isActive 
                                 ? "bg-primary text-white shadow-sm" 
                                 : "bg-surface-highlight text-text-secondary hover:text-text-primary border border-transparent hover:border-border"
                             }`}
                           >
                             {child.label}
                           </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Optional sub-header content (e.g. dom tabs) rendered in DOM just below the header */}
      {children ? (
        <div className={`px-4 pt-2 pb-2 bg-background/90 backdrop-blur-md border-b border-border sticky ${!Capacitor.isNativePlatform() ? "top-[calc(56px+env(safe-area-inset-top))]" : "top-[calc(56px+env(safe-area-inset-top))]"}`}>
          {children}
        </div>
      ) : (tabs.length > 0 && !Capacitor.isNativePlatform()) ? (
        <div className="px-4 pt-2 pb-2 bg-background/90 backdrop-blur-md border-b border-border sticky top-[calc(56px+env(safe-area-inset-top))]">
            <div className="flex bg-surface-highlight/50 p-1 rounded-xl">
                {tabs.map((tab, idx) => (
                    <button
                        key={idx}
                        onClick={() => onTabChange?.(idx)}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === idx ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>
      ) : null}
    </div>
  );

}
