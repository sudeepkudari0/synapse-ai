import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for resizing the widget within the full-screen overlay.
 */
export function useResize(onResize: (deltaW: number, deltaH: number) => void) {
    const isResizingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click

        isResizingRef.current = true;
        lastPosRef.current = { x: e.screenX, y: e.screenY };
        document.body.classList.add('is-resizing'); // Disable transitions
        e.preventDefault();
        e.stopPropagation(); // Prevent drag from firing if it bubbles
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;

            const deltaW = e.screenX - lastPosRef.current.x;
            const deltaH = e.screenY - lastPosRef.current.y;

            if (deltaW !== 0 || deltaH !== 0) {
                lastPosRef.current = { x: e.screenX, y: e.screenY };
                onResize(deltaW, deltaH);
            }
        };

        const onMouseUp = () => {
            isResizingRef.current = false;
            document.body.classList.remove('is-resizing');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [onResize]);

    return { onMouseDown };
}
