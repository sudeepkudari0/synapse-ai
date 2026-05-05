interface PulsingDotProps {
    isActive: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

export function PulsingDot({ isActive, size = 'sm', className = '' }: PulsingDotProps) {
    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
    };

    if (!isActive) {
        return (
            <span
                className={`inline-block rounded-full bg-[var(--text-muted)] ${sizeClasses[size]} ${className}`}
            />
        );
    }

    return (
        <span className={`relative inline-flex ${className}`}>
            {/* Pulsing ring */}
            <span
                className={`absolute inline-flex rounded-full bg-[var(--accent-green)] opacity-40 animate-ping ${sizeClasses[size]}`}
            />
            {/* Solid dot */}
            <span
                className={`relative inline-flex rounded-full bg-[var(--accent-green)] ${sizeClasses[size]}`}
            />
        </span>
    );
}
