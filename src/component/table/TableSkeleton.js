import React from 'react';

const SHAPES = {
    index: 'mx-auto h-4 w-6',
    text: 'h-4 w-3/5',
    short: 'h-4 w-16',
    badge: 'h-6 w-20 rounded-full',
    avatar: 'h-10 w-44',
    action: 'ml-auto h-8 w-8 rounded-lg',
};

export function TableSkeletonRows({ rows = 6, cells = ['index', 'text', 'text', 'action'] }) {
    return Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
            {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-4">
                    <div className={`bg-slate-200 ${SHAPES[cell] || SHAPES.text}`} />
                </td>
            ))}
        </tr>
    ));
}

export function serialNumber(page, pageSize, index) {
    return ((Number(page) || 1) - 1) * (Number(pageSize) || 0) + index + 1;
}
