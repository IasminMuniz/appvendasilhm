import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportDataset, exportFullBackup, listExportJobs } from "@/lib/exports.functions";

const jobsQueryOptions = () =>
  queryOptions({ queryKey: ["export-jobs"], queryFn: () => listExportJobs() });

export const Route = createFileRoute("/_authenticated/exportacao")({
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQueryOptions()),
  component: ExportPage,
  head: () => ({
    meta: [
      { title: "Exportação e Backup - Plataforma Comercial" },
      {
        name: "description",
        content: "Exporte clientes, leads, produtos, pedidos e orçamentos em CSV ou JSON.",
      },
    ],
  }),
});

function download(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ExportPage() {
  const queryClient = useQueryClient();
  const { data: jobs } = useSuspenseQuery(jobsQueryOptions());
  const [dataset, setDataset] = useState("customers");
  const [format, setFormat] = useState("csv");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["export-jobs"] });

  const exportMutation = useMutation({
    mutationFn: exportDataset,
    onSuccess: (res) => {
      download(res.fileName, res.content, format === "csv" ? "text/csv" : "application/json");
      toast.success(`${res.rowCount} registros exportados`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backupMutation = useMutation({
    mutationFn: exportFullBackup,
    onSuccess: (res) => {
      download(res.fileName, res.content, "application/json");
      toast.success("Backup gerado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exportação e backup</h1>
        <p className="text-muted-foreground">Exporte dados comerciais respeitando suas permissões.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova exportação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select value={dataset} onValueChange={setDataset}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                ["customers", "Clientes"],
                ["leads", "Leads"],
                ["products", "Produtos"],
                ["orders", "Pedidos"],
                ["quotes", "Orçamentos"],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value!}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => exportMutation.mutate({ data: { dataset, format } })}
            disabled={exportMutation.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button
            variant="outline"
            onClick={() => backupMutation.mutate({})}
            disabled={backupMutation.isPending}
          >
            Backup completo (JSON)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de exportações</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma exportação realizada.</p>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{job.file_name}</span>
                  <span className="text-muted-foreground">
                    {job.row_count} registros ·{" "}
                    {new Date(job.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
