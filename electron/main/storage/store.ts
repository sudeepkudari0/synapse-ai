import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class JSONStore {
    private basePath: string;

    constructor(subDirectory: string = '') {
        // All paths relative to app.getPath('userData')/synapse-data/
        this.basePath = path.join(app.getPath('userData'), 'synapse-data', subDirectory);
        
        // Ensure base directory exists
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }

    private getFullPath(relativePath: string): string {
        return path.join(this.basePath, relativePath);
    }

    public read<T>(relativePath: string): T | null {
        const fullPath = this.getFullPath(relativePath);
        if (!fs.existsSync(fullPath)) {
            return null;
        }

        try {
            const data = fs.readFileSync(fullPath, 'utf-8');
            return JSON.parse(data) as T;
        } catch (error) {
            console.error(`Failed to read from ${fullPath}:`, error);
            return null;
        }
    }

    public write<T>(relativePath: string, data: T): void {
        const fullPath = this.getFullPath(relativePath);
        const dirPath = path.dirname(fullPath);

        // Auto-create directories on write
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        try {
            fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (error) {
            console.error(`Failed to write to ${fullPath}:`, error);
            throw error;
        }
    }

    public list(dirPath: string = ''): string[] {
        const fullPath = this.getFullPath(dirPath);
        if (!fs.existsSync(fullPath)) {
            return [];
        }

        try {
            return fs.readdirSync(fullPath);
        } catch (error) {
            console.error(`Failed to list directory ${fullPath}:`, error);
            return [];
        }
    }

    public delete(relativePath: string): void {
        const fullPath = this.getFullPath(relativePath);
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
            } catch (error) {
                console.error(`Failed to delete ${fullPath}:`, error);
                throw error;
            }
        }
    }
}
