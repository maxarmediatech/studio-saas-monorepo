import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Options,
} from "nuqs";

export function useClientParams(options?: Options) {
  const [params, setParams] = useQueryStates(
    {
      clientId: parseAsString,
      createClient: parseAsBoolean,
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
    // Convenience methods
    openCreate: () => setParams({ createClient: true, clientId: null }),
    openEdit: (id: string) => setParams({ clientId: id, createClient: null }),
    close: () => setParams({ clientId: null, createClient: null }),
  };
}
