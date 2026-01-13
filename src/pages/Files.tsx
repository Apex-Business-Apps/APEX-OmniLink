import { useCallback, useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Trash2, FileIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getUploadToken, uploadWithToken, listUserFiles, createDownloadUrl, deleteFile } from '@/lib/files';
import { useToast } from '@/hooks/use-toast';

const Files = () => {
  const [uid, setUid] = useState<string>("");
  const [items, setItems] = useState<unknown[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setUid(data.user.id);
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const { data, error } = await listUserFiles(uid);
      if (error) throw error;
      setItems(data ?? []);
    } catch (_error) {
      // Error logged via toast
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive"
      });
    }
  }, [uid, toast]);

  useEffect(() => {
    if (uid) refresh();
  }, [uid, refresh]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setUploading(true);
    try {
      const { path, token } = await getUploadToken(f.name, f.type, f.size);
      const { error } = await uploadWithToken(path, token, f);
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `${f.name} uploaded successfully`
      });

      await refresh();
      e.currentTarget.value = "";
    } catch (error: unknown) {
      // Error logged via toast
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(name: string) {
    try {
      const path = `${uid}/${name}`;
      const { data, error } = await createDownloadUrl(path, 60);
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: unknown) {
      // Error logged via toast
      toast({
        title: "Download failed",
        description: error.message || "Failed to download file",
        variant: "destructive"
      });
    }
  }

  async function onDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;

    try {
      const path = `${uid}/${name}`;
      const { error } = await deleteFile(path);
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `${name} deleted successfully`
      });

      await refresh();
    } catch (error: unknown) {
      // Error logged via toast
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive"
      });
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">Manage your files and documents</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No files yet. Upload your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((obj) => (
            <Card key={obj.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{obj.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatFileSize(obj.metadata?.size || 0)} • {new Date(obj.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDownload(obj.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(obj.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Files;