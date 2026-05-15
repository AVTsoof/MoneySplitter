import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Transaction {
  from: string;
  to: string;
  amount: string;
}

interface DebtMapProps {
  transactions: Transaction[];
  width?: number;
  height?: number;
}

const DebtMap: React.FC<DebtMapProps> = ({ transactions, width = 600, height = 400 }) => {
  const data = useMemo(() => {
    const nodesMap = new Map<string, { id: string; name: string }>();
    const links: any[] = [];

    transactions.forEach((t) => {
      if (!nodesMap.has(t.from)) nodesMap.set(t.from, { id: t.from, name: t.from });
      if (!nodesMap.has(t.to)) nodesMap.set(t.to, { id: t.to, name: t.to });

      links.push({
        source: t.from,
        target: t.to,
        amount: t.amount,
        label: `$${t.amount}`,
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  }, [transactions]);

  return (
    <div className="bg-white rounded-lg shadow-inner overflow-hidden border border-gray-200">
      <ForceGraph2D
        graphData={data}
        width={width}
        height={height}
        nodeLabel="id"
        nodeColor={() => '#3b82f6'} // blue-500
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#1e40af'; // blue-800
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions; // to use in nodePointerAreaPaint
        }}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        linkLabel={(link: any) => `Amount: ${link.label}`}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx, globalScale) => {
          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = 4;

          const start = link.source;
          const end = link.target;

          // ignore unbound links
          if (typeof start !== 'object' || typeof end !== 'object') return;

          // calculate label positioning
          const textPos = {
            x: start.x + (end.x - start.x) / 2,
            y: start.y + (end.y - start.y) / 2
          };

          const relAngle = Math.atan2(end.y - start.y, end.x - start.x);

          const fontSize = Math.min(MAX_FONT_SIZE, (link.amount / 10) + 2);
          ctx.font = `${fontSize}px Sans-Serif`;

          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(relAngle);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#64748b'; // slate-500
          ctx.fillText(link.label, 0, -2);
          ctx.restore();
        }}
      />
    </div>
  );
};

export default DebtMap;
