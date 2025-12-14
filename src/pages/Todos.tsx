import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

type Todo = {
  id: string;
  title?: string;
  task?: string;
};

const Todos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('todos').select('*');
        if (!isMounted) return;
        if (error) {
          setError(error.message);
          return;
        }
        if (data && data.length > 0) {
          setTodos(data as Todo[]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load todos');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (error) return <div className="p-6">Failed to load todos: {error}</div>;

  return (
    <div className="p-6 space-y-3">
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title ?? todo.task ?? JSON.stringify(todo)}</li>
      ))}
    </div>
  );
};

export default Todos;

