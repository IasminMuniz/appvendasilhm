import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  addProductAsset,
  removeProductAsset,
  setPrimaryProductImage,
} from "@/lib/products.functions";

export interface ProductImage {
  id: string;
  url: string;
  signedUrl: string;
  caption: string | null;
}

const MAX_MB = 8;

/** Fotos do produto: envio de várias imagens, foto principal e exclusão. */
export function ProductImages({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product", productId] });
    qc.invalidateQueries({ queryKey: ["product-primary-images"] });
  };

  const primary = useMutation({
    mutationFn: setPrimaryProductImage,
    onSuccess: () => {
      refresh();
      toast.success("Foto principal definida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: removeProductAsset,
    onSuccess: () => {
      refresh();
      toast.success("Foto excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let sent = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: não é uma imagem.`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name}: maior que ${MAX_MB} MB.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("product-assets")
          .upload(path, file, { contentType: file.type });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        await addProductAsset({
          data: { product_id: productId, kind: "image", url: path, name: file.name },
        });
        sent++;
      }
      if (sent) toast.success(sent === 1 ? "Foto enviada." : `${sent} fotos enviadas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
      refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Fotos</CardTitle>
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          {uploading ? "Enviando..." : "Adicionar fotos"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma foto ainda. A primeira foto enviada vira a foto principal.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={img.id} className="overflow-hidden rounded-md border">
                <div className="relative aspect-[3/4] bg-muted">
                  <img
                    src={img.signedUrl}
                    alt={img.caption ?? "Foto do produto"}
                    className="h-full w-full object-cover"
                  />
                  {i === 0 && <Badge className="absolute left-2 top-2">Principal</Badge>}
                </div>
                <div className="flex justify-between gap-1 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={i === 0 || primary.isPending}
                    onClick={() =>
                      primary.mutate({ data: { product_id: productId, image_id: img.id } })
                    }
                  >
                    <Star className="mr-1 h-3.5 w-3.5" />
                    Principal
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir foto"
                    disabled={remove.isPending}
                    onClick={() =>
                      confirm("Excluir esta foto?") &&
                      remove.mutate({ data: { id: img.id, kind: "image" } })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
