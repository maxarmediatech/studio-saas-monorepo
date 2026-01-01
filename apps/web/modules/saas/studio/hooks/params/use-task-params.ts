import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Options,
} from "nuqs";

export function useTaskParams(options?: Options) {
  const [params, setParams] = useQueryStates(
    {
      taskId: parseAsString,
      createTask: parseAsBoolean,
    },
    {
      history: "push",
      shallow: true,
      ...options,
    }
  );

  return {
    ...params,
    setParams,
    openCreate: () => setParams({ createTask: true, taskId: null }),
    openEdit: (id: string) => setParams({ taskId: id, createTask: null }),
    close: () => setParams({ taskId: null, createTask: null }),
  };
}
