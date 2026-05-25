/**
 * Latency Reporter — Tracks timing metrics across the E2E interview pipeline.
 *
 * Records individual measurements for each pipeline stage and computes
 * P50, P95, P99, min, max, mean. Outputs JSON and Markdown reports.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Types ───────────────────────────────────────────────────────────

export type MetricName =
    | 'stt_latency_ms'
    | 'question_detect_latency_ms'
    | 'llm_first_token_ms'
    | 'llm_total_ms'
    | 'e2e_latency_ms'
    | 'rtf'; // Real-Time Factor

export interface LatencySample {
    metricName: MetricName;
    value: number;
    timestamp: number;
    metadata?: Record<string, string | number>;
}

export interface MetricStats {
    name: MetricName;
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    samples: number[];
}

export interface LatencyReport {
    generated: string;
    testSuite: string;
    engine: string;
    totalDuration: number;
    metrics: Record<MetricName, MetricStats>;
    rawSamples: LatencySample[];
}

// ─── Latency Tracker Class ──────────────────────────────────────────

export class LatencyTracker {
    private samples: LatencySample[] = [];
    private startTime: number = Date.now();
    private testSuite: string;
    private engine: string;

    constructor(testSuite: string, engine: string = 'unknown') {
        this.testSuite = testSuite;
        this.engine = engine;
    }

    /**
     * Record a single latency measurement.
     */
    record(metricName: MetricName, value: number, metadata?: Record<string, string | number>): void {
        this.samples.push({
            metricName,
            value,
            timestamp: Date.now(),
            metadata,
        });
    }

    /**
     * Create a timing helper that automatically records the duration.
     * Usage:
     *   const done = tracker.startTimer('stt_latency_ms');
     *   await someAsyncWork();
     *   done({ audioLength: 2500 });
     */
    startTimer(metricName: MetricName): (metadata?: Record<string, string | number>) => number {
        const start = performance.now();
        return (metadata?: Record<string, string | number>) => {
            const elapsed = performance.now() - start;
            this.record(metricName, elapsed, metadata);
            return elapsed;
        };
    }

    /**
     * Compute statistics for a given metric.
     */
    computeStats(metricName: MetricName): MetricStats | null {
        const values = this.samples
            .filter(s => s.metricName === metricName)
            .map(s => s.value)
            .sort((a, b) => a - b);

        if (values.length === 0) return null;

        return {
            name: metricName,
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            p50: percentile(values, 50),
            p95: percentile(values, 95),
            p99: percentile(values, 99),
            samples: values,
        };
    }

    /**
     * Generate the full report.
     */
    generateReport(): LatencyReport {
        const metricNames: MetricName[] = [
            'stt_latency_ms',
            'question_detect_latency_ms',
            'llm_first_token_ms',
            'llm_total_ms',
            'e2e_latency_ms',
            'rtf',
        ];

        const metrics: Record<string, MetricStats> = {};
        for (const name of metricNames) {
            const stats = this.computeStats(name);
            if (stats) {
                metrics[name] = stats;
            }
        }

        return {
            generated: new Date().toISOString(),
            testSuite: this.testSuite,
            engine: this.engine,
            totalDuration: Date.now() - this.startTime,
            metrics: metrics as Record<MetricName, MetricStats>,
            rawSamples: this.samples,
        };
    }

    /**
     * Write reports to the e2e/reports/ directory.
     */
    async writeReports(reportDir?: string): Promise<{ jsonPath: string; mdPath: string }> {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const dir = reportDir || path.join(__dirname, 'reports');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const report = this.generateReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const suffix = `${this.engine}-${timestamp}`;

        // Write JSON report
        const jsonPath = path.join(dir, `latency-report-${suffix}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

        // Write Markdown report
        const mdPath = path.join(dir, `latency-report-${suffix}.md`);
        fs.writeFileSync(mdPath, generateMarkdownReport(report));

        // Also write a "latest" copy
        const latestJsonPath = path.join(dir, `latency-report-latest-${this.engine}.json`);
        const latestMdPath = path.join(dir, `latency-report-latest-${this.engine}.md`);
        fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
        fs.writeFileSync(latestMdPath, generateMarkdownReport(report));

        return { jsonPath, mdPath };
    }

    /**
     * Get a summary string for console output.
     */
    getSummary(): string {
        const report = this.generateReport();
        const lines: string[] = [
            `\n📊 Latency Report — ${this.engine}`,
            `${'─'.repeat(60)}`,
        ];

        const metricLabels: Record<MetricName, string> = {
            stt_latency_ms: 'STT Transcription',
            question_detect_latency_ms: 'Question Detection',
            llm_first_token_ms: 'LLM First Token',
            llm_total_ms: 'LLM Total Generation',
            e2e_latency_ms: 'End-to-End Pipeline',
            rtf: 'Real-Time Factor',
        };

        for (const [name, stats] of Object.entries(report.metrics)) {
            const label = metricLabels[name as MetricName] || name;
            const unit = name === 'rtf' ? 'x' : 'ms';
            lines.push(
                `${label.padEnd(25)} │ P50: ${stats.p50.toFixed(1).padStart(8)}${unit} │ ` +
                `P95: ${stats.p95.toFixed(1).padStart(8)}${unit} │ ` +
                `Mean: ${stats.mean.toFixed(1).padStart(8)}${unit} │ ` +
                `n=${stats.count}`
            );
        }

        lines.push(`${'─'.repeat(60)}`);
        lines.push(`Total test duration: ${(report.totalDuration / 1000).toFixed(1)}s\n`);
        return lines.join('\n');
    }

    /**
     * Reset all samples (useful between engine switches).
     */
    reset(engine?: string): void {
        this.samples = [];
        this.startTime = Date.now();
        if (engine) this.engine = engine;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const idx = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const frac = idx - lower;

    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] * (1 - frac) + sortedValues[upper] * frac;
}

function generateMarkdownReport(report: LatencyReport): string {
    const metricLabels: Record<string, string> = {
        stt_latency_ms: 'STT Transcription (ms)',
        question_detect_latency_ms: 'Question Detection (ms)',
        llm_first_token_ms: 'LLM First Token (ms)',
        llm_total_ms: 'LLM Total Generation (ms)',
        e2e_latency_ms: 'End-to-End Pipeline (ms)',
        rtf: 'Real-Time Factor (x)',
    };

    let md = `# Latency Report — ${report.engine}\n\n`;
    md += `**Generated:** ${report.generated}  \n`;
    md += `**Test Suite:** ${report.testSuite}  \n`;
    md += `**Engine:** ${report.engine}  \n`;
    md += `**Total Duration:** ${(report.totalDuration / 1000).toFixed(1)}s  \n\n`;

    md += `## Summary\n\n`;
    md += `| Metric | Count | Min | P50 | P95 | P99 | Max | Mean |\n`;
    md += `|--------|------:|----:|----:|----:|----:|----:|-----:|\n`;

    for (const [name, stats] of Object.entries(report.metrics)) {
        const label = metricLabels[name] || name;
        md += `| ${label} | ${stats.count} | ${stats.min.toFixed(1)} | ${stats.p50.toFixed(1)} | ${stats.p95.toFixed(1)} | ${stats.p99.toFixed(1)} | ${stats.max.toFixed(1)} | ${stats.mean.toFixed(1)} |\n`;
    }

    md += `\n## Raw Samples\n\n`;
    md += `<details>\n<summary>Click to expand raw samples (${report.rawSamples.length} total)</summary>\n\n`;
    md += `| # | Metric | Value | Metadata |\n`;
    md += `|--:|--------|------:|---------|\n`;

    report.rawSamples.forEach((s, i) => {
        const meta = s.metadata ? JSON.stringify(s.metadata) : '';
        md += `| ${i + 1} | ${s.metricName} | ${s.value.toFixed(2)} | ${meta} |\n`;
    });

    md += `\n</details>\n`;

    return md;
}

// ─── Multi-Engine Comparison Report ──────────────────────────────────

export interface MultiEngineReport {
    generated: string;
    engines: Record<string, LatencyReport>;
}

/**
 * Generate a side-by-side comparison report for multiple engines.
 */
export function generateComparisonReport(reports: Record<string, LatencyReport>): string {
    const engines = Object.keys(reports);

    let md = `# Multi-Engine Latency Comparison\n\n`;
    md += `**Generated:** ${new Date().toISOString()}  \n`;
    md += `**Engines Tested:** ${engines.join(', ')}  \n\n`;

    const metricNames: MetricName[] = [
        'stt_latency_ms',
        'question_detect_latency_ms',
        'llm_first_token_ms',
        'llm_total_ms',
        'e2e_latency_ms',
        'rtf',
    ];

    const metricLabels: Record<MetricName, string> = {
        stt_latency_ms: 'STT Transcription',
        question_detect_latency_ms: 'Question Detection',
        llm_first_token_ms: 'LLM First Token',
        llm_total_ms: 'LLM Total Generation',
        e2e_latency_ms: 'End-to-End Pipeline',
        rtf: 'Real-Time Factor',
    };

    for (const metric of metricNames) {
        const hasData = engines.some(e => reports[e].metrics[metric]);
        if (!hasData) continue;

        md += `### ${metricLabels[metric]}\n\n`;
        md += `| Engine | Count | P50 | P95 | P99 | Mean |\n`;
        md += `|--------|------:|----:|----:|----:|-----:|\n`;

        for (const engine of engines) {
            const stats = reports[engine].metrics[metric];
            if (stats) {
                const unit = metric === 'rtf' ? 'x' : 'ms';
                md += `| ${engine} | ${stats.count} | ${stats.p50.toFixed(1)}${unit} | ${stats.p95.toFixed(1)}${unit} | ${stats.p99.toFixed(1)}${unit} | ${stats.mean.toFixed(1)}${unit} |\n`;
            } else {
                md += `| ${engine} | — | — | — | — | — |\n`;
            }
        }

        // Find fastest engine for this metric
        let fastest = '';
        let fastestP50 = Infinity;
        for (const engine of engines) {
            const stats = reports[engine].metrics[metric];
            if (stats && stats.p50 < fastestP50) {
                fastestP50 = stats.p50;
                fastest = engine;
            }
        }
        if (fastest) {
            md += `\n> 🏆 **Fastest:** ${fastest} (P50: ${fastestP50.toFixed(1)})\n`;
        }
        md += `\n`;
    }

    return md;
}
