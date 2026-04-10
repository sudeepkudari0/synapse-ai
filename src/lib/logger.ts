// Renderer process logger
const isDebugEnabled = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

export const logger = {
    debug: (...args: any[]) => {
        if (isDebugEnabled) {
            console.log(new Date().toISOString(), '[DEBUG]', ...args);
        }
    },
    info: (...args: any[]) => {
        if (isDebugEnabled) {
            console.log(new Date().toISOString(), '[INFO]', ...args);
        }
    },
    warn: (...args: any[]) => {
        console.warn(new Date().toISOString(), '[WARN]', ...args);
    },
    error: (...args: any[]) => {
        console.error(new Date().toISOString(), '[ERROR]', ...args);
    }
};
