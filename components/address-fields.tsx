import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countryOptions, type AddressInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export function AddressFields<T extends AddressInput>({
  register,
  control,
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="street">{t.companies.street}</Label>
          <Input id="street" {...register("street" as never)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="house_number">{t.companies.houseNumber}</Label>
          <Input id="house_number" {...register("house_number" as never)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="postal_code">{t.companies.postalCode}</Label>
          <Input id="postal_code" {...register("postal_code" as never)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="city">{t.companies.city}</Label>
          <Input id="city" {...register("city" as never)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="country">{t.companies.country}</Label>
        <Controller
          control={control}
          name={"country" as never}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="country" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    countryOptions.find((option) => option.value === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </>
  );
}
