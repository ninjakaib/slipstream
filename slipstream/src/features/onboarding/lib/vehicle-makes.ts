/**
 * Make lists for the "Add your vehicle" step, split by vehicle kind. Each list
 * is offered in a searchable picker; "Custom Make" lets the user type one in.
 */
export const CAR_MAKES: string[] = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Pagani", "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo",
];

export const BIKE_MAKES: string[] = [
  "Aprilia", "Arctic Cat", "Benelli", "Beta", "Bimota", "BMW Motorrad",
  "Can-Am", "CFMoto", "Ducati", "GasGas", "Harley-Davidson", "Honda",
  "Husqvarna", "Indian", "Kawasaki", "KTM", "Moto Guzzi", "MV Agusta",
  "Norton", "Royal Enfield", "Suzuki", "Triumph", "Vespa", "Yamaha", "Zero",
];

export function makesFor(kind: "car" | "bike"): string[] {
  return kind === "bike" ? BIKE_MAKES : CAR_MAKES;
}
