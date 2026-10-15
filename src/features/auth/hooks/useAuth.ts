import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import { Profile } from "@/shared/types";

export function useUsers() {
  return useQuery<Profile[]>({
    queryKey: ["admin", "profiles"],
    queryFn: () => authService.getUsers(),
  });
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Partial<Profile> & { id: string }) => authService.saveManagedProfile(profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
  });
}
