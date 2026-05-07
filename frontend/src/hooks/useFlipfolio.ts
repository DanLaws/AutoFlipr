import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete, type FlipEntry, type FlipIn } from "../api/client";

export function useFlipfolio() {
  const qc = useQueryClient();

  const { data: entries = [], isLoading } = useQuery<FlipEntry[]>({
    queryKey: ["flipfolio"],
    queryFn: () => apiFetch("/api/flipfolio"),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["flipfolio"] });
  }

  async function create(data: FlipIn): Promise<void> {
    await apiPost("/api/flipfolio", data);
    invalidate();
  }

  async function update(id: number, data: FlipIn): Promise<void> {
    await apiPut(`/api/flipfolio/${id}`, data);
    invalidate();
  }

  async function remove(id: number): Promise<void> {
    await apiDelete(`/api/flipfolio/${id}`);
    invalidate();
  }

  return { entries, isLoading, create, update, remove };
}
