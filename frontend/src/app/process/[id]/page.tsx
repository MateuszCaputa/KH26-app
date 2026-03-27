"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ProcessPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string>("loading");
  const [pipelineOutput, setPipelineOutput] = useState<Record<string, unknown> | null>(null);
  const [copilotOutput, setCopilotOutput] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, [id]);

  async function fetchStatus() {
    try {
      const resp = await fetch(`${API_URL}/api/process/${id}`);
      if (resp.status === 202) {
        setStatus("processing");
        return;
      }
      if (resp.status === 404) {
        setStatus("not_found");
        return;
      }
      if (resp.ok) {
        const data = await resp.json();
        setPipelineOutput(data);
        setStatus("pipeline_complete");
        fetchCopilot();
      }
    } catch {
      setError("Failed to fetch process data");
    }
  }

  async function fetchCopilot() {
    try {
      const resp = await fetch(`${API_URL}/api/process/${id}/copilot`);
      if (resp.ok) {
        const data = await resp.json();
        setCopilotOutput(data);
        setStatus("complete");
      }
    } catch {
      // Copilot not ready yet — that's fine
    }
  }

  async function triggerPipeline() {
    setStatus("processing");
    const resp = await fetch(`${API_URL}/api/process/${id}/run-pipeline`, {
      method: "POST",
    });
    if (resp.ok) {
      // Poll for completion
      setTimeout(fetchStatus, 2000);
    }
  }

  async function triggerAnalysis() {
    setStatus("analyzing");
    const resp = await fetch(`${API_URL}/api/process/${id}/analyze`, {
      method: "POST",
    });
    if (resp.ok) {
      setTimeout(fetchStatus, 2000);
    }
  }

  if (status === "loading") {
    return <p className="text-zinc-500">Loading...</p>;
  }

  if (status === "not_found") {
    return (
      <div className="space-y-4">
        <p className="text-zinc-400">Process {id} not found.</p>
        <Link href="/">
          <Button variant="outline">Back to Upload</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            &larr; Back
          </Link>
          <h2 className="text-xl font-semibold tracking-tight mt-1">
            Process{" "}
            <span className="font-[family-name:var(--font-geist-mono)]">
              {id}
            </span>
          </h2>
        </div>
        <Badge variant="secondary">{status}</Badge>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Pipeline Controls */}
      {!pipelineOutput && status !== "processing" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              File uploaded. Run the pipeline to discover the process.
            </p>
            <Button onClick={triggerPipeline}>Run Pipeline</Button>
          </CardContent>
        </Card>
      )}

      {status === "processing" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-zinc-400">
              Pipeline processing... This may take a moment for large files.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Results */}
      {pipelineOutput && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-base">Process Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-600">
                  Process visualization will render here
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-600">
                  Process statistics will render here
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-base">Variants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-600">
                  Process variants will render here
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-base">Bottlenecks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-600">
                  Bottleneck analysis will render here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Copilot Controls */}
      {pipelineOutput && !copilotOutput && status !== "analyzing" && (
        <>
          <Separator className="bg-zinc-800" />
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                Pipeline complete. Run the AI copilot to get automation
                recommendations.
              </p>
              <Button onClick={triggerAnalysis}>Run AI Analysis</Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Copilot Results */}
      {copilotOutput && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-zinc-800 bg-zinc-900 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                  <p className="text-sm text-zinc-600">
                    Automation recommendations will render here
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Generated BPMN</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                  <p className="text-sm text-zinc-600">
                    BPMN diagram will render here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
