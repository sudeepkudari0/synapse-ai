import { app } from "electron";
import path from "path";
import { exec } from "child_process";
import fs from "fs";

export interface JobspyOptions {
  query: string;
  location: string;
  sites?: string; // comma separated
  results?: number;
  hours?: number;
  remote?: boolean;
}

export function runJobspySearch(options: JobspyOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    let basePath = app.getAppPath();
    if (basePath.includes("dist-electron")) {
      basePath = path.join(basePath, "..", "..");
    }
    const nativeDir = path.join(basePath, "native", "jobspy");
    const venvBin =
      process.platform === "win32"
        ? path.join(nativeDir, "venv", "Scripts", "python.exe")
        : path.join(nativeDir, "venv", "bin", "python");

    const scriptPath = path.join(nativeDir, "scraper.py");

    if (!fs.existsSync(venvBin)) {
      return reject(
        new Error(
          "JobSpy Python environment not found. Please run the setup script.",
        ),
      );
    }

    let command = `"${venvBin}" "${scriptPath}" --query "${options.query}" --location "${options.location}"`;
    if (options.sites) command += ` --sites "${options.sites}"`;
    if (options.results) command += ` --results ${options.results}`;
    if (options.hours) command += ` --hours ${options.hours}`;
    if (options.remote) command += ` --remote`;

    console.log("[JobSpy Runner] Executing:", command);

    // Increase maxBuffer to 50MB because JSON output can be large
    exec(
      command,
      { maxBuffer: 1024 * 1024 * 50, cwd: nativeDir },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[JobSpy Runner] Error:", stderr || error.message);
          return reject(new Error(stderr || error.message));
        }
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            return reject(new Error(result.error));
          }
          resolve(result.data);
        } catch (e) {
          console.error("[JobSpy Runner] Failed to parse JSON:", stdout);
          reject(new Error("Invalid output from JobSpy script"));
        }
      },
    );
  });
}
