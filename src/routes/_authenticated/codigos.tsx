import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { suppliersQueryOptions } from "@/components/products/product-form";
import { COLORS, PATTERNS, SIZES, STYLES } from "@/lib/clothing";

export const Route = createFileRoute("/_authenticated/codigos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersQueryOptions),
  component: CodesPage,
  head: () => ({
    meta: [
      { title: "Códigos - Nexus 360" },
      { name: "description", content: "Consulta dos códigos usados no SKU das peças." },
      { property: "og:title", content: "Códigos - Nexus 360" },
      { property: "og:description", content: "Estrutura do SKU e tabelas de códigos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PARTS = [
  ["VE", "Categoria", "Vestido"],
  ["F01", "Fornecedor", "PML Fashion (tela Fornecedores)"],
  ["CM", "Estilo", "Camadas/Babados"],
  ["BR", "Cor", "Branco"],
  ["B", "Padrão", "Bordado"],
  ["01", "Modelo nº", "1º modelo com o mesmo fornecedor, estilo, cor e padrão"],
  ["U", "Tamanho", "Único (os demais tamanhos aparecem como estão: P, M, 38...)"],
] as const;

function CodeTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { code: string; label: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Significado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.code + r.label}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.label}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CodesPage() {
  const { data: suppliers } = useSuspenseQuery(suppliersQueryOptions);
  const toRows = (l: readonly { value: string; code: string }[]) =>
    l.map((i) => ({ code: i.code, label: i.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Códigos</h1>
        <p className="text-muted-foreground">Como o SKU de cada peça é montado.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estrutura do SKU</CardTitle>
          <p className="font-mono text-2xl font-semibold">VE-F01-CM-BR-B01-U</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Parte</TableHead>
                <TableHead>O que é</TableHead>
                <TableHead>No exemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PARTS.map(([code, what, example]) => (
                <TableRow key={what}>
                  <TableCell className="font-mono">{code}</TableCell>
                  <TableCell>{what}</TableCell>
                  <TableCell>{example}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <CodeTable
          title="Fornecedores"
          rows={suppliers.map((s) => ({ code: s.code, label: s.name }))}
        />
        <CodeTable title="Estilos" rows={toRows(STYLES)} />
        <CodeTable title="Cores" rows={toRows(COLORS)} />
        <CodeTable title="Padrões" rows={toRows(PATTERNS)} />
        <CodeTable
          title="Tamanhos"
          rows={SIZES.map((s) => ({ code: s === "Único" ? "U" : s, label: s }))}
        />
      </div>
    </div>
  );
}
