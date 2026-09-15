"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategory } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "Food",
  "Beverage",
  "Cosmetics",
  "Household Goods",
  "Personal Care",
  "Electrical",
  "Other",
];

export interface ProductInfoValues {
  productName: string;
  category: ProductCategory | "";
  brand: string;
  batchNumber: string;
  location: string;
  notes: string;
}

interface ProductInfoFormProps {
  values: ProductInfoValues;
  onChange: (values: ProductInfoValues) => void;
}

export function ProductInfoForm({ values, onChange }: ProductInfoFormProps) {
  function set<K extends keyof ProductInfoValues>(key: K, value: ProductInfoValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="productName">Product name</Label>
        <Input
          id="productName"
          placeholder="e.g. Marie Gold"
          value={values.productName}
          onChange={(e) => set("productName", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Product category</Label>
        <Select value={values.category} onValueChange={(v) => set("category", v as ProductCategory)}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand">Brand</Label>
        <Input
          id="brand"
          placeholder="e.g. Britannia"
          value={values.brand}
          onChange={(e) => set("brand", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="batchNumber">Batch / Lot number</Label>
        <Input
          id="batchNumber"
          placeholder="e.g. BSC-22841"
          value={values.batchNumber}
          onChange={(e) => set("batchNumber", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Inspection location</Label>
        <Input
          id="location"
          placeholder="e.g. Andheri West, Mumbai"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional context for this inspection…"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </div>
  );
}
