import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCars, activateCar, createCar, deleteCar } from "@/lib/api/sdk.gen";
import type { CreateCarRequest } from "@/lib/api/types.gen";

export function useCars() {
  return useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await listCars();
      if (error || !data) throw new Error("Failed to fetch cars");
      return data;
    },
  });
}

export function useActivateCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (carId: string) => {
      const { data, error } = await activateCar({ path: { car_id: carId } });
      if (error || !data) throw new Error("Failed to activate car");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useCreateCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateCarRequest) => {
      const { data, error } = await createCar({ body });
      if (error || !data) throw new Error("Failed to create car");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useDeleteCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (carId: string) => {
      const { data, error } = await deleteCar({ path: { car_id: carId } });
      if (error || !data) throw new Error("Failed to delete car");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
