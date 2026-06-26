export function formatCarName(car: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
}) {
  return `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
}
