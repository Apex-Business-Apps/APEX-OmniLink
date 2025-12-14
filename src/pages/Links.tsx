import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, ExternalLink, Star, Trash2, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { isValidRedirectUrl } from '@/lib/security';
import { logError } from '@/lib/monitoring';

const linkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  url: z.string().trim().url("Invalid URL format").max(2048, "URL must be less than 2048 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

type Link = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

const Links = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({
    title: '',
    url: '',
    description: '',
  });

  const { data: links = [], isLoading, error } = useQuery({
    queryKey: ['links', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Link[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    retry: 2,
    onError: (error) => {
      logError(error as Error, { action: 'links_fetch', userId: user?.id });
      toast({
        title: 'Error fetching links',
        description: error instanceof Error ? error.message : 'Failed to load links',
        variant: 'destructive',
      });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async (linkData: z.infer<typeof linkSchema>) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase.from('links').insert([{
        title: linkData.title,
        url: linkData.url,
        description: linkData.description || null,
        user_id: user.id,
      }]).select().single();

      if (error) throw error;
      return data as Link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', user?.id] });
      toast({ title: 'Link created successfully!' });
      setDialogOpen(false);
      setNewLink({ title: '', url: '', description: '' });
    },
    onError: (error) => {
      logError(error as Error, { action: 'link_create', userId: user?.id });
      toast({
        title: 'Error creating link',
        description: error instanceof Error ? error.message : 'Failed to create link',
        variant: 'destructive',
      });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', user?.id] });
      toast({ title: 'Link deleted successfully!' });
    },
    onError: (error) => {
      logError(error as Error, { action: 'link_delete', userId: user?.id });
      toast({
        title: 'Error deleting link',
        description: error instanceof Error ? error.message : 'Failed to delete link',
        variant: 'destructive',
      });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from('links')
        .update({ is_favorite: !isFavorite })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', user?.id] });
    },
    onError: (error) => {
      logError(error as Error, { action: 'link_toggle_favorite', userId: user?.id });
      toast({
        title: 'Error updating link',
        description: error instanceof Error ? error.message : 'Failed to update link',
        variant: 'destructive',
      });
    },
  });

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validation = linkSchema.safeParse(newLink);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      toast({
        title: 'Validation Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return;
    }

    createLinkMutation.mutate(validation.data);
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    deleteLinkMutation.mutate(id);
  };

  const toggleFavorite = async (link: Link) => {
    toggleFavoriteMutation.mutate({ id: link.id, isFavorite: link.is_favorite });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-destructive">
          <h2 className="text-xl font-semibold mb-2">Error loading links</h2>
          <p>{error instanceof Error ? error.message : 'Failed to load links'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Links</h1>
          <p className="text-muted-foreground">Manage your bookmarks and links</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Link</DialogTitle>
              <DialogDescription>Create a new link to save</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newLink.title}
                  onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newLink.description}
                  onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={createLinkMutation.isPending}
              >
                {createLinkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Link'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Card key={link.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{link.title}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavorite(link)}
                    disabled={toggleFavoriteMutation.isPending}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        link.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLink(link.id)}
                    disabled={deleteLinkMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {link.description && (
                <CardDescription>{link.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // Validate URL before opening to prevent open redirect attacks
                  if (!isValidRedirectUrl(link.url)) {
                    e.preventDefault();
                    toast({
                      title: 'Invalid URL',
                      description: 'This link cannot be opened for security reasons',
                      variant: 'destructive',
                    });
                  }
                }}
                className="flex items-center text-sm text-primary hover:underline"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Link
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {links.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No links yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Links;