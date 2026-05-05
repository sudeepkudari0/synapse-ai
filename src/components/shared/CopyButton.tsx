import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
    text: string;
    className?: string;
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            data-no-drag
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                transition-all duration-150 select-none cursor-pointer
                ${copied
                    ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                } ${className}`}
        >
            {copied ? (
                <>
                    <Check className="w-3 h-3" />
                    <span>Copied</span>
                </>
            ) : (
                <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                </>
            )}
        </button>
    );
}
