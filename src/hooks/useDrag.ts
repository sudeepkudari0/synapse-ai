import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for dragging the Electron window.
 * Uses IPC moveWindow calls for smooth drag behavior.
 */
export function useDrag() {
    const isDraggingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        // Only drag with left mouse button
        if (e.button !== 0) return;
        // Don't drag from buttons or interactive elements
        if ((e.target as HTMLElement).closest('button, input, textarea, select, [data-no-drag]')) return;

        isDraggingRef.current = true;
        lastPosRef.current = { x: e.screenX, y: e.screenY };

        // Prevent text selection during drag
        e.preventDefault();
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            const deltaX = e.screenX - lastPosRef.current.x;
            const deltaY = e.screenY - lastPosRef.current.y;

            if (deltaX !== 0 || deltaY !== 0) {
                lastPosRef.current = { x: e.screenX, y: e.screenY };
                window.electronAPI?.moveWindow(deltaX, deltaY);
            }
        };

        const onMouseUp = () => {
            isDraggingRef.current = false;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return { onMouseDown };
}
