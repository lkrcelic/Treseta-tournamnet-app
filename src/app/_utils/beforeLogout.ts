// Work that must finish while the session still exists, such as a save that is still waiting (Novo kolo saves a moment
// after a change); useLogout runs it before it logs out. A save that hangs doesn't hold the logout for long.
const LOGOUT_WAIT_MS = 3000;

const tasks = new Set<() => Promise<unknown>>();

// returns the function that takes the task off again
export function onBeforeLogout(task: () => Promise<unknown>): () => void {
  tasks.add(task);
  return () => {
    tasks.delete(task);
  };
}

export async function runBeforeLogout(waitMs: number = LOGOUT_WAIT_MS): Promise<void> {
  if (!tasks.size) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, waitMs)));
  await Promise.race([Promise.allSettled(Array.from(tasks, (task) => task())), timeout]);
  clearTimeout(timer);
}
