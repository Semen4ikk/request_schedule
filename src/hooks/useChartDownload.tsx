// hooks/useChartDownload.tsx
// hooks/useChartDownload.tsx
import type {RefObject} from 'react';
import { Chart } from 'chart.js';

export const useChartDownload = (
    chartRef: RefObject<Chart | null>,
    filename = 'chart.png'
) => {
    const download = () => {
        const chartInstance = chartRef.current;
        if (chartInstance) {
            const link = document.createElement('a');
            link.href = chartInstance.toBase64Image('image/png', 1);
            link.download = filename;
            link.click();
        }
    };

    return { download };
};