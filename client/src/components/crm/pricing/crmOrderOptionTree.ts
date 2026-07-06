import type { TelecrmOrderOptionDto } from '../../../api/telecrm';

export type OrderOptionMenuItem = {
  id: string;
  label: string;
  price: string;
  row: TelecrmOrderOptionDto;
};

export type OrderOptionTreeNode = {
  /** 접기/펼치기 키 (고유) */
  key: string;
  label: string;
  items: OrderOptionMenuItem[];
  children: OrderOptionTreeNode[];
};

function parseLabelPath(labelPath: string): string[] {
  return labelPath
    .split('›')
    .map((s) => s.trim())
    .filter(Boolean);
}

function sortTreeNodes(nodes: OrderOptionTreeNode[]): OrderOptionTreeNode[] {
  return nodes
    .map((n) => ({ ...n, children: sortTreeNodes(n.children) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

function findOrCreateChild(parent: OrderOptionTreeNode, segment: string): OrderOptionTreeNode {
  const childKey = `${parent.key}/${segment}`;
  let child = parent.children.find((c) => c.key === childKey);
  if (!child) {
    child = { key: childKey, label: segment, items: [], children: [] };
    parent.children.push(child);
  }
  return child;
}

/** labelPath 1단계=대분류(에어컨 등), 하위=중첩 접기 */
export function buildOrderOptionTree(
  orderOptions: TelecrmOrderOptionDto[],
  formatPrice: (row: TelecrmOrderOptionDto) => string,
): OrderOptionTreeNode[] {
  const rootMap = new Map<string, OrderOptionTreeNode>();

  for (const row of orderOptions) {
    const parts = parseLabelPath(row.labelPath);
    if (parts.length === 0) continue;

    const topLabel = parts[0]!;
    let root = rootMap.get(topLabel);
    if (!root) {
      root = { key: topLabel, label: topLabel, items: [], children: [] };
      rootMap.set(topLabel, root);
    }

    const menuItem: OrderOptionMenuItem = {
      id: row.id,
      label: row.emoji ? `${row.emoji} ${row.label}` : row.label,
      price: formatPrice(row),
      row,
    };

    if (parts.length === 1) {
      root.items.push(menuItem);
      continue;
    }

    let current = root;
    for (let i = 1; i < parts.length - 1; i++) {
      current = findOrCreateChild(current, parts[i]!);
    }
    current.items.push(menuItem);
  }

  return sortTreeNodes(Array.from(rootMap.values()));
}

export function countOrderOptionTreeItems(node: OrderOptionTreeNode): number {
  return node.items.length + node.children.reduce((sum, c) => sum + countOrderOptionTreeItems(c), 0);
}
