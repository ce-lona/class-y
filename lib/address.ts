interface Address {
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
}

export function formatAddress(address: Address): string | null {
  if (!address.street && !address.city) return null;
  return [
    [address.street, address.house_number].filter(Boolean).join(" "),
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}
