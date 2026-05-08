import {useCallback, useMemo, useRef, useState} from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { useChartDownload } from "../hooks/useChartDownload.tsx";
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const barOffsetPlugin = {
    id: 'barOffsetPlugin',
    afterDatasetsUpdate(chart: any, _args: any, pluginOptions: any) {
        const offsets: number[][] = pluginOptions?.offsets ?? [];
        chart.data.datasets.forEach((_ds: any, datasetIndex: number) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta?.data) return;
            meta.data.forEach((barElement: any, dataIndex: number) => {
                const offset = offsets?.[datasetIndex]?.[dataIndex] ?? 0;
                barElement.x += offset;
            });
        });
    }
};

ChartJS.register(barOffsetPlugin);

const ApiLatencyChart = () => {
    const chartRef = useRef<any>(null);
    const { download } = useChartDownload(chartRef, 'api-query-latency-chart.png');

    const [barPercentage, setBarPercentage] = useState(0.7);
    const [categoryPercentage, setCategoryPercentage] = useState(0.8);
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'width' | 'move' | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [initialPercentage, setInitialPercentage] = useState(0.7);
    const dragTarget = useRef<{ datasetIndex: number; index: number } | null>(null);
    const initialOffset = useRef<number>(0);
    const [barOffsets, setBarOffsets] = useState<number[][]>([
        [0, 0],
        [0, 0],
    ]);

    const [chartData, setChartData] = useState({
        labels: ['Avg', 'P95'],
        datasets: [
            {
                label: 'Замер 1',
                data: [266.26, 911.78],
                backgroundColor: 'rgb(231,89,109)',
                borderRadius: 10,
                barPercentage: 0.7,
                categoryPercentage: 0.8,

            },
            {
                label: 'Замер 2',
                data: [109.99, 424.62],
                backgroundColor: 'rgb(13,93,218)',
                borderRadius: 10,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
        ],
    });
    const interactionOptions = {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: true,
    };

    const handleMouseDown = useCallback((e: any) => {
        const chart = chartRef.current;
        if (!chart) return;

        const elements = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
        if (elements.length > 0) {
            e.native?.preventDefault?.();
            setIsDragging(true);
            setDragStartX(e.clientX);

            if (e.shiftKey) {
                setDragMode('move');
                const target = {
                    datasetIndex: elements[0].datasetIndex,
                    index: elements[0].index,
                };
                dragTarget.current = target;
                initialOffset.current = barOffsets[target.datasetIndex][target.index] ?? 0;
            } else {
                setDragMode('width');
                setInitialPercentage(barPercentage);
            }
            chart.canvas.style.cursor = e.shiftKey ? 'grabbing' : 'ew-resize';
        }
    }, [barPercentage, barOffsets]);

    const handleMouseMove = useCallback((e: any) => {
        if (!isDragging || !chartRef.current || !dragMode) return;

        const chart = chartRef.current;
        const deltaX = e.clientX - dragStartX;
        const chartWidth = chart.chartArea.width;

        if (dragMode === 'width') {
            const deltaPercentage = deltaX / chartWidth;
            const newPercentage = Math.max(0.1, Math.min(1.0, initialPercentage + deltaPercentage));
            setBarPercentage(newPercentage);
        } else if (dragMode === 'move') {
            const target = dragTarget.current;
            if (!target) return;
            const maxShift = chartWidth * 0.2;
            const nextOffset = Math.max(
                -maxShift,
                Math.min(maxShift, initialOffset.current + deltaX)
            );
            setBarOffsets(prev => prev.map((row, dsIdx) =>
                row.map((value, idx) =>
                    dsIdx === target.datasetIndex && idx === target.index ? nextOffset : value
                )
            ));
        }
    }, [isDragging, dragMode, dragStartX, initialPercentage]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragMode(null);
        dragTarget.current = null;
        if (chartRef.current) {
            chartRef.current.canvas.style.cursor = 'default';
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (isDragging) handleMouseUp();
    }, [isDragging, handleMouseUp]);

    const handleValueChange = useCallback((datasetIndex: number, dataIndex: number, rawValue: string) => {
        const value = Number(rawValue);
        setChartData(prev => ({
            ...prev,
            datasets: prev.datasets.map((dataset, dsIdx) => {
                if (dsIdx !== datasetIndex) return dataset;
                const nextData = [...dataset.data];
                nextData[dataIndex] = Number.isFinite(value) ? value : 0;
                return { ...dataset, data: nextData };
            }),
        }));
    }, []);

    const dataWithSizing = useMemo(() => ({
        ...chartData,
        datasets: chartData.datasets.map(dataset => ({
            ...dataset,
            barPercentage,
            categoryPercentage,
        })),
    }), [chartData, barPercentage, categoryPercentage]);


    const options = useMemo(() => ({
        responsive: true,
        animation: { duration: 0 },
        plugins: {
            barOffsetPlugin: { offsets: barOffsets },
            legend: { position: 'top' as const },
            title: {
                display: true,
                text: 'API query latency chart',
                font: { size: 16 },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.15)', borderDash: [6, 6] },
                title: { display: true, text: 'Response time (ms)' },
                reverse: false,
            },
            x: {
                grid: { color: 'rgba(0,0,0,0.15)', borderDash: [6, 6] },
            },
        },
        interaction: interactionOptions,
        onHover: (e: any) => {
            const chart = chartRef.current;
            if (!chart) return;
            const elements = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
            chart.canvas.style.cursor = elements.length > 0 ? (e.native?.shiftKey ? 'grab' : 'ew-resize') : 'default';
        },
        onLeave: () => {
            if (chartRef.current) chartRef.current.canvas.style.cursor = 'default';
        }
    }), [barOffsets]);


    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button
                onClick={download}
                style={{
                    marginBottom: '16px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                }}
            >
                Скачать PNG
            </button>

            <div
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                style={{ userSelect: 'none', outline: '1px dashed #ccc' }}
            >
                <Bar
                    ref={chartRef}
                    data={dataWithSizing}
                    options={options}

                />
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: '8px' }}>
                    {chartData.datasets.map((dataset, datasetIndex) => (
                        chartData.labels.map((label, dataIndex) => (
                            <label key={`${dataset.label}-${label}`} style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                                <span>{dataset.label} - {label}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={dataset.data[dataIndex]}
                                    onChange={(e) => handleValueChange(datasetIndex, dataIndex, e.target.value)}
                                />
                            </label>
                        ))
                    ))}
                </div>

                <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                    <span>Размер столбиков (barPercentage): {barPercentage.toFixed(2)}</span>
                    <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.01}
                        value={barPercentage}
                        onChange={(e) => setBarPercentage(Number(e.target.value))}
                    />
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                    <span>Ширина группы (categoryPercentage): {categoryPercentage.toFixed(2)}</span>
                    <input
                        type="range"
                        min={0.3}
                        max={1}
                        step={0.01}
                        value={categoryPercentage}
                        onChange={(e) => setCategoryPercentage(Number(e.target.value))}
                    />
                </label>
            </div>
        </div>
    );
};

export default ApiLatencyChart;