import React, { useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { Transaction } from '../types';

interface DebtMapProps {
  transactions: Transaction[];
  height?: number;
}

const DebtMap: React.FC<DebtMapProps> = ({ transactions, height = 300 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const graphData = useMemo(() => {
    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    transactions.forEach((t) => {
      const from = t.from === 'You' ? 'You' : t.from;
      const to = t.to === 'You' ? 'You' : t.to;

      if (!nodesMap.has(from)) nodesMap.set(from, { id: from, label: from });
      if (!nodesMap.has(to)) nodesMap.set(to, { id: to, label: to });

      edges.push({
        from: from,
        to: to,
        label: `$${t.amount}`,
        width: Math.sqrt(parseFloat(t.amount)) / 2 + 1,
      });
    });

    return {
      nodes: new DataSet<any>(Array.from(nodesMap.values())),
      edges: new DataSet<any>(edges),
    };
  }, [transactions]);

  useEffect(() => {
    if (!containerRef.current) return;

    const options: any = {
      nodes: {
        shape: 'circle',
        margin: 10,
        font: {
          size: 14,
          face: 'Inter, system-ui, sans-serif',
          weight: 'bold',
          color: '#1e293b',
        },
        color: {
          border: '#e2e8f0',
          background: 'rgba(255, 255, 255, 0.9)',
          highlight: {
            border: '#2563eb',
            background: '#eff6ff',
          },
        },
        borderWidth: 1,
      },
      edges: {
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 },
        },
        color: { color: '#d1d5db', highlight: '#2563eb' },
        font: {
          size: 11,
          face: 'Sans-Serif',
          weight: 'bold',
          color: '#64748b',
          align: 'horizontal',
          background: 'rgba(255, 255, 255, 0.9)',
          strokeWidth: 0,
        },
        smooth: {
          enabled: true,
          type: 'curvedCW',
          roundness: 0.2,
        },
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 150 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 150,
        },
      },
      interaction: {
        dragNodes: true,
        zoomView: false,
        dragView: true,
      },
    };

    // Specific styling for "You" node
    if (graphData.nodes.get('You')) {
      graphData.nodes.update({
        id: 'You',
        font: { color: '#2563eb' },
        color: { border: '#2563eb' },
        borderWidth: 2,
      });
    }

    networkRef.current = new Network(containerRef.current, graphData, options);

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: `${height}px` }} 
      className="vis-network-container"
    />
  );
};

export default DebtMap;
