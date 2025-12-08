import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { 
  ProductTreeNode, 
  ProductLevelType,
  LEVEL_LABELS, 
  LEVEL_COLORS, 
  getNodeKey 
} from "../../../lib/productHierarchy";

interface TreeNodeItemProps {
  node: ProductTreeNode;
  depth: number;
  expandedNodes: Set<string>;
  onToggle: (key: string) => void;
  renderActions?: (node: ProductTreeNode) => React.ReactNode;
  renderExtra?: (node: ProductTreeNode) => React.ReactNode;
  renderChildren?: (node: ProductTreeNode, depth: number) => React.ReactNode;
}

export function TreeNodeItem({ 
  node, 
  depth, 
  expandedNodes, 
  onToggle, 
  renderActions,
  renderExtra,
  renderChildren 
}: TreeNodeItemProps) {
  const nodeKey = getNodeKey(node);
  const isExpanded = expandedNodes.has(nodeKey);
  const hasChildren = node.children.length > 0;
  const colors = LEVEL_COLORS[node.level];

  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <button
          onClick={() => onToggle(nodeKey)}
          className={`p-0.5 rounded ${hasChildren ? "hover:bg-gray-200" : "invisible"}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <span className={`px-2 py-0.5 text-xs rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
          {LEVEL_LABELS[node.level]}
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{node.name}</span>

        {renderExtra?.(node)}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {renderActions?.(node)}
        </div>
      </div>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={getNodeKey(child)}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              renderActions={renderActions}
              renderExtra={renderExtra}
              renderChildren={renderChildren}
            />
          ))}
          {renderChildren?.(node, depth)}
        </div>
      )}
    </div>
  );
}

interface TreeViewProps {
  nodes: ProductTreeNode[];
  expandedNodes: Set<string>;
  onToggle: (key: string) => void;
  renderActions?: (node: ProductTreeNode) => React.ReactNode;
  renderExtra?: (node: ProductTreeNode) => React.ReactNode;
  renderChildren?: (node: ProductTreeNode, depth: number) => React.ReactNode;
  emptyMessage?: string;
}

export function TreeView({ 
  nodes, 
  expandedNodes, 
  onToggle, 
  renderActions,
  renderExtra,
  renderChildren,
  emptyMessage = "Nenhum item encontrado"
}: TreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNodeItem
          key={getNodeKey(node)}
          node={node}
          depth={0}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
          renderActions={renderActions}
          renderExtra={renderExtra}
          renderChildren={renderChildren}
        />
      ))}
    </div>
  );
}

export function useTreeExpansion() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandNode = (key: string) => {
    setExpandedNodes(prev => new Set(prev).add(key));
  };

  const collapseNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const expandAll = (nodes: ProductTreeNode[]) => {
    const keys = new Set<string>();
    function collectKeys(node: ProductTreeNode) {
      keys.add(getNodeKey(node));
      node.children.forEach(collectKeys);
    }
    nodes.forEach(collectKeys);
    setExpandedNodes(keys);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  return {
    expandedNodes,
    toggleNode,
    expandNode,
    collapseNode,
    expandAll,
    collapseAll,
  };
}
