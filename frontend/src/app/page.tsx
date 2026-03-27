"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProcessEntry {
  process_id: string;
  status: string;
}

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processes, setProcesses] = useState<ProcessEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchProcesses = useCallback(async () => {
    const resp = await fetch(`${API_URL}/api/processes`);
    if (resp.ok) {
      const data = await resp.json();
      setProcesses(data.processes);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || "Upload failed");
      }

      const data = await resp.json();
      setFile(null);
      await fetchProcesses();
      router.push(`/process/${data.process_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".csv")) {
      setFile(dropped);
      setError(null);
    } else {
      setError("Only CSV files are accepted");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Process Analysis
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Upload a Task Mining event log to discover processes, detect
          bottlenecks, and get automation recommendations.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-base">Upload Event Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
            className={`
              border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
              ${dragging ? "border-blue-500 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-500"}
            `}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setError(null);
                }
              }}
            />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium font-[family-name:var(--font-geist-mono)]">
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-zinc-400">
                  Drop a CSV file here or click to browse
                </p>
                <p className="text-xs text-zinc-600">
                  Activity Sequence exports from KYP.ai
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Upload and Analyze"}
          </Button>
        </CardContent>
      </Card>

      {processes.length > 0 && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400">
              Previous Analyses
            </h3>
            {processes.map((p) => (
              <Card
                key={p.process_id}
                className="border-zinc-800 bg-zinc-900 cursor-pointer hover:border-zinc-600 transition-colors"
                onClick={() => router.push(`/process/${p.process_id}`)}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <span className="font-[family-name:var(--font-geist-mono)] text-sm">
                    {p.process_id}
                  </span>
                  <Badge
                    variant={p.status === "complete" ? "default" : "secondary"}
                  >
                    {p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
