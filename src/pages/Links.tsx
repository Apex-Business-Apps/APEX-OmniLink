import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, ExternalLink, Star, Trash2 } from 'lucide-react';

type Link = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  is_favorite: boolean;
  clicks: number;
  created_at: string;
  updated_at: string;
};

const Links = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({
    title: '',
    url: '',
    description: '',
    category: '',
  });

  const fetchLinks = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error fetching links',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, [user]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('links').insert({
      ...newLink,
      user_id: user.id,
    });

    if (error) {
      toast({
        title: 'Error creating link',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Link created successfully!' });
      setDialogOpen(false);
      setNewLink({ title: '', url: '', description: '', category: '' });
      fetchLinks();
    }
  };

  const handleDeleteLink = async (id: string) => {
    const { error } = await supabase.from('links').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Error deleting link',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Link deleted successfully!' });
      fetchLinks();
    }
  };

  const toggleFavorite = async (link: Link) => {
    const { error } = await supabase
      .from('links')
      .update({ is_favorite: !link.is_favorite })
      .eq('id', link.id);

    if (error) {
      toast({
        title: 'Error updating link',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchLinks();
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

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
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={newLink.category}
                  onChange={(e) => setNewLink({ ...newLink, category: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">Create Link</Button>
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
                className="flex items-center text-sm text-primary hover:underline"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Link
              </a>
              {link.category && (
                <div className="mt-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    {link.category}
                  </span>
                </div>
              )}
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